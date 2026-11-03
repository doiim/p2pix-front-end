import {
  ContractFunctionRevertedError,
  decodeErrorResult,
  encodePacked,
  isHex,
  keccak256,
  type Address,
  type ContractFunctionArgs,
  type Hex,
} from 'viem';
import { p2PixAbi } from '@/blockchain/abi';
import { revertDataCandidates } from '@/blockchain/reputation';
import { UserFacingError, walletErrorMessage } from './walletPrompts';

/** The `PixProof` struct `release(lockID, proof)` takes, as the ABI types it. */
export type PixProof = ContractFunctionArgs<
  typeof p2PixAbi,
  'nonpayable',
  'release'
>[1];

/** The `proof` object the prover's `GET /release/:n` answers with. */
export interface RawProof {
  recipient: string;
  attestor: string;
  data: string;
  timestamp: number;
  additionParams: string;
  attConditions: string;
  signature: string;
}

export const toPixProof = (
  numeroSolicitacao: string,
  raw: RawProof,
): PixProof => ({
  numeroSolicitacao: BigInt(numeroSolicitacao),
  recipient: raw.recipient as Address,
  data: raw.data,
  timestamp: BigInt(raw.timestamp),
  additionParams: raw.additionParams,
  attConditions: raw.attConditions,
  attestor: raw.attestor as Address,
  signature: raw.signature as Hex,
});

/** The bank settings the contract rebuilds the attested request from. */
export interface BankConfig {
  solicitationUrlPrefix: string;
  solicitationUrlSuffix: string;
}

/** Mirrors `Constants.sol`: what the attestor was asked to reveal, in order. */
const PARSE_TYPE = '';
const RESOLVES: [string, string][] = [
  ['amount', '$.valorSolicitacao'],
  ['settled', '$.valorSomatorioPagamentosEfetivados'],
  ['payee', '$.repasse.recebedores[0].identificadorRecebedor'],
  ['txId', '$.informacoesPix.txId'],
  ['lock', '$.codigoConciliacaoSolicitacao'],
];

const packStrings = (parts: string[]): Hex =>
  keccak256(
    encodePacked(
      parts.map(() => 'string'),
      parts,
    ),
  );

/**
 * The digest the Primus attestor signed, rebuilt the way the contract does
 * (`PrimusAttestation.digest`): a raw keccak over the packed attestation, no
 * EIP-191 prefix. Nothing in `src/` runs a pre-check with it: that needs the
 * contract's own `bank` settings and its on-chain attestor allowlist. It is
 * the reference rebuild the release path must match, exercised by
 * `tests/blockchain/pixProof.test.ts`.
 */
export const pixProofDigest = (proof: PixProof, bank: BankConfig): Hex => {
  const urls = [
    `${bank.solicitationUrlPrefix}${proof.numeroSolicitacao}${bank.solicitationUrlSuffix}`,
  ];
  const requestHash = packStrings(urls.flatMap((url) => [url, '', 'GET', '']));
  const resolvesHash = packStrings(
    RESOLVES.flatMap(([key, path]) => [key, PARSE_TYPE, path]),
  );
  return keccak256(
    encodePacked(
      ['address', 'bytes32', 'bytes32', 'string', 'string', 'uint64', 'string'],
      [
        proof.recipient,
        requestHash,
        resolvesHash,
        proof.data,
        proof.attConditions,
        proof.timestamp,
        proof.additionParams,
      ],
    ),
  );
};

/** What the buyer reads when `release` reverts, by the contract's own error. */
const RELEASE_ERRORS: Record<string, string> = {
  ProofExpired:
    'A prova de pagamento venceu. Busque uma nova prova e envie novamente.',
  InvalidAttestor: 'O atestador desta prova não é aceito pelo contrato.',
  PixTargetMismatch: 'O Pix foi pago a outra chave, não à deste lock.',
  AlreadyReleased: 'Este lock já foi liberado.',
  LockExpired: 'Este lock expirou.',
  MalformedProof: 'A prova de pagamento está malformada.',
};

/** The connected account is not the buyer of the lock being released. */
export class NotLockBuyerError extends UserFacingError {
  constructor() {
    super('A carteira conectada não é a compradora desta reserva.');
    this.name = 'NotLockBuyerError';
  }
}

/** The error and its `cause` chain, outermost first (bounded). */
const causeChain = (err: unknown): unknown[] => {
  const causes: unknown[] = [];
  for (let e = err; e !== undefined && causes.length < 10; ) {
    causes.push(e);
    e = e instanceof Error ? e.cause : undefined;
  }
  return causes;
};

/**
 * The contract error named by revert data found anywhere in the chain. The
 * smart-account rail has no ContractFunctionRevertedError: the bundler's
 * estimation error carries the bytes instead.
 */
const decodedRevertName = (causes: unknown[]): string | undefined =>
  causes
    .filter(
      (cause): cause is object => typeof cause === 'object' && cause !== null,
    )
    .flatMap(revertDataCandidates)
    .filter((data) => isHex(data))
    .map((data) => {
      try {
        return decodeErrorResult({ abi: p2PixAbi, data }).errorName;
      } catch {
        return undefined; // Not one of the contract's errors.
      }
    })
    .find((name) => name !== undefined && name in RELEASE_ERRORS);

/**
 * The pt-BR message to show when submitting the release fails: the contract's
 * revert decoded into words, our own sentence or a cancelled wallet prompt
 * (`walletErrorMessage`), or a generic sentence. The raw error (English) stays
 * in the console, never in the toast.
 */
export const releaseErrorMessage = (err: unknown): string => {
  const causes = causeChain(err);
  const revert = causes.find((e) => e instanceof ContractFunctionRevertedError);
  const name =
    (revert instanceof ContractFunctionRevertedError
      ? revert.data?.errorName
      : undefined) ?? decodedRevertName(causes);
  if (name && RELEASE_ERRORS[name]) return RELEASE_ERRORS[name];
  const walletSide = causes
    .map((cause) => walletErrorMessage(cause, ''))
    .find(Boolean);
  if (walletSide) return walletSide;
  console.error('Release failed:', err);
  return 'Não foi possível enviar para a rede.';
};

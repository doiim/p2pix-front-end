import {
  BaseError,
  ContractFunctionRevertedError,
  encodePacked,
  keccak256,
  type Address,
  type ContractFunctionArgs,
  type Hex,
} from 'viem';
import { p2PixAbi } from '@/blockchain/abi';

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

/**
 * The message to show when submitting the release fails: the contract's
 * revert decoded into words, viem's short message for any other RPC or
 * wallet failure, the error's own message otherwise.
 */
export const releaseErrorMessage = (err: unknown): string => {
  if (!(err instanceof BaseError)) {
    return err instanceof Error ? err.message : String(err);
  }
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  const name =
    revert instanceof ContractFunctionRevertedError
      ? revert.data?.errorName
      : undefined;
  // One line: viem puts the revert signature on its own line.
  return (
    (name && RELEASE_ERRORS[name]) || err.shortMessage.replace(/\n+/g, ' ')
  );
};

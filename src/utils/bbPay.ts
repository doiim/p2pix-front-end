import type { Address } from 'viem';
import { toPixProof, type PixProof, type RawProof } from './pixProof';

export interface Participant {
  offer: string;
  chainID: number;
  identification: string;
  bankIspb?: string;
  accountType: string;
  account: string;
  branch: string;
  savingsVariation?: string;
}

interface ParticipantWithID extends Participant {
  id: string;
}

export interface Offer {
  amount: number;
  /** `<chainId>-<numeroParticipante>`, as stored in the deposit's pixTarget. */
  sellerId: string;
  /** The lock this charge settles; the proof of Pix payment is bound to it. */
  lockID: bigint;
  chainId: number;
}

/** The charge the buyer must pay. */
export interface Solicitation {
  numeroSolicitacao: string;
  /** Bacen EMV "copia e cola" payload. */
  textoQrCode?: string;
  /** When the prover stops accepting payment; absent on an older prover. Stored as an ISO string. */
  timestampLimiteSolicitacao?: Date;
}

/** An ISO-8601 string from the prover or storage; anything else is ignored. */
const toLimit = (value: unknown): Date | undefined => {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const solicitationKey = (
  chainId: number,
  p2pix: Address,
  lockID: bigint,
): string => `p2pix.solicitation.${chainId}.${p2pix.toLowerCase()}.${lockID}`;

/**
 * The charge already created for this lock on this network, if any. Kept in
 * localStorage so a reload, a revert or a later visit reuses it: a lock whose
 * fiat leg was paid must never be charged twice.
 */
export const loadSolicitation = (
  chainId: number,
  p2pix: Address,
  lockID: bigint,
): Solicitation | null => {
  try {
    const raw = localStorage.getItem(solicitationKey(chainId, p2pix, lockID));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const numero =
      'numeroSolicitacao' in parsed ? parsed.numeroSolicitacao : undefined;
    const texto = 'textoQrCode' in parsed ? parsed.textoQrCode : undefined;
    if (typeof numero !== 'string' || numero === '') return null;
    if (texto !== undefined && typeof texto !== 'string') return null;
    return {
      numeroSolicitacao: numero,
      textoQrCode: texto,
      timestampLimiteSolicitacao: toLimit(
        'timestampLimiteSolicitacao' in parsed
          ? parsed.timestampLimiteSolicitacao
          : undefined,
      ),
    };
  } catch {
    return null;
  }
};

export const saveSolicitation = (
  chainId: number,
  p2pix: Address,
  lockID: bigint,
  solicitation: Solicitation,
): void => {
  try {
    localStorage.setItem(
      solicitationKey(chainId, p2pix, lockID),
      JSON.stringify(solicitation),
    );
  } catch {
    // Storage unavailable: the charge still lives in the component state.
  }
};

/** Forget the stored charge of an expired one so the next read posts a new request. */
export const clearSolicitation = (
  chainId: number,
  p2pix: Address,
  lockID: bigint,
): void => {
  try {
    localStorage.removeItem(solicitationKey(chainId, p2pix, lockID));
  } catch {
    // Storage unavailable: nothing was stored.
  }
};

// Specs for BB Pay Sandbox
// https://apoio.developers.bb.com.br/sandbox/spec/665797498bb48200130fc32c

const API_URL =
  import.meta.env.VITE_PIX_API_URL ||
  (import.meta.env.VITE_APP_ENV === 'production'
    ? 'https://api.p2pix.co'
    : 'https://demo.api.p2pix.co');

export const createParticipant = async (participant: Participant) => {
  const response = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chainID: participant.chainID,
      tipoDocumento: 1,
      numeroDocumento: participant.identification,
      numeroConta: participant.account,
      numeroAgencia: participant.branch,
      tipoConta: participant.accountType,
      codigoIspb: participant.bankIspb,
    }),
  });
  if (!response.ok) {
    throw new Error(`Error creating participant: ${response.statusText}`);
  }
  const data = await response.json();
  if (data.errors || data.erros) {
    throw new Error(`Error creating participant: ${JSON.stringify(data)}`);
  }
  return { ...participant, id: data.numeroParticipante } as ParticipantWithID;
};

export const createSolicitation = async (
  offer: Offer,
): Promise<Solicitation> => {
  const response = await fetch(`${API_URL}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: offer.amount,
      pixTarget: offer.sellerId.split('-').pop(),
      lockId: offer.lockID.toString(),
      chainId: offer.chainId,
    }),
  });
  if (!response.ok) {
    throw new Error(`Error creating solicitation: ${response.status}`);
  }
  const data = await response.json();
  // A missing number would otherwise poll `GET /release/undefined` forever.
  if (data.numeroSolicitacao === undefined || data.numeroSolicitacao === null)
    throw new Error('Unexpected /request answer');
  return {
    numeroSolicitacao: String(data.numeroSolicitacao),
    textoQrCode:
      data.textoQrCode ??
      data.informacoesPix?.textoQrCode ??
      data.informacoesPIX?.textoQrCode,
    timestampLimiteSolicitacao: toLimit(data.timestampLimiteSolicitacao),
  };
};

/**
 * Where the prover stands on a charge: `waiting` (402, or 503 retry: not paid
 * yet), `proving` (202: payment received, proof being produced), `ready`
 * (200: the proof `release` takes) or `unreachable` (502: the bank could not
 * be asked right now; keep polling) or `expired` (410: the charge was not paid
 * and passed its limit; only a newer prover sends it). Any other failure throws.
 */
export type ReleaseStatus =
  | { status: 'waiting' | 'proving' | 'unreachable' | 'expired' }
  | { status: 'ready'; proof: PixProof };

const hasStatus = (body: unknown, status: string): boolean =>
  typeof body === 'object' &&
  body !== null &&
  'status' in body &&
  body.status === status;

export const getSolicitation = async (
  numeroSolicitacao: string,
): Promise<ReleaseStatus> => {
  const response = await fetch(`${API_URL}/release/${numeroSolicitacao}`);
  if ([402, 503].includes(response.status)) return { status: 'waiting' };
  if (response.status === 502) return { status: 'unreachable' };
  if (response.status === 202) {
    // Only the documented body counts as "proving"; anything else is not a claim of payment.
    const body: unknown = await response.json().catch(() => null);
    return { status: hasStatus(body, 'proving') ? 'proving' : 'waiting' };
  }
  if (response.status === 410) {
    const body: unknown = await response.json().catch(() => null);
    if (hasStatus(body, 'expired')) return { status: 'expired' };
  }
  if (!response.ok) {
    throw new Error(`Error checking solicitation: ${response.status}`);
  }
  const obj = await response.json();
  if (!obj.proof) throw new Error('Unexpected /release answer');
  return {
    status: 'ready',
    proof: toPixProof(
      String(obj.numeroSolicitacao ?? numeroSolicitacao),
      obj.proof as RawProof,
    ),
  };
};

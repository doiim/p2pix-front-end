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
}

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
  return {
    numeroSolicitacao: String(data.numeroSolicitacao),
    textoQrCode:
      data.textoQrCode ??
      data.informacoesPix?.textoQrCode ??
      data.informacoesPIX?.textoQrCode,
  };
};

/**
 * The proof of Pix payment `release` takes. Resolves `null` while there is
 * nothing to submit yet: the bank has not confirmed the payment (402), the
 * proof is still being produced (202) or the prover asked for a retry (503).
 * Throws on any other failure.
 */
export const getSolicitation = async (
  numeroSolicitacao: string,
): Promise<PixProof | null> => {
  const response = await fetch(`${API_URL}/release/${numeroSolicitacao}`);
  if ([202, 402, 503].includes(response.status)) return null;
  if (!response.ok) {
    throw new Error(`Error checking solicitation: ${response.status}`);
  }
  const obj = await response.json();
  if (!obj.proof) throw new Error('Unexpected /release answer');
  return toPixProof(
    String(obj.numeroSolicitacao ?? numeroSolicitacao),
    obj.proof as RawProof,
  );
};

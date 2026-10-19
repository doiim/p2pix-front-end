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
  sellerId: string;
  chainID: number;
  lockID: string;
}

// Specs for BB Pay Sandbox
// https://apoio.developers.bb.com.br/sandbox/spec/665797498bb48200130fc32c

const API_URL =
  import.meta.env.VITE_APP_ENV === 'production'
    ? 'https://api.p2pix.co'
    : 'https://demo.api.p2pix.co';

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

export const createSolicitation = async (offer: Offer) => {
  const response = await fetch(`${API_URL}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: offer.amount,
      pixTarget: offer.sellerId.split('-').pop(),
      // `amount` is in tokens; the backend prices any token but BRZ from the
      // lock itself.
      chainID: offer.chainID,
      lockID: offer.lockID,
    }),
  });
  return response.json();
};

/**
 * R$ per whole unit, keyed by token symbol. Display only: no signed or paid
 * amount is ever derived from these.
 */
export const getPrices = async (): Promise<Record<string, number>> => {
  const response = await fetch(`${API_URL}/prices`);
  if (!response.ok) {
    throw new Error(`Error fetching prices: ${response.statusText}`);
  }
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null) {
    throw new Error('Prices response is not an object');
  }
  return Object.fromEntries(
    Object.entries(data).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]) &&
        entry[1] > 0,
    ),
  );
};

export const getSolicitation = async (
  id: bigint,
): Promise<{ pixTimestamp: `0x${string}`; signature: `0x${string}` }> => {
  const response = await fetch(`${API_URL}/release/${id}`);

  const obj = await response.json();

  return {
    pixTimestamp: obj.pixTimestamp,
    signature: obj.signature,
  };
};

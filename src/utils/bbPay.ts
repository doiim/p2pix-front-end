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

export interface ParticipantWithID extends Participant {
  id: string;
}

export interface Offer {
  amount: number;
  sellerId: string;
}

// Specs for BB Pay Sandbox
// https://apoio.developers.bb.com.br/sandbox/spec/665797498bb48200130fc32c

export const createParticipant = async (participant: Participant) => {
  const response = await fetch(`${import.meta.env.VITE_APP_API_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
  const response = await fetch(`${import.meta.env.VITE_APP_API_URL}/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: offer.amount,
      pixTarget: offer.sellerId.split("-").pop(),
    }),
  });
  return response.json();
};

export const getSolicitation = async (id: bigint): Promise<{pixTimestamp: `0x${string}`, signature: `0x${string}`}> => {
  const response = await fetch(
    `${import.meta.env.VITE_APP_API_URL}/release/${id}`
  );

  const obj = await response.json();

  return {
    pixTimestamp: obj.pixTimestamp,
    signature: obj.signature,
  };
};

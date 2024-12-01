export interface Participant {
  offer: string;
  fullName: string;
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
  sellerID: string;
}

export const createParticipant = async (participant: Participant) => {
  const response = await fetch(`${process.env.VUE_APP_API_URL}/participants`, {
    method: "PUT",
    body: JSON.stringify(participant),
  });
  const data = await response.json();
  return { ...participant, id: data.id } as ParticipantWithID;
};

export const createSolicitation = async (offer: Offer) => {
  const response = await fetch(`${process.env.VUE_APP_API_URL}/solicitation`, {
    method: "POST",
    body: JSON.stringify(offer),
  });
  return response.json();
};

export const getSolicitation = async (id: string) => {
  const response = await fetch(
    `${process.env.VUE_APP_API_URL}/solicitation/${id}`
  );
  return response.json();
};

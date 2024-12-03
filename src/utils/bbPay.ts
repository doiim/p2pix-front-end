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
  lockId: string;
  sellerId: string;
}

// Specs for BB Pay Sandbox
// https://apoio.developers.bb.com.br/sandbox/spec/665797498bb48200130fc32c

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

  const obj: any = response.json();

  return {
    id: obj.numeroSolicitacao,
    lockId: obj.codigoConciliacaoSolicitacao,
    amount: obj.valorSolicitacao,
    qrcode: obj.pix.textoQrCode,
    status: obj.valorSomatorioPagamentosEfetivados >= obj.valorSolicitacao,
    signature: obj.assinatura,
  };
};

import { bytesToHex, isHex, size, type Address, type Hex } from 'viem';

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
  orderId: Hex;
  lockId: string;
  chainId: number;
  contractAddress: Address;
  buyer: Address;
  seller: Address;
  token: Address;
}

export type FirstLockAuthorizationRequest = {
  orderId: Hex;
  chainId: number;
  sender: Address;
  contractAddress: Address;
  seller: Address;
  token: Address;
  amount: string;
};

export type FirstLockAuthorization =
  | {
      eligible: true;
      orderId: Hex;
      authorizationId: string;
      expiresAtMs: number;
    }
  | {
      eligible: false;
      orderId: Hex;
      reason: string;
    };

export type ReleaseAuthorization = {
  pixTimestamp: Hex;
  deadline: bigint;
  signature: Hex;
};

const isBytes32 = (value: unknown): value is Hex =>
  typeof value === 'string' &&
  isHex(value, { strict: true }) &&
  size(value) === 32;

/** Generate the idempotency key that is permanently bound to one P2Pix lock. */
export const createOrderId = (): Hex => {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};

/**
 * Ask the authenticated backend/ledger whether this exact order may consume
 * the one-time first-lock sponsorship. Only a well-formed authoritative
 * `eligible:false` response may select the paid rail. Transport, HTTP, schema
 * or expiry failures throw and block the purchase before the PIX exists.
 */
export const requestFirstLockAuthorization = async (
  request: FirstLockAuthorizationRequest,
): Promise<FirstLockAuthorization> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_APP_API_URL}/aa/first-lock-authorization`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
    if (!response.ok) {
      throw new Error(
        `First-lock authorization failed: HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (
      !isBytes32(data.orderId) ||
      data.orderId.toLowerCase() !== request.orderId.toLowerCase()
    ) {
      throw new Error('First-lock authorization returned a mismatched orderId');
    }
    if (
      data.eligible === false &&
      typeof data.reason === 'string' &&
      data.reason.length > 0
    ) {
      return {
        eligible: false,
        orderId: data.orderId,
        reason: data.reason,
      };
    }
    if (data.eligible !== true) {
      throw new Error(
        'First-lock authorization returned an invalid eligibility decision',
      );
    }

    if (
      typeof data.authorizationId !== 'string' ||
      data.authorizationId.length === 0 ||
      typeof data.expiresAtMs !== 'number' ||
      !Number.isSafeInteger(data.expiresAtMs) ||
      data.expiresAtMs <= Date.now()
    ) {
      throw new Error('First-lock authorization is malformed or expired');
    }

    return {
      eligible: true,
      orderId: data.orderId,
      authorizationId: data.authorizationId,
      expiresAtMs: data.expiresAtMs,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('First-lock authorization')
    ) {
      throw error;
    }
    throw new Error('First-lock authorization service unavailable', {
      cause: error,
    });
  }
};

// Specs for BB Pay Sandbox
// https://apoio.developers.bb.com.br/sandbox/spec/665797498bb48200130fc32c

export const createParticipant = async (participant: Participant) => {
  const response = await fetch(`${import.meta.env.VITE_APP_API_URL}/register`, {
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
  const response = await fetch(`${import.meta.env.VITE_APP_API_URL}/request`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: offer.amount,
      pixTarget: offer.sellerId.split('-').pop(),
      orderId: offer.orderId,
      lockId: offer.lockId,
      chainId: offer.chainId,
      contractAddress: offer.contractAddress,
      buyer: offer.buyer,
      seller: offer.seller,
      token: offer.token,
    }),
  });
  if (!response.ok) {
    throw new Error(`Error creating PIX solicitation: ${response.statusText}`);
  }
  return response.json();
};

export const getSolicitation = async (
  id: bigint,
): Promise<ReleaseAuthorization> => {
  const response = await fetch(
    `${import.meta.env.VITE_APP_API_URL}/release/${id}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    throw new Error(`Error reading PIX solicitation: ${response.statusText}`);
  }

  const obj = (await response.json()) as Record<string, unknown>;
  const deadline =
    typeof obj.deadline === 'string' || typeof obj.deadline === 'number'
      ? BigInt(obj.deadline)
      : 0n;

  if (
    !isBytes32(obj.pixTimestamp) ||
    typeof obj.signature !== 'string' ||
    !isHex(obj.signature, { strict: true }) ||
    size(obj.signature) === 0 ||
    deadline <= BigInt(Math.floor(Date.now() / 1000))
  ) {
    throw new Error('Malformed or expired P2Pix release authorization');
  }

  return {
    pixTimestamp: obj.pixTimestamp,
    deadline,
    signature: obj.signature as Hex,
  };
};

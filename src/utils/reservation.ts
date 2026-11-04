import type { Address } from 'viem';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { shortAddress } from './shortAddress';

const tokenSymbol = (network: NetworkConfig, token: Address): string => {
  const known = [
    { symbol: 'BRZ', address: network.tokens.BRZ.address },
    ...(network.swap?.tokens ?? []),
  ].find((t) => t.address?.toLowerCase() === token.toLowerCase());
  return known?.symbol ?? shortAddress(token, 6, '…');
};

/** "R$ 5,00 · 5,00 BRZ · Arbitrum One · Reserva #4". The token is paid 1:1 in BRL. */
export const reservationLabel = (
  network: NetworkConfig,
  lock: { lockID: string; amount: number; token: Address },
): string =>
  [
    lock.amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }),
    `${lock.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${tokenSymbol(network, lock.token)}`,
    network.name,
    `Reserva #${lock.lockID}`,
  ].join(' · ');

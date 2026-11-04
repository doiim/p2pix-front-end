import { describe, expect, it } from 'vitest';
import { sepolia } from 'viem/chains';
import { reservationLabel } from '@/utils/reservation';
import type { NetworkConfig } from '@/model/NetworkEnum';

const BRZ = '0xC40356e14842e951A2A1F156d5be28cC6E4C2697';
const network = {
  ...sepolia,
  tokens: { BRZ: { address: BRZ } },
  subgraphUrls: [],
} as NetworkConfig;

describe('reservationLabel', () => {
  it('names amount, token, network and lock', () => {
    const label = reservationLabel(network, {
      lockID: '4',
      amount: 5,
      token: BRZ,
    }).replace(/ /g, ' ');
    expect(label).toBe('R$ 5,00 · 5,00 BRZ · Sepolia · Reserva #4');
  });
});

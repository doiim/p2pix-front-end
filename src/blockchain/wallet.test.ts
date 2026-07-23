import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther, type Address, type Hex } from 'viem';
import { LockStatus } from '@/model/LockStatus';

const mocks = vi.hoisted(() => ({
  getContract: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock('@wagmi/core', () => ({ getAccount: vi.fn() }));
vi.mock('@/config/appkit', () => ({ getWagmiConfig: vi.fn() }));
vi.mock('@/composables/useUser', () => ({ useUser: mocks.useUser }));
vi.mock('./aaAccount', () => ({ getEffectiveWalletAddress: vi.fn() }));
vi.mock('./events', () => ({
  getUnreleasedLockById: vi.fn(),
  getValidDeposits: vi.fn(),
}));
vi.mock('./provider', () => ({
  getContract: mocks.getContract,
  getPublicClient: vi.fn(),
}));

import { getActiveLockAmount } from './wallet';

const P2PIX = `0x${'1'.repeat(40)}` as Address;
const TOKEN = `0x${'2'.repeat(40)}` as Address;
const BUYER = `0x${'3'.repeat(40)}` as Address;
const SELLER = `0x${'4'.repeat(40)}` as Address;
const ORDER_ID = `0x${'5'.repeat(64)}` as Hex;
const PIX_TARGET = `0x${'6'.repeat(64)}` as Hex;

const lockTuple = (lockID: bigint, amount: bigint) =>
  [
    lockID,
    ORDER_ID,
    10_000n,
    PIX_TARGET,
    amount,
    TOKEN,
    BUYER,
    SELLER,
  ] as const;

const mockSellerLocks = (lockIDs: readonly bigint[]) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: {
          lockAddeds: lockIDs.map((lockID, index) => ({
            buyer: BUYER,
            lockID: lockID.toString(),
            seller: SELLER,
            amount: '1',
            blockTimestamp: '1',
            blockNumber: String(index + 1),
            transactionHash: `0x${String(index + 1).padStart(64, '0')}`,
          })),
        },
      }),
    }),
  );
};

const mockContract = (
  sortedIDs: readonly bigint[],
  statuses: readonly LockStatus[],
) => {
  const readContract = vi.fn(
    async ({
      functionName,
      args,
    }: {
      functionName: string;
      args: readonly unknown[];
    }) => {
      if (functionName === 'getLocksStatus') return [sortedIDs, statuses];
      if (functionName === 'mapLocks') {
        return lockTuple(args[0] as bigint, parseEther('1'));
      }
      throw new Error(`Unexpected readContract call: ${functionName}`);
    },
  );
  const multicall = vi.fn();

  mocks.getContract.mockResolvedValue({
    address: P2PIX,
    abi: [],
    client: { readContract, multicall },
  });

  return { readContract, multicall };
};

describe('getActiveLockAmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.useUser.mockReturnValue({
      network: { value: { subgraphUrls: ['https://subgraph.test'] } },
    });
  });

  it('uses sorted lock IDs instead of treating status values as IDs', async () => {
    const subgraphIDs = [91n, 92n, 93n];
    const sortedIDs = [703n, 701n, 702n];
    const statuses = [
      LockStatus.Expired,
      LockStatus.Active,
      LockStatus.Released,
    ];
    mockSellerLocks(subgraphIDs);
    const { multicall } = mockContract(sortedIDs, statuses);
    multicall.mockImplementation(
      async ({ contracts }: { contracts: unknown[] }) => {
        expect(contracts).toEqual(
          sortedIDs.map((id) => ({
            address: P2PIX,
            abi: [],
            functionName: 'mapLocks',
            args: [id],
          })),
        );
        return sortedIDs.map((id) => ({
          status: 'success',
          result: lockTuple(id, parseEther('1')),
        }));
      },
    );

    await expect(getActiveLockAmount(SELLER)).resolves.toBe(1);
  });

  it('builds multicall descriptors without eagerly starting readContract calls', async () => {
    const sortedIDs = [401n];
    mockSellerLocks(sortedIDs);
    const { readContract, multicall } = mockContract(sortedIDs, [
      LockStatus.Active,
    ]);
    multicall.mockImplementation(
      async ({ contracts }: { contracts: unknown[] }) => {
        expect(readContract).toHaveBeenCalledTimes(1);
        expect(contracts[0]).toEqual({
          address: P2PIX,
          abi: [],
          functionName: 'mapLocks',
          args: [sortedIDs[0]],
        });
        expect(contracts[0]).not.toBeInstanceOf(Promise);
        return [
          {
            status: 'success',
            result: lockTuple(sortedIDs[0], parseEther('1')),
          },
        ];
      },
    );

    await expect(getActiveLockAmount(SELLER)).resolves.toBe(1);

    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it('decodes multicall results and sums the v2 tuple amount only for active locks', async () => {
    const sortedIDs = [501n, 502n, 503n];
    mockSellerLocks(sortedIDs);
    const { multicall } = mockContract(sortedIDs, [
      LockStatus.Active,
      LockStatus.Active,
      LockStatus.Expired,
    ]);
    multicall.mockResolvedValue([
      {
        status: 'success',
        result: lockTuple(sortedIDs[0], parseEther('2.5')),
      },
      {
        status: 'failure',
        error: new Error('RPC failure'),
      },
      {
        status: 'success',
        result: lockTuple(sortedIDs[2], parseEther('99')),
      },
    ]);

    await expect(getActiveLockAmount(SELLER)).resolves.toBe(2.5);
  });
});

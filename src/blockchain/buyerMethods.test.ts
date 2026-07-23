import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseUnits,
  type Address,
  type Hex,
  type Log,
} from 'viem';

const mocks = vi.hoisted(() => ({
  getActiveAaContext: vi.fn(),
  getContract: vi.fn(),
  createOrderId: vi.fn(),
  requestFirstLockAuthorization: vi.fn(),
  assertErc20PaymasterTokenSupported: vi.fn(),
  prepareErc20PaymasterQuote: vi.fn(),
  sendPreparedErc20UserOperation: vi.fn(),
}));

vi.mock('./provider', () => ({ getContract: mocks.getContract }));
vi.mock('./aaAccount', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./aaAccount')>()),
  getActiveAaContext: mocks.getActiveAaContext,
}));
vi.mock('@/utils/bbPay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/bbPay')>()),
  createOrderId: mocks.createOrderId,
  requestFirstLockAuthorization: mocks.requestFirstLockAuthorization,
}));
vi.mock('./erc20Paymaster', () => ({
  assertErc20PaymasterTokenSupported: mocks.assertErc20PaymasterTokenSupported,
  prepareErc20PaymasterQuote: mocks.prepareErc20PaymasterQuote,
  sendPreparedErc20UserOperation: mocks.sendPreparedErc20UserOperation,
}));

import {
  assertLockAcceptableForPix,
  getLockIdFromLogs,
  pixSettlementSafetyBlocks,
  prepareLock,
  prepareRelease,
  reserveLockIntent,
  clearLockIntent,
  submitLock,
  submitRelease,
  type P2PixLock,
} from './buyerMethods';

const BUYER = `0x${'1'.repeat(40)}` as Address;
const SELLER = `0x${'2'.repeat(40)}` as Address;
const TOKEN = `0x${'3'.repeat(40)}` as Address;
const P2PIX = `0x${'4'.repeat(40)}` as Address;
const ORDER = `0x${'5'.repeat(64)}` as Hex;
const OTHER_ORDER = `0x${'9'.repeat(64)}` as Hex;
const USER_OP_HASH = `0x${'6'.repeat(64)}` as Hex;
const TX_HASH = `0x${'7'.repeat(64)}` as Hex;

const makeStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

let testStorage: Storage;

const abi = [
  {
    type: 'function',
    name: 'lock',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'seller', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint80' },
      { name: 'merkleProof', type: 'bytes32[]' },
      { name: 'expiredLocks', type: 'uint256[]' },
    ],
    outputs: [{ name: 'lockID', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'release',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'lockID', type: 'uint256' },
      { name: 'pixTimestamp', type: 'bytes32' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'LockAdded',
    inputs: [
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: true, name: 'lockID', type: 'uint256' },
      { indexed: true, name: 'orderId', type: 'bytes32' },
      { indexed: false, name: 'seller', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
] as const;

const lockTuple = (lockID = 11n) =>
  [
    lockID,
    ORDER,
    20_000n,
    `0x${'8'.repeat(64)}`,
    1_000_000_000_000_000_000n,
    TOKEN,
    BUYER,
    SELLER,
  ] as const;

const lockLog = (lockID = 11n, orderId = ORDER): Log =>
  ({
    address: P2PIX,
    data: encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [SELLER, 1_000_000_000_000_000_000n],
    ),
    topics: encodeEventTopics({
      abi,
      eventName: 'LockAdded',
      args: { buyer: BUYER, lockID, orderId },
    }),
  }) as Log;

const makeContract = (existingLockID = 0n, decimals = 18) => {
  const readContract = vi.fn(async ({ functionName }) => {
    if (functionName === 'lockIdByBuyerOrderId') return existingLockID;
    if (functionName === 'mapLocks') return lockTuple(existingLockID || 11n);
    if (functionName === 'decimals') return decimals;
    throw new Error(`unexpected read ${functionName}`);
  });
  return {
    address: P2PIX,
    abi,
    wallet: null,
    account: BUYER,
    client: {
      chain: { id: 1 },
      readContract,
      getBlockNumber: vi.fn().mockResolvedValue(1_000n),
      getChainId: vi.fn().mockResolvedValue(1),
    },
  };
};

const makeAa = () => {
  const sponsoredClient = {
    sendUserOperation: vi.fn().mockResolvedValue(USER_OP_HASH),
    waitForUserOperationReceipt: vi.fn().mockResolvedValue({
      success: true,
      receipt: { logs: [lockLog()], transactionHash: TX_HASH },
    }),
  };
  const erc20Client = {
    waitForUserOperationReceipt: vi.fn().mockResolvedValue({
      success: true,
      receipt: { logs: [lockLog()], transactionHash: TX_HASH },
    }),
  };
  return {
    account: { address: BUYER },
    network: { id: 1 },
    sponsoredClient,
    erc20Client,
  };
};

describe('P2Pix AA purchase flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testStorage = makeStorage();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: testStorage,
    });
    mocks.createOrderId.mockReturnValue(ORDER);
    mocks.assertErc20PaymasterTokenSupported.mockResolvedValue(undefined);
    mocks.getContract.mockImplementation(async () => makeContract());
  });

  it('uses chain-specific PIX settlement safety windows', () => {
    expect(pixSettlementSafetyBlocks(42161)).toBe(3_600n);
    expect(pixSettlementSafetyBlocks(1)).toBe(300n);
  });

  it('persists the same orderId across reloads and confirmation cancellation', () => {
    mocks.createOrderId
      .mockReturnValueOnce(ORDER)
      .mockReturnValueOnce(OTHER_ORDER);
    const context = {
      seller: SELLER,
      token: TOKEN,
      amount: '1000000000000000000',
      chainId: 1,
      account: BUYER,
      contractAddress: P2PIX,
    };

    const first = reserveLockIntent(context, testStorage, 1_000);
    const afterReload = reserveLockIntent(context, testStorage, 2_000);

    expect(afterReload.orderId).toBe(first.orderId);
    expect(mocks.createOrderId).toHaveBeenCalledOnce();
  });

  it('rotates persisted orderId only when intent context changes or expires', () => {
    mocks.createOrderId
      .mockReturnValueOnce(ORDER)
      .mockReturnValueOnce(OTHER_ORDER);
    const context = {
      seller: SELLER,
      token: TOKEN,
      amount: '1000000000000000000',
      chainId: 1,
      account: BUYER,
      contractAddress: P2PIX,
    };

    const first = reserveLockIntent(context, testStorage, 1_000);
    const changed = reserveLockIntent(
      { ...context, amount: '2000000000000000000' },
      testStorage,
      2_000,
    );

    expect(changed.orderId).not.toBe(first.orderId);
    expect(clearLockIntent(first.orderId, testStorage)).toBe(false);
    expect(clearLockIntent(changed.orderId, testStorage)).toBe(true);
  });

  it('matches LockAdded by contract, buyer and orderId', () => {
    expect(getLockIdFromLogs(abi, [lockLog(9n)], BUYER, ORDER, P2PIX)).toBe(9n);
    expect(() =>
      getLockIdFromLogs(
        abi,
        [lockLog(9n, `0x${'9'.repeat(64)}`)],
        BUYER,
        ORDER,
        P2PIX,
      ),
    ).toThrow(/buyer\/order/);
  });

  it('blocks before submission when the eligibility boundary is unavailable', async () => {
    const aa = makeAa();
    mocks.getActiveAaContext.mockResolvedValue(aa);
    mocks.requestFirstLockAuthorization.mockRejectedValue(
      new Error('First-lock authorization service unavailable'),
    );

    await expect(prepareLock(SELLER, TOKEN, 1)).rejects.toThrow(
      /authorization service unavailable/,
    );
    expect(aa.sponsoredClient.sendUserOperation).not.toHaveBeenCalled();
    expect(mocks.prepareErc20PaymasterQuote).not.toHaveBeenCalled();
  });

  it('uses sponsoredClient only after a valid positive authorization', async () => {
    const aa = makeAa();
    mocks.getActiveAaContext.mockResolvedValue(aa);
    mocks.requestFirstLockAuthorization.mockResolvedValue({
      eligible: true,
      orderId: ORDER,
      authorizationId: 'grant-1',
      expiresAtMs: Date.now() + 60_000,
    });

    const prepared = await prepareLock(SELLER, TOKEN, 1);
    const result = await submitLock(prepared);

    expect(prepared.policy).toBe('sponsored');
    expect(result).toMatchObject({
      lockID: 11n,
      orderId: ORDER,
      recovered: false,
    });
    expect(aa.sponsoredClient.sendUserOperation).toHaveBeenCalledOnce();
    expect(mocks.sendPreparedErc20UserOperation).not.toHaveBeenCalled();
  });

  it('uses a prepared ERC-20 quote after an authoritative negative decision', async () => {
    const aa = makeAa();
    const quote = { quoteId: USER_OP_HASH };
    mocks.getActiveAaContext.mockResolvedValue(aa);
    mocks.requestFirstLockAuthorization.mockResolvedValue({
      eligible: false,
      orderId: ORDER,
      reason: 'already-consumed',
    });
    mocks.prepareErc20PaymasterQuote.mockResolvedValue(quote);
    mocks.sendPreparedErc20UserOperation.mockResolvedValue(USER_OP_HASH);

    const prepared = await prepareLock(SELLER, TOKEN, 1);
    const result = await submitLock(prepared);

    expect(prepared.policy).toBe('erc20');
    expect(mocks.prepareErc20PaymasterQuote).toHaveBeenCalledWith(
      aa,
      [prepared.call],
      { type: 'existing' },
    );
    expect(mocks.sendPreparedErc20UserOperation).toHaveBeenCalledWith(
      aa,
      quote,
    );
    expect(result.lockID).toBe(11n);
  });

  it('recovers an existing idempotent order without sending another UserOperation', async () => {
    const aa = makeAa();
    mocks.getActiveAaContext.mockResolvedValue(aa);
    mocks.requestFirstLockAuthorization.mockResolvedValue({
      eligible: true,
      orderId: ORDER,
      authorizationId: 'grant-1',
      expiresAtMs: Date.now() + 60_000,
    });
    const prepared = await prepareLock(SELLER, TOKEN, 1);
    mocks.getContract.mockImplementation(async () => makeContract(11n));

    await expect(submitLock(prepared)).resolves.toMatchObject({
      lockID: 11n,
      recovered: true,
    });
    expect(aa.sponsoredClient.sendUserOperation).not.toHaveBeenCalled();
  });

  it('never falls back to EOA when an AA session disappears', async () => {
    const aa = makeAa();
    mocks.getActiveAaContext.mockResolvedValueOnce(aa);
    mocks.requestFirstLockAuthorization.mockResolvedValue({
      eligible: true,
      orderId: ORDER,
      authorizationId: 'grant-1',
      expiresAtMs: Date.now() + 60_000,
    });
    const prepared = await prepareLock(SELLER, TOKEN, 1);
    mocks.getActiveAaContext.mockResolvedValueOnce(null);

    await expect(submitLock(prepared)).rejects.toThrow(
      /refusing to change buyer/,
    );
  });

  it('prepares and submits release through the ERC-20 client with incoming balance', async () => {
    const aa = makeAa();
    const quote = { quoteId: USER_OP_HASH };
    const authorization = {
      pixTimestamp: `0x${'a'.repeat(64)}` as Hex,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
      signature: '0x1234' as Hex,
    };
    mocks.getActiveAaContext.mockResolvedValue(aa);
    mocks.prepareErc20PaymasterQuote.mockResolvedValue(quote);
    mocks.sendPreparedErc20UserOperation.mockResolvedValue(USER_OP_HASH);

    const prepared = await prepareRelease(11n, authorization);
    const receipt = await submitRelease(prepared);

    expect(mocks.prepareErc20PaymasterQuote).toHaveBeenCalledWith(
      aa,
      [prepared.call],
      { type: 'incoming', token: TOKEN, amount: lockTuple()[4] },
    );
    expect(mocks.sendPreparedErc20UserOperation).toHaveBeenCalledWith(
      aa,
      quote,
    );
    expect(receipt.transactionHash).toBe(TX_HASH);
  });

  it('derives the lock amount from the token real decimals, not a fixed 18', async () => {
    const aa = makeAa();
    mocks.getActiveAaContext.mockResolvedValue(aa);
    mocks.requestFirstLockAuthorization.mockResolvedValue({
      eligible: true,
      orderId: ORDER,
      authorizationId: 'grant-1',
      expiresAtMs: Date.now() + 60_000,
    });

    mocks.getContract.mockImplementation(async () => makeContract(0n, 6));
    const usdcLike = await prepareLock(SELLER, TOKEN, 2.5);
    expect(usdcLike.amount).toBe(parseUnits('2.5', 6));
    expect(usdcLike.amount).toBe(2_500_000n);

    mocks.getContract.mockImplementation(async () => makeContract(0n, 18));
    const brzLike = await prepareLock(SELLER, TOKEN, 1);
    expect(brzLike.amount).toBe(parseUnits('1', 18));
  });

  const makeLock = (over: Partial<P2PixLock> = {}): P2PixLock => ({
    lockID: 11n,
    orderId: ORDER,
    expirationBlock: 20_000n,
    currentBlock: 1_000n,
    pixTarget: `0x${'8'.repeat(64)}` as Hex,
    amount: 1_000_000_000_000_000_000n,
    token: TOKEN,
    buyer: BUYER,
    seller: SELLER,
    contractAddress: P2PIX,
    chainId: 1,
    ...over,
  });

  it('accepts a funded lock with a safe settlement window', () => {
    expect(() => assertLockAcceptableForPix(makeLock(), ORDER)).not.toThrow();
  });

  it('refuses to create a PIX for an inactive lock', () => {
    expect(() => assertLockAcceptableForPix(makeLock({ amount: 0n }))).toThrow(
      /no longer active/,
    );
  });

  it('refuses to create a PIX when the lock is too close to expiration', () => {
    // chainId 1 safety window is 300 blocks; 1300 <= 1000 + 300.
    expect(() =>
      assertLockAcceptableForPix(makeLock({ expirationBlock: 1_300n })),
    ).toThrow(/too close to expiration/);
  });

  it('refuses to create a PIX when the order id does not match the lock', () => {
    expect(() => assertLockAcceptableForPix(makeLock(), OTHER_ORDER)).toThrow(
      /does not match/,
    );
  });
});

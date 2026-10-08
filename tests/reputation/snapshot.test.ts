import {
  createPublicClient,
  custom,
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionResult,
  getAddress,
  isHex,
  multicall3Abi,
  numberToHex,
  zeroAddress,
} from 'viem';
import type { Address, Chain, Hex, PublicClient } from 'viem';
import { arbitrum, sepolia } from 'viem/chains';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { p2PixAbi, reputationAbi } from '@/blockchain/abi';
import {
  ReputationReadError,
  readReputationSnapshot,
} from '@/blockchain/reputation';
import { WAD, castAddrToKey } from '@/utils/reputation';
import type { ReputationTarget } from '@/utils/reputation';

const P2PIX: Address = '0xb9de24ab263c812a080488edab0382701c754bbc';
const MODULE: Address = '0xc40356e14842e951a2a1f156d5be28cc6e4c2697';
const ACCOUNT: Address = '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9f3e';
const LATEST = 9_000_000n; // above Sepolia's Multicall3 deployment block
const TARGET: ReputationTarget = {
  chainId: sepolia.id,
  p2pix: P2PIX,
  account: ACCOUNT,
};

type CallResult = { success: boolean; returnData: Hex };
type World = {
  userRecord: (key: bigint) => CallResult;
  reputation: () => CallResult;
  limiter: (credit: bigint) => CallResult;
  maxLimit: () => CallResult;
  magicValue: () => CallResult;
  // Index counts every JSON-RPC request, eth_blockNumber included.
  transportFails: (requestIndex: number) => boolean;
};
type LoggedRequest = { method: string; block?: string; calls: string[] };

const uint = (value: bigint): CallResult => ({
  success: true,
  returnData: encodeAbiParameters([{ type: 'uint256' }], [value]),
});
const address = (value: Address): CallResult => ({
  success: true,
  returnData: encodeAbiParameters([{ type: 'address' }], [value]),
});
const decodeUint = (result: CallResult): bigint =>
  decodeAbiParameters([{ type: 'uint256' }], result.returnData)[0];
const REVERT: CallResult = { success: false, returnData: '0x' };
const NO_DATA: CallResult = { success: true, returnData: '0x' };

// The deployed curve, written independently of the replica (reference integer sqrt).
const isqrt = (n: bigint): bigint => {
  const step = (x: bigint): bigint => {
    const y = (x + n / x) >> 1n;
    return y < x ? step(y) : x;
  };
  return n < 2n ? n : step(1n << BigInt(Math.ceil(n.toString(2).length / 2)));
};
const deployedLimiter = (base: bigint) => (credit: bigint) =>
  uint(
    base + (1_000_000n * credit) / isqrt(250_000_000_000n + credit * credit),
  );

const arbitrumWorld = (overrides: Partial<World> = {}): World => ({
  userRecord: (key) =>
    key === castAddrToKey(ACCOUNT) ? uint(1000n * WAD + WAD / 2n) : uint(0n),
  reputation: () => address(MODULE),
  limiter: deployedLimiter(256n),
  maxLimit: () => uint(1_000_000n),
  magicValue: () => uint(250_000_000_000n),
  transportFails: () => false,
  ...overrides,
});

const answer = (world: World, target: Address, callData: Hex): CallResult => {
  if (target.toLowerCase() === P2PIX) {
    const call = decodeFunctionData({ abi: p2PixAbi, data: callData });
    if (call.functionName === 'userRecord')
      return world.userRecord(call.args[0]);
    if (call.functionName === 'reputation') return world.reputation();
  }
  if (target.toLowerCase() === MODULE) {
    const call = decodeFunctionData({ abi: reputationAbi, data: callData });
    if (call.functionName === 'limiter') return world.limiter(call.args[0]);
    return call.functionName === 'maxLimit'
      ? world.maxLimit()
      : world.magicValue();
  }
  throw new Error(`unexpected call to ${target}`);
};

const callLabel = (target: Address, callData: Hex) => {
  const call =
    target.toLowerCase() === P2PIX
      ? decodeFunctionData({ abi: p2PixAbi, data: callData })
      : decodeFunctionData({ abi: reputationAbi, data: callData });
  return `${call.functionName}(${(call.args ?? []).join(',')})`;
};

// A real viem client; the only stub is the JSON-RPC boundary. Each eth_blockNumber answers the next
// of `heads`, and the last one repeats.
const fakeChain = (
  world: World,
  heads: readonly bigint[] = [LATEST],
  chain: Chain = sepolia,
) => {
  const log: LoggedRequest[] = [];
  const request = async (args: { method: string; params?: unknown }) => {
    const index = log.length;
    if (args.method === 'eth_blockNumber') {
      const polls = log.filter((r) => r.method === 'eth_blockNumber').length;
      log.push({ method: args.method, calls: [] });
      if (world.transportFails(index)) throw new Error('network down');
      return numberToHex(heads[Math.min(polls, heads.length - 1)]);
    }
    if (args.method !== 'eth_call')
      throw new Error(`unexpected ${args.method}`);
    const params: unknown[] = Array.isArray(args.params) ? args.params : [];
    const tx = params[0];
    const block = params[1];
    if (
      typeof tx !== 'object' ||
      tx === null ||
      !('data' in tx) ||
      typeof tx.data !== 'string' ||
      !isHex(tx.data) ||
      typeof block !== 'string'
    )
      throw new Error('malformed eth_call');
    const multicall = decodeFunctionData({ abi: multicall3Abi, data: tx.data });
    if (multicall.functionName !== 'aggregate3')
      throw new Error(`unexpected ${multicall.functionName}`);
    const calls = multicall.args[0];
    log.push({
      method: args.method,
      block,
      calls: calls.map((call) => callLabel(call.target, call.callData)),
    });
    if (world.transportFails(index)) throw new Error('network down');
    return encodeFunctionResult({
      abi: multicall3Abi,
      functionName: 'aggregate3',
      result: calls.map((call) => answer(world, call.target, call.callData)),
    });
  };
  const client: PublicClient = createPublicClient({
    chain,
    transport: custom({ request }, { retryCount: 0 }),
  });
  return { client, log };
};

const nextLimitFailures = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(
    (call) => call[0] === '[reputation] next-limit read failed',
  ).length;

const readError = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  if (!(error instanceof ReputationReadError))
    throw new Error(`expected ReputationReadError, got ${String(error)}`);
  return error;
};

// The module batch: the user's points, the curve getters, then the fixed probes 10 … 10^9.
const PROBES = Array.from(
  { length: 9 },
  (_, i) => `limiter(${10n ** BigInt(i + 1)})`,
);

describe('readReputationSnapshot', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reads the Arbitrum curve snapshot in four requests pinned to one block', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const { client, log } = fakeChain(arbitrumWorld());
    const snapshot = await readReputationSnapshot(client, TARGET);
    expect(snapshot).toEqual({
      chainId: sepolia.id,
      p2pix: getAddress(P2PIX),
      account: getAddress(ACCOUNT),
      blockNumber: LATEST,
      key: castAddrToKey(ACCOUNT),
      reputation: getAddress(MODULE),
      creditTokens: 1000n,
      limiterValue: 2256n,
      limitTokens: 2256n,
      baseValue: 256n,
      newWalletLimitTokens: 256n,
      nextLimitTokens: 6767n,
      curve: { base: 256n, maxLimit: 1_000_000n, magicValue: 250_000_000_000n },
    });
    expect(log).toEqual([
      { method: 'eth_blockNumber', calls: [] },
      {
        method: 'eth_call',
        block: numberToHex(LATEST),
        calls: [`userRecord(${castAddrToKey(ACCOUNT)})`, 'reputation()'],
      },
      {
        method: 'eth_call',
        block: numberToHex(LATEST),
        // Whole tokens, never wei: the old code passed userRecord straight to limiter.
        calls: [
          'limiter(1000)',
          'limiter(0)',
          'maxLimit()',
          'magicValue()',
          ...PROBES,
        ],
      },
      {
        method: 'eth_call',
        block: numberToHex(LATEST),
        calls: ['limiter(3256)'],
      },
    ]);
    expect(nextLimitFailures(consoleError)).toBe(0);
  });

  it('waits for a node behind minBlock to reach it, never asking for a block it has not seen', async () => {
    vi.useFakeTimers();
    const behind = fakeChain(arbitrumWorld(), [
      LATEST,
      LATEST + 2n,
      LATEST + 6n,
    ]);
    const pending = readReputationSnapshot(behind.client, TARGET, {
      minBlock: LATEST + 5n,
    });
    await vi.runAllTimersAsync();
    expect((await pending).blockNumber).toBe(LATEST + 6n);
    expect(behind.log.map((r) => r.block ?? r.method)).toEqual([
      'eth_blockNumber',
      'eth_blockNumber',
      'eth_blockNumber',
      numberToHex(LATEST + 6n),
      numberToHex(LATEST + 6n),
      numberToHex(LATEST + 6n),
    ]);
  });

  it("fails as 'rpc' when the node stays behind minBlock, without an eth_call", async () => {
    vi.useFakeTimers();
    const stuck = fakeChain(arbitrumWorld());
    const pending = readError(
      readReputationSnapshot(stuck.client, TARGET, { minBlock: LATEST + 5n }),
    );
    await vi.runAllTimersAsync();
    expect((await pending).kind).toBe('rpc');
    expect(stuck.log.every((r) => r.method === 'eth_blockNumber')).toBe(true);
    // Polled at the client's interval (4 s on Sepolia) for at most 30 s.
    expect(stuck.log).toHaveLength(8);
  });

  it('reads at latest when the node is at or past minBlock', async () => {
    const ahead = fakeChain(arbitrumWorld());
    const latest = await readReputationSnapshot(ahead.client, TARGET, {
      minBlock: LATEST - 5n,
    });
    expect(latest.blockNumber).toBe(LATEST);
    expect(
      ahead.log.filter((r) => r.method === 'eth_blockNumber'),
    ).toHaveLength(1);
  });

  it('gives a new BASE 1 wallet the 100 bypass and reads its next limit', async () => {
    const { client } = fakeChain(
      arbitrumWorld({
        userRecord: () => uint(0n),
        limiter: deployedLimiter(1n),
      }),
    );
    const snapshot = await readReputationSnapshot(client, TARGET);
    expect(snapshot).toMatchObject({
      creditTokens: 0n,
      limiterValue: 1n,
      limitTokens: 100n,
      baseValue: 1n,
      newWalletLimitTokens: 100n,
      nextLimitTokens: 201n,
      curve: { base: 1n, maxLimit: 1_000_000n, magicValue: 250_000_000_000n },
    });
  });

  it('skips the next-limit read at the cap', async () => {
    const { client, log } = fakeChain(
      arbitrumWorld({ userRecord: () => uint(22_092_000n * WAD) }),
    );
    const snapshot = await readReputationSnapshot(client, TARGET);
    expect(snapshot.limitTokens).toBe(1_000_000n);
    expect(snapshot.nextLimitTokens).toBeNull();
    expect(snapshot.curve).not.toBeNull();
    expect(log).toHaveLength(3);
  });

  it("fails as 'module' when P2PIX reports the zero address", async () => {
    const { client, log } = fakeChain(
      arbitrumWorld({ reputation: () => address(zeroAddress) }),
    );
    expect((await readError(readReputationSnapshot(client, TARGET))).kind).toBe(
      'module',
    );
    expect(log).toHaveLength(2);
  });

  it("fails as 'module' when limiter reverts or the module has no code", async () => {
    const reverting = fakeChain(arbitrumWorld({ limiter: () => REVERT }));
    expect(
      (await readError(readReputationSnapshot(reverting.client, TARGET))).kind,
    ).toBe('module');

    const baseOnly = fakeChain(
      arbitrumWorld({
        limiter: (credit) => (credit === 0n ? REVERT : uint(2256n)),
      }),
    );
    expect(
      (await readError(readReputationSnapshot(baseOnly.client, TARGET))).kind,
    ).toBe('module');

    const noCode = fakeChain(
      arbitrumWorld({
        limiter: () => NO_DATA,
        maxLimit: () => NO_DATA,
        magicValue: () => NO_DATA,
      }),
    );
    expect(
      (await readError(readReputationSnapshot(noCode.client, TARGET))).kind,
    ).toBe('module');
  });

  it("fails as 'rpc' when userRecord reverts, never as 'module'", async () => {
    const { client } = fakeChain(arbitrumWorld({ userRecord: () => REVERT }));
    const error = await readError(readReputationSnapshot(client, TARGET));
    expect(error.kind).toBe('rpc');
    expect(error.cause).toBeInstanceOf(Error);
  });

  it.each([
    ['eth_blockNumber', 0],
    ['the P2PIX batch', 1],
    ['the module batch', 2],
  ])("fails as 'rpc' when the transport drops %s", async (_, failing) => {
    const { client } = fakeChain(
      arbitrumWorld({ transportFails: (index) => index === failing }),
    );
    const error = await readError(readReputationSnapshot(client, TARGET));
    expect(error.kind).toBe('rpc');
    expect(error.cause).toBeDefined();
  });

  it('refuses a client on another chain before sending anything', async () => {
    const { client, log } = fakeChain(arbitrumWorld(), [LATEST], arbitrum);
    expect((await readError(readReputationSnapshot(client, TARGET))).kind).toBe(
      'rpc',
    );
    expect(log).toHaveLength(0);
  });

  it('keeps the snapshot but drops the curve when a getter is missing or zero', async () => {
    const worlds = [
      arbitrumWorld({ maxLimit: () => REVERT }),
      arbitrumWorld({ magicValue: () => NO_DATA }),
      arbitrumWorld({ maxLimit: () => uint(0n) }),
    ];
    const snapshots = await Promise.all(
      worlds.map((world) =>
        readReputationSnapshot(fakeChain(world).client, TARGET),
      ),
    );
    snapshots.forEach((snapshot) => {
      expect(snapshot.curve).toBeNull();
      expect(snapshot.limitTokens).toBe(2256n);
      expect(snapshot.nextLimitTokens).toBe(6767n);
    });
  });

  it('drops the curve when the replica does not reproduce limiter(credit)', async () => {
    const { client } = fakeChain(
      arbitrumWorld({ maxLimit: () => uint(2_000_000n) }),
    );
    const snapshot = await readReputationSnapshot(client, TARGET);
    expect(snapshot.curve).toBeNull();
    expect(snapshot.limitTokens).toBe(2256n);
  });

  it('drops the curve when the replica does not reproduce the next-limit read', async () => {
    const curve = deployedLimiter(256n);
    const { client } = fakeChain(
      arbitrumWorld({
        limiter: (credit) => (credit === 3256n ? uint(6768n) : curve(credit)),
      }),
    );
    const snapshot = await readReputationSnapshot(client, TARGET);
    expect(snapshot.curve).toBeNull();
    expect(snapshot.nextLimitTokens).toBe(6768n);
  });

  it('drops the curve when the replica does not reproduce limiter(0)', async () => {
    const curve = deployedLimiter(256n);
    const { client } = fakeChain(
      arbitrumWorld({
        limiter: (credit) => (credit === 0n ? uint(300n) : curve(credit)),
      }),
    );
    const snapshot = await readReputationSnapshot(client, TARGET);
    expect(snapshot.curve).toBeNull();
    expect(snapshot.newWalletLimitTokens).toBe(300n);
  });

  it("drops the curve when the module departs from the replica away from the user's credit", async () => {
    const curve = deployedLimiter(256n);
    // Same getters and the same values at credit 0, 1000 and 3256, but clamped at 50,000.
    const clamped = fakeChain(
      arbitrumWorld({
        limiter: (credit) => {
          const value = decodeUint(curve(credit));
          return uint(value > 50_000n ? 50_000n : value);
        },
      }),
    );
    const snapshot = await readReputationSnapshot(clamped.client, TARGET);
    expect(snapshot.limitTokens).toBe(2256n);
    expect(snapshot.nextLimitTokens).toBe(6767n);
    expect(snapshot.curve).toBeNull();

    const revertingProbe = fakeChain(
      arbitrumWorld({
        limiter: (credit) => (credit === 10n ** 6n ? REVERT : curve(credit)),
      }),
    );
    expect(
      (await readReputationSnapshot(revertingProbe.client, TARGET)).curve,
    ).toBeNull();
  });

  it('keeps the snapshot without a next limit when that read fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const curve = deployedLimiter(256n);
    const reverting = fakeChain(
      arbitrumWorld({
        limiter: (credit) => (credit === 3256n ? REVERT : curve(credit)),
      }),
    );
    const snapshot = await readReputationSnapshot(reverting.client, TARGET);
    expect(snapshot.nextLimitTokens).toBeNull();
    expect(snapshot.limitTokens).toBe(2256n);
    expect(snapshot.curve).not.toBeNull();
    expect(nextLimitFailures(consoleError)).toBe(1);

    const dropped = fakeChain(
      arbitrumWorld({ transportFails: (index) => index === 3 }),
    );
    expect(
      (await readReputationSnapshot(dropped.client, TARGET)).nextLimitTokens,
    ).toBeNull();
    expect(nextLimitFailures(consoleError)).toBe(2);
  });
});

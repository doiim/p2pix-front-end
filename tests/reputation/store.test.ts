import { ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReputationReadError } from '@/blockchain/reputation';
import {
  createReputationStore,
  useReputation,
} from '@/composables/useReputation';
import type { SnapshotReader } from '@/composables/useReputation';
import { castAddrToKey } from '@/utils/reputation';
import type { ReputationSnapshot, ReputationTarget } from '@/utils/reputation';

const ALICE: ReputationTarget = {
  chainId: 42161,
  p2pix: '0xB9dE24aB263c812A080488Edab0382701C754BBc',
  account: '0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9f3e',
};
const BOB: ReputationTarget = {
  ...ALICE,
  account: '0x00000000000000000000000000000000000000b0',
};
const ALICE_ON_SEPOLIA: ReputationTarget = { ...ALICE, chainId: 11155111 };

const snapshotFor = (
  target: ReputationTarget,
  limitTokens: bigint,
): ReputationSnapshot => ({
  chainId: target.chainId,
  p2pix: target.p2pix,
  account: target.account,
  blockNumber: 1n,
  key: castAddrToKey(target.account),
  reputation: '0xC40356e14842e951A2A1F156d5be28cC6E4C2697',
  creditTokens: 0n,
  limiterValue: limitTokens,
  limitTokens,
  baseValue: 256n,
  newWalletLimitTokens: 256n,
  nextLimitTokens: null,
  curve: null,
});

// A reader whose reads settle only when the test says so.
const controlledReader = () => {
  const reads: {
    target: ReputationTarget;
    opts: { minBlock?: bigint };
    resolve: (snapshot: ReputationSnapshot) => void;
    reject: (err: unknown) => void;
  }[] = [];
  // Built by hand: Promise.withResolvers needs Node 22, and CI runs vitest on the runner's node.
  const read: SnapshotReader = (target, opts) =>
    new Promise<ReputationSnapshot>((resolve, reject) =>
      reads.push({ target, opts, resolve, reject }),
    );
  return { read, reads };
};

const setup = (initial: ReputationTarget | null = ALICE) => {
  const target = ref<ReputationTarget | null>(initial);
  const reader = controlledReader();
  const store = createReputationStore(reader.read, () => target.value);
  return { target, store, reads: reader.reads };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createReputationStore', () => {
  it('reads nothing for guests', async () => {
    const { store, reads } = setup(null);
    expect(await store.ensure()).toEqual({ ok: false, reason: 'disconnected' });
    expect(await store.refresh()).toEqual({
      ok: false,
      reason: 'disconnected',
    });
    expect(reads).toHaveLength(0);
    expect(store.snapshot.value).toBeNull();
    expect(store.reading.value).toBe(false);
  });

  it('dedupes ensure() while a read is in flight, then serves the cache', async () => {
    const { store, reads } = setup();
    const first = store.ensure();
    const second = store.ensure();
    expect(second).toBe(first);
    expect(reads).toHaveLength(1);
    expect(store.reading.value).toBe(true);
    expect(store.snapshot.value).toBeNull();

    const snapshot = snapshotFor(ALICE, 2256n);
    reads[0].resolve(snapshot);
    expect(await first).toEqual({ ok: true, snapshot });
    expect(store.snapshot.value).toBe(snapshot);
    expect(store.reading.value).toBe(false);

    expect(await store.ensure()).toEqual({ ok: true, snapshot });
    expect(reads).toHaveLength(1);
  });

  it('keys the cache case-insensitively by chain, P2Pix and account', async () => {
    const { target, store, reads } = setup();
    void store.ensure();
    reads[0].resolve(snapshotFor(ALICE, 2256n));
    await flush();

    target.value = {
      ...ALICE,
      p2pix: '0xb9de24ab263c812a080488edab0382701c754bbc',
      account: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9f3e',
    };
    expect(store.snapshot.value?.limitTokens).toBe(2256n);
    await store.ensure();
    expect(reads).toHaveLength(1);

    target.value = ALICE_ON_SEPOLIA;
    expect(store.snapshot.value).toBeNull();
    void store.ensure();
    expect(reads).toHaveLength(2);
  });

  it('always starts a new read on refresh() and passes minBlock through', async () => {
    const { store, reads } = setup();
    void store.ensure();
    reads[0].resolve(snapshotFor(ALICE, 2256n));
    await flush();

    const refreshed = store.refresh({ minBlock: 77n });
    expect(reads).toHaveLength(2);
    expect(reads[1].opts.minBlock).toBe(77n);
    expect(reads[0].opts.minBlock).toBeUndefined();
    // The previous snapshot stays visible while the re-read runs.
    expect(store.snapshot.value?.limitTokens).toBe(2256n);
    expect(store.reading.value).toBe(true);

    const fresh = snapshotFor(ALICE, 6767n);
    reads[1].resolve(fresh);
    expect(await refreshed).toEqual({ ok: true, snapshot: fresh });
    expect(store.snapshot.value).toBe(fresh);
  });

  it('commits only the latest-started read, whatever order they settle in', async () => {
    const { store, reads } = setup();
    const older = store.refresh();
    const newer = store.refresh();
    const newest = snapshotFor(ALICE, 3000n);

    reads[1].resolve(newest);
    expect(await newer).toEqual({ ok: true, snapshot: newest });
    reads[0].resolve(snapshotFor(ALICE, 1000n));
    // The superseded read answers with the read that committed.
    expect(await older).toEqual({ ok: true, snapshot: newest });
    expect(store.snapshot.value).toBe(newest);
  });

  it('keeps reading until the latest read settles', async () => {
    const { store, reads } = setup();
    const older = store.refresh();
    const newer = store.refresh();
    reads[0].resolve(snapshotFor(ALICE, 1000n));
    await flush();
    expect(store.snapshot.value).toBeNull();
    expect(store.reading.value).toBe(true);

    const newest = snapshotFor(ALICE, 3000n);
    reads[1].resolve(newest);
    expect(await older).toEqual({ ok: true, snapshot: newest });
    expect(await newer).toEqual({ ok: true, snapshot: newest });
    expect(store.reading.value).toBe(false);
  });

  it('answers stale when the account changed mid-read, and still caches the result', async () => {
    const { target, store, reads } = setup();
    const pending = store.refresh();
    target.value = BOB;
    expect(store.reading.value).toBe(false);

    const aliceSnapshot = snapshotFor(ALICE, 2256n);
    reads[0].resolve(aliceSnapshot);
    expect(await pending).toEqual({ ok: false, reason: 'stale' });
    expect(store.snapshot.value).toBeNull();

    target.value = ALICE;
    expect(store.snapshot.value).toBe(aliceSnapshot);
  });

  it('times out without cancelling the read, which commits later', async () => {
    vi.useFakeTimers();
    const { store, reads } = setup();
    const pending = store.refresh({ timeoutMs: 4000 });
    await vi.advanceTimersByTimeAsync(4000);
    expect(await pending).toEqual({ ok: false, reason: 'timeout' });
    expect(store.reading.value).toBe(true);

    const late = snapshotFor(ALICE, 2256n);
    reads[0].resolve(late);
    await vi.runAllTimersAsync();
    expect(store.snapshot.value).toBe(late);
    expect(store.reading.value).toBe(false);
  });

  it('clears its timer when the read wins', async () => {
    vi.useFakeTimers();
    const { store, reads } = setup();
    const pending = store.refresh({ timeoutMs: 4000 });
    const snapshot = snapshotFor(ALICE, 2256n);
    reads[0].resolve(snapshot);
    expect(await pending).toEqual({ ok: true, snapshot });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops the cached snapshot after a failed read and reports the kind', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { store, reads } = setup();
    void store.ensure();
    reads[0].resolve(snapshotFor(ALICE, 2256n));
    await flush();

    const failed = store.refresh();
    const failure = new ReputationReadError('module');
    reads[1].reject(failure);
    expect(await failed).toEqual({ ok: false, reason: 'module' });
    expect(store.snapshot.value).toBeNull();
    expect(store.error.value).toBe('module');
    expect(consoleError).toHaveBeenCalledWith(
      '[reputation] read failed',
      failure,
    );

    const retried = store.ensure();
    expect(reads).toHaveLength(3);
    const fresh = snapshotFor(ALICE, 2256n);
    reads[2].resolve(fresh);
    expect(await retried).toEqual({ ok: true, snapshot: fresh });
    expect(store.error.value).toBeNull();
  });

  it("maps unknown failures to 'rpc' and never rejects", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const target = ref<ReputationTarget | null>(ALICE);
    const throwing = createReputationStore(
      () => {
        throw new Error('synchronous failure');
      },
      () => target.value,
    );
    expect(await throwing.refresh()).toEqual({ ok: false, reason: 'rpc' });
    expect(throwing.error.value).toBe('rpc');

    const { store, reads } = setup();
    const pending = store.refresh({ timeoutMs: 4000 });
    reads[0].reject('not even an Error');
    expect(await pending).toEqual({ ok: false, reason: 'rpc' });
  });
});

describe('useReputation', () => {
  it('is one shared store that reads nothing without a wallet', async () => {
    const store = useReputation();
    expect(useReputation()).toBe(store);
    expect(await store.ensure()).toEqual({ ok: false, reason: 'disconnected' });
    expect(store.snapshot.value).toBeNull();
    expect(store.reading.value).toBe(false);
  });
});

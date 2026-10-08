import { computed, shallowReactive } from 'vue';
import type { ComputedRef } from 'vue';
import {
  ReputationReadError,
  readReputationSnapshot,
} from '@/blockchain/reputation';
import { useUser } from '@/composables/useUser';
import type {
  ReputationErrorKind,
  ReputationRead,
  ReputationSnapshot,
  ReputationTarget,
} from '@/utils/reputation';

export type RefreshOptions = { minBlock?: bigint; timeoutMs?: number };
export type SnapshotReader = (
  target: ReputationTarget,
  opts: { minBlock?: bigint },
) => Promise<ReputationSnapshot>;

export type ReputationStore = {
  snapshot: ComputedRef<ReputationSnapshot | null>; // current (chain, p2pix, walletAddress) only; null for guests, before the first read lands, after a failed read
  reading: ComputedRef<boolean>; // a read for the current key is in flight
  error: ComputedRef<ReputationErrorKind | null>; // last failure for the current key; cleared by the next success
  ensure: () => Promise<ReputationRead>; // cached → ok immediately; in flight → same promise; else start a read
  refresh: (opts?: RefreshOptions) => Promise<ReputationRead>; // always a new read; NEVER rejects
};

type Outcome =
  | { snapshot: ReputationSnapshot; error: null }
  | { snapshot: null; error: ReputationErrorKind };
type Entry = {
  snapshot: ReputationSnapshot | null;
  error: ReputationErrorKind | null;
  reading: boolean;
};

const IDLE: Entry = { snapshot: null, error: null, reading: false };
const DISCONNECTED: ReputationRead = { ok: false, reason: 'disconnected' };
const STALE: ReputationRead = { ok: false, reason: 'stale' };
const TIMEOUT: ReputationRead = { ok: false, reason: 'timeout' };

/** @public Exported for tests: the store logic with an injected reader and target. `currentTarget` must read reactive state. */
export const createReputationStore = (
  read: SnapshotReader,
  currentTarget: () => ReputationTarget | null,
): ReputationStore => {
  // Memory only (D3). A commit replaces the key's entry object, never mutates it.
  const entries = shallowReactive(new Map<string, Entry>());
  // The latest-started read per key; only it commits, so a slow older read cannot overwrite a newer one.
  const latest = new Map<
    string,
    { seq: number; settled: Promise<ReputationRead> }
  >();

  const currentKey = () => {
    const target = currentTarget();
    return target === null ? null : keyOf(target);
  };
  const current = computed(() => {
    const key = currentKey();
    return (key === null ? undefined : entries.get(key)) ?? IDLE;
  });

  const start = (
    target: ReputationTarget,
    opts: { minBlock?: bigint },
  ): Promise<ReputationRead> => {
    const key = keyOf(target);
    const seq = (latest.get(key)?.seq ?? 0) + 1;
    entries.set(key, { ...(entries.get(key) ?? IDLE), reading: true });
    // The executor turns a synchronous throw from the reader into a rejection.
    const settled = new Promise<ReputationSnapshot>((resolve) =>
      resolve(read(target, opts)),
    )
      .then(
        (snapshot): Outcome => ({ snapshot, error: null }),
        (err: unknown): Outcome => {
          console.error('[reputation] read failed', err);
          return {
            snapshot: null,
            error: err instanceof ReputationReadError ? err.kind : 'rpc',
          };
        },
      )
      .then((outcome): ReputationRead | Promise<ReputationRead> => {
        const newest = latest.get(key);
        // Superseded: answer with the read that will commit.
        if (newest !== undefined && newest.seq !== seq) return newest.settled;
        entries.set(key, { ...outcome, reading: false });
        if (currentKey() !== key) return STALE;
        return outcome.snapshot === null
          ? { ok: false, reason: outcome.error }
          : { ok: true, snapshot: outcome.snapshot };
      });
    latest.set(key, { seq, settled });
    return settled;
  };

  const ensure = (): Promise<ReputationRead> => {
    const target = currentTarget();
    if (target === null) return Promise.resolve(DISCONNECTED);
    const key = keyOf(target);
    const entry = entries.get(key);
    if (entry?.snapshot)
      return Promise.resolve({ ok: true, snapshot: entry.snapshot });
    const inFlight = entry?.reading ? latest.get(key) : undefined;
    return inFlight?.settled ?? start(target, {});
  };

  const refresh = (opts: RefreshOptions = {}): Promise<ReputationRead> => {
    const target = currentTarget();
    if (target === null) return Promise.resolve(DISCONNECTED);
    const settled = start(target, { minBlock: opts.minBlock });
    return opts.timeoutMs === undefined
      ? settled
      : withTimeout(settled, opts.timeoutMs);
  };

  return {
    snapshot: computed(() => current.value.snapshot),
    reading: computed(() => current.value.reading),
    error: computed(() => current.value.error),
    ensure,
    refresh,
  };
};

export const useReputation = (): ReputationStore => store;

const keyOf = (target: ReputationTarget) =>
  `${target.chainId}:${target.p2pix.toLowerCase()}:${target.account.toLowerCase()}`;

// The read keeps running after a timeout and still commits.
const withTimeout = (
  settled: Promise<ReputationRead>,
  ms: number,
): Promise<ReputationRead> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(TIMEOUT), ms);
    void settled.then((result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });

const selectedTarget = (): ReputationTarget | null => {
  const user = useUser();
  const account = user.walletAddress.value;
  const p2pix = user.network.value.contracts?.p2pix;
  if (account === null || p2pix === undefined || !('address' in p2pix))
    return null;
  return { chainId: user.network.value.id, p2pix: p2pix.address, account };
};

const readSelectedNetwork: SnapshotReader = async (target, opts) => {
  // A test seam, not a code split: provider.ts is also imported statically elsewhere, so it stays in
  // the main chunk and Vite warns INEFFECTIVE_DYNAMIC_IMPORT. Importing it on demand keeps this
  // module (and createReputationStore) loadable in unit tests, where @/config/appkit throws at
  // import time without VITE_REOWN_PROJECT_ID.
  const provider = await import('@/blockchain/provider');
  return readReputationSnapshot(provider.getPublicClient(), target, opts);
};

const store = createReputationStore(readSelectedNetwork, selectedTarget);

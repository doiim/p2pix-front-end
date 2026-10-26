import { computed, shallowRef } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import type { Address } from 'viem';
import {
  ReputationReadError,
  readReputationSnapshot,
} from '@/blockchain/reputation';
import { getPublicClient } from '@/blockchain/provider';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import type {
  ReputationErrorKind,
  ReputationRead,
  ReputationSnapshot,
  ReputationTarget,
} from '@/utils/reputation';

export type RefreshOptions = { minBlock?: bigint; timeoutMs?: number };

export type ReputationStore = {
  snapshot: ComputedRef<ReputationSnapshot | null>; // current (chain, p2pix, walletAddress) only; null for guests, before the first read lands, after a failed read
  reading: ComputedRef<boolean>; // a read for the current key is in flight
  ensure: () => Promise<ReputationRead>; // cached → ok immediately; in flight → same promise; else start a read
  refresh: (opts?: RefreshOptions) => Promise<ReputationRead>; // always a new read; NEVER rejects
};

type Outcome =
  | { snapshot: ReputationSnapshot; error: null }
  | { snapshot: null; error: ReputationErrorKind };
// The one cached read: the target is always the connected wallet on the selected network.
type Entry = {
  key: string;
  snapshot: ReputationSnapshot | null;
  reading: boolean;
  seq: number; // the read that started last; only it commits, so a slow older read cannot overwrite a newer one
  settled: Promise<ReputationRead>;
};

const IDLE = { snapshot: null, reading: false };
const DISCONNECTED: ReputationRead = { ok: false, reason: 'disconnected' };
const STALE: ReputationRead = { ok: false, reason: 'stale' };
const TIMEOUT: ReputationRead = { ok: false, reason: 'timeout' };

// Memory only (D3), shared by every caller. A commit replaces the entry object, never mutates it.
const entry = shallowRef<Entry | null>(null);
let lastSeq = 0;

const createReputationStore = (
  account: Readonly<Ref<Address | null>>,
): ReputationStore => {
  const currentKey = () => {
    const target = selectedTarget(account.value);
    return target === null ? null : keyOf(target);
  };
  // The entry when it belongs to the current key, so a commit for another wallet or network never shows.
  const ownEntry = (key: string | null) =>
    entry.value !== null && entry.value.key === key ? entry.value : null;
  const current = computed(() => ownEntry(currentKey()) ?? IDLE);

  const start = (
    target: ReputationTarget,
    opts: { minBlock?: bigint },
  ): Promise<ReputationRead> => {
    const key = keyOf(target);
    const seq = ++lastSeq;
    // The executor turns a synchronous throw from the reader into a rejection.
    const settled = new Promise<ReputationSnapshot>((resolve) =>
      resolve(readReputationSnapshot(getPublicClient(), target, opts)),
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
        const newest = entry.value;
        // Superseded: answer with the read that will commit, or stale when it is for another key.
        if (newest !== null && newest.seq !== seq)
          return newest.key === key ? newest.settled : STALE;
        entry.value = {
          key,
          snapshot: outcome.snapshot,
          reading: false,
          seq,
          settled,
        };
        if (currentKey() !== key) return STALE;
        return outcome.snapshot === null
          ? { ok: false, reason: outcome.error }
          : { ok: true, snapshot: outcome.snapshot };
      });
    entry.value = {
      key,
      snapshot: ownEntry(key)?.snapshot ?? null,
      reading: true,
      seq,
      settled,
    };
    return settled;
  };

  const ensure = (): Promise<ReputationRead> => {
    const target = selectedTarget(account.value);
    if (target === null) return Promise.resolve(DISCONNECTED);
    const own = ownEntry(keyOf(target));
    if (own?.snapshot)
      return Promise.resolve({ ok: true, snapshot: own.snapshot });
    return own?.reading ? own.settled : start(target, {});
  };

  const refresh = (opts: RefreshOptions = {}): Promise<ReputationRead> => {
    const target = selectedTarget(account.value);
    if (target === null) return Promise.resolve(DISCONNECTED);
    const settled = start(target, { minBlock: opts.minBlock });
    return opts.timeoutMs === undefined
      ? settled
      : withTimeout(settled, opts.timeoutMs);
  };

  return {
    snapshot: computed(() => current.value.snapshot),
    reading: computed(() => current.value.reading),
    ensure,
    refresh,
  };
};

export const useReputation = (): ReputationStore =>
  createReputationStore(useWalletAddress());

const keyOf = (target: ReputationTarget) =>
  `${target.chainId}:${target.p2pix.toLowerCase()}:${target.account.toLowerCase()}`;

// The read keeps running after a timeout and still commits.
const withTimeout = (
  settled: Promise<ReputationRead>,
  ms: number,
): Promise<ReputationRead> =>
  Promise.race([
    settled,
    new Promise<ReputationRead>((resolve) =>
      setTimeout(() => resolve(TIMEOUT), ms),
    ),
  ]);

const selectedTarget = (account: Address | null): ReputationTarget | null => {
  const user = useUser();
  const p2pix = user.network.value.contracts?.p2pix;
  if (account === null || p2pix === undefined || !('address' in p2pix))
    return null;
  return { chainId: user.network.value.id, p2pix: p2pix.address, account };
};

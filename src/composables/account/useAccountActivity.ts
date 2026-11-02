import { computed, ref } from 'vue';
import type { Address } from 'viem';

import { TokenEnum } from '@/model/NetworkEnum';
import { useQuery } from '@tanstack/vue-query';
import { fetchActivity, type Transaction } from '@/queries/graphql';
import { activityKey } from '@/queries/keys';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';
import { readHistory } from './userOpHistory';

export type ActivityItem = {
  id: string;
  title: string;
  direction: 'in' | 'out' | 'neutral';
  amount: bigint;
  /** Absent means the chain's native coin, or an unknown token (amount 0n). */
  token?: TokenEnum;
  /** Milliseconds since epoch. */
  timestamp: number;
  href: string | null;
};

type ActivityGroup = { title: string; items: ActivityItem[] };

// Direction is the money flow of the queried role, not of the event alone: the
// activity query scopes lock/release/return to the buyer and deposit to the
// seller, so each entry reads from that side of the trade. A lock only reserves
// the seller's tokens; the release pays them to the buyer.
const SUBGRAPH: Record<
  Transaction['type'],
  { title: string; direction: ActivityItem['direction'] }
> = {
  deposit: { title: 'Oferta criada', direction: 'out' },
  lock: { title: 'Compra iniciada', direction: 'neutral' },
  release: { title: 'Comprado com Pix', direction: 'in' },
  return: { title: 'Reserva devolvida', direction: 'neutral' },
};
// A withdrawal brings the offer's tokens back to the seller.
const WITHDRAWN = { title: 'Saque da oferta', direction: 'in' } as const;

const monthOf = (timestampMs: number): string => {
  const title = new Date(timestampMs).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const groupByMonth = (items: ActivityItem[]): ActivityGroup[] => {
  const groups = new Map<string, ActivityGroup>();
  for (const item of items) {
    const title = monthOf(item.timestamp);
    const group = groups.get(title) ?? { title, items: [] };
    group.items.push(item);
    groups.set(title, group);
  }
  return [...groups.values()];
};

export function useAccountActivity() {
  const user = useUser();
  const account = usePasskeyAccount();
  // Bumped by refresh() to re-read the stored sends.
  const sendsVersion = ref(0);

  const address = computed(
    () => account.smartAccountAddress.value?.toLowerCase() ?? null,
  );
  // Same cache family as the explorer feed, scoped to the smart account.
  const query = useQuery({
    queryKey: computed(() => activityKey(user.network.value.id, address.value)),
    queryFn: () => fetchActivity(user.network.value, address.value),
    enabled: computed(() => Boolean(address.value)),
  });

  /** Deposits name their ERC-20 by address; lock/release/return carry none,
   * so they can only be the network's token when it has exactly one. */
  const tokenAt = (address: string | undefined): TokenEnum | undefined => {
    const tokens = Object.values(TokenEnum);
    return (
      tokens.find(
        (token) =>
          user.network.value.tokens[token].address.toLowerCase() ===
          address?.toLowerCase(),
      ) ?? (tokens.length === 1 ? tokens[0] : undefined)
    );
  };

  const remote = computed(() =>
    (query.data.value ?? []).map((tx): ActivityItem => {
      const token = tokenAt(tx.token);
      return {
        id: tx.id,
        ...(tx.withdrawn ? WITHDRAWN : SUBGRAPH[tx.type]),
        // An amount without a known token has no unit: show none, never a guess.
        amount: token ? BigInt(tx.amount || '0') : 0n,
        token,
        timestamp: Number(tx.blockTimestamp) * 1000,
        href: account.explorerTxUrl(tx.transactionHash as Address),
      };
    }),
  );

  const items = computed(() =>
    [...local.value, ...remote.value].sort((a, b) => b.timestamp - a.timestamp),
  );

  // Derived from the current account and network, so a switch never shows the
  // previous account's sends.
  const local = computed((): ActivityItem[] => {
    void sendsVersion.value;
    const current = account.smartAccountAddress.value;
    if (!current) return [];
    return readHistory(user.network.value.id, current).map(
      (e): ActivityItem => ({
        id: e.id,
        title: 'Enviado',
        direction: 'out',
        amount: BigInt(e.amount),
        token: e.token,
        timestamp: e.timestamp,
        href: e.txHash ? account.explorerTxUrl(e.txHash) : null,
      }),
    );
  });

  const refresh = async (): Promise<void> => {
    if (!account.smartAccountAddress.value) return;
    sendsVersion.value++;
    await query.refetch();
  };

  return {
    groups: computed(() => groupByMonth(items.value)),
    isEmpty: computed(() => items.value.length === 0),
    error: computed(() => query.error.value?.message ?? null),
    refresh,
  };
}

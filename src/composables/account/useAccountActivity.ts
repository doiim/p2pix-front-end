import { computed, ref } from 'vue';
import type { Address } from 'viem';

import type { TokenEnum } from '@/model/NetworkEnum';
import { findToken } from '@/config/networks';
import { useGraphQL, type Transaction } from '@/composables/useGraphQL';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';
import { readHistory } from './userOpHistory';

export type ActivityItem = {
  id: string;
  title: string;
  direction: 'in' | 'out' | 'neutral';
  amount: bigint;
  /** Absent means the chain's native coin. */
  token?: TokenEnum;
  /** Milliseconds since epoch. */
  timestamp: number;
  href: string | null;
};

type ActivityGroup = { title: string; items: ActivityItem[] };

// Direction is the money flow of the queried role, not of the event alone: the
// activity query scopes lock/release/return to the buyer and deposit to the
// seller, so each entry reads from that side of the trade.
const SUBGRAPH: Record<
  Transaction['type'],
  { title: string; direction: ActivityItem['direction'] }
> = {
  deposit: { title: 'Depósito na oferta', direction: 'out' },
  lock: { title: 'Reserva', direction: 'out' },
  release: { title: 'Liberação', direction: 'neutral' },
  return: { title: 'Devolução', direction: 'in' },
};

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
  const graph = useGraphQL(user.network);
  const items = ref<ActivityItem[]>([]);
  const loading = ref(false);

  /** Subgraph rows name their ERC-20 by address; a return carries none, so
   * it reads as the selected one. */
  const tokenAt = (address: string | undefined): TokenEnum =>
    findToken(user.network.value, address)?.symbol ?? user.selectedToken.value;

  const refresh = async (): Promise<void> => {
    const address = account.smartAccountAddress.value;
    if (!address) return;
    const local = readHistory(user.network.value.id, address).map(
      (e): ActivityItem => ({
        id: e.id,
        title: 'Envio',
        direction: 'out',
        amount: BigInt(e.amount),
        token: e.token,
        timestamp: e.timestamp,
        href: e.txHash ? account.explorerTxUrl(e.txHash) : null,
      }),
    );
    items.value = local;
    loading.value = true;
    await graph.fetchUserActivity(address.toLowerCase());
    const remote = graph.transactions.value.map(
      (tx): ActivityItem => ({
        id: tx.id,
        ...SUBGRAPH[tx.type],
        amount: BigInt(tx.amount || '0'),
        token: tokenAt(tx.token),
        timestamp: Number(tx.blockTimestamp) * 1000,
        href: account.explorerTxUrl(tx.transactionHash as Address),
      }),
    );
    items.value = [...local, ...remote].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    loading.value = false;
  };

  return {
    groups: computed(() => groupByMonth(items.value)),
    isEmpty: computed(() => items.value.length === 0),
    loading,
    error: graph.error,
    refresh,
  };
}

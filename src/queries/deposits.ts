import { computed, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';

import type { TokenEnum } from '@/model/NetworkEnum';
import { getNetworksLiquidity } from '@/blockchain/events';
import { queryKeyRoots } from './keys';

/** Deposits offered on every configured network for the selected token:
 * the read spans all networks, so the key carries the token alone. */
export function useNetworkDepositsQuery(token: Ref<TokenEnum>) {
  return useQuery({
    queryKey: computed(() => [...queryKeyRoots.networkDeposits, token.value]),
    queryFn: () => getNetworksLiquidity(token.value),
  });
}

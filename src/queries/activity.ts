import { computed, type Ref } from 'vue';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';

import type { NetworkConfig } from '@/model/NetworkEnum';
import { activityKey, queryKeyRoots } from './keys';
import { fetchActivity, fetchAnalytics } from './graphql';

/** Explorer feed. `address` empty means "all activity"; every distinct
 * address is its own cache entry, and the previous page stays on screen while
 * the next one loads. */
export function useActivityQuery(
  network: Ref<NetworkConfig>,
  address: Ref<string>,
) {
  const normalizedAddress = computed(() => address.value.trim() || null);

  return useQuery({
    queryKey: computed(() =>
      activityKey(network.value.id, normalizedAddress.value),
    ),
    queryFn: () => fetchActivity(network.value, normalizedAddress.value),
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsQuery(network: Ref<NetworkConfig>) {
  return useQuery({
    queryKey: computed(() => [...queryKeyRoots.analytics, network.value.id]),
    queryFn: () => fetchAnalytics(network.value),
  });
}

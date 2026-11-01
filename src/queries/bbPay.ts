import { computed, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';

import {
  createSolicitation,
  getSolicitation,
  loadSolicitation,
  saveSolicitation,
  type Offer,
} from '@/utils/bbPay';
import { queryKeyRoots } from './keys';

/**
 * The Pix charge for a lock, requested once: the fiat leg may already be paid,
 * so a remount (this cache) or a reload (localStorage) reuses the charge
 * instead of posting again. A failed request is not retried either — the
 * prover may have created the charge before the error. Another browser still
 * posts again; only a `lockId` idempotency key on the prover closes that.
 */
export function useLockSolicitationQuery(offer: Ref<Offer | null>) {
  return useQuery({
    queryKey: computed(() => [
      ...queryKeyRoots.solicitation,
      offer.value?.chainId ?? 0,
      String(offer.value?.lockID ?? ''),
    ]),
    queryFn: async () => {
      if (!offer.value) throw new Error('Reserva não encontrada');
      const { chainId, lockID } = offer.value;
      const cached = loadSolicitation(chainId, lockID);
      if (cached) return cached;
      const created = await createSolicitation(offer.value);
      saveSolicitation(chainId, lockID, created);
      return created;
    },
    enabled: computed(() => offer.value !== null),
    staleTime: Infinity,
    gcTime: Infinity,
    // a retry is a second POST /request, i.e. a second charge
    retry: false,
    retryOnMount: false,
  });
}

/**
 * The prover's proof of Pix payment. Polls until it answers with one (`null`
 * means not yet), then stops; a refetch that comes back `null` resumes it.
 */
export function usePixProofQuery(numeroSolicitacao: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => [
      ...queryKeyRoots.pixProof,
      numeroSolicitacao.value ?? '',
    ]),
    queryFn: () => getSolicitation(numeroSolicitacao.value ?? ''),
    enabled: computed(() => Boolean(numeroSolicitacao.value)),
    refetchInterval: (query) => (query.state.data ? false : 10_000),
  });
}

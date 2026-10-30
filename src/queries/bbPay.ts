import { computed, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';

import { createSolicitation, getSolicitation, type Offer } from '@/utils/bbPay';
import { queryKeyRoots } from './keys';

/**
 * The Pix charge for a lock, requested once per page load: a release that
 * reverts remounts the QR step, and the fiat leg may already be paid, so the
 * remount reuses this entry instead of posting again. A failed request is
 * not retried either — the prover may have created the charge before the
 * error. A reload still posts again; only a `lockId` idempotency key on the
 * prover closes that.
 */
export function useLockSolicitationQuery(offer: Ref<Offer | null>) {
  return useQuery({
    queryKey: computed(() => [
      ...queryKeyRoots.solicitation,
      offer.value?.chainId ?? 0,
      String(offer.value?.lockID ?? ''),
    ]),
    queryFn: () => {
      if (!offer.value) throw new Error('Reserva não encontrada');
      return createSolicitation(offer.value);
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

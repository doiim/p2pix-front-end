import { computed, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { zeroAddress, type Address } from 'viem';

import type { NetworkConfig, TokenEnum } from '@/model/NetworkEnum';
import {
  getSellerLockState,
  getWalletDeposits,
  getWalletTransactions,
} from '@/blockchain/wallet';
import { getParticipantID, getUnreleasedLockById } from '@/blockchain/events';
import { getEffectiveWalletAddress } from '@/blockchain/aa/operations';
import { useConnection } from '@wagmi/vue';
import { useUser } from '@/composables/useUser';
import { Networks } from '@/config/networks';
import { lockKey, participantIdKey, queryKeyRoots } from './keys';

/** Deposits a seller still has on the selected network. */
export function useWalletDepositsQuery(
  network: Ref<NetworkConfig>,
  token: Ref<TokenEnum>,
  walletAddress: Ref<Address | null>,
) {
  const tokenAddress = computed(
    () => network.value.tokens[token.value].address,
  );

  return useQuery({
    queryKey: computed(() => [
      ...queryKeyRoots.walletDeposits,
      network.value.id,
      tokenAddress.value,
      walletAddress.value ?? zeroAddress,
    ]),
    queryFn: () => {
      const address = walletAddress.value;
      if (!address) throw new Error('Carteira não conectada');
      return getWalletDeposits(address, network.value, tokenAddress.value);
    },
    enabled: computed(() => Boolean(walletAddress.value)),
  });
}

export function useWalletTransactionsQuery(
  network: Ref<NetworkConfig>,
  walletAddress: Ref<Address | null>,
) {
  return useQuery({
    queryKey: computed(() => [
      ...queryKeyRoots.walletTransactions,
      network.value.id,
      walletAddress.value ?? zeroAddress,
    ]),
    queryFn: () => {
      const address = walletAddress.value;
      if (!address) throw new Error('Carteira não conectada');
      return getWalletTransactions(address, network.value);
    },
    enabled: computed(() => Boolean(walletAddress.value)),
  });
}

/** Value locked against the connected seller and the ids already expired. */
export function useSellerLockStateQuery(
  network: Ref<NetworkConfig>,
  walletAddress: Ref<Address | null>,
) {
  return useQuery({
    queryKey: computed(() => [
      ...queryKeyRoots.sellerLockState,
      network.value.id,
      walletAddress.value ?? zeroAddress,
    ]),
    queryFn: () => {
      const address = walletAddress.value;
      if (!address) throw new Error('Carteira não conectada');
      return getSellerLockState(address, network.value);
    },
    enabled: computed(() => Boolean(walletAddress.value)),
  });
}

/** Lock resolved straight from its id (QR / redirect entry points). */
export function useLockQuery(
  network: Ref<NetworkConfig>,
  lockId: Ref<string | null>,
) {
  return useQuery({
    queryKey: computed(() => lockKey(network.value.id, lockId.value ?? '')),
    queryFn: () => getUnreleasedLockById(BigInt(lockId.value ?? '0')),
    enabled: computed(() => Boolean(lockId.value)),
  });
}

/**
 * The one source for the connected address: the smart account the connector
 * resolves to (Kernel for passkey / social sessions, the connector EOA
 * otherwise). `null` while disconnected, resolving, or when resolution fails;
 * there is deliberately no EOA fallback on error. The key carries the app
 * network and the connector so a switch refetches (TopBar resets the AA cache
 * on chain change before the network moves).
 */
export function useWalletAddress(): Readonly<Ref<Address | null>> {
  const { network } = useUser();
  const connection = useConnection();
  const connectorAddress = computed(() => connection.address.value ?? null);

  const query = useQuery({
    queryKey: computed(
      () =>
        [
          ...queryKeyRoots.aaAddress,
          network.value.id,
          connection.connector.value?.id ?? 'none',
          connectorAddress.value ?? zeroAddress,
        ] as const,
    ),
    // Only the key's values: a switch mid-read cannot store the new account under the old key.
    queryFn: ({ queryKey: [, networkId, connectorId, address] }) => {
      const keyNetwork = Networks.find((n) => n.id === networkId);
      if (address === zeroAddress || !keyNetwork) {
        throw new Error('Carteira não conectada');
      }
      return getEffectiveWalletAddress(address, keyNetwork, connectorId);
    },
    enabled: computed(() => Boolean(connectorAddress.value)),
  });

  return computed(() => query.data.value ?? null);
}

/** PIX target registered on-chain for a seller + token pair. */
export function useParticipantIdQuery(
  network: Ref<NetworkConfig>,
  seller: Ref<Address | undefined>,
  token: Ref<Address | undefined>,
) {
  return useQuery({
    queryKey: computed(() =>
      participantIdKey(
        network.value.id,
        seller.value ?? zeroAddress,
        token.value ?? zeroAddress,
      ),
    ),
    queryFn: () => {
      const sellerAddress = seller.value;
      const tokenAddress = token.value;
      if (!sellerAddress || !tokenAddress) {
        throw new Error('Vendedor e token da reserva não estão disponíveis');
      }
      return getParticipantID(sellerAddress, tokenAddress);
    },
    enabled: computed(() => Boolean(seller.value && token.value)),
  });
}

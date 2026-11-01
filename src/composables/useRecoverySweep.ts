import { computed, ref, watch } from 'vue';
import { useConnection } from '@wagmi/vue';
import { getAddress, type Address, type Hex } from 'viem';

import { UserFacingError, walletErrorMessage } from '@/utils/walletPrompts';
import {
  createRecoveryContext,
  loginWithBackupPasskey,
} from '@/blockchain/aa/recovery';
import {
  readSweepBalances,
  type SweepTokenBalance,
  sweepAccount,
  validateSweepRecipient,
} from '@/blockchain/aa/sweep';
import type { AaContext } from '@/blockchain/aa/types';
import { getPublicClient } from '@/blockchain/provider';
import { useUser } from '@/composables/useUser';
import type { TokenEnum } from '@/model/NetworkEnum';

/** Sweep a Magic smart account with its backup passkey alone. */
export function useRecoverySweep() {
  const user = useUser();
  const connection = useConnection();
  const context = ref<AaContext | null>(null);
  const address = ref<Address | null>(null);
  const balances = ref<{
    eth: bigint;
    tokens: SweepTokenBalance[];
    skipped: TokenEnum[];
  } | null>(null);
  const busy = ref(false);
  const error = ref<string | null>(null);
  const lastUserOpHash = ref<Hex | null>(null);

  // The context is bound to the network it was built on: a switch logs out.
  // Sync, so login's own switch clears before its context is built.
  watch(
    () => user.network.value.id,
    () => {
      context.value = null;
      address.value = null;
      balances.value = null;
    },
    { flush: 'sync' },
  );

  const run = async <T>(task: () => Promise<T>): Promise<T | null> => {
    busy.value = true;
    error.value = null;
    try {
      return await task();
    } catch (cause) {
      console.error(cause);
      error.value = walletErrorMessage(cause, 'Falha na recuperação');
      return null;
    } finally {
      busy.value = false;
    }
  };

  const refreshBalances = async () => {
    const current = context.value;
    if (!current) return;
    const read = await readSweepBalances(current);
    // a network switch during the read already logged out: drop it
    if (context.value === current) balances.value = read;
  };

  const login = () =>
    run(async () => {
      const found = await loginWithBackupPasskey();
      // The handle may pin a chain; the selected network follows it, unless a
      // connected wallet owns the network (TopBar only syncs wallet → app).
      if (
        found.chainId !== undefined &&
        found.chainId !== user.network.value.id
      ) {
        if (connection.isConnected.value) {
          throw new UserFacingError(
            'Esta conta é de outra rede: desconecte a carteira para recuperá-la',
          );
        }
        user.setNetworkById(found.chainId);
      }
      const network = user.network.value;
      const built = await createRecoveryContext(
        network,
        getPublicClient(),
        found,
      );
      // a network switch during the build already logged out: drop it
      if (user.network.value.id !== network.id) return;
      context.value = built;
      address.value = found.address;
      await refreshBalances();
    });

  const sweep = async (recipient: string) => {
    const result = await run(async () => {
      const current = context.value;
      if (!current) {
        throw new UserFacingError('Entre com a passkey de backup primeiro');
      }
      const invalid = validateSweepRecipient(recipient, address.value);
      if (invalid) throw new UserFacingError(invalid);
      return sweepAccount(current, getAddress(recipient));
    });
    if (!result) return null;
    lastUserOpHash.value = result.userOpHash;
    // The sweep already landed; a failed refresh must not read as a failed sweep.
    await run(refreshBalances);
    return result;
  };

  return {
    address,
    balances,
    busy,
    error,
    lastUserOpHash,
    isLoggedIn: computed(() => context.value !== null),
    login,
    sweep,
  };
}

import { computed } from 'vue';
import { useMutation, useQuery } from '@tanstack/vue-query';
import { useConnection } from '@wagmi/vue';
import { isAddressEqual } from 'viem';
import {
  encodeInstallBackupPasskey,
  registerBackupPasskey,
} from '@doiim/passkeys/smart-account';

import { readBackupPasskeyInstalled } from '@/blockchain/aa/recovery';
import { isAaAvailable } from '@/blockchain/aa/aaContext';
import { getPublicClient } from '@/blockchain/provider';
import { UserFacingError } from '@/utils/walletPrompts';
import { getSender, sendContractCalls } from '@/blockchain/send';
import { requireRpId, rpId } from '@/config/aa';
import { useUser } from '@/composables/useUser';
import { queryClient } from '@/queries/client';
import { queryKeyRoots } from '@/queries/keys';
import { useWalletAddress } from '@/queries/wallet';
import { MAGIC_CONNECTOR_ID } from '@/wallet/magic';

/**
 * Backup passkey for a Magic smart account: a second signer, held in the
 * user's authenticator, that can recover the funds without Magic.
 */
export function useBackupPasskey() {
  const { network } = useUser();
  const connection = useConnection();
  const walletAddress = useWalletAddress();

  const isEligible = computed(
    () =>
      connection.connector.value?.id === MAGIC_CONNECTOR_ID &&
      isAaAvailable(network.value) &&
      rpId !== null,
  );

  const statusQuery = useQuery({
    queryKey: computed(
      () =>
        [
          ...queryKeyRoots.backupPasskey,
          network.value.id,
          walletAddress.value ?? '0x',
        ] as const,
    ),
    // Only the key's values: reading the selected chain let a network switch
    // mid-read store chain B's backup status under chain A, which then showed
    // or hid "Adicionar passkey de backup" on the wrong network.
    queryFn: ({ queryKey: [, chainId, address] }) => {
      if (address === '0x') throw new UserFacingError('Carteira não conectada');
      return readBackupPasskeyInstalled(getPublicClient(chainId), address);
    },
    enabled: computed(() => isEligible.value && Boolean(walletAddress.value)),
  });

  /** True only once the chain confirmed there is none; unknown is not "missing". */
  const needsBackup = computed(
    () => isEligible.value && statusQuery.data.value === false,
  );

  const installMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const address = walletAddress.value;
      // Installing replaces the single validator slot, and registering again
      // replaces the authenticator's credential: never run it over a backup
      // that exists.
      if (!address || !needsBackup.value) {
        throw new UserFacingError(
          'Não é possível adicionar a passkey de backup agora',
        );
      }
      // The credential is bound to `address` and `chainId`; the install is
      // sent by the active smart account on the current network. Both must
      // still match after the authenticator prompt, or the install lands on
      // another chain's slot.
      const chainId = network.value.id;
      const assertSameAccount = async () => {
        const sender = await getSender();
        if (
          network.value.id !== chainId ||
          !sender.isSmartAccount ||
          !isAddressEqual(sender.address, address)
        ) {
          throw new UserFacingError('A conta ou a rede mudou; tente novamente');
        }
        return sender;
      };
      await assertSameAccount();
      // The cached status can be stale (installed from another tab or
      // device); re-read the chain before replacing the credential.
      if (await readBackupPasskeyInstalled(getPublicClient(chainId), address)) {
        throw new UserFacingError('Esta conta já tem uma passkey de backup');
      }
      const credential = await registerBackupPasskey({
        address,
        chainId,
        rpId: requireRpId(),
        userName: 'Backup P2Pix',
      });
      const sender = await assertSameAccount();
      // Installs a validator on the Kernel account: only the smart account can send it.
      const result = await sendContractCalls(
        sender,
        [
          encodeInstallBackupPasskey({
            account: address,
            credentialId: credential.credentialId,
            publicKeyX: credential.publicKeyX,
            publicKeyY: credential.publicKeyY,
          }),
        ],
        { aaOnly: true },
      );
      if (!result.success)
        throw new UserFacingError('Falha ao instalar a passkey');
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeyRoots.backupPasskey }),
  });

  return {
    isEligible,
    needsBackup,
    installing: computed(() => installMutation.isPending.value),
    install: () => installMutation.mutateAsync(),
  };
}

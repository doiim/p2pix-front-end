import type { Address, PublicClient } from 'viem';
import { authenticatePasskey } from '@doiim/passkeys';
import {
  isBackupPasskeyInstalled,
  parseBackupUserHandle,
  toKernelBackupPasskeyAccount,
} from '@doiim/passkeys/smart-account';

import { requireRpId } from '@/config/aa';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { createAaContext, isAaAvailable } from './aaContext';
import type { AaContext } from './types';

export type BackupLogin = {
  address: Address;
  credentialId: string;
  /** Set when the passkey was registered for one specific chain. */
  chainId?: number;
};

/**
 * Discoverable passkey login: the authenticator picks the credential and
 * returns the account address it was registered for as the userHandle, so no
 * wallet, Magic session or server is involved.
 */
export const loginWithBackupPasskey = async (): Promise<BackupLogin> => {
  const assertion = await authenticatePasskey({ rpId: requireRpId() });
  const handle = parseBackupUserHandle(assertion.userHandle);
  if (!handle) {
    throw new Error('Esta passkey não é uma passkey de backup do P2Pix');
  }
  return { ...handle, credentialId: assertion.credentialId };
};

/** Sending rail for the account behind `login`, signing with its backup passkey. */
export const createRecoveryContext = async (
  network: NetworkConfig,
  publicClient: PublicClient,
  login: BackupLogin,
): Promise<AaContext> => {
  if (login.chainId !== undefined && login.chainId !== network.id) {
    throw new Error('Esta passkey foi registrada em outra rede');
  }
  if (!isAaAvailable(network)) {
    throw new Error('A conta inteligente não está disponível nesta rede');
  }
  if (!(await isBackupPasskeyInstalled(publicClient, login.address))) {
    throw new Error(
      'Esta conta não tem passkey de backup instalada nesta rede',
    );
  }
  const account = await toKernelBackupPasskeyAccount({
    client: publicClient,
    address: login.address,
    credentialId: login.credentialId,
    rpId: requireRpId(),
  });
  return createAaContext({ network, publicClient }, account);
};

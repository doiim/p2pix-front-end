import { concat, parseAbi, type Address, type PublicClient } from 'viem';
import { authenticatePasskey } from '@doiim/passkeys';
import {
  KERNEL_WEBAUTHN_VALIDATOR,
  parseBackupUserHandle,
  toKernelBackupPasskeyAccount,
} from '@doiim/passkeys/smart-account';

import { requireRpId } from '@/config/aa';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { createAaContext } from './aaContext';
import type { AaContext } from './types';
import { UserFacingError } from '@/utils/walletPrompts';

const kernelAbi = parseAbi([
  'function isAllowedSelector(bytes21 vId, bytes4 selector) view returns (bool)',
]);
// `execute(bytes32,bytes)`: the selector the backup validator is granted.
const EXECUTE_SELECTOR = '0xe9ae5c53';
const VALIDATOR_TYPE = '0x01';

/**
 * Whether the backup validator is installed on `account`, with RPC errors
 * propagated: the library's own check answers false on any failed read, which
 * would offer (and let through) a second install over an existing backup.
 * No code at the address is the one real "nothing installed": undeployed.
 */
export const readBackupPasskeyInstalled = async (
  client: PublicClient,
  account: Address,
): Promise<boolean> => {
  const code = await client.getCode({ address: account });
  if (!code || code === '0x') return false;
  return client.readContract({
    address: account,
    abi: kernelAbi,
    functionName: 'isAllowedSelector',
    args: [
      concat([VALIDATOR_TYPE, KERNEL_WEBAUTHN_VALIDATOR]),
      EXECUTE_SELECTOR,
    ],
  });
};

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
    throw new UserFacingError(
      'Esta passkey não é uma passkey de backup do P2Pix',
    );
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
    throw new UserFacingError('Esta passkey foi registrada em outra rede');
  }
  // Bundler only: the self-pay sweep needs no sponsorship policy.
  if (!network.aa?.bundlerUrl) {
    throw new UserFacingError(
      'A conta inteligente não está disponível nesta rede',
    );
  }
  if (!(await readBackupPasskeyInstalled(publicClient, login.address))) {
    throw new UserFacingError(
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

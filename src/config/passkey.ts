// Single source of truth for the passkey smart-account chain, RPC and mode.
//
// A Kernel account follows the active P2Pix trading network. Account creation
// and operations must call the resolvers below with that same network; pinning
// the connector to Arbitrum made locks on other deployments impossible.
//
// Local anvil dev is the one exception: it keeps the local exactly-mode plugin
// deployment and the anvil network, both driven by env.
import type { Chain } from 'viem';

import { env } from '@/config/env';
import { DEFAULT_NETWORK } from '@/config/networks';

/** True when running against a local anvil node (VITE_LOCAL_P2PIX_ADDRESS set). */
export const passkeyIsLocal = Boolean(env.local.p2pix);

/** Resolve the smart-account chain from the active trading selection. */
export const resolvePasskeyChain = (activeNetwork: Chain): Chain =>
  activeNetwork;

/** Resolve reads against the active chain, respecting its RPC overlay. */
export const resolvePasskeyRpcUrl = (activeNetwork: Chain): string =>
  activeNetwork.rpcUrls.default.http[0];

/** @deprecated Pass the active chain to resolvePasskeyChain instead. */
export const passkeyChain = resolvePasskeyChain(DEFAULT_NETWORK);

/** RPC for passkey chain reads + the bundler's public client (non-local path). */
export const passkeyRpcUrl: string = resolvePasskeyRpcUrl(passkeyChain);

/**
 * Account kind. Kernel off local (no custom deploy — the Kernel factory is on
 * every chain permissionless supports); env-driven locally (defaults to
 * exactly-mode against the local plugin).
 */
export const passkeyAccountKind: 'kernel' | 'exactly-mode' = passkeyIsLocal
  ? env.passkey.accountKind
  : 'kernel';

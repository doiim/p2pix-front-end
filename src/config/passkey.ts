// Single source of truth for the passkey smart-account chain, RPC and mode.
//
// The passkey smart account is deliberately decoupled from the P2Pix trading
// network (Sepolia / Rootstock). Off local dev it ALWAYS runs on Arbitrum One
// in kernel mode — that's where the ERC-4337 infra is deployed and gas is
// cheapest. Both consumers MUST read the passkey chain/mode from here so that
// account derivation (config/appkit.ts → the wagmi connector) and account
// operations (composables/usePasskeyAccount.ts → sweep/balances/owners) land on
// the same chain with the same account kind — otherwise they derive different
// smart-account addresses and the flow silently breaks.
//
// Local anvil dev is the one exception: it keeps the local exactly-mode plugin
// deployment and the anvil network, both driven by env.
import { arbitrum } from '@doiim/reown-appkit/networks';
import type { Chain } from 'viem';

import { env } from '@/config/env';

/** True when running against a local anvil node (VITE_LOCAL_P2PIX_ADDRESS set). */
export const passkeyIsLocal = Boolean(env.local.p2pix);

/** The chain the passkey smart account lives on off local dev: Arbitrum One (42161). */
export const passkeyChain = arbitrum as unknown as Chain;

/** RPC for passkey chain reads + the bundler's public client (non-local path). */
export const passkeyRpcUrl: string =
  env.arbitrum.rpc || arbitrum.rpcUrls.default.http[0];

/**
 * Account kind. Kernel on Arbitrum (no custom deploy — the Kernel factory is on
 * every chain permissionless supports); env-driven locally (defaults to
 * exactly-mode against the local plugin).
 */
export const passkeyAccountKind: 'kernel' | 'exactly-mode' = passkeyIsLocal
  ? env.passkey.accountKind
  : 'kernel';

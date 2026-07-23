/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID: string;
  readonly VITE_ENVIRONMENT?: string;
  readonly VITE_APP_API_URL?: string;
  readonly VITE_SEPOLIA_API_URL?: string;
  readonly VITE_SEPOLIA_P2PIX_ADDRESS?: `0x${string}`;
  readonly VITE_SEPOLIA_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_SEPOLIA_SUBGRAPH_URL?: string;
  readonly VITE_SEPOLIA_CHAIN_ID?: string;
  readonly VITE_RSK_API_URL?: string;
  readonly VITE_RSK_P2PIX_ADDRESS?: `0x${string}`;
  readonly VITE_RSK_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_RSK_SUBGRAPH_URL?: string;
  readonly VITE_ARBITRUM_API_URL?: string;
  readonly VITE_ARBITRUM_P2PIX_ADDRESS?: `0x${string}`;
  readonly VITE_ARBITRUM_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_ARBITRUM_SUBGRAPH_URL?: string;
  readonly VITE_MAINNET_API_URL?: string;
  readonly VITE_MAINNET_P2PIX_ADDRESS?: `0x${string}`;
  readonly VITE_MAINNET_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_MAINNET_SUBGRAPH_URL?: string;
  readonly VITE_LOCAL_RPC_URL?: string;
  readonly VITE_LOCAL_P2PIX_ADDRESS?: `0x${string}`;
  readonly VITE_LOCAL_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_PASSKEY_RP_ID?: string;
  readonly VITE_PIMLICO_API_KEY?: string;
  readonly VITE_PIMLICO_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_PIMLICO_ARBITRUM_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_ARBITRUM_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_PIMLICO_MAINNET_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_MAINNET_SPONSORSHIP_POLICY_ID?: string;
  readonly VITE_PIMLICO_MAINNET_PAYMASTER_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_MAINNET_PAYMASTER_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_PIMLICO_ARBITRUM_PAYMASTER_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_ARBITRUM_PAYMASTER_TOKEN_ADDRESS?: `0x${string}`;
  readonly VITE_MAINNET_BUNDLER_URL?: string;
  readonly VITE_ARBITRUM_BUNDLER_URL?: string;
  readonly VITE_ACCOUNT_KIND?: 'exactly-mode' | 'kernel';
  readonly VITE_WEBAUTHN_PLUGIN_ADDRESS?: `0x${string}`;
  readonly VITE_WEBAUTHN_FACTORY_ADDRESS?: `0x${string}`;
  readonly VITE_ENTRYPOINT_ADDRESS?: `0x${string}`;
  readonly VITE_BUNDLER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_ENVIRONMENT: string;
  readonly VITE_SEPOLIA_API_URL: string;
  readonly VITE_SEPOLIA_P2PIX_ADDRESS: string;
  readonly VITE_SEPOLIA_TOKEN_ADDRESS: string;
  readonly VITE_SEPOLIA_SUBGRAPH_URL: string;
  readonly VITE_RSK_API_URL: string;
  readonly VITE_RSK_P2PIX_ADDRESS: string;
  readonly VITE_RSK_TOKEN_ADDRESS: string;
  readonly VITE_RSK_SUBGRAPH_URL: string;
  readonly VITE_REOWN_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

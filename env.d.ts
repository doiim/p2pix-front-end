/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

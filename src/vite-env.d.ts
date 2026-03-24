/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORCHESTRATION_MODELS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

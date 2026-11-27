/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Set to "1" on Vercel (the platform injects VERCEL=1 at build time).
   * Absent in local dev and CI preview, so analytics is never injected there.
   */
  readonly VERCEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Comma-separated handoff Cc. Optional. Defaults to Kevin and Deb when empty. Not a secret. */
  readonly VITE_REFERRAL_CC?: string;
}

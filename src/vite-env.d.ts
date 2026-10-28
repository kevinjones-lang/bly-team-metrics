/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Comma-separated handoff Cc. Optional. Defaults to Kevin and Deb when empty. Not a secret. */
  readonly VITE_REFERRAL_CC?: string;
  /** Public Azure app (SPA) client id. Not a secret. Empty uses the referral-outlook Edge Function. */
  readonly VITE_MICROSOFT_CLIENT_ID?: string;
  /** Azure tenant id or domain. Optional. Defaults to `organizations` when the client id is set. */
  readonly VITE_MICROSOFT_TENANT_ID?: string;
}

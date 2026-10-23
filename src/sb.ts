import { createClient } from "@supabase/supabase-js";
export const SB_URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(SB_URL || "http://localhost", KEY || "anon", { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });

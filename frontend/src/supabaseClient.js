import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const BUSINESS_ID = import.meta.env.VITE_BUSINESS_ID;

export const configError =
  !url || !anonKey || !BUSINESS_ID
    ? "Supabase is not configured. Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_BUSINESS_ID to frontend/.env, then restart npm run dev."
    : "";

export const supabase = configError ? null : createClient(url, anonKey);
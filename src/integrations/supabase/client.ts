import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Use the legacy JWT anon key — required for Edge Function JWT verification (verify_jwt: true).
// The new sb_publishable_ key format causes 401s on edge functions.
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing VITE_SUPABASE_URL");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY");
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      apikey: SUPABASE_ANON_KEY,
    },
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
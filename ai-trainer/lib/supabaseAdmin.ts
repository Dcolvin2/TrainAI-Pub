// lib/supabaseAdmin.ts
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // NOT public

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

// Optional: default export too, in case some files do `import admin from './supabaseAdmin'`
export default getSupabaseAdmin;



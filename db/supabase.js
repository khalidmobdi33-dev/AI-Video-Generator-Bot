import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(`[${new Date().toISOString()}] ERROR: Supabase credentials are not set`);
}

export function createSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured');
  }

  const client = createClient(supabaseUrl, supabaseKey);
  console.log(`[${new Date().toISOString()}] Supabase client created`);
  return client;
}


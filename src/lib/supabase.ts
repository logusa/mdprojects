import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Cliente de Supabase listo para ser usado en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
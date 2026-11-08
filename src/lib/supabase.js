import { createClient } from '@supabase/supabase-js';
import { resolveFetch } from './nativeFetch';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey, { fetch: resolveFetch() });

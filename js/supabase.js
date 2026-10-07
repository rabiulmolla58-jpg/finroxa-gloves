import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://crouuddxyuxvqdnbmxxe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7SxPTf0gsmDv70Ge-w0vJw_umKyO8wi';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SUPABASE_URL = 'https://pvvohvusyhmfiiptjqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KH-HODHmoPu1EcmNtfkT7g_dWnXeBbc';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;

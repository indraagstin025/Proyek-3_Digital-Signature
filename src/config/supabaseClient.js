import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export const supabaseBucket = process.env.SUPABASE_BUCKET_NAME;

export const supabase = createClient(supabaseUrl, supabaseKey);

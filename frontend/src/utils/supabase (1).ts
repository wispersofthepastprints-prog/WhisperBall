import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://kkloxdrebbssbuosoccd.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbG94ZHJlYmJzc2J1b3NvY2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjEzNDMsImV4cCI6MjEwMTkzNzM0M30.DJsinHC1cVsODhmgDS6ldTufg8yWelUJxjA32em8ukg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

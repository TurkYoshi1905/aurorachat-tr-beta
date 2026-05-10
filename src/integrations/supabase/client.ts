import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  || 'https://ktittqaubkaylprxnoya.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXR0cWF1YmtheWxwcnhub3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzI3NDAsImV4cCI6MjA4ODIwODc0MH0.nmgU8lXCueNmDyoDtX94x9uOAY9292ZTFaaXz8XI3dU';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});


import { createClient } from '@supabase/supabase-js';

// Credentials provided for the Bubble project
const PROJECT_URL = "https://wnrppwuxcaewvylrdpyd.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducnBwd3V4Y2Fld3Z5bHJkcHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTk0NTUsImV4cCI6MjA4MDY5NTQ1NX0.IUiU12Oti_pxunSJR1NR_nGgg22d9ymq0m6HSZOBCzA";

console.log("Bubble: Initializing Supabase Client...");

export const supabase = createClient(PROJECT_URL, ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    global: {
        headers: { 'x-application-name': 'bubble-math' },
    }
});

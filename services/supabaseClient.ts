
import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables in different environments (Vite, CRA, Node)
const getEnv = (key: string) => {
    try {
        // Check for Node/Process-style env vars (Preferred for non-VITE setup)
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
    } catch (e) {}

    try {
        // Check for Vite-style env vars (Fallback if user switches back to VITE_ logic later, or using custom build)
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            // @ts-ignore
            return import.meta.env[key];
        }
    } catch (e) {}
    
    return '';
};

// Hardcoded fallbacks provided by user to ensure the app works immediately
const DEFAULT_URL = "https://wnrppwuxcaewvylrdpyd.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducnBwd3V4Y2Fld3Z5bHJkcHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTk0NTUsImV4cCI6MjA4MDY5NTQ1NX0.IUiU12Oti_pxunSJR1NR_nGgg22d9ymq0m6HSZOBCzA";

const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL') || DEFAULT_URL;
const supabaseKey = getEnv('SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY') || DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase URL or Key is missing. App may crash.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
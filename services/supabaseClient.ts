
import { createClient } from '@supabase/supabase-js';

// Configuration strictly using the provided Project ID
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

/**
 * Wraps a promise with a timeout to prevent infinite hanging.
 */
export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 15000, errorMsg = "Request timed out"): Promise<T> => {
    let timeoutHandle: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutHandle);
        return result;
    } catch (error) {
        clearTimeout(timeoutHandle);
        throw error;
    }
};

/**
 * Retries an async operation with exponential backoff.
 * Essential for Supabase connectivity issues or cold starts.
 */
export const withRetry = async <T>(
    operation: () => Promise<T>, 
    retries: number = 3, 
    baseDelay: number = 1000
): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        if (retries <= 0) throw error;
        
        // Don't retry on Auth/Permission errors (401, 403) or specific Postgrest errors that won't resolve with time
        if (error.status === 401 || error.status === 403 || error.code === 'PGRST301' || error.code === '23505') {
            throw error;
        }

        console.warn(`Supabase op failed, retrying... (${retries} left). Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, baseDelay));
        return withRetry(operation, retries - 1, baseDelay * 2);
    }
};

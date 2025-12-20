import { User } from '../types';
import { supabase, withTimeout, withRetry } from './supabaseClient';

export const authService = {
    async login(email: string, password: string, captchaToken?: string): Promise<User> {
        try {
            const { data, error } = await withTimeout(
                supabase.auth.signInWithPassword({
                    email,
                    password,
                    options: { captchaToken }
                }), 
                20000
            ) as any;

            if (error) throw new Error(error.message);
            if (!data.user) throw new Error("No user data returned");

            return {
                id: data.user.id,
                name: data.user.user_metadata?.full_name || email.split('@')[0],
                email: data.user.email || "",
                avatarUrl: data.user.user_metadata?.avatar_url,
                hasOnboarded: data.user.user_metadata?.hasOnboarded || false
            };
        } catch (e: any) {
            throw new Error(e.message || "Login failed.");
        }
    },

    async signup(name: string, email: string, password: string, captchaToken?: string): Promise<User> {
        try {
            const { data, error } = await withTimeout(
                supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: name, hasOnboarded: false },
                        captchaToken
                    },
                }),
                20000
            ) as any;

            if (error) throw new Error(error.message);
            if (!data.user) throw new Error("Signup failed");

            return {
                id: data.user.id,
                name: name,
                email: data.user.email || "",
                hasOnboarded: false
            };
        } catch (e: any) {
             throw new Error(e.message || "Signup failed.");
        }
    },

    async loginWithGoogle(): Promise<void> {
        const redirectUrl = window.location.origin.replace(/\/$/, '');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: redirectUrl }
        });
        if (error) throw new Error(`Google Auth Error: ${error.message}`);
    },

    async logout(): Promise<void> {
        try {
            const { error } = await withTimeout(supabase.auth.signOut(), 5000) as any;
            if (error) console.error("Error signing out:", error);
        } catch (e) { }
    },

    async getCurrentUser(): Promise<User | null> {
        try {
            const { data: { session } } = await withTimeout(supabase.auth.getSession(), 5000) as any;
            if (!session?.user) return null;

            return {
                id: session.user.id,
                name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
                email: session.user.email || "",
                avatarUrl: session.user.user_metadata?.avatar_url,
                hasOnboarded: session.user.user_metadata?.hasOnboarded || false
            };
        } catch (e) {
            return null;
        }
    },

    async completeOnboarding(): Promise<void> {
        try {
            await withTimeout(supabase.auth.updateUser({
                data: { hasOnboarded: true }
            }), 10000);
        } catch (e) { }
    },

    // --- API Key Management (Restored) ---

    async getGeminiKey(userId: string): Promise<string | null> {
        try {
            const result = await withRetry(async () => {
                return await supabase
                    .from('user_api_keys')
                    .select('encrypted_key')
                    .eq('user_id', userId)
                    .eq('provider', 'gemini')
                    .maybeSingle();
            });
            if (result.error) return null;
            return result.data ? result.data.encrypted_key : null;
        } catch (e) {
            return null;
        }
    },

    async saveGeminiKey(userId: string, key: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return { success: false, error: "No active session." };
            
            const { error: upsertError } = await withRetry(async () => {
                return await supabase
                    .from('user_api_keys')
                    .upsert({ 
                        user_id: session.user.id, 
                        provider: 'gemini', 
                        encrypted_key: key, 
                        is_valid: true
                    }, { onConflict: 'user_id,provider' });
            });
            
            if (upsertError) return { success: false, error: upsertError.message };
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    async removeGeminiKey(userId: string): Promise<void> {
        try {
            await withRetry(async () => {
                return await supabase
                    .from('user_api_keys')
                    .delete()
                    .eq('user_id', userId)
                    .eq('provider', 'gemini');
            });
        } catch (e) { }
    }
};
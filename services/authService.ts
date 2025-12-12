
import { User } from '../types';
import { supabase } from './supabaseClient';

export const authService = {
    async login(email: string, password: string, captchaToken?: string): Promise<User> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: {
                captchaToken
            }
        });

        if (error) throw new Error(error.message);
        if (!data.user) throw new Error("No user data returned");

        return {
            id: data.user.id,
            name: data.user.user_metadata?.full_name || email.split('@')[0],
            email: data.user.email || "",
            avatarUrl: data.user.user_metadata?.avatar_url,
            hasOnboarded: data.user.user_metadata?.hasOnboarded || false
        };
    },

    async signup(name: string, email: string, password: string, captchaToken?: string): Promise<User> {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    hasOnboarded: false
                },
                captchaToken
            },
        });

        if (error) throw new Error(error.message);
        if (!data.user) throw new Error("Signup failed");

        return {
            id: data.user.id,
            name: name,
            email: data.user.email || "",
            hasOnboarded: false
        };
    },

    async loginWithGoogle(): Promise<void> {
        // Ensure the redirect URL is clean (no trailing slash) to prevent "invalid path" errors
        const redirectUrl = window.location.origin.replace(/\/$/, '');
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) throw new Error(error.message);
    },

    async logout(): Promise<void> {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Error signing out:", error);
    },

    async getCurrentUser(): Promise<User | null> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return null;

            return {
                id: session.user.id,
                name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
                email: session.user.email || "",
                avatarUrl: session.user.user_metadata?.avatar_url,
                hasOnboarded: session.user.user_metadata?.hasOnboarded || false
            };
        } catch (e) {
            console.error("Error getting current user:", e);
            return null;
        }
    },

    async completeOnboarding(): Promise<void> {
        try {
            const { error } = await supabase.auth.updateUser({
                data: { hasOnboarded: true }
            });
            if (error) console.warn("Failed to sync onboarding:", error.message);
        } catch (e) { }
    },

    // --- API Key Management (USER_API_KEYS Table) ---

    async getGeminiKey(userId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('USER_API_KEYS')
                .select('encrypted_key')
                .eq('user_id', userId)
                .eq('provider', 'gemini')
                .limit(1)
                .maybeSingle();
            
            if (error) {
                // If the table doesn't exist or RLS blocks it, return null gracefully
                console.warn("Bubble DB Warning [getGeminiKey]:", error.message);
                return null;
            }
            if (data) {
                return data.encrypted_key;
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    async saveGeminiKey(userId: string, key: string): Promise<{ success: boolean; error?: string }> {
        console.log("Bubble: Saving API Key...");
        try {
            // CRITICAL: Get the ACTUAL session ID to ensure RLS compliance.
            // Do not rely solely on the 'userId' argument which might be stale.
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                return { success: false, error: "No active session" };
            }
            
            const sessionUserId = session.user.id;

            // STRATEGY: Delete existing key(s) first to ensure clean state
            const { error: deleteError } = await supabase
                .from('USER_API_KEYS')
                .delete()
                .eq('user_id', sessionUserId)
                .eq('provider', 'gemini');

            if (deleteError) {
                console.warn("Bubble DB Warning [Delete Old Key]:", deleteError.message);
            }

            // Insert new key using the SESSION ID
            const { error: insertError } = await supabase
                .from('USER_API_KEYS')
                .insert({ 
                    user_id: sessionUserId, 
                    provider: 'gemini', 
                    encrypted_key: key, 
                    is_valid: true,
                    last_error: "" 
                });
            
            if (insertError) {
                console.error("Bubble DB Error [Insert]:", insertError.message);
                return { success: false, error: insertError.message };
            }

            console.log("Bubble: API Key saved successfully.");
            return { success: true };
        } catch (e: any) {
            console.error("Bubble DB Critical Error:", e.message);
            return { success: false, error: e.message };
        }
    },

    async removeGeminiKey(userId: string): Promise<void> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase
                .from('USER_API_KEYS')
                .delete()
                .eq('user_id', session.user.id)
                .eq('provider', 'gemini');
            
            if (error) console.error("Bubble DB Error [Remove]:", error.message);
        } catch (e: any) {
             console.error("Bubble DB Error:", e.message);
        }
    }
};

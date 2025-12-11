
import { User } from '../types';
import { supabase } from './supabaseClient';

export const authService = {
    async login(email: string, password: string): Promise<User> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
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

    async signup(name: string, email: string, password: string): Promise<User> {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    hasOnboarded: false
                },
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
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
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
                console.error("Bubble DB Error [getGeminiKey]:", error.message);
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return { success: false, error: "No active session" };

            // STRATEGY: Delete existing key(s) first to ensure clean state and avoid duplication issues
            // This relies on the RLS policy allowing DELETE for the auth user.
            const { error: deleteError } = await supabase
                .from('USER_API_KEYS')
                .delete()
                .eq('user_id', userId)
                .eq('provider', 'gemini');

            if (deleteError) {
                console.warn("Bubble DB Warning [Delete Old Key]:", deleteError.message);
                // We proceed to insert anyway, as the delete might fail if no rows exist or RLS quirks, 
                // but usually it's fine.
            }

            // Insert new key
            // Crucial: Must provide 'last_error' as empty string because column is NOT NULL with no default
            const { error: insertError } = await supabase
                .from('USER_API_KEYS')
                .insert({ 
                    user_id: userId, 
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
            const { error } = await supabase
                .from('USER_API_KEYS')
                .delete()
                .eq('user_id', userId)
                .eq('provider', 'gemini');
            
            if (error) console.error("Bubble DB Error [Remove]:", error.message);
        } catch (e: any) {
             console.error("Bubble DB Error:", e.message);
        }
    }
};

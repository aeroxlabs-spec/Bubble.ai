
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
            // Note: Schema uses 'encrypted_key'
            const { data, error } = await supabase
                .from('USER_API_KEYS')
                .select('encrypted_key')
                .eq('user_id', userId)
                .eq('provider', 'gemini')
                .maybeSingle();
            
            if (error) {
                console.error("Bubble DB Error [getGeminiKey]:", error.message);
                return null;
            }
            if (data) {
                console.debug("Bubble: Cloud Key Loaded.");
                return data.encrypted_key; // Return mapped column
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    async saveGeminiKey(userId: string, key: string): Promise<void> {
        console.log("Bubble: Attempting to save API Key to Cloud...");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error("Bubble DB Error: No active session found when saving key.");
                return;
            }

            // Robust Check-then-Upsert
            const { data: existing, error: selectError } = await supabase
                .from('USER_API_KEYS')
                .select('id')
                .eq('user_id', userId)
                .eq('provider', 'gemini')
                .maybeSingle();

            if (selectError) {
                console.error("Bubble DB Error [Check Existing]:", selectError.message);
                return;
            }

            if (existing) {
                console.log("Bubble: Updating existing cloud key...");
                // Note: Schema requires 'encrypted_key' and 'is_valid'
                const { error: updateError } = await supabase
                    .from('USER_API_KEYS')
                    .update({ 
                        encrypted_key: key, 
                        is_valid: true,
                        last_error: "", // Required by schema
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                
                if (updateError) {
                    console.error("Bubble DB Error [Update]:", updateError.message);
                } else {
                    console.log("Bubble: API Key updated successfully.");
                }
            } else {
                console.log("Bubble: Inserting new cloud key...");
                // Note: Schema requires 'encrypted_key', 'is_valid', 'last_error'
                const { error: insertError } = await supabase
                    .from('USER_API_KEYS')
                    .insert({ 
                        user_id: userId, 
                        provider: 'gemini', 
                        encrypted_key: key, 
                        is_valid: true,
                        last_error: "" // Required by schema (NOT NULL)
                    });
                
                if (insertError) {
                    console.error("Bubble DB Error [Insert]:", insertError.message);
                } else {
                    console.log("Bubble: API Key inserted successfully.");
                }
            }
        } catch (e: any) {
            console.error("Bubble DB Critical Error:", e.message);
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
            else console.log("Bubble: Cloud Key Removed.");
        } catch (e: any) {
             console.error("Bubble DB Error:", e.message);
        }
    }
};

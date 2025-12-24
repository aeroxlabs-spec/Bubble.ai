

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

        // Map Supabase user to our App User type
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase.auth.updateUser({
                data: { hasOnboarded: true }
            });
            if (error) {
                if (!error.message.includes('Auth session missing')) {
                    console.warn("Failed to sync onboarding:", error.message);
                }
            }
        } catch (e) {
            // Suppress
        }
    },

    // --- API Key Management (USER_API_KEYS Table) ---

    async getGeminiKey(userId: string): Promise<string | null> {
        try {
            // Check session first to avoid RLS issues
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return null;

            const { data, error } = await supabase
                .from('USER_API_KEYS')
                .select('api_key')
                .eq('user_id', userId)
                .eq('provider', 'gemini')
                .maybeSingle();
            
            if (error) {
                return null;
            }
            return data?.api_key || null;
        } catch (e) {
            return null;
        }
    },

    async saveGeminiKey(userId: string, key: string): Promise<void> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Check if exists first
            const { data, error: selectError } = await supabase
                .from('USER_API_KEYS')
                .select('id')
                .eq('user_id', userId)
                .eq('provider', 'gemini')
                .maybeSingle();

            if (selectError && selectError.code !== 'PGRST116') {
                 throw selectError;
            }

            if (data) {
                // Update
                const { error } = await supabase
                    .from('USER_API_KEYS')
                    .update({ 
                        api_key: key, 
                        is_valid: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', data.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('USER_API_KEYS')
                    .insert({ 
                        user_id: userId, 
                        provider: 'gemini', 
                        api_key: key, 
                        is_valid: true 
                    });
                if (error) throw error;
            }
        } catch (e: any) {
            console.warn("Saving to DB failed, fallback to local storage active.", e.message);
        }
    },

    async removeGeminiKey(userId: string): Promise<void> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase
                .from('USER_API_KEYS')
                .delete()
                .eq('user_id', userId)
                .eq('provider', 'gemini');
            
            if (error) throw error;
        } catch (e: any) {
             // Ignore
        }
    }
};
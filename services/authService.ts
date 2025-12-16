
import { User } from '../types';
import { supabase, withTimeout, withRetry } from './supabaseClient';

export const authService = {
    async login(email: string, password: string, captchaToken?: string): Promise<User> {
        try {
            const { data, error } = await withTimeout(
                supabase.auth.signInWithPassword({
                    email,
                    password,
                    options: {
                        captchaToken
                    }
                }), 
                20000 // 20s timeout for auth
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
            throw new Error(e.message || "Login failed due to timeout or network error.");
        }
    },

    async signup(name: string, email: string, password: string, captchaToken?: string): Promise<User> {
        try {
            const { data, error } = await withTimeout(
                supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                            hasOnboarded: false
                        },
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
             throw new Error(e.message || "Signup failed due to timeout or network error.");
        }
    },

    async loginWithGoogle(): Promise<void> {
        const redirectUrl = window.location.origin.replace(/\/$/, '');
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) throw new Error(`Google Auth Error: ${error.message}`);
    },

    async logout(): Promise<void> {
        try {
            const { error } = await withTimeout(supabase.auth.signOut(), 5000) as any;
            if (error) console.error("Error signing out:", error);
        } catch (e) {
            console.warn("Logout timed out or failed locally");
        }
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
            console.error("Error getting current user:", e);
            return null;
        }
    },

    async completeOnboarding(): Promise<void> {
        try {
            const { error } = await withTimeout(supabase.auth.updateUser({
                data: { hasOnboarded: true }
            }), 10000) as any;
            if (error) console.warn("Failed to sync onboarding:", error.message);
        } catch (e) { }
    },

    // --- API Key Management (user_api_keys Table) ---

    async getGeminiKey(userId: string): Promise<string | null> {
        try {
            // Using withRetry to handle cold starts or network blips
            const result = await withRetry(async () => {
                return await supabase
                    .from('user_api_keys')
                    .select('encrypted_key')
                    .eq('user_id', userId)
                    .eq('provider', 'gemini')
                    .maybeSingle();
            });
            
            if (result.error) {
                console.warn("Bubble DB Warning [getGeminiKey]:", result.error.message);
                return null;
            }
            
            if (result.data) {
                return result.data.encrypted_key;
            }
            return null;
        } catch (e) {
            console.warn("Failed to fetch key from DB after retries:", e);
            return null;
        }
    },

    async saveGeminiKey(userId: string, key: string): Promise<{ success: boolean; error?: string }> {
        console.log("Bubble: Syncing API Key to Cloud...");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                return { success: false, error: "No active session found. Please reload." };
            }
            
            // Ensure we are saving for the currently authenticated user
            const sessionUserId = session.user.id;
            if (userId !== sessionUserId) {
                 return { success: false, error: "User ID mismatch during save." };
            }

            // Using UPSERT with the unique constraint (user_id, provider)
            // Retry logic wrapped here to ensure robustness
            const { error } = await withRetry(async () => {
                return await supabase
                    .from('user_api_keys')
                    .upsert({ 
                        user_id: sessionUserId, 
                        provider: 'gemini', 
                        encrypted_key: key, 
                        is_valid: true,
                        last_error: null 
                    }, { onConflict: 'user_id, provider' });
            });
            
            if (error) {
                console.error("Bubble DB Error [Upsert]:", error.message, error.details);
                return { success: false, error: `Database Error: ${error.message}` };
            }

            console.log("Bubble: API Key synced successfully.");
            return { success: true };
        } catch (e: any) {
            console.error("Bubble DB Critical Error:", e.message);
            return { success: false, error: `Sync Error: ${e.message}` };
        }
    },

    async removeGeminiKey(userId: string): Promise<void> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await withRetry(async () => {
                return await supabase
                    .from('user_api_keys')
                    .delete()
                    .eq('user_id', session.user.id)
                    .eq('provider', 'gemini');
            });
            
            if (error) console.error("Bubble DB Error [Remove]:", error.message);
        } catch (e: any) {
             console.error("Bubble DB Error:", e.message);
        }
    }
};

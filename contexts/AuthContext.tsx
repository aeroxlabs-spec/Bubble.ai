
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { setSessionKey } from '../services/geminiService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string, captchaToken?: string) => Promise<void>;
    signup: (name: string, email: string, password: string, captchaToken?: string) => Promise<void>;
    loginWithGoogle: (credential: string) => Promise<void>;
    loginAsGuest: () => Promise<void>;
    logout: () => Promise<void>;
    userApiKey: string;
    updateApiKey: (key: string) => Promise<void>;
    finishOnboarding: () => Promise<void>;
    hasValidKey: boolean;
    credits: number;
    useCredits: () => boolean; 
    decrementCredits: (amount?: number) => void;
    isCloudSynced: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Free Tier Key - Used only when user has credits but no personal key
const DEFAULT_CREDIT_KEY = "AIzaSyAk4hc_GDCixtu5v7y2yrX4TpUL5Q1EAHc";
const INITIAL_CREDITS = 100;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [userApiKey, setUserApiKey] = useState<string>("");
    const [isCloudSynced, setIsCloudSynced] = useState(false);
    
    const [credits, setCredits] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('bubble_credits');
            return stored ? parseInt(stored, 10) : INITIAL_CREDITS;
        }
        return INITIAL_CREDITS;
    });

    /**
     * Synchronization of the active API key to the Gemini Service.
     * Logic: Use personal key if provided, else use default credit key if credits > 0.
     */
    useEffect(() => {
        if (userApiKey && userApiKey.length > 10) {
            setSessionKey(userApiKey);
            console.log("Bubble: Using Personal API Key.");
        } else if (credits > 0) {
            setSessionKey(DEFAULT_CREDIT_KEY);
            console.log("Bubble: Using Credit Pool.");
        } else {
            setSessionKey(null);
            console.warn("Bubble: No valid key or credits available.");
        }
    }, [userApiKey, credits]);

    useEffect(() => {
        localStorage.setItem('bubble_credits', credits.toString());
    }, [credits]);

    const syncKeys = async (userId: string) => {
        try {
            const dbKey = await authService.getGeminiKey(userId);
            const localKey = localStorage.getItem('bubble_user_api_key');

            if (dbKey) {
                setUserApiKey(dbKey);
                localStorage.setItem('bubble_user_api_key', dbKey);
                setIsCloudSynced(true);
            } else if (localKey && localKey.length > 10) {
                console.log("Bubble: Migrating local key to cloud...");
                const result = await authService.saveGeminiKey(userId, localKey);
                setUserApiKey(localKey);
                if (result.success) {
                    setIsCloudSynced(true);
                }
            } else {
                setUserApiKey("");
                localStorage.removeItem('bubble_user_api_key');
                setIsCloudSynced(false);
            }
        } catch (error) {
            console.error("Key Sync Error:", error);
            const localKey = localStorage.getItem('bubble_user_api_key');
            if (localKey) setUserApiKey(localKey);
            setIsCloudSynced(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) throw error;

                if (session?.user) {
                    const mappedUser: User = {
                        id: session.user.id,
                        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
                        email: session.user.email || "",
                        avatarUrl: session.user.user_metadata?.avatar_url,
                        hasOnboarded: session.user.user_metadata?.hasOnboarded || false
                    };
                    if (mounted) setUser(mappedUser);
                    await syncKeys(session.user.id);
                } else {
                    if (mounted) {
                        setUser(null);
                        setUserApiKey("");
                        localStorage.removeItem('bubble_user_api_key');
                    }
                }
            } catch (error) {
                console.error("Initialization Failed:", error);
                if (mounted) setUser(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const mappedUser: User = {
                    id: session.user.id,
                    name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
                    email: session.user.email || "",
                    avatarUrl: session.user.user_metadata?.avatar_url,
                    hasOnboarded: session.user.user_metadata?.hasOnboarded || false
                };
                setUser(mappedUser);
                setLoading(true);
                await syncKeys(session.user.id);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setUserApiKey("");
                localStorage.removeItem('bubble_user_api_key');
                setIsCloudSynced(false);
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string, captchaToken?: string) => {
        const user = await authService.login(email, password, captchaToken);
        setUser(user);
    };

    const signup = async (name: string, email: string, password: string, captchaToken?: string) => {
        const user = await authService.signup(name, email, password, captchaToken);
        setUser(user);
    };

    const loginWithGoogle = async () => {
        await authService.loginWithGoogle();
    };

    const loginAsGuest = async () => {
        const guestUser: User = {
            id: `guest-${Math.random().toString(36).substring(2, 9)}`,
            name: "Guest User",
            email: "guest@bubble.app",
            hasOnboarded: false
        };
        setUser(guestUser);
        setUserApiKey(""); 
        localStorage.removeItem('bubble_user_api_key');
        setIsCloudSynced(false);
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
        setUserApiKey("");
        localStorage.removeItem('bubble_user_api_key');
        setIsCloudSynced(false);
    };

    const updateApiKey = async (key: string) => {
        if (!user) return;
        
        if (!key) {
            if (!user.id.startsWith('guest-')) {
                await authService.removeGeminiKey(user.id);
            }
            localStorage.removeItem('bubble_user_api_key');
            setUserApiKey("");
            setIsCloudSynced(false);
        } else {
            const cleanedKey = key.trim();
            if (!user.id.startsWith('guest-')) {
                const result = await authService.saveGeminiKey(user.id, cleanedKey);
                setIsCloudSynced(result.success);
            } else {
                setIsCloudSynced(false);
            }
            localStorage.setItem('bubble_user_api_key', cleanedKey);
            setUserApiKey(cleanedKey);
        }
    };

    const finishOnboarding = async () => {
        if (!user) return;
        setUser({ ...user, hasOnboarded: true });
        if (!user.id.startsWith('guest-')) {
            await authService.completeOnboarding();
        }
    }

    const useCredits = () => {
        return !userApiKey || userApiKey.length < 10;
    }

    const decrementCredits = (amount = 1) => {
        if (useCredits()) {
            setCredits(prev => Math.max(0, prev - amount));
        }
    }

    const hasValidKey = (userApiKey && userApiKey.trim().length > 10) || (credits > 0);

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            login, 
            signup, 
            loginWithGoogle, 
            loginAsGuest,
            logout,
            userApiKey,
            updateApiKey,
            finishOnboarding,
            hasValidKey,
            credits,
            useCredits,
            decrementCredits,
            isCloudSynced
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

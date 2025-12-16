
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

const DEFAULT_API_KEY = "AIzaSyAk4hc_GDCixtu5v7y2yrX4TpUL5Q1EAHc";
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

    useEffect(() => {
        if (userApiKey && userApiKey.length > 10) {
            setSessionKey(userApiKey);
        } else if (credits > 0) {
            setSessionKey(DEFAULT_API_KEY);
        } else {
            setSessionKey(null);
        }
    }, [userApiKey, credits]);

    useEffect(() => {
        localStorage.setItem('bubble_credits', credits.toString());
    }, [credits]);

    // Core Sync Logic
    const syncKeys = async (userId: string) => {
        try {
            const dbKey = await authService.getGeminiKey(userId);
            const localKey = localStorage.getItem('bubble_user_api_key');

            if (dbKey) {
                // Scenario 1: Key exists in DB. This is the source of truth.
                setUserApiKey(dbKey);
                localStorage.setItem('bubble_user_api_key', dbKey);
                setIsCloudSynced(true);
            } else if (localKey && localKey.length > 10) {
                // Scenario 2: Key exists Locally but NOT in DB.
                // Action: Repair by pushing local key to DB.
                console.log("Bubble: Cloud key missing. Auto-repairing from local storage...");
                const result = await authService.saveGeminiKey(userId, localKey);
                if (result.success) {
                    setUserApiKey(localKey);
                    setIsCloudSynced(true);
                } else {
                    // Save failed, keep local but mark unsynced
                    setUserApiKey(localKey);
                    setIsCloudSynced(false);
                }
            } else {
                // Scenario 3: No key anywhere.
                setUserApiKey("");
                localStorage.removeItem('bubble_user_api_key');
                setIsCloudSynced(false);
            }
        } catch (error) {
            console.error("Key Sync Failed:", error);
            // Fallback to local if DB fails entirely
            const localKey = localStorage.getItem('bubble_user_api_key');
            if (localKey) setUserApiKey(localKey);
            setIsCloudSynced(false);
        }
    };

    // Initial check
    useEffect(() => {
        const initAuth = async () => {
            try {
                const currentUser = await authService.getCurrentUser();
                setUser(currentUser);

                if (currentUser && !currentUser.id.startsWith('guest-')) {
                    await syncKeys(currentUser.id);
                } else {
                    localStorage.removeItem('bubble_user_api_key');
                    setUserApiKey("");
                    setIsCloudSynced(false);
                }
            } catch (error) {
                console.error("Auth init failed", error);
            } finally {
                setLoading(false);
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

    const loginWithGoogle = async (credential: string) => {
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
            // REMOVE KEY SCENARIO
            if (!user.id.startsWith('guest-')) {
                await authService.removeGeminiKey(user.id);
            }
            localStorage.removeItem('bubble_user_api_key');
            setUserApiKey("");
            setIsCloudSynced(false);
        } else {
            // SAVE KEY SCENARIO
            const cleanedKey = key.trim();
            if (!user.id.startsWith('guest-')) {
                // Try to save to DB with retry logic
                const result = await authService.saveGeminiKey(user.id, cleanedKey);
                
                if (!result.success) {
                    // Even if DB fails, save locally so user can continue working
                    // The syncKeys logic on next load will attempt to repair it
                    console.warn("Saving locally only due to DB error:", result.error);
                    setIsCloudSynced(false);
                } else {
                    setIsCloudSynced(true);
                }
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
        if (userApiKey && userApiKey.length > 10) return false;
        return true;
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

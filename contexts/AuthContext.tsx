
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { setSessionKey } from '../services/geminiService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (name: string, email: string, password: string) => Promise<void>;
    loginWithGoogle: (credential: string) => Promise<void>;
    loginAsGuest: () => Promise<void>;
    logout: () => Promise<void>;
    userApiKey: string;
    updateApiKey: (key: string) => Promise<void>;
    finishOnboarding: () => Promise<void>;
    hasValidKey: boolean;
    credits: number;
    useCredits: () => boolean; // Returns true if using credit system (not custom key)
    decrementCredits: (amount?: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_API_KEY = "AIzaSyAk4hc_GDCixtu5v7y2yrX4TpUL5Q1EAHc";
const INITIAL_CREDITS = 100;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [userApiKey, setUserApiKey] = useState<string>("");
    
    // Credit System State
    const [credits, setCredits] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('bubble_credits');
            return stored ? parseInt(stored, 10) : INITIAL_CREDITS;
        }
        return INITIAL_CREDITS;
    });

    // Update session key whenever userKey or credits change
    useEffect(() => {
        // If user has a custom key, use it
        if (userApiKey && userApiKey.length > 10) {
            setSessionKey(userApiKey);
        } 
        // If no custom key but credits remain, use default key
        else if (credits > 0) {
            setSessionKey(DEFAULT_API_KEY);
        } 
        // No custom key and no credits -> No key (will trigger prompt)
        else {
            setSessionKey(null);
        }
    }, [userApiKey, credits]);

    // Persist credits
    useEffect(() => {
        localStorage.setItem('bubble_credits', credits.toString());
    }, [credits]);

    // Initial check
    useEffect(() => {
        const initAuth = async () => {
            try {
                const currentUser = await authService.getCurrentUser();
                setUser(currentUser);

                if (currentUser) {
                    const dbKey = await authService.getGeminiKey(currentUser.id);
                    if (dbKey) {
                        setUserApiKey(dbKey);
                        localStorage.setItem('bubble_user_api_key', dbKey);
                    } else {
                        const localKey = localStorage.getItem('bubble_user_api_key');
                        if (localKey) {
                             await authService.saveGeminiKey(currentUser.id, localKey);
                             setUserApiKey(localKey);
                        } else {
                            setUserApiKey("");
                            localStorage.removeItem('bubble_user_api_key');
                        }
                    }
                } else {
                    localStorage.removeItem('bubble_user_api_key');
                    setUserApiKey("");
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
                
                const dbKey = await authService.getGeminiKey(session.user.id);
                if (dbKey) {
                    setUserApiKey(dbKey);
                    localStorage.setItem('bubble_user_api_key', dbKey);
                } else {
                    const localKey = localStorage.getItem('bubble_user_api_key');
                    if (localKey) {
                        await authService.saveGeminiKey(session.user.id, localKey);
                        setUserApiKey(localKey);
                    }
                }

                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setUserApiKey("");
                localStorage.removeItem('bubble_user_api_key');
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        const user = await authService.login(email, password);
        setUser(user);
    };

    const signup = async (name: string, email: string, password: string) => {
        const user = await authService.signup(name, email, password);
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
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
        setUserApiKey("");
        localStorage.removeItem('bubble_user_api_key');
    };

    const updateApiKey = async (key: string) => {
        if (!user) return;
        
        if (!key) {
            if (!user.id.startsWith('guest-')) {
                await authService.removeGeminiKey(user.id);
            }
            localStorage.removeItem('bubble_user_api_key');
            setUserApiKey("");
        } else {
            if (!user.id.startsWith('guest-')) {
                await authService.saveGeminiKey(user.id, key);
            }
            localStorage.setItem('bubble_user_api_key', key);
            setUserApiKey(key);
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
        // If we have a custom key, we are NOT using credits
        if (userApiKey && userApiKey.length > 10) return false;
        // If no custom key, we ARE using credits (even if 0, technically)
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
            decrementCredits
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

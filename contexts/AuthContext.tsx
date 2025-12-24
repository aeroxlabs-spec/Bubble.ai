
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
    logout: () => Promise<void>;
    userApiKey: string;
    updateApiKey: (key: string) => Promise<void>;
    finishOnboarding: () => Promise<void>;
    credits: number;
    isCloudSynced: boolean;
    // Added useCredits to interface
    useCredits: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INITIAL_CREDITS = 100;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userApiKey, setUserApiKey] = useState("");
    const [isCloudSynced, setIsCloudSynced] = useState(false);
    const [credits, setCredits] = useState(() => {
        const stored = localStorage.getItem('bubble_credits');
        return stored ? parseInt(stored, 10) : INITIAL_CREDITS;
    });

    useEffect(() => {
        // Sync geminiService with current key
        setSessionKey(userApiKey || null);
    }, [userApiKey]);

    const syncKeys = async (userId: string) => {
        try {
            const dbKey = await authService.getGeminiKey(userId);
            if (dbKey) {
                setUserApiKey(dbKey);
                setIsCloudSynced(true);
            }
        } catch (e) {
            console.error("Key sync failed", e);
        }
    };

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const u: User = { id: session.user.id, name: session.user.user_metadata.full_name, email: session.user.email || "", hasOnboarded: session.user.user_metadata.hasOnboarded };
                setUser(u);
                await syncKeys(u.id);
            }
            setLoading(false);
        };
        init();
    }, []);

    const updateApiKey = async (key: string) => {
        setUserApiKey(key);
        if (user) {
            await authService.saveGeminiKey(user.id, key);
            setIsCloudSynced(true);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setUserApiKey("");
    };

    // Helper to determine if credits are being used (no personal API key set)
    const useCredits = () => !userApiKey;

    const finishOnboarding = async () => {
        if (user) {
            await authService.completeOnboarding();
            setUser({ ...user, hasOnboarded: true });
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, loading, login: async () => {}, signup: async () => {}, loginWithGoogle: async () => {}, logout,
            userApiKey, updateApiKey, finishOnboarding, credits, isCloudSynced,
            useCredits
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used in AuthProvider");
    return context;
};

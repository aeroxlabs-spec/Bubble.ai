
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (name: string, email: string, password: string) => Promise<void>;
    loginWithGoogle: (credential: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Initial check
    useEffect(() => {
        const initAuth = async () => {
            try {
                const currentUser = await authService.getCurrentUser();
                setUser(currentUser);
            } catch (error) {
                console.error("Auth init failed", error);
            } finally {
                setLoading(false);
            }
        };
        initAuth();

        // Listen for Supabase Auth changes (crucial for OAuth redirects)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const mappedUser: User = {
                    id: session.user.id,
                    name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
                    email: session.user.email || "",
                    avatarUrl: session.user.user_metadata?.avatar_url
                };
                setUser(mappedUser);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
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
        // User state will be updated by the onAuthStateChange listener after redirect
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
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


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
            avatarUrl: data.user.user_metadata?.avatar_url
        };
    },

    async signup(name: string, email: string, password: string): Promise<User> {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                },
            },
        });

        if (error) throw new Error(error.message);
        
        // Note: If email confirmation is enabled in Supabase, 
        // data.user might be null or session null until confirmed.
        if (!data.user) throw new Error("Signup failed");

        return {
            id: data.user.id,
            name: name,
            email: data.user.email || "",
        };
    },

    async loginWithGoogle(): Promise<void> {
        // Supabase OAuth handles the redirect. 
        // The user will leave the page and come back.
        // We do not return a User here; the AuthContext listener will pick it up on return.
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
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) return null;

        return {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
            email: session.user.email || "",
            avatarUrl: session.user.user_metadata?.avatar_url
        };
    }
};

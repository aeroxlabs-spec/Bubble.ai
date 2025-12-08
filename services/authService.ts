import { User } from '../types';

// Mock delay to simulate network request
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const USERS_KEY = 'bubble_users';
const SESSION_KEY = 'bubble_session';

export const authService = {
    async login(email: string, password: string): Promise<User> {
        await delay(800); // Simulate network

        // In a real app, this would hit an API.
        // Here we simulate by checking localStorage.
        const usersStr = localStorage.getItem(USERS_KEY);
        const users = usersStr ? JSON.parse(usersStr) : [];
        
        const user = users.find((u: any) => u.email === email && u.password === password);
        
        if (!user) {
            throw new Error("Invalid email or password.");
        }

        const sessionUser: User = {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        return sessionUser;
    },

    async signup(name: string, email: string, password: string): Promise<User> {
        await delay(1000); // Simulate network

        const usersStr = localStorage.getItem(USERS_KEY);
        const users = usersStr ? JSON.parse(usersStr) : [];

        if (users.find((u: any) => u.email === email)) {
            throw new Error("User with this email already exists.");
        }

        const newUser = {
            id: crypto.randomUUID(),
            name,
            email,
            password, // In real app, never store plain text passwords!
        };

        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));

        const sessionUser: User = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        return sessionUser;
    },

    async loginWithGoogle(credential: string): Promise<User> {
        await delay(500); 
        
        // Basic JWT Decode (Payload is part 2)
        // Warning: In production, verify signature on backend.
        const payload = JSON.parse(atob(credential.split('.')[1]));
        
        const usersStr = localStorage.getItem(USERS_KEY);
        const users = usersStr ? JSON.parse(usersStr) : [];
        
        let user = users.find((u: any) => u.email === payload.email);
        
        if (!user) {
            // Register new Google user
            user = {
                id: payload.sub, // Google unique ID
                name: payload.name,
                email: payload.email,
                avatarUrl: payload.picture,
                password: '', // OAuth users have no password
                provider: 'google'
            };
            users.push(user);
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        } else {
            // Update existing user info
            user.name = payload.name;
            user.avatarUrl = payload.picture;
            
            const idx = users.findIndex((u:any) => u.id === user.id);
            if (idx !== -1) {
                users[idx] = user;
                localStorage.setItem(USERS_KEY, JSON.stringify(users));
            }
        }

        const sessionUser: User = {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        return sessionUser;
    },

    async logout(): Promise<void> {
        await delay(300);
        localStorage.removeItem(SESSION_KEY);
        
        // Also revoke Google token if possible/needed, but usually just clearing session is enough for client-side app
        if ((window as any).google) {
            (window as any).google.accounts.id.disableAutoSelect();
        }
    },

    async getCurrentUser(): Promise<User | null> {
        // Simulate checking session on app load
        const sessionStr = localStorage.getItem(SESSION_KEY);
        if (!sessionStr) return null;
        return JSON.parse(sessionStr) as User;
    }
};
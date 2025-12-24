
import { Feedback, AdminStats, AppMode } from '../types';
import { getLifetimeStats } from './geminiService';

// Storage keys
const FEEDBACK_STORAGE_KEY = 'bubble_admin_feedback';
const GRAPH_DATA_KEY = 'bubble_admin_graph_history';

// Helper to generate a realistic looking historical curve that ends at the current real count
const generateStableHistory = (currentRealTotal: number, days: number): { date: string; count: number }[] => {
    // Check if we have history
    const stored = localStorage.getItem(GRAPH_DATA_KEY);
    if (stored) {
        const parsed = JSON.parse(stored);
        // Only return if it matches today's date structure approx, otherwise regenerate to sync with real total
        if (parsed.length === days) {
            // Update the last entry to match real total
            parsed[parsed.length - 1].count = currentRealTotal;
            return parsed;
        }
    }

    // Generate new stable history
    const data = [];
    let runningTotal = Math.max(0, currentRealTotal - (days * 15)); // Start somewhat lower
    
    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        
        if (i === days - 1) {
            runningTotal = currentRealTotal;
        } else {
            // Random daily increment between 5 and 30
            const increment = Math.floor(Math.random() * 25) + 5;
            runningTotal += increment;
            if (runningTotal > currentRealTotal) runningTotal = currentRealTotal; // Clamp
        }

        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count: runningTotal
        });
    }

    localStorage.setItem(GRAPH_DATA_KEY, JSON.stringify(data));
    return data;
};

export const adminService = {
    async submitFeedback(feedback: Omit<Feedback, 'id' | 'timestamp' | 'status'>): Promise<void> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const newFeedback: Feedback = {
            ...feedback,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            status: 'NEW'
        };

        // Persist to local storage
        const existing = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([newFeedback, ...existing]));
    },

    async getFeedback(): Promise<Feedback[]> {
        await new Promise(resolve => setTimeout(resolve, 500));
        return JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
    },

    async getStats(days = 14): Promise<AdminStats> {
        await new Promise(resolve => setTimeout(resolve, 300));

        // Get Real Lifetime Stats from the Service
        const realStats = getLifetimeStats();

        // Get Stable Graph Data
        const requestsOverTime = generateStableHistory(realStats.totalRequests, days);

        return {
            totalUsers: 1, // Currently single user context + guest
            totalRequests: realStats.totalRequests,
            creditsConsumed: realStats.estimatedCredits, 
            activeNow: 1, // Just you
            requestsOverTime,
            modeDistribution: [
                { mode: 'SOLVER', count: Math.floor(realStats.totalRequests * 0.6) },
                { mode: 'EXAM', count: Math.floor(realStats.totalRequests * 0.25) },
                { mode: 'DRILL', count: Math.max(0, realStats.totalRequests - Math.floor(realStats.totalRequests * 0.85)) }
            ]
        };
    }
};

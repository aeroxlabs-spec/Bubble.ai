
import { Feedback, AdminStats, AppMode } from '../types';
import { supabase } from './supabaseClient';

// Time out request after 3000ms to prevent hanging UI
const TIMEOUT_MS = 3000;

const fetchWithTimeout = async (promise: PromiseLike<any>): Promise<any> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS);
    });
    try {
        const result = await Promise.race([Promise.resolve(promise), timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
    } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
    }
};

export const adminService = {
    async submitFeedback(feedback: Omit<Feedback, 'id' | 'timestamp' | 'status'>): Promise<void> {
        // Schema mismatch fix: feedback table does NOT have user_id, only user_email
        const { error } = await supabase.from('feedback').insert({
            user_email: feedback.userEmail,
            type: feedback.type,
            message: feedback.message,
            status: 'NEW'
        });

        if (error) {
            console.error("Bubble DB Error [Submit Feedback]:", error.message);
            throw error;
        }
    },

    async getFeedback(): Promise<Feedback[]> {
        try {
            // Use timeout to avoid eternal loading if RLS blocks silently
            const { data, error } = await fetchWithTimeout(
                supabase
                .from('feedback')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)
            );

            if (error) throw error;

            return (data || []).map((item: any) => ({
                id: item.id,
                userId: item.user_id || 'anonymous', // Handle missing user_id in schema
                userName: item.user_email?.split('@')[0] || 'User',
                userEmail: item.user_email,
                type: item.type,
                message: item.message,
                timestamp: new Date(item.created_at).getTime(),
                status: item.status
            }));
        } catch (e: any) {
            console.warn("Bubble Admin Warning: Could not fetch feedback.", e.message);
            // Return empty array to keep UI functional
            return [];
        }
    },

    async getStats(days = 14): Promise<AdminStats> {
        try {
            // 1. Total Requests (Fast count)
            const { count: totalRequests, error: reqError } = await fetchWithTimeout(
                supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true })
            );
            
            if (reqError) throw reqError;

            // 2. Active Now (Last 15 mins)
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const { count: activeNow } = await supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', fifteenMinsAgo);

            // 3. Graph Data (Only fetch needed fields)
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const { data: recentLogs, error: graphError } = await fetchWithTimeout(
                supabase
                .from('usage_logs')
                .select('created_at, mode, user_id')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true })
            );

            if (graphError) throw graphError;

            // Process Data locally
            const distributionMap = new Map<string, number>();
            const dayMap = new Map<string, number>();
            const uniqueRecentUsers = new Set<string>();

            // Initialize timeline buckets
            for (let i = 0; i < days; i++) {
                 const d = new Date();
                 d.setDate(d.getDate() - (days - 1 - i));
                 dayMap.set(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 0);
            }

            recentLogs?.forEach((r: any) => {
                const m = r.mode || 'UNKNOWN';
                distributionMap.set(m, (distributionMap.get(m) || 0) + 1);

                const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dayMap.has(dateStr)) {
                    dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
                }

                if (r.user_id) uniqueRecentUsers.add(r.user_id);
            });

            const modeDistribution = Array.from(distributionMap.entries()).map(([mode, count]) => ({
                mode: mode as AppMode,
                count
            }));

            const requestsOverTime = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

            return {
                totalUsers: uniqueRecentUsers.size,
                totalRequests: totalRequests || 0,
                creditsConsumed: (totalRequests || 0) * 5,
                activeNow: activeNow || 0,
                requestsOverTime,
                modeDistribution
            };

        } catch (e: any) {
            console.error("Bubble Admin Critical Error:", e.message);
            throw e;
        }
    }
};

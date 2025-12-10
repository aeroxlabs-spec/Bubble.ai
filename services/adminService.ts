
import { Feedback, AdminStats, AppMode } from '../types';
import { supabase } from './supabaseClient';

export const adminService = {
    async submitFeedback(feedback: Omit<Feedback, 'id' | 'timestamp' | 'status'>): Promise<void> {
        try {
            const { error } = await supabase.from('feedback').insert({
                user_id: feedback.userId,
                user_email: feedback.userEmail,
                type: feedback.type,
                message: feedback.message,
                status: 'NEW'
            });

            if (error) throw error;
        } catch (e) {
            console.error("Failed to submit feedback", e);
            throw e;
        }
    },

    async getFeedback(): Promise<Feedback[]> {
        try {
            const { data, error } = await supabase
                .from('feedback')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50); // Limit to last 50 items for performance

            if (error) throw error;

            return data.map((item: any) => ({
                id: item.id,
                userId: item.user_id,
                userName: item.user_email?.split('@')[0] || 'User',
                userEmail: item.user_email,
                type: item.type,
                message: item.message,
                timestamp: new Date(item.created_at).getTime(),
                status: item.status
            }));
        } catch (e) {
            console.error("Failed to fetch feedback", e);
            return [];
        }
    },

    async getStats(days = 14): Promise<AdminStats> {
        try {
            // 1. Total Requests (Lifetime) - Fast count
            const { count: totalRequests, error: reqError } = await supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true });
            
            if (reqError) throw reqError;

            // 2. Active Now (Last 15 mins) - Fast count
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const { count: activeNow } = await supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', fifteenMinsAgo);

            // 3. Graph Data - Fetch only necessary columns for the selected range
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const { data: recentLogs, error: graphError } = await supabase
                .from('usage_logs')
                .select('created_at, mode, user_id')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            if (graphError) throw graphError;

            // Process Graph Data (Client-side aggregation for recent data is fast enough)
            const distributionMap = new Map<string, number>();
            const dayMap = new Map<string, number>();
            const uniqueRecentUsers = new Set<string>();

            // Initialize days map with 0
            for (let i = 0; i < days; i++) {
                 const d = new Date();
                 d.setDate(d.getDate() - (days - 1 - i));
                 dayMap.set(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 0);
            }

            recentLogs?.forEach(r => {
                // Mode Dist
                const m = r.mode || 'UNKNOWN';
                distributionMap.set(m, (distributionMap.get(m) || 0) + 1);

                // Time Dist
                const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dayMap.has(dateStr)) {
                    dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
                }

                // Unique Users
                if (r.user_id) uniqueRecentUsers.add(r.user_id);
            });

            const modeDistribution = Array.from(distributionMap.entries()).map(([mode, count]) => ({
                mode: mode as AppMode,
                count
            }));

            const requestsOverTime = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

            return {
                totalUsers: uniqueRecentUsers.size, // Showing active users in period instead of lifetime (faster/more relevant)
                totalRequests: totalRequests || 0,
                creditsConsumed: (totalRequests || 0) * 5, // Estimate
                activeNow: activeNow || 0,
                requestsOverTime,
                modeDistribution
            };

        } catch (e) {
            console.error("Failed to fetch admin stats", e);
            return {
                totalUsers: 0,
                totalRequests: 0,
                creditsConsumed: 0,
                activeNow: 0,
                requestsOverTime: [],
                modeDistribution: []
            };
        }
    }
};

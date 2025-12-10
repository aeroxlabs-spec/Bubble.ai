
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
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data.map((item: any) => ({
                id: item.id,
                userId: item.user_id,
                userName: item.user_email?.split('@')[0] || 'User', // Fallback as we don't store name in feedback table currently
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
            // 1. Total Requests
            const { count: totalRequests } = await supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true });

            // 2. Mode Distribution
            const { data: modeData } = await supabase
                .from('usage_logs')
                .select('mode');
            
            const distributionMap = new Map<string, number>();
            modeData?.forEach(r => {
                const m = r.mode || 'UNKNOWN';
                distributionMap.set(m, (distributionMap.get(m) || 0) + 1);
            });

            const modeDistribution = Array.from(distributionMap.entries()).map(([mode, count]) => ({
                mode: mode as AppMode,
                count
            }));

            // 3. Requests Over Time (History)
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const { data: historyData } = await supabase
                .from('usage_logs')
                .select('created_at')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            const dayMap = new Map<string, number>();
            // Initialize days
            for (let i = 0; i < days; i++) {
                 const d = new Date();
                 d.setDate(d.getDate() - (days - 1 - i));
                 dayMap.set(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 0);
            }

            historyData?.forEach(r => {
                const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (dayMap.has(dateStr)) {
                    dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
                }
            });

            const requestsOverTime = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

            // 4. Unique Users (Approximate from Logs or if using separate user tracking)
            // Using distinct user_id from logs as a proxy for "Active Users"
            // Note: Supabase JS doesn't support .distinct() easily without RPC or workaround.
            // For now, we fetch user_ids and set them in JS. Efficient enough for small scale.
            const { data: userData } = await supabase.from('usage_logs').select('user_id');
            const uniqueUsers = new Set(userData?.map(u => u.user_id)).size;

            // 5. Active Now (Last 5 mins)
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { count: activeNow } = await supabase
                .from('usage_logs')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', fiveMinsAgo);

            return {
                totalUsers: uniqueUsers || 0,
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

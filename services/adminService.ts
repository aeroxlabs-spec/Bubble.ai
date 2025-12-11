
import { FeedbackV2, FeedbackType } from '../types';
import { supabase } from './supabaseClient';

export const adminService = {
    // --- USER ACTIONS ---

    async submitFeedback(data: { userId: string, type: FeedbackType, body: string, title?: string, metadata?: any }): Promise<void> {
        const { error } = await supabase.from('feedback_v2').insert({
            user_id: data.userId,
            type: data.type,
            title: data.title || null,
            body: data.body,
            metadata: data.metadata || {},
            resolved: false
        });

        if (error) {
            console.error("Bubble DB Error [Submit Feedback V2]:", error.message);
            throw new Error(error.message);
        }
    },

    // --- ADMIN ACTIONS ---

    async fetchAllFeedback(): Promise<FeedbackV2[]> {
        // Fetch feedback and join with auth.users to get emails if possible, 
        // usually needs Supabase Admin API or a public view. 
        // For simplicity with standard client, we might just fetch the rows.
        // If RLS allows, we can fetch all rows.
        
        const { data, error } = await supabase
            .from('feedback_v2')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        
        // Since we can't easily join auth.users from the client without specific setup,
        // we'll rely on the user_id. In a real admin dashboard, you'd use an Edge Function 
        // or a View to get the email.
        return data as FeedbackV2[];
    },

    async resolveFeedback(id: string, resolved: boolean, adminId: string): Promise<void> {
        const updates: any = {
            resolved,
            resolved_at: resolved ? new Date().toISOString() : null,
            resolved_by: resolved ? adminId : null
        };

        const { error } = await supabase
            .from('feedback_v2')
            .update(updates)
            .eq('id', id);

        if (error) throw new Error(error.message);
    }
};

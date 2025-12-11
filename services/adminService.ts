
import { FeedbackV2, FeedbackType, FeedbackMetadata } from '../types';
import { supabase } from './supabaseClient';

export const adminService = {
    // --- USER ACTIONS ---

    async submitFeedback(data: { 
        userId: string, 
        type: FeedbackType, 
        body: string, 
        title?: string, 
        metadata?: FeedbackMetadata 
    }): Promise<void> {
        
        // Prepare payload to strictly match DB schema
        const payload = {
            user_id: data.userId,
            type: data.type,
            title: data.title || null,
            body: data.body,
            metadata: data.metadata || {}, // Ensure valid JSON object
            resolved: false
        };

        console.log("Bubble: Submitting feedback...", payload);

        const { error } = await supabase
            .from('feedback_v2')
            .insert(payload);

        if (error) {
            console.error("Bubble DB Error [Submit Feedback V2]:", error.message, error.details);
            throw new Error(`Feedback submission failed: ${error.message}`);
        }
        
        console.log("Bubble: Feedback submitted successfully.");
    },

    // --- ADMIN ACTIONS ---

    async fetchAllFeedback(): Promise<FeedbackV2[]> {
        const { data, error } = await supabase
            .from('feedback_v2')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Bubble DB Error [Fetch Feedback]:", error.message);
            throw new Error(error.message);
        }
        
        return data as FeedbackV2[];
    },

    async resolveFeedback(id: string, resolved: boolean, adminId: string): Promise<void> {
        const updates = {
            resolved: resolved,
            resolved_at: resolved ? new Date().toISOString() : null,
            resolved_by: resolved ? adminId : null
        };

        const { error } = await supabase
            .from('feedback_v2')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error("Bubble DB Error [Resolve Feedback]:", error.message);
            throw new Error(error.message);
        }
    }
};

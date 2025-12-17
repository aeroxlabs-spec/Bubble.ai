

import React, { useState } from 'react';
import { X, GraduationCap, Bug, Lightbulb, Loader2, Send } from 'lucide-react';
import { adminService } from '../services/adminService';
import { User, FeedbackType } from '../types';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, user }) => {
    const [type, setType] = useState<FeedbackType>('general');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const placeholders: Record<string, string> = {
        general: "Tell us what you think...",
        bug: "Describe the bug, steps to reproduce, and what you expected...",
        feature: "Describe the feature you'd like to see and why it's useful..."
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            await adminService.submitFeedback({
                userId: user.id,
                type: type,
                body: message,
                metadata: { 
                    userEmail: user.email || "No Email", 
                    userName: user.name || "Unknown User",
                    timestamp: new Date().toISOString()
                } 
            });

            setIsSuccess(true);
            setTimeout(() => {
                onClose();
                setIsSuccess(false);
                setMessage('');
                setType('general');
            }, 2000);
        } catch (error) {
            console.error(error);
            alert("Failed to submit feedback. Please check your connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            
            <div className="w-full max-w-md bg-[#0a0a0a]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative backdrop-blur-xl">
                
                {/* Upper Notch Gradient */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-20" />

                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5 pt-6">
                    <h2 className="text-lg font-bold text-white tracking-tight">Send Feedback</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {isSuccess ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95">
                        <div className="flex flex-col items-center justify-center text-center py-6 bg-white/5 rounded-xl border border-white/10 w-full">
                            <Send 
                                size={24} 
                                className="text-green-400 mb-3 animate-bounce" 
                            />
                            <p className="text-white font-bold text-sm">Request Sent</p>
                            <p className="text-xs text-gray-400 mt-1">Thanks for helping us improve BubbleIB.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Feedback Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setType('general')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                        type === 'general' 
                                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' 
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                                >
                                    <GraduationCap 
                                        size={18} 
                                        className={`transition-transform duration-300 ${type === 'general' ? 'scale-110' : ''}`}
                                    />
                                    <span className="text-[10px] font-bold">General</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('bug')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                        type === 'bug' 
                                            ? 'bg-red-500/10 border-red-500/40 text-red-400' 
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                                >
                                    <Bug 
                                        size={18} 
                                        className={`transition-transform duration-300 ${type === 'bug' ? 'scale-110 -rotate-12' : ''}`} 
                                    />
                                    <span className="text-[10px] font-bold">Bug</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('feature')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                        type === 'feature' 
                                            ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400' 
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                                >
                                    <Lightbulb 
                                        size={18} 
                                        className={`transition-transform duration-300 ${type === 'feature' ? 'scale-110 rotate-12' : ''}`} 
                                    />
                                    <span className="text-[10px] font-bold">Feature</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={placeholders[type]}
                                className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 resize-none transition-colors"
                                required
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={isSubmitting || !message.trim()}
                            className="w-full py-3 rounded-xl bg-transparent border border-white/20 text-white font-bold text-sm hover:bg-white/5 hover:border-white/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Submit Feedback"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;
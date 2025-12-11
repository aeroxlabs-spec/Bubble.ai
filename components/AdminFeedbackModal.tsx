
import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { FeedbackV2, FeedbackType, User } from '../types';
import { X, CheckCircle, Circle, RefreshCw, Filter, MessageSquare, Bug, Lightbulb, HelpCircle, Loader2 } from 'lucide-react';

interface AdminFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    adminUser: User;
}

const AdminFeedbackModal: React.FC<AdminFeedbackModalProps> = ({ isOpen, onClose, adminUser }) => {
    const [feedbacks, setFeedbacks] = useState<FeedbackV2[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState<'ALL' | FeedbackType>('ALL');
    const [showResolved, setShowResolved] = useState(false);

    const loadFeedback = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.fetchAllFeedback();
            setFeedbacks(data);
        } catch (e) {
            console.error("Failed to load feedback", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadFeedback();
        }
    }, [isOpen]);

    const handleResolve = async (id: string, currentStatus: boolean) => {
        try {
            // Optimistic update
            setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, resolved: !currentStatus } : f));
            await adminService.resolveFeedback(id, !currentStatus, adminUser.id);
        } catch (e) {
            console.error("Failed to update status", e);
            // Revert on failure
            loadFeedback();
        }
    };

    const filteredFeedbacks = feedbacks.filter(f => {
        if (filter !== 'ALL' && f.type !== filter) return false;
        if (!showResolved && f.resolved) return false;
        return true;
    });

    if (!isOpen) return null;

    const TypeIcon = ({ type }: { type: FeedbackType }) => {
        switch (type) {
            case 'bug': return <Bug size={14} className="text-red-400" />;
            case 'feature': return <Lightbulb size={14} className="text-yellow-400" />;
            case 'help': return <HelpCircle size={14} className="text-green-400" />;
            default: return <MessageSquare size={14} className="text-blue-400" />;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-4xl bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
                
                {/* Header */}
                <div className="bg-[#121212] px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Admin Feedback Panel</h2>
                        <p className="text-[10px] text-gray-500 font-mono">Managing table: public.feedback_v2</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={loadFeedback}
                            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-[#0a0a0a] px-6 py-3 border-b border-white/5 flex items-center gap-4 overflow-x-auto">
                    <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                        <Filter size={14} className="text-gray-500" />
                        <span className="text-xs font-bold text-gray-500 uppercase">Filter</span>
                    </div>
                    
                    {(['ALL', 'general', 'bug', 'feature', 'help'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                                filter === t 
                                    ? 'bg-white/10 text-white border-white/20' 
                                    : 'bg-transparent text-gray-600 border-transparent hover:text-gray-400'
                            }`}
                        >
                            {t}
                        </button>
                    ))}

                    <div className="flex-1" />

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-200 select-none">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${showResolved ? 'bg-blue-500 border-blue-500' : 'border-gray-600 bg-transparent'}`}>
                            {showResolved && <CheckCircle size={10} className="text-white" />}
                        </div>
                        Show Resolved
                        <input type="checkbox" className="hidden" checked={showResolved} onChange={() => setShowResolved(!showResolved)} />
                    </label>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-0 bg-[#050505]">
                    {isLoading && feedbacks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                            <Loader2 size={32} className="animate-spin" />
                            <span className="text-xs">Fetching records...</span>
                        </div>
                    ) : filteredFeedbacks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                            <MessageSquare size={32} className="opacity-20" />
                            <span className="text-sm">No items found</span>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#121212] sticky top-0 z-10 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 border-b border-white/5">Status</th>
                                    <th className="px-6 py-3 border-b border-white/5">Type</th>
                                    <th className="px-6 py-3 border-b border-white/5 w-1/3">Message</th>
                                    <th className="px-6 py-3 border-b border-white/5">User Info</th>
                                    <th className="px-6 py-3 border-b border-white/5 text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredFeedbacks.map(f => (
                                    <tr key={f.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => handleResolve(f.id, f.resolved)}
                                                className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide transition-all ${
                                                    f.resolved 
                                                        ? 'bg-green-900/20 text-green-400 border-green-500/30 hover:bg-green-900/30' 
                                                        : 'bg-yellow-900/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-900/20'
                                                }`}
                                            >
                                                {f.resolved ? <CheckCircle size={12} /> : <Circle size={12} />}
                                                {f.resolved ? 'Resolved' : 'Open'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs text-gray-300 font-medium capitalize">
                                                <TypeIcon type={f.type} />
                                                {f.type}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-3 group-hover:line-clamp-none transition-all">
                                                {f.body}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-white font-medium">
                                                    {f.metadata?.userName || 'Unknown'}
                                                </span>
                                                <span className="text-[10px] text-gray-500 font-mono">
                                                    {f.metadata?.userEmail || f.user_id.substring(0,8)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[10px] text-gray-500 font-mono">
                                                {new Date(f.created_at).toLocaleDateString()}
                                                <br/>
                                                {new Date(f.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {/* Footer */}
                <div className="bg-[#121212] px-6 py-3 border-t border-white/5 text-[10px] text-gray-600 flex justify-between items-center">
                    <span>Admin View: {adminUser.email}</span>
                    <span>Total Records: {feedbacks.length}</span>
                </div>
            </div>
        </div>
    );
};

export default AdminFeedbackModal;

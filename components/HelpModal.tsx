

import React, { useState } from 'react';
import { X, ChevronDown, MessageCircle, HelpCircle, Send, Loader2 } from 'lucide-react';
import { User } from '../types';
import { adminService } from '../services/adminService';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-white/5 rounded-lg overflow-hidden bg-white/5">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
            >
                <span className="text-sm font-bold text-gray-200">{question}</span>
                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`transition-[max-height,padding] duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-40 p-4 pt-0 border-t border-white/5' : 'max-h-0'}`}>
                <p className="text-xs text-gray-400 leading-relaxed mt-3">{answer}</p>
            </div>
        </div>
    )
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, user }) => {
    const [question, setQuestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim()) return;

        setIsSubmitting(true);
        try {
            await adminService.submitFeedback({
                userId: user.id,
                type: 'help',
                body: question,
                metadata: { 
                    userEmail: user.email || "No Email", 
                    userName: user.name || "Unknown User", 
                    context: 'Help Center' 
                }
            });
            setIsSuccess(true);
            setTimeout(() => {
                onClose();
                setIsSuccess(false);
                setQuestion('');
            }, 2500);
        } catch (e) {
            console.error(e);
            alert("Error sending help request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
             
             <div className="w-full max-w-lg bg-[#0a0a0a]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative backdrop-blur-xl flex flex-col max-h-[85vh]">
                
                 {/* Top Gradient */}
                 <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-20" />

                 {/* Header */}
                 <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5 pt-7">
                    <div className="flex items-center gap-3">
                        <HelpCircle size={20} className="text-blue-400" />
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Help Center</h2>
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Support & FAQ</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* FAQ Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Common Questions</h3>
                        <div className="space-y-2">
                             <FAQItem 
                                question="Is Bubble.ib really free?" 
                                answer="Yes. Bubble.ib is a non-profit student initiative. You get 100 free credits to start. After that, you can use your own Gemini API key for unlimited free usage (within Google's free tier limits)." 
                             />
                             <FAQItem 
                                question="How do I get an API Key?" 
                                answer="Go to Google AI Studio (aistudio.google.com), create a new project, and generate an API key. Then paste it into Bubble.ib's settings." 
                             />
                             <FAQItem 
                                question="What is the difference between Solver and Drill?" 
                                answer="Solver analyzes specific problems you upload. Drill generates endless practice questions based on your chosen difficulty and topics." 
                             />
                        </div>
                    </div>

                    {/* Ask Admin Section */}
                    <div className="space-y-4">
                         <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ask Support</h3>
                            <span className="text-[10px] text-blue-400 flex items-center gap-1">
                                <MessageCircle size={10} /> replies via email
                            </span>
                         </div>
                         
                         {isSuccess ? (
                             <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 py-6 bg-white/5 rounded-xl border border-white/10">
                                 <Send 
                                    size={24} 
                                    className="text-green-400 mb-3 animate-bounce" 
                                 />
                                 <p className="text-white font-bold text-sm">Request Sent</p>
                                 <p className="text-xs text-gray-400 mt-1">We'll respond to <b>{user.email}</b> shortly.</p>
                             </div>
                         ) : (
                             <form onSubmit={handleSubmit} className="space-y-3">
                                 <textarea 
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="Type your question here..."
                                    className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/30 resize-none transition-colors"
                                 />
                                 <button 
                                    type="submit"
                                    disabled={!question.trim() || isSubmitting}
                                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <>Send Request <Send size={14} /></>}
                                 </button>
                             </form>
                         )}
                    </div>

                </div>
             </div>
        </div>
    );
};

export default HelpModal;
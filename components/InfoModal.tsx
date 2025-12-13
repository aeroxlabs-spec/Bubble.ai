
import React from 'react';
import { X, Info, Mail, Zap, GraduationCap, Pen } from 'lucide-react';

export type InfoPageType = 'ABOUT' | 'SERVICES' | 'CONTACT';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    page: InfoPageType | null;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, page }) => {
    if (!isOpen || !page) return null;

    const renderContent = () => {
        switch (page) {
            case 'ABOUT':
                return (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-white">Our Mission</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Bubble.ib is a student-led initiative designed to democratize high-quality mathematics tutoring. 
                                Built specifically for the <strong>International Baccalaureate (IB)</strong> curriculum, we leverage advanced AI 
                                (powered by Google's Gemini models) to help Math Analysis and Approaches HL students master complex concepts without the high cost of private tuition.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-white">How It Works</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Unlike generic math solvers, Bubble.ib is context-aware. It understands IB markschemes, 
                                method marks (M1), and accuracy marks (A1). It doesn't just give you the answer; 
                                it teaches you the methodology required to score maximum points in your exams.
                            </p>
                        </div>
                    </div>
                );
            case 'SERVICES':
                return (
                    <div className="space-y-6">
                        <div className="grid gap-4">
                            <div className="bg-[#121212] p-4 rounded-xl border border-blue-500/20">
                                <div className="flex items-center gap-3 mb-2">
                                    <Pen className="text-blue-400" size={20} />
                                    <h4 className="font-bold text-white">Smart Solver</h4>
                                </div>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Upload any math problem (image or text). Our AI breaks it down into logical steps, 
                                    provides hints, and generates a detailed IB-style markscheme to help you self-assess.
                                </p>
                            </div>

                            <div className="bg-[#121212] p-4 rounded-xl border border-purple-500/20">
                                <div className="flex items-center gap-3 mb-2">
                                    <GraduationCap className="text-purple-400" size={20} />
                                    <h4 className="font-bold text-white">Exam Creator</h4>
                                </div>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Need practice papers? Generate full-length Mock Exams tailored to specific topics, 
                                    difficulties, and time constraints. Perfect for revision sessions.
                                </p>
                            </div>

                            <div className="bg-[#121212] p-4 rounded-xl border border-yellow-500/20">
                                <div className="flex items-center gap-3 mb-2">
                                    <Zap className="text-yellow-400" size={20} />
                                    <h4 className="font-bold text-white">Adaptive Drill</h4>
                                </div>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    A dynamic practice mode that adjusts difficulty based on your performance. 
                                    Master specific topics like Calculus or Vectors with rapid-fire questions and instant feedback.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            case 'CONTACT':
                return (
                    <div className="space-y-6">
                        <p className="text-gray-400 text-sm">
                            We value your feedback and are here to help with any technical issues or feature requests.
                        </p>
                        
                        <div className="bg-[#121212] p-4 rounded-xl border border-white/10 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-white/5 p-2 rounded-lg">
                                    <Mail className="text-blue-400" size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">Email Support</h4>
                                    <p className="text-gray-500 text-xs mb-1">For general inquiries and partnerships.</p>
                                    <a href="mailto:support@bubbleib.eu" className="text-blue-400 text-xs hover:text-blue-300 transition-colors">
                                        support@bubbleib.eu
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 pt-4 border-t border-white/5">
                                <div className="bg-white/5 p-2 rounded-lg">
                                    <Info className="text-purple-400" size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">Feedback</h4>
                                    <p className="text-gray-500 text-xs">
                                        Found a bug or have a suggestion? Use the "Send Feedback" button in the user menu 
                                        to reach our development team directly.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    const getTitle = () => {
        switch (page) {
            case 'ABOUT': return "About Bubble.ib";
            case 'SERVICES': return "Our Tools & Services";
            case 'CONTACT': return "Contact Us";
            default: return "";
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[85vh]">
                
                 {/* Top Gradient */}
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-20" />

                 {/* Header */}
                 <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5 pt-7">
                    <h2 className="text-lg font-bold text-white tracking-tight">{getTitle()}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {renderContent()}
                </div>
             </div>
        </div>
    );
};

export default InfoModal;

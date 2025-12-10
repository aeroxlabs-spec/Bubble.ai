
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, ArrowLeft, GraduationCap, Zap, Hash, Check, ExternalLink, Loader2, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface OnboardingModalProps {
    onComplete: () => void;
}

interface RichTypewriterProps {
    text: string;
    onComplete: () => void;
    highlightColor: string;
    onClick: () => void;
}

const RichTypewriter: React.FC<RichTypewriterProps> = ({ text, onComplete, highlightColor, onClick }) => {
    const [charIndex, setCharIndex] = useState(0);

    // Parse text into segments of { content, isHighlight }
    const segments = useMemo(() => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.filter(p => p).map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return { content: part.slice(2, -2), isHighlight: true };
            }
            return { content: part, isHighlight: false };
        });
    }, [text]);

    const fullText = segments.map(s => s.content).join('');

    useEffect(() => {
        if (charIndex < fullText.length) {
            const timeout = setTimeout(() => {
                setCharIndex(prev => prev + 1);
            }, 30); // Speed of typing
            return () => clearTimeout(timeout);
        } else {
            onComplete();
        }
    }, [charIndex, fullText, onComplete]);

    // Expose a way to force completion via parent click, or we can handle click here
    useEffect(() => {
        // If text changes, reset (unlikely in this modal flow, but good practice)
    }, [text]);

    // Force completion logic handled in parent/click
    const forceComplete = () => {
        setCharIndex(fullText.length);
        onComplete();
        onClick();
    };

    // Render logic
    let charsRendered = 0;
    
    return (
        <p onClick={forceComplete} className="leading-relaxed text-gray-300 text-sm md:text-base h-[60px] cursor-pointer hover:text-gray-200 transition-colors select-none">
            {segments.map((segment, i) => {
                const start = charsRendered;
                const end = start + segment.content.length;
                
                // Segment is fully typed
                if (charIndex >= end) {
                    charsRendered = end;
                    return segment.isHighlight ? (
                        <span key={i} className={`font-bold ${highlightColor} transition-colors duration-300`}>{segment.content}</span>
                    ) : (
                        <span key={i}>{segment.content}</span>
                    );
                }
                
                // Segment is partially typed
                if (charIndex > start && charIndex < end) {
                    const visiblePart = segment.content.slice(0, charIndex - start);
                    charsRendered = end; // Actually current pointer
                    return segment.isHighlight ? (
                        <span key={i} className={`font-bold ${highlightColor}`}>
                            {visiblePart}
                            <span className="border-r-2 border-white animate-pulse ml-0.5" />
                        </span>
                    ) : (
                        <span key={i}>
                            {visiblePart}
                            <span className="border-r-2 border-white animate-pulse ml-0.5" />
                        </span>
                    );
                }

                // Segment hasn't started
                charsRendered = end;
                return null;
            })}
        </p>
    );
};

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
    const { updateApiKey } = useAuth();
    const [step, setStep] = useState(0);
    const [canProceed, setCanProceed] = useState(false);
    const [inputKey, setInputKey] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [useCustomKey, setUseCustomKey] = useState(false);

    const slides = [
        {
            icon: GraduationCap,
            title: "Welcome to Bubble",
            subtitle: "Intelligent Tutor",
            text: "We are a **student-built platform** designed to help IB Math HL students understand complex exercises through **intelligent analysis**.",
            theme: {
                color: 'text-blue-400',
                bg: 'bg-blue-500',
                border: 'border-blue-500/20',
            }
        },
        {
            icon: Hash,
            title: "Private & Sustainable",
            subtitle: "Your Data, Your Keys",
            text: "Bubble uses a **Bring Your Own Key** model. Your API key is stored locally and never sent to our servers.",
            theme: {
                color: 'text-purple-400',
                bg: 'bg-purple-500',
                border: 'border-purple-500/20',
            }
        },
        {
            icon: Coins,
            title: "Completely Free",
            subtitle: "Non-Profit Initiative",
            text: "As a **non-profit seeking program**, our services are completely free. We provide **100 credits** so you can start learning immediately.",
            theme: {
                color: 'text-yellow-400',
                bg: 'bg-yellow-500',
                border: 'border-yellow-500/20',
            }
        },
        {
            icon: Zap,
            title: "Start Solving",
            subtitle: "Setup Complete",
            text: "You are ready to go. Enter your own **Gemini API Key** for unlimited access, or use the provided free credits.",
            isInputStep: true,
            theme: {
                // Gradient theme for the final step - Text gradient for highlight
                color: 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400', 
                // Progress bar gradient
                bg: 'bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500',
                border: 'border-white/20', 
                isGradient: true
            }
        }
    ];

    const handleSaveKey = async () => {
        if (useCustomKey && inputKey.length < 10) return;
        setIsSaving(true);
        try {
            if (useCustomKey && inputKey) {
                await updateApiKey(inputKey);
            }
            onComplete();
        } catch (e) {
            console.error(e);
            setIsSaving(false);
        }
    };

    const nextStep = () => {
        if (!canProceed) return; 
        setCanProceed(false);
        if (step < slides.length - 1) {
            setStep(step + 1);
        } else {
            onComplete();
        }
    };

    const prevStep = () => {
        if (step > 0) {
            setStep(step - 1);
            setCanProceed(true);
        }
    };

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                if (canProceed && !slides[step].isInputStep) {
                    nextStep();
                }
            } else if (e.key === 'ArrowLeft') {
                prevStep();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step, canProceed, slides]);

    const currentSlide = slides[step];
    const Icon = currentSlide.icon;
    const theme = currentSlide.theme;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in fade-in duration-500">
            {/* Custom Keyframe for Twitch Animation */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes twitch {
                    0% { transform: scale(0.8) rotate(0deg); opacity: 0; }
                    40% { transform: scale(1.1) rotate(-10deg); opacity: 1; }
                    60% { transform: scale(1.0) rotate(5deg); }
                    80% { transform: scale(1.05) rotate(-3deg); }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                }
            `}} />
            
            {/* SVG Definition for Gradient Icon */}
            <svg width="0" height="0" className="absolute">
                <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="50%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#facc15" />
                </linearGradient>
            </svg>

            <div className={`w-full max-w-lg bg-[#0e0e0e] border ${theme.border} rounded-3xl shadow-2xl overflow-hidden relative flex flex-col min-h-[460px] transition-all duration-500`}>
                
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-white/5 z-20">
                    <div 
                        className={`h-full transition-all duration-500 ease-out shadow-[0_0_2px_currentColor] ${theme.isGradient ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500' : theme.bg}`} 
                        style={{ width: `${((step + 1) / slides.length) * 100}%` }} 
                    />
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col p-6 pt-8 relative z-10">
                    {/* Background Glow */}
                    <div className={`absolute top-0 right-0 w-[280px] h-[280px] opacity-[0.08] blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2 transition-all duration-500 ${theme.isGradient ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500' : theme.bg}`} />
                    
                    {/* Icon - With Gradient Support */}
                    <div className="mb-4 h-16 flex items-center justify-start">
                        <div key={step} style={{ animation: 'twitch 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
                            {theme.isGradient ? (
                                <Icon size={48} style={{ stroke: "url(#icon-gradient)" }} className="drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                            ) : (
                                <Icon size={48} className={`${theme.color} drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]`} />
                            )}
                        </div>
                    </div>

                    <div className="mb-4">
                        {/* Subtitle - Grey if isInputStep, else colored */}
                        <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 opacity-70 ${theme.isGradient ? 'text-gray-500' : theme.color} transition-colors duration-300`}>{currentSlide.subtitle}</h3>
                        <h2 className="text-4xl font-bold text-white tracking-tight">{currentSlide.title}</h2>
                    </div>
                    
                    <RichTypewriter 
                        key={step} 
                        text={currentSlide.text} 
                        onComplete={() => setCanProceed(true)} 
                        onClick={() => setCanProceed(true)}
                        highlightColor={theme.color} 
                    />

                    {currentSlide.isInputStep && (
                         <div className={`mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${canProceed ? 'opacity-100' : 'opacity-0'}`}>
                            
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={() => setUseCustomKey(false)}
                                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left group ${!useCustomKey ? 'bg-white/10 border-white/20' : 'bg-[#151515] border-white/5 hover:border-white/10'}`}
                                >
                                    {/* Monochrome buttons as requested */}
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${!useCustomKey ? 'border-white bg-white' : 'border-gray-600'}`}>
                                        {!useCustomKey && <Check size={12} className="text-black" />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">Use Free Credits</div>
                                        <div className="text-xs text-gray-400">100 credits included to start.</div>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => setUseCustomKey(true)}
                                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left group ${useCustomKey ? 'bg-white/10 border-white/20' : 'bg-[#151515] border-white/5 hover:border-white/10'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${useCustomKey ? 'border-white bg-white' : 'border-gray-600'}`}>
                                        {useCustomKey && <Check size={12} className="text-black" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-white">I have my own Key</div>
                                        <div className="text-xs text-gray-400">Unlimited usage with your own API key.</div>
                                    </div>
                                </button>
                            </div>

                            {useCustomKey && (
                                <div className="mt-4 animate-in fade-in zoom-in-95 duration-200">
                                    <input 
                                        type="password" 
                                        value={inputKey}
                                        onChange={(e) => setInputKey(e.target.value)}
                                        placeholder="Paste Gemini API Key here..."
                                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-all font-mono"
                                        autoFocus
                                    />
                                    <a 
                                        href="https://aistudio.google.com/app/apikey" 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="mt-2 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors"
                                    >
                                        Get a key from Google <ExternalLink size={8} />
                                    </a>
                                </div>
                            )}
                         </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="px-6 pb-6 pt-0 flex items-center justify-between mt-auto">
                    <button 
                        onClick={prevStep}
                        disabled={step === 0}
                        className={`text-gray-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${step === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    >
                        <ArrowLeft size={14} /> Back
                    </button>

                    {currentSlide.isInputStep ? (
                        <button
                            onClick={handleSaveKey}
                            disabled={isSaving || (useCustomKey && inputKey.length < 10)}
                            className={`px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest text-black transition-all flex items-center gap-2 ${
                                (useCustomKey && inputKey.length < 10) 
                                    ? 'bg-gray-700 cursor-not-allowed text-gray-400' 
                                    : 'bg-white hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                            }`}
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Start Learning"}
                            {!isSaving && <ArrowRight size={16} />}
                        </button>
                    ) : (
                        <button 
                            onClick={nextStep}
                            disabled={!canProceed}
                            className={`px-6 py-3 rounded-full border text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                                canProceed 
                                    ? `bg-transparent border-white/20 text-white hover:bg-white/5 hover:border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]` 
                                    : 'border-white/10 text-gray-600 cursor-not-allowed bg-transparent'
                            }`}
                        >
                            Next <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;

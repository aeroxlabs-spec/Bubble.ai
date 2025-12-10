
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Pen, Zap, GraduationCap, ArrowRight, AlertCircle, Sigma, Divide, Minus, Lightbulb, Percent, Hash, Ghost } from 'lucide-react';

export const AuthScreens: React.FC = () => {
    const [view, setView] = useState<'LANDING' | 'LOGIN' | 'SIGNUP'>('LANDING');

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col relative overflow-hidden">
            
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] animate-pulse delay-1000" />
            </div>

            {/* Header */}
            <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                     <span className="text-2xl font-bold tracking-tighter">Bubble.</span>
                </div>
                {view === 'LANDING' && (
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => setView('LOGIN')}
                            className="text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
                        >
                            Log In
                        </button>
                        <button 
                            onClick={() => setView('SIGNUP')}
                            className="text-xs font-bold bg-white/10 border border-white/20 text-white px-5 py-2 rounded-full hover:bg-white/20 hover:border-white/40 transition-all uppercase tracking-wider"
                        >
                            Sign Up
                        </button>
                    </div>
                )}
                {view !== 'LANDING' && (
                     <button 
                        onClick={() => setView('LANDING')}
                        className="text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
                    >
                        Back
                    </button>
                )}
            </nav>

            <div className="flex-1 flex items-center justify-center z-10 px-4">
                {view === 'LANDING' && <LandingPage onViewChange={setView} />}
                {view === 'LOGIN' && <AuthForm mode="LOGIN" onSwitch={() => setView('SIGNUP')} />}
                {view === 'SIGNUP' && <AuthForm mode="SIGNUP" onSwitch={() => setView('LOGIN')} />}
            </div>
        </div>
    );
};

const LandingPage = ({ onViewChange }: { onViewChange: (v: 'LOGIN' | 'SIGNUP') => void }) => {
    const { loginAsGuest } = useAuth();
    
    return (
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center space-y-12 py-8 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
            
            {/* Hero Section */}
            <div className="space-y-8 max-w-4xl relative z-20 flex flex-col items-center">
                
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-none mb-2">
                    Master IB Math <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400 pb-2 inline-block">
                        with Intelligence.
                    </span>
                </h1>
                
                <div className="text-lg md:text-xl text-gray-400 w-full mx-auto leading-relaxed relative flex flex-col items-center">
                    <p className="whitespace-nowrap">
                        Step-by-step solutions, custom exam papers, and adaptive drills.
                    </p>
                </div>

                <div className="pt-4 flex flex-col items-center gap-4">
                    <button 
                        onClick={() => onViewChange('SIGNUP')}
                        className="group relative px-10 py-4 rounded-full font-bold text-base border border-white/10 text-white hover:border-white/20 transition-all bg-black/10 backdrop-blur-sm overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors" />
                        <span className="relative z-10 flex items-center gap-2">
                            Start learning <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                        </span>
                    </button>
                    
                    <button
                        onClick={loginAsGuest}
                        className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5"
                    >
                        <Ghost size={14} /> Continue as Guest (Test Mode)
                    </button>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 w-full px-4 pt-20">
                <FeatureCard 
                    icon={<Pen size={20} className="text-blue-400" />}
                    title="Smart Solver"
                    desc="Detailed breakdowns and markscheme analysis."
                    extraInfo="Upload any math image. Gemini analyzes structure & logic."
                    color="border-blue-500/20 hover:border-blue-500/40"
                    gradient="from-blue-500/5"
                />
                <FeatureCard 
                    icon={<GraduationCap size={20} className="text-purple-400" />}
                    title="Exam Creator"
                    desc="Generate full IB papers from your notes."
                    extraInfo="Select topics. AI generates a formatted IB PDF paper."
                    color="border-purple-500/20 hover:border-purple-500/40"
                    gradient="from-purple-500/5"
                />
                <FeatureCard 
                    icon={<Zap size={20} className="text-yellow-400" />}
                    title="Adaptive Drill"
                    desc="Sessions that adapt to your skill level."
                    extraInfo="Practice mode. Questions adapt to your skill level in real-time."
                    color="border-yellow-500/20 hover:border-yellow-500/40"
                    gradient="from-yellow-500/5"
                />
            </div>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc, color, gradient, extraInfo }: any) => {
    const [isHovered, setIsHovered] = useState(false);
    const [typedText, setTypedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Using the same icons as UploadZone for consistency
    const icons = [
        { Icon: Sigma, color: 'text-red-400', x: -100, y: -55, r: -25 },
        { Icon: Divide, color: 'text-orange-400', x: -70, y: -75, r: -15 },
        { Icon: Minus, color: 'text-yellow-400', x: -35, y: -50, r: -5 },
        { Icon: Lightbulb, color: 'text-green-400', x: 0, y: -65, r: 0 },
        { Icon: Pen, color: 'text-blue-400', x: 35, y: -50, r: 5 },
        { Icon: Percent, color: 'text-purple-400', x: 70, y: -75, r: 15 },
        { Icon: Hash, color: 'text-pink-400', x: 100, y: -55, r: 25 },
        { Icon: GraduationCap, color: 'text-indigo-400', x: 0, y: -85, r: 0 }, // Center high
    ];

    const handleClick = () => {
        if (isTyping || !extraInfo) return;
        setIsTyping(true);
        setTypedText('');
        
        let i = 0;
        const text = extraInfo;
        
        const typeInterval = setInterval(() => {
            if (i < text.length) {
                setTypedText(text.slice(0, i + 1));
                i++;
            } else {
                clearInterval(typeInterval);
                setTimeout(() => {
                    const deleteInterval = setInterval(() => {
                        setTypedText(prev => {
                            if (prev.length <= 1) {
                                clearInterval(deleteInterval);
                                setIsTyping(false);
                                return '';
                            }
                            return prev.slice(0, -1);
                        });
                    }, 20);
                }, 2000);
            }
        }, 30);
    };

    return (
        <div 
            className="group relative w-full h-[220px] cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
             {/* Peeping Icons Layer - Positioned relative to the card top */}
             <div className="absolute top-0 left-0 right-0 h-0 flex justify-center z-0">
                 {icons.map((item, i) => (
                     <div
                        key={i}
                        className={`absolute top-2 ${item.color} transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
                        style={{
                            transform: isHovered 
                                ? `translate(${item.x}px, ${item.y}px) rotate(${item.r}deg)` 
                                : `translate(${item.x * 0.2}px, 10px) rotate(0deg)`, // Start slightly bunched and hidden
                            opacity: isHovered ? 1 : 0,
                            zIndex: -1
                        }}
                     >
                        <item.Icon size={20} className="drop-shadow-lg" />
                     </div>
                 ))}
             </div>

             {/* Card Content - Has background to hide icons when they retract */}
             <div className={`relative z-10 h-full p-6 pt-10 rounded-xl bg-[#0a0a0a] border ${color} transition-all duration-300 group-hover:scale-[1.02] shadow-lg flex flex-col items-start justify-start`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl`} />
                <div className="relative z-10 space-y-3 w-full text-left">
                    <div className="p-2.5 bg-[#151515] rounded-lg inline-block shadow-inner border border-white/5">{icon}</div>
                    <div>
                        <h3 className="font-bold text-lg text-white mb-1 tracking-tight">{title}</h3>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">{desc}</p>
                    </div>
                    {/* Extra Info - Fixed height reserved to prevent layout shift */}
                    <div className={`text-[11px] font-mono text-blue-300 mt-2 h-12 transition-opacity duration-200 ${typedText ? 'opacity-100' : 'opacity-0'}`}>
                        {typedText}
                        {typedText && <span className="inline-block w-1.5 h-3 bg-blue-400 ml-1 animate-pulse align-middle" />}
                    </div>
                </div>
             </div>
        </div>
    )
}

// Minimal Google G Logo
const GoogleGLogo = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.52 12.29C23.52 11.43 23.44 10.61 23.3 9.81H12V14.45H18.45C18.17 15.93 17.33 17.18 16.07 18.03V21H19.95C22.22 18.91 23.52 15.83 23.52 12.29Z" fill="#4285F4"/>
        <path d="M12 24C15.24 24 17.96 22.92 19.95 21.09L16.07 18.03C15 18.75 13.62 19.18 12 19.18C8.88 19.18 6.23 17.07 5.29 14.25H1.28V17.36C3.34 21.46 7.57 24 12 24Z" fill="#34A853"/>
        <path d="M5.29 14.25C5.05 13.39 4.92 12.48 4.92 11.55C4.92 10.62 5.05 9.71 5.29 8.85V5.74H1.28C0.46 7.37 0 9.2 0 11.55C0 13.9 0.46 15.73 1.28 17.36L5.29 14.25Z" fill="#FBBC05"/>
        <path d="M12 3.92C13.76 3.92 15.34 4.53 16.59 5.72L20.03 2.28C17.96 0.35 15.24 0 12 0C7.57 0 3.34 2.54 1.28 6.64L5.29 9.74C6.23 6.92 8.88 3.92 12 3.92Z" fill="#EA4335"/>
    </svg>
);

const OrbitalAuthAnimation = ({ onComplete }: { onComplete: () => void }) => {
    // Duration approx 2.2s
    useEffect(() => {
        const timer = setTimeout(onComplete, 2200);
        return () => clearTimeout(timer);
    }, [onComplete]);

    const icons = [
        { Icon: Sigma, color: 'text-red-500' },
        { Icon: Divide, color: 'text-orange-500' },
        { Icon: Minus, color: 'text-yellow-500' },
        { Icon: Lightbulb, color: 'text-green-500' },
        { Icon: Percent, color: 'text-purple-500' },
        { Icon: Hash, color: 'text-pink-500' },
        { Icon: GraduationCap, color: 'text-indigo-500' },
        { Icon: Pen, color: 'text-blue-500' },
    ];

    const radius = 30; // Radius for the ring

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-500">
             
             {/* Spinner Container - Explicit dimensions to ensure centering */}
             <div className="relative w-20 h-20 flex items-center justify-center mb-12">
                 {/* The Rotating Ring - Uses strict 3s spin */}
                 <div className="absolute inset-0 w-full h-full animate-[spin_3s_linear_infinite] rounded-full">
                    {icons.map((item, i) => {
                        const angle = i * (360 / icons.length);
                        return (
                            <div
                                key={i}
                                className={`absolute top-1/2 left-1/2 ${item.color} flex items-center justify-center`}
                                style={{
                                    transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`,
                                    width: '24px',
                                    height: '24px'
                                }}
                            >
                                <item.Icon size={18} strokeWidth={2.5} />
                            </div>
                        );
                    })}
                 </div>
             </div>

             <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] animate-pulse">
                 Verifying
             </div>
        </div>
    );
};

const AuthForm = ({ mode, onSwitch }: { mode: 'LOGIN' | 'SIGNUP', onSwitch: () => void }) => {
    const { login, signup, loginWithGoogle } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // Simplified Google Auth Handler using Supabase Redirect
    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            // "credential" param not needed for Supabase OAuth trigger, we just call the wrapper
            await loginWithGoogle(''); 
        } catch (e: any) {
            setError(e.message || "Google Login Failed");
            setIsLoading(false);
        }
    }

    const performAuth = async () => {
        try {
            if (mode === 'LOGIN') {
                await login(email, password);
            } else {
                await signup(name, email, password);
            }
        } catch (err: any) {
            setError(err.message || "Authentication failed");
            setIsLoading(false);
            setIsAnimating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        setIsAnimating(true);
        // Auth triggered via animation callback
    };

    return (
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300 relative">
            
            <div className={`bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden transition-all duration-500 ${isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
                {/* Simplified gradient to single color blue to match user preference */}
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50" />
                
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {mode === 'LOGIN' ? 'Welcome back' : 'Create an account'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {mode === 'LOGIN' ? 'Enter your credentials to access your workspace.' : 'Join Bubble to start mastering IB Math.'}
                    </p>
                </div>
                
                {/* Standardized Google Auth Button for Supabase */}
                <button 
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="relative w-full h-[42px] mb-6 group bg-[#0a0a0a] border border-white/10 rounded-full flex items-center justify-center gap-2.5 transition-all hover:border-white/30 hover:bg-[#151515] disabled:opacity-50"
                >
                     <GoogleGLogo />
                     <span className="text-sm font-bold text-gray-300 group-hover:text-white font-sans">Continue with Google</span>
                </button>
                
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-px bg-white/5 flex-1" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Or continue with email</span>
                    <div className="h-px bg-white/5 flex-1" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {mode === 'SIGNUP' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                            <input 
                                type="text" 
                                required 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors bg-transparent border-white/10 shadow-inner"
                                placeholder="John Doe"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors bg-transparent border-white/10 shadow-inner"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                        <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors bg-transparent border-white/10 shadow-inner"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-transparent border border-white/20 text-white font-bold py-2.5 rounded-full hover:bg-white/5 hover:border-white/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {isLoading ? (
                             <span className="text-xs font-mono animate-pulse">Initializing...</span>
                        ) : (
                             mode === 'LOGIN' ? 'Log In' : 'Sign Up'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={onSwitch}
                        className="text-sm text-gray-500 hover:text-white transition-colors"
                        disabled={isLoading}
                    >
                        {mode === 'LOGIN' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                    </button>
                </div>
            </div>

            {/* Success Animation Layer */}
            {isAnimating && (
                 <OrbitalAuthAnimation onComplete={performAuth} />
            )}
            
            {!isAnimating && (
                <div className="mt-8 text-center animate-in fade-in delay-200">
                    <p className="text-[10px] text-gray-600">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            )}
        </div>
    );
};

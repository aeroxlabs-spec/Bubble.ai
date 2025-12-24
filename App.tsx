
import React, { useState, useEffect, useRef } from 'react';
import { AppState, MathSolution, MathStep, UserInput, AppMode, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty, ConceptSettings, ConceptExplanation } from './types';
import { analyzeMathInput, getMarkscheme, generateExam, generateDrillQuestion, generateDrillSolution, generateDrillBatch, generateConceptExplanation, reloadConceptExamples } from './services/geminiService';
import { supabase, withTimeout } from './services/supabaseClient';
import { useAuth } from './contexts/AuthContext';
import { AuthScreens } from './components/AuthScreens';
import UploadZone from './components/UploadZone';
import StepCard from './components/StepCard';
import ChatInterface from './components/ChatInterface';
import MarkdownRenderer from './components/MarkdownRenderer';
import ExamConfigPanel from './components/ExamConfigPanel';
import ExamViewer from './components/ExamViewer';
import DrillConfigPanel from './components/DrillConfigPanel';
import DrillSessionViewer from './components/DrillSessionViewer';
import ConceptConfigPanel from './components/ConceptConfigPanel';
import ConceptViewer from './components/ConceptViewer';
import OnboardingModal from './components/OnboardingModal'; 
import ApiKeyModal from './components/ApiKeyModal';
import FeedbackModal from './components/FeedbackModal';
import HelpModal from './components/HelpModal';
import AdminFeedbackModal from './components/AdminFeedbackModal';
import InfoModal, { InfoPageType } from './components/InfoModal';
import Footer from './components/Footer';
import { Pen, X, ArrowRight, Maximize2, Loader2, ChevronDown, FileText, Download, ScrollText, Layers, Sigma, Divide, Minus, Lightbulb, Zap, LogOut, LayoutDashboard, RefreshCw, Settings, Coins, ShieldCheck } from 'lucide-react';

const SectionContainer: React.FC<{ title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void; icon?: React.ReactNode; rightContent?: React.ReactNode; }> = ({ title, children, isOpen, onToggle, icon, rightContent }) => {
    return (
        <div className="border border-white/10 rounded-xl bg-[#0a0a0a]">
            <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-300 text-sm group-hover:text-white transition-colors uppercase tracking-wider flex items-center gap-2">
                        {icon || <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 group-hover:bg-blue-400 transition-colors" />}
                        {title}
                    </span>
                    {rightContent && <div className="animate-in fade-in slide-in-from-left-2 duration-300" onClick={(e) => e.stopPropagation()}>{rightContent}</div>}
                </div>
                <ChevronDown className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 pt-0 space-y-4 border-t border-white/5 mt-0">{children}</div>
                </div>
            </div>
        </div>
    );
};

const TypewriterLoader = ({ phrases }: { phrases: string[] }) => {
    const [text, setText] = useState('');
    const [index, setIndex] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => {
            setText(phrases[index].slice(0, text.length + 1));
            if (text === phrases[index]) {
                setTimeout(() => {
                    setText('');
                    setIndex((index + 1) % phrases.length);
                }, 1000);
            }
        }, 50);
        return () => clearInterval(timer);
    }, [text, index, phrases]);
    return <div className="text-gray-400 text-xs font-mono">{text}<span className="animate-pulse">|</span></div>;
};

const App: React.FC = () => {
  const { user, loading: authLoading, logout, finishOnboarding, credits, userApiKey, isCloudSynced } = useAuth();
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [appMode, setAppMode] = useState<AppMode>('SOLVER');
  const [uploads, setUploads] = useState<UserInput[]>([]);
  const [solutions, setSolutions] = useState<(MathSolution | null)[]>([]); 
  const [generatedExam, setGeneratedExam] = useState<ExamPaper | null>(null);
  const [conceptExplanation, setConceptExplanation] = useState<ConceptExplanation | null>(null);
  const [drillQuestions, setDrillQuestions] = useState<DrillQuestion[]>([]);
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [activeView, setActiveView] = useState<'steps' | 'markscheme'>('steps');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [infoPage, setInfoPage] = useState<InfoPageType | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const isAdmin = user?.email === 'gbrlmartinlopez@gmail.com';

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setUploads([]);
    setSolutions([]);
    setGeneratedExam(null);
    setConceptExplanation(null);
    setDrillQuestions([]);
    setErrorMsg(null);
  };

  const startSolverFlow = async () => {
    setAppState(AppState.ANALYZING);
    setLoadingProgress(20);
    try {
      const res = await analyzeMathInput(uploads[0]);
      setSolutions([res]);
      setAppState(AppState.SOLVED);
    } catch (e: any) {
      setErrorMsg(e.message);
      setAppState(AppState.ERROR);
    }
  };

  const handleMainAction = () => {
    if (appMode === 'SOLVER') startSolverFlow();
    else setShowConfig(true);
  };

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!user) return <AuthScreens />;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-blue-500/30">
      {!user.hasOnboarded && <OnboardingModal onComplete={finishOnboarding} />}
      <ApiKeyModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} user={user} />
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} user={user} />
      {isAdmin && <AdminFeedbackModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} adminUser={user} />}
      <InfoModal isOpen={!!infoPage} page={infoPage} onClose={() => setInfoPage(null)} />

      <nav className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-2xl font-bold tracking-tighter">BubbleIB</span>
            <div className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                <Coins size={12} className="text-yellow-400" />
                <span className="text-[10px] font-bold text-yellow-200">{credits}</span>
                <div className="h-2 w-px bg-white/10 mx-1" />
                {userApiKey ? <ShieldCheck size={12} className="text-green-400" /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setShowApiKeyModal(true)} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors" title="Settings">
                <Settings size={18} />
            </button>
            <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.name[0]}
                </button>
                {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#181818] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="px-4 py-3 border-b border-white/5">
                            <div className="text-sm font-bold">{user.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                        </div>
                        <div className="p-1">
                            <button onClick={() => { setShowApiKeyModal(true); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded-lg flex items-center gap-2"><Settings size={14} /> Connections</button>
                            <button onClick={logout} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2"><LogOut size={14} /> Sign Out</button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-bold tracking-tight">Math explained. <span className="text-blue-400">Simply.</span></h1>
                    <p className="text-gray-500 max-w-md mx-auto">Upload exercises, notes, or topics. Get tailored IB analysis.</p>
                </div>
                <UploadZone uploads={uploads} onUpload={(u) => setUploads([...uploads, u])} onRemove={(id) => setUploads(uploads.filter(u => u.id !== id))} appMode={appMode} />
                <button onClick={handleMainAction} disabled={uploads.length === 0} className="px-10 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2">
                    Solve Problem <ArrowRight size={18} />
                </button>
            </div>
        )}

        {appState === AppState.ANALYZING && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <Loader2 size={40} className="text-blue-500 animate-spin" />
                <TypewriterLoader phrases={["Reading image...", "Identifying concepts...", "Building solution..."]} />
            </div>
        )}

        {appState === AppState.SOLVED && solutions[0] && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Final Answer</h3>
                        <div className="text-xl font-medium"><MarkdownRenderer content={solutions[0].finalAnswer} /></div>
                    </div>
                </div>
                <div className="lg:col-span-8 space-y-4">
                    {solutions[0].steps.map((step, i) => (
                        <StepCard key={i} step={step} index={i} isActive={currentStepIndex === i} problemContext="" onClick={() => setCurrentStepIndex(i)} />
                    ))}
                </div>
            </div>
        )}
      </main>
      <Footer onLinkClick={setInfoPage} />
    </div>
  );
};

export default App;

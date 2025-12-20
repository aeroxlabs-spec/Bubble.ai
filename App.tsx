
import React, { useState, useEffect, useRef } from 'react';
import { AppState, MathSolution, MathStep, UserInput, AppMode, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty, ConceptSettings, ConceptExplanation } from './types';
import { analyzeMathInput, getMarkscheme, generateExam, generateDrillQuestion, generateDrillSolution, generateDrillBatch, generateConceptExplanation, reloadConceptExamples } from './services/geminiService';
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
import FeedbackModal from './components/FeedbackModal';
import HelpModal from './components/HelpModal';
import AdminFeedbackModal from './components/AdminFeedbackModal';
import InfoModal, { InfoPageType } from './components/InfoModal';
import Footer from './components/Footer';
import { Pen, X, ArrowRight, Maximize2, Loader2, BookOpen, ChevronDown, FileText, Download, ScrollText, Layers, Sigma, Divide, Minus, Lightbulb, Percent, Hash, GraduationCap, Calculator, Zap, LogOut, User as UserIcon, Check, AlertCircle, Key, Coins, MessageSquare, HelpCircle, LayoutDashboard, RefreshCw, Settings } from 'lucide-react';

const App: React.FC = () => {
  const { user, loading: authLoading, logout, finishOnboarding, credits, useCredits } = useAuth();
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [appMode, setAppMode] = useState<AppMode>('SOLVER');
  const [uploads, setUploads] = useState<UserInput[]>([]);
  const [solutions, setSolutions] = useState<(MathSolution | null)[]>([]); 
  const [generatedExam, setGeneratedExam] = useState<ExamPaper | null>(null);
  const [conceptExplanation, setConceptExplanation] = useState<ConceptExplanation | null>(null);
  const [drillSettings, setDrillSettings] = useState<DrillSettings | null>(null);
  const [drillQuestions, setDrillQuestions] = useState<DrillQuestion[]>([]);
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [loadingDrillSolution, setLoadingDrillSolution] = useState(false); 
  const [activeTab, setActiveTab] = useState<number>(0);
  const [activeView, setActiveView] = useState<'steps' | 'markscheme'>('steps');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatPrompt, setChatPrompt] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [loadingMarkscheme, setLoadingMarkscheme] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPageType | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [startBackgroundEffects, setStartBackgroundEffects] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [isMarkschemeOpen, setIsMarkschemeOpen] = useState(true);

  const isAdmin = user?.email === 'gbrlmartinlopez@gmail.com';

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setSolutions([]);
    setGeneratedExam(null);
    setConceptExplanation(null);
    setUploads([]);
    setCurrentStepIndex(0);
    setActiveTab(0);
    setIsChatOpen(false);
    setErrorMsg(null);
    setDrillQuestions([]);
    setCurrentDrillIndex(0);
  };

  useEffect(() => { if (!user) handleReset(); }, [user]);

  const handleMainAction = () => {
    if (uploads.length === 0 && appMode === 'SOLVER') return;
    if (appMode === 'SOLVER') startSolverFlow();
    else setShowConfig(true);
  };

  const startSolverFlow = async () => {
    setAppState(AppState.ANALYZING);
    setSolutions(new Array(uploads.length).fill(null));
    try {
      const result = await analyzeMathInput(uploads[0]);
      setSolutions([result]);
      setAppState(AppState.SOLVED);
    } catch (err: any) {
      setErrorMsg(err.message || "Analysis failed.");
      setAppState(AppState.ERROR);
    }
  }

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (!user) return <AuthScreens />;

  return (
    <div className="min-h-screen text-gray-100 bg-black font-sans flex flex-col overflow-x-hidden">
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} user={user} />
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} user={user} />
      {isAdmin && <AdminFeedbackModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} adminUser={user} />}
      <InfoModal isOpen={!!infoPage} page={infoPage} onClose={() => setInfoPage(null)} />

      <nav className="sticky top-0 z-40 border-b border-white/5 bg-black/95 backdrop-blur-sm h-16 flex items-center justify-between px-6">
          <div className="font-bold text-xl tracking-tighter">BubbleIB</div>
          
          <div className="flex items-center gap-3">
              {/* API Key settings removed to comply with mandatory guidelines */}
              {appState !== AppState.IDLE && <button onClick={handleReset} className="text-xs font-bold text-gray-500 hover:text-white px-3 py-1.5 border border-white/10 rounded-md">Home</button>}
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold">{user.name.charAt(0)}</button>
          </div>
      </nav>

      <main className="mx-auto px-4 py-8 max-w-6xl flex-1">
          {appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-bold tracking-tight">Math explained. <span className="text-blue-400">Simply.</span></h1>
                    <p className="text-lg text-gray-500 max-w-md mx-auto">Upload IB Math problems. Get step-by-step solutions.</p>
                </div>
                <UploadZone uploads={uploads} onUpload={u => setUploads([...uploads, u])} onRemove={id => setUploads(uploads.filter(u => u.id !== id))} appMode={appMode} />
                <button onClick={handleMainAction} disabled={uploads.length === 0} className="px-10 py-4 bg-white/5 border border-blue-500/30 text-blue-400 rounded-full font-bold transition-all hover:bg-white/10 disabled:opacity-50">
                    Analyze Problems
                </button>
            </div>
          )}
          
          {appState === AppState.SOLVED && solutions[0] && (
              <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
                  <div className="lg:col-span-4 space-y-6">
                      <div className="bg-[#0a0a0a] p-6 rounded-xl border border-white/10">
                          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Summary</h3>
                          <div className="text-sm leading-relaxed"><MarkdownRenderer content={solutions[0].problemSummary} /></div>
                      </div>
                  </div>
                  <div className="lg:col-span-8 space-y-4">
                      {solutions[0].steps.map((step, i) => (
                          <StepCard key={i} step={step} index={i} isActive={currentStepIndex === i} problemContext="" onClick={() => setCurrentStepIndex(i)} onNext={() => setCurrentStepIndex(i+1)} onPrev={() => setCurrentStepIndex(i-1)} isFirst={i===0} isLast={i===solutions[0]!.steps.length-1} />
                      ))}
                  </div>
              </div>
          )}
      </main>
      <Footer onLinkClick={setInfoPage} />
      {appState === AppState.SOLVED && <ChatInterface solution={solutions[0]!} currentStepIndex={currentStepIndex} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} activeView="steps" mode={appMode} userName={user.name} />}
    </div>
  );
};

export default App;

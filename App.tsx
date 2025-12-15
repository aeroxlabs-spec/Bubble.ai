
import React, { useState, useEffect, useRef } from 'react';
import { AppState, MathSolution, MathStep, UserInput, AppMode, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty, ConceptSettings, ConceptExplanation } from './types';
import { analyzeMathInput, getMarkscheme, generateExam, generateDrillQuestion, getSystemDiagnostics, generateDrillSolution, getDailyUsage, generateDrillBatch, generateConceptExplanation, reloadConceptExamples, generateSimilarProblem } from './services/geminiService';
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
import InteractiveGraph from './components/InteractiveGraph'; // Import new graph component
import { Pen, X, ArrowRight, Maximize2, Loader2, BookOpen, ChevronDown, FileText, Download, ScrollText, Layers, Sigma, Divide, Minus, Lightbulb, Percent, Hash, GraduationCap, Calculator, Zap, LogOut, User as UserIcon, Check, AlertCircle, Key, Coins, MessageSquare, ShieldAlert, HelpCircle, Activity, LayoutDashboard, RefreshCw, Sparkles } from 'lucide-react';

// Cost Configuration
const COSTS = {
    SOLVER_PER_IMAGE: 5,
    EXAM_GENERATION: 25,
    DRILL_SESSION: 10,
    CONCEPT_EXPLANATION: 15,
    CONCEPT_RELOAD: 1,
    SIMILAR_PROBLEM: 2
};

const MagneticPencil = ({ onClick, isOpen, mode }: { onClick: () => void, isOpen: boolean, mode: AppMode }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isOpen) {
          setPosition({ x: 0, y: 0 });
          return;
      }
      
      if (!btnRef.current) return;
      
      const rect = btnRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      
      const range = 80;

      if (distance < range) {
        const power = 0.2;
        setPosition({ x: distanceX * power, y: distanceY * power });
      } else {
        setPosition({ x: 0, y: 0 });
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  let colorClass = 'text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]';
  if (mode === 'DRILL') colorClass = 'text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]';
  if (mode === 'CONCEPT') colorClass = 'text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]';

  let Icon = Pen;
  if (mode === 'DRILL') Icon = Zap;
  if (mode === 'CONCEPT') Icon = Lightbulb;

  return (
    <div className="fixed bottom-10 right-10 z-50 pointer-events-none">
       <button
        ref={btnRef}
        onClick={onClick}
        style={{ 
            transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        className="pointer-events-auto p-3 transition-transform duration-150 ease-out hover:scale-105 focus:outline-none bg-transparent"
        aria-label={isOpen ? "Close Assistant" : "Open Assistant"}
      >
        {isOpen ? (
            <X size={20} className="text-white opacity-80" />
        ) : (
            <Icon size={20} className={colorClass} />
        )}
      </button>
    </div>
  );
};

const Lightbox = ({ src, onClose }: { src: string, onClose: () => void }) => {
    return (
        <div 
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
                <X size={32} />
            </button>
            <img 
                src={src} 
                alt="Full size" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
    )
}

interface SectionContainerProps { 
    title: string; 
    children: React.ReactNode; 
    isOpen: boolean; 
    onToggle: () => void;
    icon?: React.ReactNode;
    rightContent?: React.ReactNode;
}

const SectionContainer: React.FC<SectionContainerProps> = ({ title, children, isOpen, onToggle, icon, rightContent }) => {
    return (
        <div className="border border-white/10 rounded-xl bg-[#0a0a0a]">
            <button 
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-300 text-sm group-hover:text-white transition-colors uppercase tracking-wider flex items-center gap-2">
                        {icon || <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 group-hover:bg-blue-400 transition-colors" />}
                        {title}
                    </span>
                    {rightContent && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-300" onClick={(e) => e.stopPropagation()}>
                            {rightContent}
                        </div>
                    )}
                </div>
                <ChevronDown className={`text-gray-500 transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </button>
            
            <div 
                className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
            >
                <div className="overflow-hidden">
                    <div className="p-4 pt-0 space-y-4 border-t border-white/5 mt-0">
                        <div className="h-2" />
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TypewriterLoader = ({ phrases }: { phrases: string[] }) => {
    const [text, setText] = useState('');
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(50);
  
    useEffect(() => {
      const currentPhrase = phrases[phraseIndex];
      
      const handleType = () => {
        if (isDeleting) {
          setText(currentPhrase.substring(0, text.length - 1));
          setTypingSpeed(30);
        } else {
          setText(currentPhrase.substring(0, text.length + 1));
          setTypingSpeed(50 + Math.random() * 50);
        }
  
        if (!isDeleting && text === currentPhrase) {
          setTimeout(() => setIsDeleting(true), 2000);
        } else if (isDeleting && text === '') {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      };
  
      const timer = setTimeout(handleType, typingSpeed);
      return () => clearTimeout(timer);
    }, [text, isDeleting, phraseIndex, phrases, typingSpeed]);
  
    return (
      <div className="h-6 flex items-center justify-center text-gray-400 font-mono text-sm tracking-wide">
        <span>{text}</span>
        <span className={`w-0.5 h-4 ml-1 animate-pulse bg-current`} />
      </div>
    );
  };

const MarkschemeLoader = () => {
    const phrases = [
        "Analyzing solution steps...",
        "Applying IB marking codes...",
        "Structuring grading rubric...",
        "Calculating total marks...",
        "Finalizing table..."
    ];

    return (
        <div className="h-64 flex flex-col items-center justify-center space-y-6 border border-white/10 rounded-xl bg-[#0a0a0a] overflow-hidden relative">
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/5 via-transparent to-transparent animate-pulse" />
             
             <div className="relative z-10 flex flex-col items-center gap-6 px-4">
                 <div className="relative">
                    <ScrollText size={40} className="text-blue-500/80 animate-pulse" />
                 </div>
                 <div className="mt-2 text-center">
                    <TypewriterLoader phrases={phrases} />
                    <p className="text-[10px] text-gray-500 mt-4 max-w-[280px] mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-2 delay-1000">
                        Generating a detailed grading rubric. This may take a minute.<br/>
                        <span className="text-blue-400 font-medium">Feel free to return to the solution analysis while you wait.</span>
                    </p>
                 </div>
             </div>
        </div>
    );
}

const FallingBackgroundIcons = ({ active }: { active: boolean }) => {
    const [icons, setIcons] = useState<any[]>([]);
    const availableIndices = useRef<number[]>([]);

    const iconTypes = [
        { Icon: Sigma, color: 'text-red-400' },
        { Icon: Divide, color: 'text-orange-400' },
        { Icon: Minus, color: 'text-yellow-400' },
        { Icon: Lightbulb, color: 'text-green-400' },
        { Icon: Pen, color: 'text-blue-400' },
        { Icon: Percent, color: 'text-purple-400' },
        { Icon: Hash, color: 'text-pink-400' },
        { Icon: GraduationCap, color: 'text-indigo-400' },
    ];

    const getNextIcon = () => {
        if (availableIndices.current.length === 0) {
            availableIndices.current = Array.from({ length: iconTypes.length }, (_, i) => i);
        }
        const randomIndex = Math.floor(Math.random() * availableIndices.current.length);
        const iconIndex = availableIndices.current[randomIndex];
        availableIndices.current.splice(randomIndex, 1);
        return iconTypes[iconIndex];
    };

    useEffect(() => {
        if (!active) return;
        const interval = setInterval(() => {
            if (document.hidden) return; 

            const groupSize = Math.floor(Math.random() * 3) + 1; 
            const newIcons = [];
            for (let i = 0; i < groupSize; i++) {
                const id = Date.now() + Math.random();
                const type = getNextIcon();
                const isLeft = Math.random() > 0.5;
                const base = isLeft ? 17 : 83;
                const offset = (Math.random() * 10) - 5; 
                const left = base + offset;
                const duration = 3 + Math.random() * 3; 
                const rotation = (Math.random() * 180) - 90;
                const delay = Math.random() * 1.5;

                newIcons.push({ id, Icon: type.Icon, color: type.color, left, duration, rotation, delay });
            }
            setIcons(prev => [...prev, ...newIcons]);
            setTimeout(() => {
                setIcons(prev => prev.filter(icon => !newIcons.some(n => n.id === icon.id)));
            }, 8000); 
        }, 2000);
        return () => clearInterval(interval);
    }, [active]);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
            {icons.map((icon: any) => (
                <div
                    key={icon.id}
                    className={`absolute -top-12 ${icon.color}`}
                    style={{
                        left: `${icon.left}%`,
                        opacity: 0,
                        '--rot-end': `${icon.rotation}deg`,
                        animation: `bg-fall ${icon.duration}s linear forwards`,
                        animationDelay: `${icon.delay}s`
                    } as React.CSSProperties}
                >
                    <icon.Icon size={22} />
                </div>
            ))}
            <style>{`
                @keyframes bg-fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 0;
                    }
                    10% {
                        opacity: 0.8;
                    }
                    85% {
                        opacity: 0.8; 
                    }
                    100% {
                        transform: translateY(110vh) rotate(var(--rot-end));
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
};

const calculateTotalMarks = (text: string) => {
    if (!text) return 0;
    let score = 0;
    const regex = /\b[MAR](\d+)\b/g; 
    let match;
    while ((match = regex.exec(text)) !== null) {
        score += parseInt(match[1], 10);
    }
    return score;
};

const getBaseDifficulty = (diff: ExamDifficulty) => {
    switch (diff) {
        case 'HELL': return 9;
        case 'HARD': return 6;
        default: return 3; // STANDARD
    }
};

const App: React.FC = () => {
  const { user, loading: authLoading, logout, finishOnboarding, hasValidKey, credits, useCredits, decrementCredits } = useAuth();
  
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
  // Chat Prompt Trigger
  const [chatPrompt, setChatPrompt] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [analyzingIndex, setAnalyzingIndex] = useState<number>(-1);
  const [loadingMarkscheme, setLoadingMarkscheme] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [forceApiKeyModal, setForceApiKeyModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPageType | null>(null);
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [startBackgroundEffects, setStartBackgroundEffects] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [isMarkschemeOpen, setIsMarkschemeOpen] = useState(true);

  // Similar Problem State
  const [similarProblem, setSimilarProblem] = useState<DrillQuestion | null>(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);

  // Soft Limit Warning State
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

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
    setActiveView('steps');
    setStartBackgroundEffects(false);
    setShowConfig(false);
    setShowActionButtons(false);
    setErrorMsg(null);
    setDrillSettings(null);
    setDrillQuestions([]);
    setCurrentDrillIndex(0);
    setLoadingDrill(false);
    setLoadingDrillSolution(false);
    setLimitWarning(null); // Clear warnings on reset
    setChatPrompt('');
    setSimilarProblem(null);
    setShowSimilarModal(false);
  };

  useEffect(() => {
      if (!user) {
          handleReset();
      }
  }, [user]);

  // Keyboard Navigation for Steps in Solver Mode
  useEffect(() => {
      if (appState === AppState.SOLVED && appMode === 'SOLVER' && solutions[activeTab] && activeView === 'steps' && !showSimilarModal) {
          const handleKeyDown = (e: KeyboardEvent) => {
              // Only trigger if not typing in an input
              if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

              if (e.key === 'ArrowRight') {
                  setCurrentStepIndex(prev => {
                      const max = solutions[activeTab]!.steps.length - 1;
                      return prev < max ? prev + 1 : prev;
                  });
              } else if (e.key === 'ArrowLeft') {
                  setCurrentStepIndex(prev => Math.max(0, prev - 1));
              }
          };

          window.addEventListener('keydown', handleKeyDown);
          return () => window.removeEventListener('keydown', handleKeyDown);
      }
  }, [appState, appMode, solutions, activeTab, activeView, showSimilarModal]);


  // Warm-up effect: Ping Supabase on mount to prevent cold start delays
  useEffect(() => {
    const warmUp = async () => {
        try {
            // Simple lightweight query to wake up Supabase serverless function/db
            await withTimeout(supabase.from('user_api_keys').select('count', { count: 'exact', head: true }), 5000);
        } catch(e) { 
            // Silent catch, this is non-critical optimization
            console.log("Warmup ping completed (or timeout/fail)", e); 
        }
    };
    warmUp();
  }, []);

  const activeSolution = solutions[activeTab];
  const activeInput = uploads[activeTab];

  const stepGroups = React.useMemo(() => {
    if (!activeSolution) return [];
    
    const groups: { title: string; steps: { data: MathStep; index: number }[] }[] = [];
    
    activeSolution.steps.forEach((step, index) => {
        const sectionTitle = step.section || "Solution";
        if (groups.length === 0 || groups[groups.length - 1].title !== sectionTitle) {
            groups.push({ title: sectionTitle, steps: [] });
        }
        groups[groups.length - 1].steps.push({ data: step, index });
    });
    
    return groups;
  }, [activeSolution]);

  useEffect(() => {
      if (!stepGroups.length) return;
      const activeGroup = stepGroups.find(g => g.steps.some(s => s.index === currentStepIndex));
      if (activeGroup) {
          setOpenSections(prev => {
              const next = new Set(prev);
              next.add(activeGroup.title);
              return next;
          });
      }
  }, [currentStepIndex, stepGroups]);

  useEffect(() => {
    if (appState === AppState.ANALYZING) {
        const progressInterval = setInterval(() => {
            setLoadingProgress(prev => {
                if (prev >= 95) return prev;
                const increment = Math.max(0.2, (95 - prev) / 30); 
                return prev + increment;
            });
        }, 100);
        return () => clearInterval(progressInterval);
    } else {
        setLoadingProgress(0);
    }
  }, [appState, appMode]);

  const handleInputAdd = (input: UserInput) => {
    setUploads(prev => [...prev, input]);
    setErrorMsg(null);
  };

  const handleInputRemove = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const checkKeyAndProceed = async (action: () => Promise<void>, cost: number = 0) => {
      if (!user) return;
      if (hasValidKey) {
          if (useCredits()) {
              if (credits < cost) {
                   setForceApiKeyModal(true);
                   setShowApiKeyModal(true);
                   return;
              }
              decrementCredits(cost);
          }
          await action();
          
          // Check limits after action
          const { count, limit } = getDailyUsage();
          if (count > limit) {
              setLimitWarning(`Daily soft limit of ${limit} requests has been exceeded.`);
          }
      } else {
          setForceApiKeyModal(true);
          setShowApiKeyModal(true);
      }
  }

  const startSolverFlow = async () => {
    const cost = uploads.length * COSTS.SOLVER_PER_IMAGE;
    await checkKeyAndProceed(async () => {
        setAppState(AppState.ANALYZING);
        setAnalyzingIndex(0);
        setLoadingProgress(0);
        setStartBackgroundEffects(false); 
        setShowActionButtons(false);
        setSolutions(new Array(uploads.length).fill(null));

        try {
          const firstResult = await analyzeMathInput(uploads[0]);
          setLoadingProgress(100); 
          setTimeout(() => {
              setSolutions(prev => {
                  const next = [...prev];
                  next[0] = firstResult;
                  return next;
              });
              setAppState(AppState.SOLVED);
              setActiveTab(0);
              setCurrentStepIndex(0);
              if (uploads.length > 1) {
                  (async () => {
                      for (let i = 1; i < uploads.length; i++) {
                          try {
                              const res = await analyzeMathInput(uploads[i]);
                              setSolutions(p => { const n = [...p]; n[i] = res; return n; });
                          } catch (e) { console.error(e); }
                      }
                  })();
              }
          }, 500);
        } catch (err: any) {
          console.error(err);
          // err.message should now be the detailed string from mapGenAIError
          setErrorMsg(err.message || "Analysis failed. Please try again.");
          setAppState(AppState.ERROR);
        } finally {
          setAnalyzingIndex(-1);
        }
    }, cost);
}

const handleGenerateSimilarProblem = async () => {
    if (!activeSolution) return;
    
    setLoadingSimilar(true);
    await checkKeyAndProceed(async () => {
        try {
            const context = `${activeSolution.exerciseStatement}\nSolution Summary: ${activeSolution.problemSummary}`;
            const question = await generateSimilarProblem(context);
            setSimilarProblem(question);
            setShowSimilarModal(true);
        } catch (e: any) {
            console.error(e);
            setErrorMsg("Failed to generate similar problem.");
        } finally {
            setLoadingSimilar(false);
        }
    }, COSTS.SIMILAR_PROBLEM);
}

// Handler for Similar Problem Modal - Solution Generation
const handleGenerateSimilarSolution = async () => {
    if (!similarProblem) return;
    setLoadingDrillSolution(true);
    try {
        const steps = await generateDrillSolution(similarProblem);
        setSimilarProblem({ ...similarProblem, steps });
    } catch (e) {
        console.error("Failed to solve similar problem", e);
    } finally {
        setLoadingDrillSolution(false);
    }
}

const handleExamConfigSubmit = async (settings: ExamSettings) => {
    await checkKeyAndProceed(async () => {
        setShowConfig(false);
        setAppState(AppState.ANALYZING);
        setLoadingProgress(0);
        setStartBackgroundEffects(false);
        setShowActionButtons(false);

        try {
            const exam = await generateExam(uploads, settings);
            setLoadingProgress(100);
            setTimeout(() => {
                setGeneratedExam(exam);
                setAppState(AppState.SOLVED);
            }, 500);
        } catch (error: any) {
            console.error(error);
            setErrorMsg(error.message || "Failed to generate exam paper.");
            setAppState(AppState.ERROR);
        }
    }, COSTS.EXAM_GENERATION);
}

// Updated to use the new batch function that uses Promise.allSettled
const handleDrillConfigSubmit = async (settings: DrillSettings) => {
    await checkKeyAndProceed(async () => {
        setShowConfig(false);
        setDrillSettings(settings);
        setAppState(AppState.ANALYZING);
        setLoadingProgress(0);
        setStartBackgroundEffects(false);
        setShowActionButtons(false);

        setDrillQuestions([]);
        setCurrentDrillIndex(0);
        setLoadingDrill(true);

        const startDiff = getBaseDifficulty(settings.difficulty);

        try {
            // Use improved batch function
            const initialBatch = await generateDrillBatch(1, startDiff, 3, settings, uploads);
            setLoadingProgress(100);
            
            setTimeout(() => {
                setDrillQuestions(initialBatch);
                setAppState(AppState.SOLVED);
                setLoadingDrill(false);
            }, 500);
        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message || "Failed to start drill session.");
            setAppState(AppState.ERROR);
        } 
    }, COSTS.DRILL_SESSION);
}

const handleConceptConfigSubmit = async (settings: ConceptSettings) => {
    await checkKeyAndProceed(async () => {
        setShowConfig(false);
        setAppState(AppState.ANALYZING);
        setLoadingProgress(0);
        setStartBackgroundEffects(false);
        setShowActionButtons(false);

        try {
            const explanation = await generateConceptExplanation(uploads, settings);
            setLoadingProgress(100);
            setTimeout(() => {
                setConceptExplanation(explanation);
                setAppState(AppState.SOLVED);
            }, 500);
        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message || "Failed to generate explanation.");
            setAppState(AppState.ERROR);
        }
    }, COSTS.CONCEPT_EXPLANATION);
};

const handleReloadConceptExamples = async () => {
    if (!conceptExplanation) return;
    await checkKeyAndProceed(async () => {
        try {
            const newExamples = await reloadConceptExamples(conceptExplanation);
            setConceptExplanation(prev => prev ? { ...prev, examples: newExamples } : null);
        } catch (e) {
            console.error(e);
        }
    }, COSTS.CONCEPT_RELOAD);
};

const handleNextDrillQuestion = async () => {
    if (!drillSettings) return;
    const nextIndex = currentDrillIndex + 1;
    if (drillQuestions.length > 0 && currentDrillIndex >= drillQuestions.length - 2 && !loadingDrill) {
         const lastQ = drillQuestions[drillQuestions.length - 1];
         setLoadingDrill(true);
         // Use improved batch function in background
         generateDrillBatch(lastQ.number + 1, lastQ.difficultyLevel, 3, drillSettings, uploads)
           .then(newQs => {
               setDrillQuestions(prev => [...prev, ...newQs]);
               setLoadingDrill(false);
           })
           .catch(e => {
               console.error("Background fetch failed", e);
               setLoadingDrill(false);
           });
    }

    if (nextIndex < drillQuestions.length) {
        setCurrentDrillIndex(nextIndex);
    } else {
        if (!loadingDrill) {
            setLoadingDrill(true);
            const lastQ = drillQuestions[drillQuestions.length - 1];
            generateDrillBatch(lastQ.number + 1, lastQ.difficultyLevel, 3, drillSettings, uploads)
               .then(newQs => {
                   setDrillQuestions(prev => [...prev, ...newQs]);
                   setLoadingDrill(false);
                   setCurrentDrillIndex(prev => prev + 1);
               });
        }
    }
}

const handleGenerateDrillSolution = async () => {
    const currentQ = drillQuestions[currentDrillIndex];
    if (!currentQ) return;
    if (currentQ.steps && currentQ.steps.length > 0) return; 

    setLoadingDrillSolution(true);
    try {
        const steps = await generateDrillSolution(currentQ);
        setDrillQuestions(prev => {
            const updated = [...prev];
            updated[currentDrillIndex] = { ...currentQ, steps };
            return updated;
        });
    } catch (e) {
        console.error("Failed to generate solution steps", e);
    } finally {
        setLoadingDrillSolution(false);
    }
};

const [waitingForNext, setWaitingForNext] = useState(false);

useEffect(() => {
    if (waitingForNext && drillQuestions.length > currentDrillIndex + 1) {
        setWaitingForNext(false);
        setCurrentDrillIndex(prev => prev + 1);
    }
}, [drillQuestions.length, waitingForNext, currentDrillIndex]);

const handleNextWithWait = () => {
    if (currentDrillIndex + 1 < drillQuestions.length) {
        handleNextDrillQuestion();
    } else {
        setWaitingForNext(true);
        handleNextDrillQuestion();
    }
};


const handlePrevDrillQuestion = () => {
    if (currentDrillIndex > 0) {
        setCurrentDrillIndex(currentDrillIndex - 1);
        setWaitingForNext(false);
    }
}

const handleMainAction = () => {
    if (uploads.length === 0 && appMode === 'SOLVER') return;
    
    if (appMode === 'SOLVER') {
        startSolverFlow();
    } else {
        setShowConfig(true);
    }
};

const handleViewChange = async (view: 'steps' | 'markscheme') => {
    setActiveView(view);
    if (view === 'markscheme' && activeSolution && !activeSolution.markscheme) {
        setLoadingMarkscheme(true);
        try {
            const markscheme = await getMarkscheme(activeSolution.exerciseStatement, JSON.stringify(activeSolution.steps));
            setSolutions(prev => {
                const next = [...prev];
                if (next[activeTab]) next[activeTab]!.markscheme = markscheme;
                return next;
            });
        } catch (e) { console.error(e); } finally { setLoadingMarkscheme(false); }
    }
}

const handleDownloadMarkscheme = () => {
    if (!activeSolution?.markscheme) return;
    const element = document.getElementById('ib-markscheme-container');
    if (!element || !(window as any).html2pdf) return;
    const opt = {
        margin: 0.3,
        filename: `Bubble_Markscheme_Solution_${activeTab + 1}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f0f0f' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    (window as any).html2pdf().set(opt).from(element).save();
};

const toggleSection = (title: string) => {
  setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
  });
};

const handleOpenChatWithPrompt = (prompt: string) => {
    setChatPrompt(prompt);
    setIsChatOpen(true);
};

  // Determine Current Cost
  let currentActionCost = 0;
  if (appMode === 'SOLVER') {
      currentActionCost = uploads.length * COSTS.SOLVER_PER_IMAGE;
  } else if (appMode === 'EXAM') {
      currentActionCost = COSTS.EXAM_GENERATION;
  } else if (appMode === 'DRILL') {
      currentActionCost = COSTS.DRILL_SESSION;
  } else if (appMode === 'CONCEPT') {
      currentActionCost = COSTS.CONCEPT_EXPLANATION;
  }

  if (authLoading) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-white">
              <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
      );
  }

  if (!user) {
      return <AuthScreens />;
  }

  const totalMarks = activeSolution?.markscheme ? calculateTotalMarks(activeSolution.markscheme) : 0;
  const isNextButtonLoading = waitingForNext || (loadingDrill && currentDrillIndex === drillQuestions.length - 1 && waitingForNext);
  
  return (
    <div className="min-h-screen text-gray-100 bg-black selection:bg-blue-900/50 font-sans overflow-x-hidden text-sm flex flex-col">
      
      {!user.hasOnboarded && <OnboardingModal onComplete={finishOnboarding} />}
      
      <ApiKeyModal 
        isOpen={showApiKeyModal} 
        onClose={() => { if(!forceApiKeyModal) setShowApiKeyModal(false); }} 
        forced={forceApiKeyModal} 
        initialTab={'SETTINGS'}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        user={user}
      />

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        user={user}
      />

      {isAdmin && (
          <AdminFeedbackModal 
            isOpen={showAdminModal}
            onClose={() => setShowAdminModal(false)}
            adminUser={user}
          />
      )}

      {/* Info Modal for SEO pages */}
      <InfoModal 
        isOpen={!!infoPage} 
        page={infoPage} 
        onClose={() => setInfoPage(null)} 
      />

      {/* Similar Problem Modal */}
      {showSimilarModal && similarProblem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
              <div className="w-full max-w-3xl bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500" />
                  
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5 pt-6">
                      <div className="flex items-center gap-3">
                          <Sparkles size={20} className="text-yellow-400" />
                          <div>
                              <h2 className="text-lg font-bold text-white tracking-tight">Practice Problem</h2>
                              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Reinforcement Drill</p>
                          </div>
                      </div>
                      <button onClick={() => setShowSimilarModal(false)} className="text-gray-500 hover:text-white transition-colors">
                          <X size={18} />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-0">
                      <DrillSessionViewer 
                          question={similarProblem} 
                          isLoading={false}
                          onNext={() => setShowSimilarModal(false)} // Treat next as close/finish
                          onGenerateSolution={handleGenerateSimilarSolution}
                          isGeneratingSolution={loadingDrillSolution}
                      />
                  </div>
              </div>
          </div>
      )}

      {/* Limit Warning Toast */}
      {limitWarning && (
          <div className="fixed top-20 right-6 z-[60] animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="bg-[#1a1a1a] border border-red-500/30 rounded-xl p-4 shadow-2xl flex items-start gap-3 max-w-sm backdrop-blur-xl">
                  <div className="bg-red-500/10 p-2 rounded-lg text-red-400">
                      <AlertCircle size={20} />
                  </div>
                  <div className="flex-1">
                      <h4 className="text-white font-bold text-sm mb-1">Usage Limit Reached</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">{limitWarning}</p>
                  </div>
                  <button onClick={() => setLimitWarning(null)} className="text-gray-500 hover:text-white transition-colors">
                      <X size={16} />
                  </button>
              </div>
          </div>
      )}

      <nav className={`sticky top-0 z-40 border-b border-white/5 transition-all duration-300 ${
          appMode === 'EXAM' 
            ? 'bg-black/70 backdrop-blur-md' 
            : 'bg-black/95 backdrop-blur-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
             <div className="group flex items-center gap-2 focus:outline-none pointer-events-none select-none">
                <span className="font-sans font-bold text-xl sm:text-2xl tracking-tighter text-white">
                    Bubble.ib
                </span>
             </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
              
              <div 
                  className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg border transition-colors cursor-default ${
                    hasValidKey 
                        ? (useCredits() ? 'bg-yellow-900/10 border-yellow-500/20' : 'bg-green-900/10 border-green-500/20')
                        : 'bg-red-900/10 border-red-500/20'
                  }`}
              >
                  {hasValidKey ? (
                      useCredits() ? (
                          <>
                            <Coins size={14} className="text-yellow-400" />
                            <span className="text-xs font-bold font-mono text-yellow-400">
                                {credits} <span className="hidden sm:inline">Credits</span>
                            </span>
                          </>
                      ) : (
                          <>
                            <Key size={14} className="text-green-400" />
                            <span className="text-xs font-bold font-mono text-green-400">
                                <span className="sm:hidden">Key</span>
                                <span className="hidden sm:inline">Custom Key Active</span>
                            </span>
                          </>
                      )
                  ) : (
                      <>
                        <AlertCircle size={14} className="text-red-400" />
                        <span className="text-xs font-bold font-mono text-red-400">
                            <span className="sm:hidden">Req</span>
                            <span className="hidden sm:inline">Key Required</span>
                        </span>
                      </>
                  )}
              </div>

              {appState === AppState.IDLE && (
                    <div className="flex sm:flex bg-[#121212] p-1 rounded-lg border border-white/10 gap-1 sm:gap-0">
                        <button
                        onClick={() => setAppMode('SOLVER')}
                        className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            appMode === 'SOLVER' 
                            ? 'bg-[#1e293b] text-blue-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Solver"
                        >
                        <Pen size={14} /> <span className="hidden sm:inline">Solver</span>
                        </button>
                        <button
                        onClick={() => setAppMode('EXAM')}
                        className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            appMode === 'EXAM' 
                            ? 'bg-[#1e293b] text-purple-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Exam Creator"
                        >
                        <GraduationCap size={14} /> <span className="hidden sm:inline">Exam</span>
                        </button>
                        <button
                        onClick={() => setAppMode('DRILL')}
                        className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            appMode === 'DRILL' 
                            ? 'bg-[#1e293b] text-yellow-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Drill"
                        >
                        <Zap size={14} /> <span className="hidden sm:inline">Drill</span>
                        </button>
                        <button
                        onClick={() => setAppMode('CONCEPT')}
                        className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            appMode === 'CONCEPT' 
                            ? 'bg-[#1e293b] text-green-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Concept"
                        >
                        <Lightbulb size={14} /> <span className="hidden sm:inline">Concept</span>
                        </button>
                    </div>
                )}
                
                {appState !== AppState.IDLE && (
                    <button 
                        onClick={handleReset} 
                        className="text-xs font-bold text-gray-500 hover:text-white px-2 sm:px-3 py-1.5 border border-white/10 rounded-md hover:bg-white/5 transition-colors whitespace-nowrap"
                    >
                        <span className="hidden sm:inline">Back to Home</span>
                        <span className="sm:hidden">Back</span>
                    </button>
                )}

                <div className="relative">
                    <button 
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-8 h-8 flex items-center justify-center rounded-full overflow-hidden text-sm font-bold text-white hover:opacity-80 transition-opacity bg-white/5 border border-white/10 outline-none"
                    >
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            user.name.charAt(0).toUpperCase()
                        )}
                    </button>
                    
                    {showUserMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-[#181818] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-white/5">
                                    <div className="text-sm font-bold text-white">{user.name}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                                </div>
                                <div className="p-1">
                                    {isAdmin && (
                                        <button 
                                            onClick={() => { setShowAdminModal(true); setShowUserMenu(false); }}
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-900/10 hover:text-yellow-300 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-yellow-500/20 mb-1"
                                        >
                                            <LayoutDashboard size={14} /> Admin Panel
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => { setShowApiKeyModal(true); setShowUserMenu(false); setForceApiKeyModal(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Key size={14} /> API Settings
                                    </button>
                                    
                                    <button 
                                        onClick={() => { setShowHelpModal(true); setShowUserMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <HelpCircle size={14} /> Help Center
                                    </button>

                                    <button 
                                        onClick={() => { setShowFeedbackModal(true); setShowUserMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <MessageSquare size={14} /> Send Feedback
                                    </button>
                                    <button 
                                        onClick={logout}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-900/10 hover:text-red-300 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <LogOut size={14} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
          </div>
          
        </div>
      </nav>

      <div className="relative z-10 flex-1">
        <main className="mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-6xl">
            {isLightboxOpen && activeInput?.type === 'image' && (
                <Lightbox src={activeInput.preview!} onClose={() => setIsLightboxOpen(false)} />
            )}

            {appState === AppState.SOLVED && (appMode === 'SOLVER' || appMode === 'DRILL' || appMode === 'CONCEPT') && (
                <MagneticPencil isOpen={isChatOpen} onClick={() => setIsChatOpen(!isChatOpen)} mode={appMode} />
            )}
            
            {/* Error State - Enhanced */}
            {appState === AppState.ERROR && (
                <div className="mb-8 max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="p-6 bg-[#1a0505] border border-red-500/30 rounded-xl text-red-400 flex flex-col gap-4 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                        <div className="flex items-center gap-3 border-b border-red-500/20 pb-3">
                            <AlertCircle size={24} className="text-red-500" />
                            <span className="font-bold text-lg text-red-100">Operation Failed</span> 
                        </div>
                        
                        <div className="space-y-2">
                            <p className="text-sm text-gray-400">The system encountered an error while processing your request:</p>
                            <div className="bg-black/40 p-4 rounded-lg font-mono text-xs text-red-300 border border-red-900/50 break-words leading-relaxed">
                                {errorMsg || "Unknown error occurred. Please check your network connection or API key."}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                             <button onClick={handleReset} className="font-bold text-xs bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg transition-all shadow-lg hover:shadow-red-900/20 active:scale-95 flex items-center gap-2">
                                <RefreshCw size={14} /> Try Again
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Idle State - Landing & Config */}
            {appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
                <FallingBackgroundIcons active={startBackgroundEffects} />
                
                {showConfig ? (
                    appMode === 'EXAM' 
                        ? <ExamConfigPanel onStart={handleExamConfigSubmit} onCancel={() => setShowConfig(false)} />
                        : appMode === 'DRILL'
                        ? <DrillConfigPanel onStart={handleDrillConfigSubmit} onCancel={() => setShowConfig(false)} />
                        : <ConceptConfigPanel onStart={handleConceptConfigSubmit} onCancel={() => setShowConfig(false)} initialTopic={uploads[0]?.content || ''} />
                ) : (
                    <div className="space-y-10 w-full flex flex-col items-center z-10 relative">
                        <div className="text-center space-y-4 max-w-2xl px-4">
                            {appMode === 'SOLVER' && (
                                <>
                                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                                        Math explained. <span className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">Simply.</span>
                                    </h1>
                                    <p className="text-base sm:text-lg text-gray-500 font-normal max-w-md mx-auto">
                                        Upload any math problem. Get step-by-step solutions.
                                    </p>
                                </>
                            )}
                            {appMode === 'EXAM' && (
                                <>
                                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                                        Create perfect <span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">Exams.</span>
                                    </h1>
                                    <p className="text-base sm:text-lg text-gray-500 font-normal max-w-md mx-auto">
                                        Upload notes or problems. Get a deployable IB paper.
                                    </p>
                                </>
                            )}
                            {appMode === 'DRILL' && (
                                <>
                                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                                        Adaptive <span className="text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">Practice.</span>
                                    </h1>
                                    <p className="text-base sm:text-lg text-gray-500 font-normal max-w-md mx-auto">
                                        Quick-fire drills that learn as you go.
                                    </p>
                                </>
                            )}
                            {appMode === 'CONCEPT' && (
                                <>
                                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                                        Deep <span className="text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">Understanding.</span>
                                    </h1>
                                    <p className="text-base sm:text-lg text-gray-500 font-normal max-w-md mx-auto">
                                        Visualize and master complex IB concepts.
                                    </p>
                                </>
                            )}
                        </div>
                        
                        <div className="w-full flex flex-col items-center space-y-8">
                            <UploadZone 
                                uploads={uploads}
                                onUpload={handleInputAdd}
                                onRemove={handleInputRemove}
                                onFirstInteraction={() => {
                                    setTimeout(() => setStartBackgroundEffects(true), 2500);
                                    setTimeout(() => setShowActionButtons(true), 3200);
                                }}
                                appMode={appMode}
                            />
                            
                            <div className={`transition-all duration-1000 ease-out ${showActionButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                <button 
                                    onClick={handleMainAction}
                                    disabled={appMode === 'SOLVER' && uploads.length === 0}
                                    className={`group flex items-center gap-2 border text-sm font-semibold px-8 py-3 rounded-full transition-all duration-300 hover:shadow-md active:scale-95 ${
                                        appMode === 'SOLVER' 
                                            ? 'bg-[#1c1c1e] hover:bg-[#252525] border-blue-500/30 text-blue-100' 
                                        : appMode === 'EXAM'
                                            ? 'bg-[#1c1c1e] hover:bg-[#252525] border-purple-500/30 text-purple-100'
                                        : appMode === 'DRILL'
                                            ? 'bg-[#1c1c1e] hover:bg-[#252525] border-yellow-500/30 text-yellow-400'
                                        : 'bg-[#1c1c1e] hover:bg-[#252525] border-green-500/30 text-green-400'
                                    } ${appMode === 'SOLVER' && uploads.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {appMode === 'SOLVER' 
                                        ? `Analyze ${uploads.length} Problem${uploads.length > 1 ? 's' : ''}` 
                                        : appMode === 'EXAM' ? 'Configure Exam Paper' 
                                        : appMode === 'DRILL' ? 'Configure Drill'
                                        : 'Explain Concept'
                                    }
                                    
                                    <ArrowRight size={16} className={`group-hover:translate-x-0.5 transition-transform ${
                                        appMode === 'SOLVER' ? 'text-blue-400' 
                                        : appMode === 'EXAM' ? 'text-purple-400' 
                                        : appMode === 'DRILL' ? 'text-yellow-400'
                                        : 'text-green-400'
                                    }`} />
                                </button>
                                
                                <div className="mt-3 text-center text-[10px] text-gray-600 font-mono flex items-center justify-center gap-3">
                                    {hasValidKey ? (
                                        useCredits() ? (
                                            <>
                                                <span className="text-gray-500">Cost: <b className="text-white">{currentActionCost} Credits</b></span>
                                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                                <span className="text-gray-500">Balance: <b className={credits < currentActionCost ? 'text-red-400' : 'text-yellow-400'}>{credits}</b></span>
                                            </>
                                        ) : (
                                            <span className="text-green-400 font-bold">Ready (Custom Key Active)</span>
                                        )
                                    ) : (
                                        <span className="text-red-400">Key Required</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* ... Rest of appState rendering ... */}
            {/* Analyzing State */}
            {appState === AppState.ANALYZING && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-700">
                <div className="relative flex flex-col items-center gap-8">
                    <div className="relative group">
                        {/* Removed the large pulsing background circle to clean up visuals */}
                        <div className="relative z-10 animate-bounce duration-[2000ms]">
                             <div className="animate-[spin_3s_ease-in-out_infinite]">
                                {appMode === 'SOLVER' ? (
                                    <Pen size={32} className="text-blue-400 transform -rotate-45" />
                                ) : appMode === 'EXAM' ? (
                                    <GraduationCap size={32} className="text-purple-400" />
                                ) : appMode === 'DRILL' ? (
                                    <Zap size={32} className="text-yellow-400" />
                                ) : (
                                    <Lightbulb size={32} className="text-green-400" />
                                )}
                             </div>
                        </div>
                    </div>
                </div>
                
                <div className="min-h-[24px]">
                    <TypewriterLoader phrases={appMode === 'SOLVER' ? [
                        "Analyzing problem structure...", "Extracting mathematical context...", "Generating step-by-step solution..."
                    ] : appMode === 'EXAM' ? [
                         "Drafting initial questions...", "Calculating mark allocations...", "Auditing math logic..."
                    ] : appMode === 'DRILL' ? [
                         "Calibrating initial difficulty...", "Analyzing topic requirements...", "Generating practice scenario..."
                    ] : [
                         "Connecting concepts...", "Deriving key formulas...", "Drafting mathematical proofs...", "Generating IB examples..."
                    ]} />
                </div>

                <div className="w-full max-w-xs space-y-3 relative mb-6">
                    <div className="h-1.5 w-full bg-[#111] rounded-full overflow-visible border border-white/5 relative">
                        <div 
                            className={`h-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out relative rounded-full ${
                                appMode === 'SOLVER' 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-400' 
                                : appMode === 'EXAM'
                                    ? 'bg-gradient-to-r from-purple-600 to-purple-400'
                                : appMode === 'DRILL'
                                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                                    : 'bg-gradient-to-r from-green-600 to-green-400'
                            }`}
                            style={{ width: `${loadingProgress}%` }}
                        >
                            <span className="absolute right-0 top-full mt-2 text-[10px] font-mono font-bold text-gray-500 transform translate-x-1/2 transition-all">
                                {Math.round(loadingProgress)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Solved State */}
            {appState === AppState.SOLVED && (
                appMode === 'SOLVER' && activeSolution ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 pb-32 animate-in fade-in duration-500">
                         {/* ... Solver Logic ... */}
                         {/* Left Panel */}
                         <div className="lg:col-span-4 space-y-6">
                            <div className="sticky top-24 space-y-6">
                                {activeInput?.type === 'image' ? (
                                    <div 
                                        className="group relative h-40 w-full rounded-lg overflow-hidden bg-black border border-white/10 cursor-pointer hover:border-white/30 transition-colors flex items-center justify-center"
                                        onClick={() => setIsLightboxOpen(true)}
                                    >
                                        <div className="absolute top-2 left-2 bg-black/80 text-[10px] font-bold text-white px-2 py-0.5 rounded border border-white/10 z-10 flex items-center gap-1.5 backdrop-blur-sm">
                                            SOURCE <Maximize2 size={10} className="text-gray-400" />
                                        </div>
                                        <img src={activeInput.preview} alt="Source" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                ) : (
                                    <div className="h-40 w-full rounded-lg overflow-hidden bg-[#0a0a0a] border border-white/10 p-4 relative">
                                        <div className="absolute top-2 left-2 bg-black/80 text-[10px] font-bold text-green-400 px-2 py-0.5 rounded border border-white/10 z-10 flex items-center gap-1.5">SOURCE <FileText size={10} /></div>
                                        <div className="mt-6 text-xs text-gray-400 font-mono leading-relaxed line-clamp-6">{activeInput?.content}</div>
                                    </div>
                                )}

                                <div className="bg-[#0a0a0a] rounded-xl p-5 border border-white/10">
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Summary</h3>
                                            <div className="text-gray-300 leading-relaxed text-sm"><MarkdownRenderer content={activeSolution.problemSummary} /></div>
                                        </div>
                                        <div className="pt-6 border-t border-white/5">
                                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Final Answer</h3>
                                            <div className="bg-black p-4 rounded-lg border border-white/10">
                                                <div className="text-white font-medium text-base leading-relaxed"><MarkdownRenderer content={activeSolution.finalAnswer} /></div>
                                            </div>
                                        </div>
                                        
                                        {/* New Generate Similar Button */}
                                        <div className="pt-6 border-t border-white/5">
                                            <button 
                                                onClick={handleGenerateSimilarProblem}
                                                disabled={loadingSimilar}
                                                className="w-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                                            >
                                                {loadingSimilar ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                                Generate Similar Practice Question
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         </div>
                         
                         {/* Right Panel */}
                         <div className="lg:col-span-8 space-y-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-1 gap-4 sm:gap-0">
                                <div className="flex items-center gap-6">
                                    <h2 className="text-2xl font-bold text-white">{solutions.length > 1 ? `Solution ${activeTab + 1}` : 'Solution'}</h2>
                                    <div className="flex bg-[#121212] p-1 rounded-lg border border-white/10">
                                        <button onClick={() => handleViewChange('steps')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${activeView === 'steps' ? 'bg-[#1e293b] text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                                            <Layers size={12} /> 
                                            <span className="hidden sm:inline">Detailed Steps</span>
                                            <span className="sm:hidden">Steps</span>
                                        </button>
                                        <button onClick={() => handleViewChange('markscheme')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${activeView === 'markscheme' ? 'bg-[#1e293b] text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                                            <ScrollText size={12} /> 
                                            <span className="hidden sm:inline">Markscheme</span>
                                            <span className="sm:hidden">Marks</span>
                                        </button>
                                    </div>
                                </div>
                                {activeView === 'steps' && <span className="text-xs font-bold text-gray-500 hidden sm:inline-block">{activeSolution.steps.length} STEPS</span>}
                                {activeView === 'markscheme' && activeSolution.markscheme && (
                                    <button onClick={handleDownloadMarkscheme} className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors ml-auto sm:ml-0">
                                        <Download size={14} /> 
                                        <span className="hidden sm:inline">Download PDF</span>
                                    </button>
                                )}
                            </div>

                            <div className="bg-[#111] rounded-xl p-6 border border-blue-500/20 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                <div className="flex items-center gap-3 mb-3"><span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-1 rounded border border-blue-500/20 uppercase tracking-widest">Exercise</span></div>
                                <div className="text-gray-200 text-lg leading-relaxed font-medium"><MarkdownRenderer content={activeSolution.exerciseStatement} /></div>
                                {/* Visuals Integration */}
                                {activeSolution.graphFunctions && activeSolution.graphFunctions.length > 0 && (
                                    <div className="mt-6">
                                        <InteractiveGraph functions={activeSolution.graphFunctions} mode="SOLVER" />
                                    </div>
                                )}
                                {activeSolution.geometrySvg && (
                                    <div className="mt-6 flex justify-center">
                                        <div className="p-4 bg-black/40 border border-white/10 rounded-lg max-w-[400px] w-full flex items-center justify-center">
                                            <div dangerouslySetInnerHTML={{ __html: activeSolution.geometrySvg }} className="w-full" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {activeView === 'steps' ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {stepGroups.length === 1 ? (
                                        stepGroups[0].steps.map(({ data, index }) => (
                                            <StepCard key={`${activeTab}-${index}`} step={data} index={index} isActive={currentStepIndex === index} problemContext={activeSolution.problemSummary} onClick={() => setCurrentStepIndex(index)} onNext={() => setCurrentStepIndex(index + 1)} onPrev={() => setCurrentStepIndex(index - 1)} isFirst={index === 0} isLast={index === activeSolution.steps.length - 1} />
                                        ))
                                    ) : (
                                        stepGroups.map((group, gIdx) => (
                                            <SectionContainer key={gIdx} title={group.title} isOpen={openSections.has(group.title)} onToggle={() => toggleSection(group.title)}>
                                                {group.steps.map(({ data, index }) => (
                                                    <StepCard key={`${activeTab}-${index}`} step={data} index={index} isActive={currentStepIndex === index} problemContext={activeSolution.problemSummary} onClick={() => setCurrentStepIndex(index)} onNext={() => setCurrentStepIndex(index + 1)} onPrev={() => setCurrentStepIndex(index - 1)} isFirst={index === 0} isLast={index === activeSolution.steps.length - 1} />
                                                ))}
                                            </SectionContainer>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="animate-in fade-in duration-300">
                                    {loadingMarkscheme ? (
                                        <MarkschemeLoader />
                                    ) : activeSolution.markscheme ? (
                                        <div id="ib-markscheme-container">
                                            <SectionContainer 
                                                title="Detailed Markscheme" 
                                                isOpen={isMarkschemeOpen} 
                                                onToggle={() => setIsMarkschemeOpen(!isMarkschemeOpen)}
                                                icon={<ScrollText size={12} className="text-blue-500" />}
                                                rightContent={
                                                    totalMarks > 0 && (
                                                       <span className="ml-4 text-xs text-blue-200 font-bold px-3 py-1 rounded bg-blue-500/10 border border-blue-500/30 shadow-[0_0_5px_rgba(59,130,246,0.1)]">
                                                          {totalMarks} Marks
                                                       </span>
                                                    )
                                                }
                                            >
                                                <div className="text-gray-300 text-sm">
                                                    <MarkdownRenderer content={activeSolution.markscheme} />
                                                </div>
                                            </SectionContainer>
                                        </div>
                                    ) : (
                                        <div className="h-40 flex items-center justify-center border border-dashed border-white/10 rounded-xl"><p className="text-gray-500 text-xs">Could not load markscheme.</p></div>
                                    )}
                                </div>
                            )}
                         </div>
                    </div>
                ) : appMode === 'EXAM' && generatedExam ? (
                    <ExamViewer exam={generatedExam} />
                ) : appMode === 'DRILL' ? (
                    <DrillSessionViewer 
                        question={drillQuestions[currentDrillIndex] || null} 
                        isLoading={loadingDrill} 
                        isNextLoading={isNextButtonLoading}
                        onNext={handleNextWithWait}
                        onPrev={handlePrevDrillQuestion}
                        hasPrev={currentDrillIndex > 0}
                        onGenerateSolution={handleGenerateDrillSolution}
                        isGeneratingSolution={loadingDrillSolution}
                    />
                ) : appMode === 'CONCEPT' && conceptExplanation ? (
                    <ConceptViewer 
                        concept={conceptExplanation} 
                        onChatAction={handleOpenChatWithPrompt} 
                        onReloadExamples={handleReloadConceptExamples}
                    />
                ) : null
            )}
        </main>
      </div>

      {appState === AppState.IDLE && (
          <Footer onLinkClick={setInfoPage} />
      )}

      {appState === AppState.SOLVED && (
          <ChatInterface 
             key={appMode === 'DRILL' ? currentDrillIndex : activeTab} 
             solution={appMode === 'SOLVER' ? activeSolution || undefined : undefined} 
             drillQuestion={appMode === 'DRILL' ? drillQuestions[currentDrillIndex] : undefined}
             concept={appMode === 'CONCEPT' ? conceptExplanation || undefined : undefined}
             currentStepIndex={currentStepIndex} 
             isOpen={isChatOpen} 
             onClose={() => setIsChatOpen(false)} 
             activeView={activeView} 
             mode={appMode}
             userName={user.name}
             initialPrompt={chatPrompt}
          />
      )}
      
    </div>
  );
};

export default App;

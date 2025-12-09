

import React, { useState, useEffect, useRef } from 'react';
import { AppState, MathSolution, MathStep, UserInput, AppMode, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty } from './types';
import { analyzeMathInput, getMarkscheme, generateExam, generateDrillQuestion, getSystemDiagnostics, generateDrillSolution } from './services/geminiService';
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
import { Pen, X, ArrowRight, Maximize2, Loader2, BookOpen, ChevronDown, FileText, Download, ScrollText, Layers, Sigma, Divide, Minus, Lightbulb, Percent, Hash, GraduationCap, Calculator, Zap, LogOut, User as UserIcon, Check, AlertCircle } from 'lucide-react';

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

  const colorClass = mode === 'DRILL' 
    ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
    : 'text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]';

  const Icon = mode === 'DRILL' ? Zap : Pen;

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
             
             <div className="relative z-10 flex flex-col items-center gap-6">
                 <div className="relative">
                    <ScrollText size={40} className="text-blue-500/80 animate-pulse" />
                 </div>
                 <div className="mt-2">
                    <TypewriterLoader phrases={phrases} />
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
  const { user, loading: authLoading, logout } = useAuth();
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [appMode, setAppMode] = useState<AppMode>('SOLVER');
  
  const [uploads, setUploads] = useState<UserInput[]>([]);
  const [solutions, setSolutions] = useState<(MathSolution | null)[]>([]); 
  const [generatedExam, setGeneratedExam] = useState<ExamPaper | null>(null);

  const [drillSettings, setDrillSettings] = useState<DrillSettings | null>(null);
  const [drillQuestions, setDrillQuestions] = useState<DrillQuestion[]>([]);
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [loadingDrillSolution, setLoadingDrillSolution] = useState(false); // State for solution gen

  const [activeTab, setActiveTab] = useState<number>(0);
  const [activeView, setActiveView] = useState<'steps' | 'markscheme'>('steps');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [analyzingIndex, setAnalyzingIndex] = useState<number>(-1);
  const [loadingMarkscheme, setLoadingMarkscheme] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [startBackgroundEffects, setStartBackgroundEffects] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [isMarkschemeOpen, setIsMarkschemeOpen] = useState(true);

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setSolutions([]);
    setGeneratedExam(null);
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
  };

  useEffect(() => {
      if (!user) {
          handleReset();
      }
  }, [user]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appState !== AppState.SOLVED || isChatOpen || activeView !== 'steps') return;
      
      if (appMode === 'SOLVER' && activeSolution) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
        if (e.key === 'ArrowRight') setCurrentStepIndex(prev => Math.min(prev + 1, activeSolution.steps.length - 1));
        else if (e.key === 'ArrowLeft') setCurrentStepIndex(prev => Math.max(prev - 1, 0));
      } 
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, activeSolution, isChatOpen, activeView, appMode]);

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

  const normalizeMarkscheme = (text: string) => {
    if (!text || text === 'null') return "";
    let clean = text.replace(/\*\*/g, ''); 
    clean = clean.replace(/\$\$/g, '$');
    clean = clean.replace(/\\n/g, '\n').replace(/\n\s*\n/g, '\n');
    clean = clean.replace(/<br\s*\/?>/gi, ' ');

    const lines = clean.split('\n');
    const mergedLines: string[] = [];
    
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (trimmed.startsWith('|')) {
            const fixedLine = trimmed.replace(/\|\|/g, '| |');
            mergedLines.push(fixedLine);
        } else {
            if (mergedLines.length > 0) {
                mergedLines[mergedLines.length - 1] += ' ' + trimmed;
            } else {
                 mergedLines.push(trimmed);
            }
        }
    });

    return '\n\n' + mergedLines.join('\n');
  };

  const solverPhrases = [
    "Analyzing problem structure...",
    "Extracting mathematical context...",
    "Generating step-by-step solution...",
    "Double-checking calculations...",
    "Formatting LaTeX expressions..."
  ];

  const examPhrases = [
      "Drafting initial questions...",
      "Calculating mark allocations...",
      "Auditing math logic...",
      "Verifying LaTeX syntax...",
      "Standardizing markschemes..."
  ];

  const drillPhrases = [
      "Calibrating initial difficulty...",
      "Analyzing topic requirements...",
      "Generating practice scenario...",
      "Validating answer logic...",
      "Preparing rapid-fire session..."
  ];

  const currentLoadingPhrases = appMode === 'SOLVER' ? solverPhrases : (appMode === 'EXAM' ? examPhrases : drillPhrases);

  const handleInputAdd = (input: UserInput) => {
    setUploads(prev => [...prev, input]);
    setErrorMsg(null);
  };

  const handleInputRemove = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const startSolverFlow = async () => {
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
        setErrorMsg(err.message || "Analysis failed. Please try again.");
        setAppState(AppState.ERROR);
      } finally {
        setAnalyzingIndex(-1);
      }
  }

  const handleExamConfigSubmit = async (settings: ExamSettings) => {
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
  }

  const generateDrillBatch = async (startNum: number, prevDiff: number, count: number, settings: DrillSettings): Promise<DrillQuestion[]> => {
      const promises = [];
      let currentDiff = prevDiff;
      for (let i = 0; i < count; i++) {
          promises.push(generateDrillQuestion(settings, uploads, startNum + i, currentDiff));
          currentDiff = Math.min(10, currentDiff + 0.5); 
      }
      return Promise.all(promises);
  }

  const handleDrillConfigSubmit = async (settings: DrillSettings) => {
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
          const initialBatch = await generateDrillBatch(1, startDiff, 3, settings);
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
  }

  const handleNextDrillQuestion = async () => {
      if (!drillSettings) return;
      
      const nextIndex = currentDrillIndex + 1;
      
      if (drillQuestions.length > 0 && currentDrillIndex >= drillQuestions.length - 2 && !loadingDrill) {
           const lastQ = drillQuestions[drillQuestions.length - 1];
           setLoadingDrill(true);
           
           generateDrillBatch(lastQ.number + 1, lastQ.difficultyLevel, 3, drillSettings)
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
              generateDrillBatch(lastQ.number + 1, lastQ.difficultyLevel, 3, drillSettings)
                 .then(newQs => {
                     setDrillQuestions(prev => [...prev, ...newQs]);
                     setLoadingDrill(false);
                     setCurrentDrillIndex(prev => prev + 1);
                 });
          }
      }
  }

  // Handler to generate Drill Solution On Demand
  const handleGenerateDrillSolution = async () => {
      const currentQ = drillQuestions[currentDrillIndex];
      if (!currentQ) return;
      if (currentQ.steps && currentQ.steps.length > 0) return; // Already exists

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
  const diagnostics = getSystemDiagnostics();

  // Reduced GLOBAL text size to text-sm
  return (
    <div className="min-h-screen text-gray-100 bg-black selection:bg-blue-900/50 font-sans overflow-x-hidden text-sm">
      
      <nav className={`sticky top-0 z-40 border-b border-white/5 transition-all duration-300 ${
          appMode === 'EXAM' 
            ? 'bg-black/70 backdrop-blur-md' 
            : 'bg-black/95 backdrop-blur-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
             <div className="group flex items-center gap-2 focus:outline-none pointer-events-none select-none">
                <span className="font-sans font-bold text-2xl tracking-tighter text-white">
                    Bubble.
                </span>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
              {appState === AppState.IDLE && (
                    <div className="hidden sm:flex bg-[#121212] p-1 rounded-lg border border-white/10">
                        <button
                        onClick={() => setAppMode('SOLVER')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                            appMode === 'SOLVER' 
                            ? 'bg-[#1e293b] text-blue-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        >
                        <Pen size={14} /> Solver
                        </button>
                        <button
                        onClick={() => setAppMode('EXAM')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                            appMode === 'EXAM' 
                            ? 'bg-[#1e293b] text-purple-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        >
                        <GraduationCap size={14} /> Exam Creator
                        </button>
                        <button
                        onClick={() => setAppMode('DRILL')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                            appMode === 'DRILL' 
                            ? 'bg-[#1e293b] text-yellow-400 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        >
                        <Zap size={14} /> Drill
                        </button>
                    </div>
                )}
                
                {appState !== AppState.IDLE && (
                    <button 
                        onClick={handleReset} 
                        className="text-xs font-bold text-gray-500 hover:text-white px-3 py-1.5 border border-white/10 rounded-md hover:bg-white/5 transition-colors"
                    >
                        Back to Home
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
                            <div className="absolute right-0 top-full mt-2 w-48 bg-[#181818] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-white/5">
                                    <div className="text-sm font-bold text-white">{user.name}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                                </div>
                                <div className="p-1">
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

          {appState === AppState.SOLVED && appMode === 'SOLVER' && uploads.length > 1 && (
             <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-[#121212] p-1 rounded-full border border-white/10">
                {uploads.map((_, idx) => {
                    const isReady = !!solutions[idx];
                    const isSelected = activeTab === idx;
                    return (
                        <button
                            key={idx}
                            onClick={() => { if (isReady) { setActiveTab(idx); setCurrentStepIndex(0); setActiveView('steps'); }}}
                            disabled={!isReady}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                                isSelected
                                    ? 'bg-[#1e293b] text-blue-400 shadow-lg shadow-blue-900/10 border border-blue-500/20' 
                                    : 'text-gray-500 hover:text-gray-300'
                            } ${!isReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span>Prob {idx + 1}</span>
                            {!isReady && <Loader2 size={10} className="animate-spin" />}
                        </button>
                    )
                })}
             </div>
          )}
        </div>
      </nav>

      {isLightboxOpen && activeInput?.type === 'image' && (
          <Lightbox src={activeInput.preview!} onClose={() => setIsLightboxOpen(false)} />
      )}

      {appState === AppState.SOLVED && (appMode === 'SOLVER' || appMode === 'DRILL') && (
        <MagneticPencil isOpen={isChatOpen} onClick={() => setIsChatOpen(!isChatOpen)} mode={appMode} />
      )}

      <div className="relative z-10">
        <main className="mx-auto px-6 py-8 max-w-6xl">
            
            {appState === AppState.ERROR && (
                <div className="mb-8 max-w-2xl mx-auto space-y-4">
                    <div className="p-4 bg-[#1a0505] border border-red-900/50 rounded-lg text-red-400 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <AlertCircle size={20} className="text-red-500" />
                            <span className="font-bold text-lg">Analysis Failed</span> 
                        </div>
                        <p className="text-sm bg-red-950/30 p-3 rounded font-mono text-red-300 border border-red-900/30">
                            {errorMsg || "Unknown error occurred."}
                        </p>
                        <div className="flex justify-end">
                             <button onClick={handleReset} className="font-bold text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded transition-colors">
                                Try Again
                             </button>
                        </div>
                    </div>

                    <div className="bg-[#111] border border-white/10 rounded-lg p-5 text-xs font-mono text-gray-400 shadow-xl">
                         <h3 className="text-gray-200 font-bold mb-4 uppercase tracking-wider flex items-center gap-2">
                             <Zap size={14} className="text-yellow-500" /> System Diagnostics
                         </h3>
                         
                         <div className="grid grid-cols-2 gap-y-3 gap-x-8 border-t border-white/5 pt-4">
                             <div className="text-gray-500">API Key Status</div>
                             <div className={`font-bold ${diagnostics.hasApiKey ? "text-green-400" : "text-red-500"}`}>
                                 {diagnostics.hasApiKey ? "DETECTED" : "MISSING / INVALID"}
                             </div>

                             <div className="text-gray-500">Key Length</div>
                             <div>{diagnostics.keyLength > 0 ? `${diagnostics.keyLength} chars` : "0"}</div>

                             <div className="text-gray-500">Vite Environment</div>
                             <div className={diagnostics.envCheck.vite ? "text-green-400" : "text-gray-600"}>
                                 {diagnostics.envCheck.vite ? "VITE_API_KEY Found" : "Not Found"}
                             </div>

                             <div className="text-gray-500">Process Environment</div>
                             <div className={diagnostics.envCheck.process ? "text-green-400" : "text-gray-600"}>
                                 {diagnostics.envCheck.process ? "process.env Found" : "Not Found"}
                             </div>
                         </div>
                         
                         {!diagnostics.hasApiKey && (
                            <div className="mt-5 p-3 bg-yellow-900/10 border border-yellow-500/20 rounded text-yellow-500/80 leading-relaxed">
                                <strong>Action Required:</strong> Please go to your Vercel/Netlify dashboard and ensure you have added an Environment Variable named <code className="bg-black px-1 py-0.5 rounded text-yellow-300">VITE_API_KEY</code> with your Gemini API key value.
                            </div>
                         )}
                    </div>
                </div>
            )}

            {appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
                <FallingBackgroundIcons active={startBackgroundEffects} />
                
                {showConfig ? (
                    appMode === 'EXAM' 
                        ? <ExamConfigPanel onStart={handleExamConfigSubmit} onCancel={() => setShowConfig(false)} />
                        : <DrillConfigPanel onStart={handleDrillConfigSubmit} onCancel={() => setShowConfig(false)} />
                ) : (
                    <div className="space-y-10 w-full flex flex-col items-center z-10 relative">
                        <div className="text-center space-y-4 max-w-2xl">
                            {appMode === 'SOLVER' && (
                                <>
                                    <h1 className="text-5xl font-bold tracking-tight text-white">
                                        Math explained. <span className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">Simply.</span>
                                    </h1>
                                    <p className="text-lg text-gray-500 font-normal max-w-md mx-auto">
                                    Step-by-step IB HL analysis. Powered by Gemini.
                                    </p>
                                </>
                            )}
                            {appMode === 'EXAM' && (
                                <>
                                    <h1 className="text-5xl font-bold tracking-tight text-white">
                                        Create perfect <span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">Exams.</span>
                                    </h1>
                                    <p className="text-lg text-gray-500 font-normal max-w-md mx-auto">
                                    Upload notes or problems. Get a deployable IB paper.
                                    </p>
                                </>
                            )}
                            {appMode === 'DRILL' && (
                                <>
                                    <h1 className="text-5xl font-bold tracking-tight text-white">
                                        Adaptive <span className="text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">Practice.</span>
                                    </h1>
                                    <p className="text-lg text-gray-500 font-normal max-w-md mx-auto">
                                    Quick-fire drills that learn as you go.
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
                                        : 'bg-[#1c1c1e] hover:bg-[#252525] border-yellow-500/30 text-yellow-400'
                                    } ${appMode === 'SOLVER' && uploads.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {appMode === 'SOLVER' 
                                        ? `Analyze ${uploads.length} Problem${uploads.length > 1 ? 's' : ''}` 
                                        : appMode === 'EXAM' ? 'Configure Exam Paper' : 'Configure Drill'
                                    }
                                    <ArrowRight size={16} className={`group-hover:translate-x-0.5 transition-transform ${
                                        appMode === 'SOLVER' ? 'text-blue-400' 
                                        : appMode === 'EXAM' ? 'text-purple-400' 
                                        : 'text-yellow-400'
                                    }`} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {appState === AppState.ANALYZING && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-700">
                <div className="relative flex flex-col items-center gap-8">
                    <div className="relative group">
                        <div className={`absolute inset-0 rounded-full animate-pulse ${
                            appMode === 'SOLVER' ? 'bg-blue-500/5' : (appMode === 'EXAM' ? 'bg-purple-500/5' : 'bg-yellow-500/5')
                        }`}></div>
                        <div className="relative z-10 animate-bounce duration-[2000ms]">
                             <div className="animate-[spin_3s_ease-in-out_infinite]">
                                {appMode === 'SOLVER' ? (
                                    <Pen size={24} className="text-blue-400 transform -rotate-45" />
                                ) : appMode === 'EXAM' ? (
                                    <GraduationCap size={24} className="text-purple-400" />
                                ) : (
                                    <Zap size={24} className="text-yellow-400" />
                                )}
                             </div>
                        </div>
                    </div>
                </div>
                
                <div className="min-h-[24px]">
                    <TypewriterLoader phrases={currentLoadingPhrases} />
                </div>

                <div className="w-full max-w-xs space-y-3 relative mb-6">
                    <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden border border-white/5 relative">
                        <div 
                            className={`h-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out ${
                                appMode === 'SOLVER' 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-400' 
                                : appMode === 'EXAM'
                                    ? 'bg-gradient-to-r from-purple-600 to-purple-400'
                                    : 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                            }`}
                            style={{ width: `${loadingProgress}%` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full animate-[shimmer_1.5s_infinite]" />
                    </div>
                    <div 
                        className={`absolute top-full mt-2 text-[10px] font-bold transition-all duration-300 ease-linear ${
                            appMode === 'SOLVER' ? 'text-blue-400' : (appMode === 'EXAM' ? 'text-purple-400' : 'text-yellow-400')
                        }`}
                        style={{ left: `${Math.min(95, Math.max(0, loadingProgress - 2))}%` }}
                    >
                        {Math.round(loadingProgress)}%
                    </div>
                </div>
            </div>
            )}

            {appState === AppState.SOLVED && (
                appMode === 'SOLVER' && activeSolution ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32 animate-in fade-in duration-500">
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
                                    </div>
                                </div>
                            </div>
                         </div>
                         
                         <div className="lg:col-span-8 space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-6">
                                    <h2 className="text-2xl font-bold text-white">{solutions.length > 1 ? `Solution ${activeTab + 1}` : 'Solution'}</h2>
                                    <div className="flex bg-[#121212] p-1 rounded-lg border border-white/10">
                                        <button onClick={() => handleViewChange('steps')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${activeView === 'steps' ? 'bg-[#1e293b] text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                                            <Layers size={12} /> Detailed Steps
                                        </button>
                                        <button onClick={() => handleViewChange('markscheme')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${activeView === 'markscheme' ? 'bg-[#1e293b] text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                                            <ScrollText size={12} /> Markscheme
                                        </button>
                                    </div>
                                </div>
                                {activeView === 'steps' && <span className="text-xs font-bold text-gray-500">{activeSolution.steps.length} STEPS</span>}
                                {activeView === 'markscheme' && activeSolution.markscheme && (
                                    <button onClick={handleDownloadMarkscheme} className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"><Download size={14} /> Download PDF</button>
                                )}
                            </div>

                            <div className="bg-[#111] rounded-xl p-6 border border-blue-500/20 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                <div className="flex items-center gap-3 mb-3"><span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-1 rounded border border-blue-500/20 uppercase tracking-widest">Exercise</span></div>
                                <div className="text-gray-200 text-lg leading-relaxed font-medium"><MarkdownRenderer content={activeSolution.exerciseStatement} /></div>
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
                                                    <MarkdownRenderer content={normalizeMarkscheme(activeSolution.markscheme)} />
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
                ) : appMode === 'DRILL' && (
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
                )
            )}
        </main>
      </div>

      {appState === AppState.SOLVED && (
          <ChatInterface 
             key={appMode === 'DRILL' ? currentDrillIndex : activeTab} 
             solution={appMode === 'SOLVER' ? activeSolution || undefined : undefined} 
             drillQuestion={appMode === 'DRILL' ? drillQuestions[currentDrillIndex] : undefined}
             currentStepIndex={currentStepIndex} 
             isOpen={isChatOpen} 
             onClose={() => setIsChatOpen(false)} 
             activeView={activeView} 
             mode={appMode}
             userName={user.name}
          />
      )}
      
    </div>
  );
};

export default App;
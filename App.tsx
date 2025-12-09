

import React, { useState, useEffect, useRef } from 'react';
import { AppState, MathSolution, MathStep, UserInput, AppMode, ExamSettings, ExamPaper, DrillSettings, DrillQuestion } from './types';
import { analyzeMathInput, getMarkscheme, generateExam, generateDrillQuestion } from './services/geminiService';
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
import { Pen, X, ArrowRight, Maximize2, Loader2, BookOpen, ChevronDown, FileText, Download, ScrollText, Layers, Sigma, Divide, Minus, Lightbulb, Percent, Hash, GraduationCap, Calculator, Zap, LogOut, User as UserIcon, Check } from 'lucide-react';

/**
 * Magnetic Pencil Component
 * Clean, minimalistic signature icon.
 */
const MagneticPencil = ({ onClick, isOpen, mode }: { onClick: () => void, isOpen: boolean, mode: AppMode }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // If chat is open, do not follow cursor (stay static)
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
      
      // Magnetic range (pixels)
      const range = 80;

      if (distance < range) {
        // Subtle pull
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
            
            {/* CSS Grid Animation Strategy - Prevents Blur caused by max-height/transform/transition-all */}
            <div 
                className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
            >
                <div className="overflow-hidden">
                    <div className="p-4 pt-0 space-y-4 border-t border-white/5 mt-0">
                        <div className="h-2" /> {/* Spacer */}
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Typewriter Loader Component
 * Cycles through phrases with a typing/deleting effect.
 */
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
          setTypingSpeed(30); // Faster deleting
        } else {
          setText(currentPhrase.substring(0, text.length + 1));
          setTypingSpeed(50 + Math.random() * 50); // Natural typing variation
        }
  
        if (!isDeleting && text === currentPhrase) {
          // Finished typing phrase, pause before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        } else if (isDeleting && text === '') {
          // Finished deleting, move to next phrase
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

/**
 * Animated loader for the Markscheme generation phase
 */
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
                 {/* Simple Icon Animation */}
                 <div className="relative">
                    <ScrollText size={40} className="text-blue-500/80 animate-pulse" />
                 </div>

                 {/* Minimal Text Loader */}
                 <div className="mt-2">
                    <TypewriterLoader phrases={phrases} />
                 </div>
             </div>
        </div>
    );
}

/**
 * Background Falling Icons Component
 * Renders falling math icons on the lateral sides of the screen.
 */
const FallingBackgroundIcons = ({ active }: { active: boolean }) => {
    const [icons, setIcons] = useState<any[]>([]);
    
    // Shuffle bag to ensure even distribution and minimize repetition
    const availableIndices = useRef<number[]>([]);

    // Define the specific mapping of Icon to Color matching UploadZone
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
        // If bag is empty, refill it
        if (availableIndices.current.length === 0) {
            availableIndices.current = Array.from({ length: iconTypes.length }, (_, i) => i);
        }
        
        // Pick random index from bag
        const randomIndex = Math.floor(Math.random() * availableIndices.current.length);
        const iconIndex = availableIndices.current[randomIndex];
        
        // Remove picked index from bag
        availableIndices.current.splice(randomIndex, 1);
        
        return iconTypes[iconIndex];
    };

    useEffect(() => {
        if (!active) return;

        const interval = setInterval(() => {
            if (document.hidden) return; 

            // Groups of 1, 2, or 3 icons
            const groupSize = Math.floor(Math.random() * 3) + 1; 
            
            const newIcons = [];
            for (let i = 0; i < groupSize; i++) {
                const id = Date.now() + Math.random();
                
                // Use shuffle bag to get unique icon
                const type = getNextIcon();
                
                // Independently decide side for EACH icon to allow mixing
                const isLeft = Math.random() > 0.5;

                // Position: 
                // Left: 12% - 22% (Closer to center but safe)
                // Right: 78% - 88% (Closer to center but safe)
                const base = isLeft ? 17 : 83;
                const offset = (Math.random() * 10) - 5; 
                const left = base + offset;

                // Faster physics: 3s - 6s duration
                const duration = 3 + Math.random() * 3; 
                const rotation = (Math.random() * 180) - 90;
                const delay = Math.random() * 1.5; // Stagger them

                newIcons.push({ id, Icon: type.Icon, color: type.color, left, duration, rotation, delay });
            }

            setIcons(prev => [...prev, ...newIcons]);

            // Cleanup
            setTimeout(() => {
                setIcons(prev => prev.filter(icon => !newIcons.some(n => n.id === icon.id)));
            }, 8000); 

        }, 2000); // Faster generation rate

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
                    {/* Reduced size from 28 to 22 for subtle background effect */}
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
                        opacity: 0.8; /* Vibrant visibility */
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

// Helper to calculate marks from the markdown string
const calculateTotalMarks = (text: string) => {
    if (!text) return 0;
    let score = 0;
    // Extract codes like M1, A1, R1, M2, A2
    const regex = /\b[MAR](\d+)\b/g; 
    let match;
    while ((match = regex.exec(text)) !== null) {
        score += parseInt(match[1], 10);
    }
    return score;
};

const App: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [appMode, setAppMode] = useState<AppMode>('SOLVER');
  
  // Data State
  const [uploads, setUploads] = useState<UserInput[]>([]);
  const [solutions, setSolutions] = useState<(MathSolution | null)[]>([]); 
  const [generatedExam, setGeneratedExam] = useState<ExamPaper | null>(null);

  // Drill Mode State
  const [drillSettings, setDrillSettings] = useState<DrillSettings | null>(null);
  const [drillQuestions, setDrillQuestions] = useState<DrillQuestion[]>([]);
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [loadingDrill, setLoadingDrill] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<number>(0);
  const [activeView, setActiveView] = useState<'steps' | 'markscheme'>('steps');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [analyzingIndex, setAnalyzingIndex] = useState<number>(-1);
  const [loadingMarkscheme, setLoadingMarkscheme] = useState(false);
  const [showConfig, setShowConfig] = useState(false); // Used for both Exam and Drill config
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [startBackgroundEffects, setStartBackgroundEffects] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [isMarkschemeOpen, setIsMarkschemeOpen] = useState(true);

  // Define handleReset here, before any effects that use it
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
    
    // Drill Reset
    setDrillSettings(null);
    setDrillQuestions([]);
    setCurrentDrillIndex(0);
    setLoadingDrill(false);
  };

  // Logic to reset state when user logs out
  useEffect(() => {
      if (!user) {
          handleReset();
      }
  }, [user]);

  // Computed active solution
  const activeSolution = solutions[activeTab];
  const activeInput = uploads[activeTab];

  // Group steps logic (Moved up to obey Hook Rules)
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

  // Effect to ensure current step's section is open
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

  // Keyboard Navigation Effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appState !== AppState.SOLVED || isChatOpen || activeView !== 'steps') return;
      
      if (appMode === 'SOLVER' && activeSolution) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
        if (e.key === 'ArrowRight') setCurrentStepIndex(prev => Math.min(prev + 1, activeSolution.steps.length - 1));
        else if (e.key === 'ArrowLeft') setCurrentStepIndex(prev => Math.max(prev - 1, 0));
      } 
      // Drill Mode navigation is now handled within DrillSessionViewer to manage step vs question logic
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, activeSolution, isChatOpen, activeView, appMode]);

  // Progress Bar Effect
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

  // Helper to normalize Markscheme tables (shared with ExamViewer logic)
  const normalizeMarkscheme = (text: string) => {
    if (!text || text === 'null') return "";

    // 0. Aggressive Cleanup for dirty asterisks and multiple newlines
    let clean = text.replace(/\*\*/g, ''); 

    // 1. Convert block math to inline math to prevent line breaks
    clean = clean.replace(/\$\$/g, '$');
    
    // 2. Convert literal newlines to real newlines, then condense multiple newlines
    clean = clean.replace(/\\n/g, '\n').replace(/\n\s*\n/g, '\n');
    
    // 3. Remove HTML breaks (replace with space)
    clean = clean.replace(/<br\s*\/?>/gi, ' ');

    // 4. Robust Line Merging for broken tables
    const lines = clean.split('\n');
    const mergedLines: string[] = [];
    
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // If line starts with '|', it's a valid row start (or header separator).
        if (trimmed.startsWith('|')) {
            // Check for empty cells or misformatted pipes
            const fixedLine = trimmed.replace(/\|\|/g, '| |');
            mergedLines.push(fixedLine);
        } else {
            // Otherwise it's likely a broken continuation. Append to previous line.
            if (mergedLines.length > 0) {
                mergedLines[mergedLines.length - 1] += ' ' + trimmed;
            } else {
                // Fallback: If it doesn't look like a row but we need it
                 mergedLines.push(trimmed);
            }
        }
    });

    return '\n\n' + mergedLines.join('\n');
  };

  // Loading phrases
  const solverPhrases = [
    "Analyzing problem structure...",
    "Extracting mathematical context...",
    "Generating step-by-step solution...",
    "Double-checking calculations...",
    "Formatting LaTeX expressions..."
  ];

  const examPhrases = [
      "Reviewing source material...",
      "Drafting Section A questions...",
      "Designing complex problems for Section B...",
      "Calculating mark allocations...",
      "Finalizing exam paper format..."
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
                 // Background processing remaining
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
      } catch (err) {
        console.error(err);
        setErrorMsg("Analysis failed. Please try again.");
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
      } catch (error) {
          console.error(error);
          setErrorMsg("Failed to generate exam paper.");
          setAppState(AppState.ERROR);
      }
  }

  // --- Drill Mode Handlers ---

  const generateDrillBatch = async (startNum: number, prevDiff: number, count: number, settings: DrillSettings): Promise<DrillQuestion[]> => {
      const promises = [];
      let currentDiff = prevDiff;
      for (let i = 0; i < count; i++) {
          promises.push(generateDrillQuestion(settings, uploads, startNum + i, currentDiff));
          // Increment difficulty logic slightly for prediction (actual func does it too)
          currentDiff = Math.min(10, currentDiff + 0.5); 
      }
      return Promise.all(promises);
  }

  const handleDrillConfigSubmit = async (settings: DrillSettings) => {
      setShowConfig(false);
      setDrillSettings(settings);
      // Change to ANALYZING to show the main loading screen for the initial batch
      setAppState(AppState.ANALYZING);
      setLoadingProgress(0);
      setStartBackgroundEffects(false);
      setShowActionButtons(false);

      setDrillQuestions([]);
      setCurrentDrillIndex(0);
      setLoadingDrill(true);

      try {
          // Generate 3 questions initially
          const initialBatch = await generateDrillBatch(1, 0, 3, settings);
          setLoadingProgress(100);
          
          setTimeout(() => {
              setDrillQuestions(initialBatch);
              setAppState(AppState.SOLVED);
              setLoadingDrill(false);
          }, 500);
      } catch (e) {
          console.error(e);
          setErrorMsg("Failed to start drill session.");
          setAppState(AppState.ERROR);
      } 
  }

  const handleNextDrillQuestion = async () => {
      if (!drillSettings) return;
      
      const nextIndex = currentDrillIndex + 1;
      
      // PREFETCH LOGIC: When user reaches second to last card
      // If we are at index X, and length is L.
      // Second to last is index L-2.
      // We start fetching when we LAND on L-2 (meaning we have 2 questions left including current)
      if (drillQuestions.length > 0 && currentDrillIndex >= drillQuestions.length - 2 && !loadingDrill) {
           const lastQ = drillQuestions[drillQuestions.length - 1];
           
           // We set loadingDrill to true to indicate a fetch is active,
           // but we don't necessarily block UI unless user hits the end.
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

      // NAVIGATION LOGIC
      if (nextIndex < drillQuestions.length) {
          // Immediate transition if we have the question
          setCurrentDrillIndex(nextIndex);
      } else {
          // If we hit the end (next question not ready), we stay on current and show loading on button
          if (!loadingDrill) {
              // Safety fallback: if we somehow hit end without fetch active
              setLoadingDrill(true);
              const lastQ = drillQuestions[drillQuestions.length - 1];
              generateDrillBatch(lastQ.number + 1, lastQ.difficultyLevel, 3, drillSettings)
                 .then(newQs => {
                     setDrillQuestions(prev => [...prev, ...newQs]);
                     setLoadingDrill(false);
                     setCurrentDrillIndex(prev => prev + 1); // Auto-advance once loaded
                 });
          }
      }
  }

  // To implement auto-advance after loading:
  const [waitingForNext, setWaitingForNext] = useState(false);
  
  useEffect(() => {
      if (waitingForNext && drillQuestions.length > currentDrillIndex + 1) {
          setWaitingForNext(false);
          setCurrentDrillIndex(prev => prev + 1);
      }
  }, [drillQuestions.length, waitingForNext, currentDrillIndex]);

  // Updated handleNextDrillQuestion wrapper to set waiting state
  const handleNextWithWait = () => {
      if (currentDrillIndex + 1 < drillQuestions.length) {
          handleNextDrillQuestion(); // Normal logic (prefetch check inside)
      } else {
          setWaitingForNext(true);
          handleNextDrillQuestion(); // Triggers fetch if needed
      }
  };


  const handlePrevDrillQuestion = () => {
      if (currentDrillIndex > 0) {
          setCurrentDrillIndex(currentDrillIndex - 1);
          setWaitingForNext(false); // Cancel any forward wait
      }
  }

  const handleMainAction = () => {
      if (uploads.length === 0 && appMode === 'SOLVER') return; // Solver needs upload
      
      if (appMode === 'SOLVER') {
          startSolverFlow();
      } else {
          // Both Exam and Drill open config panel first
          setShowConfig(true);
      }
  };

  // Markscheme Handlers
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

  // ------------------------------------------
  // RENDER PHASE
  // ------------------------------------------
  
  // Conditional Rendering: Auth Flow
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

  // Determine if next button should be in loading state
  // It is loading if we are explicitly waiting for next question OR if we are at the end and currently fetching
  const isNextButtonLoading = waitingForNext || (loadingDrill && currentDrillIndex === drillQuestions.length - 1 && waitingForNext);

  return (
    <div className="min-h-screen text-gray-100 bg-black selection:bg-blue-900/50 font-sans overflow-x-hidden text-sm">
      
      {/* Navigation Bar */}
      <nav className={`sticky top-0 z-40 border-b border-white/5 transition-all duration-300 ${
          appMode === 'EXAM' 
            ? 'bg-black/70 backdrop-blur-md' 
            : 'bg-black/95 backdrop-blur-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
             {/* Logo - Bubble. */}
             <button 
                onClick={handleReset}
                className="group flex items-center gap-2 focus:outline-none"
             >
                <span className="font-sans font-bold text-2xl tracking-tighter text-white transition-all duration-300 ease-out hover:text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    Bubble.
                </span>
             </button>
          </div>
          
          <div className="flex items-center gap-4">
              {/* Right Side: Mode Switcher (Visible only in IDLE) */}
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
                
                {/* User Menu */}
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

          {/* Tab Bar (Only visible in SOLVED state with > 1 upload for Solver) */}
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

      {/* Lightbox */}
      {isLightboxOpen && activeInput?.type === 'image' && (
          <Lightbox src={activeInput.preview!} onClose={() => setIsLightboxOpen(false)} />
      )}

      {/* Magnetic Assistant (Only for Solver/Drill Mode) */}
      {appState === AppState.SOLVED && (appMode === 'SOLVER' || appMode === 'DRILL') && (
        <MagneticPencil isOpen={isChatOpen} onClick={() => setIsChatOpen(!isChatOpen)} mode={appMode} />
      )}

      {/* Main Content Wrapper */}
      <div className="relative z-10">
        <main className="mx-auto px-6 py-12 max-w-5xl">
            
            {/* Error State */}
            {appState === AppState.ERROR && (
                <div className="mb-8 p-4 bg-[#1a0505] border border-red-900/50 rounded-lg text-red-400 flex items-center justify-between max-w-2xl mx-auto text-sm">
                    <div className="flex items-center gap-3">
                        <span className="font-bold">Error</span> {errorMsg}
                    </div>
                    <button onClick={handleReset} className="font-medium hover:text-red-300 transition-colors">Retry</button>
                </div>
            )}

            {/* IDLE State */}
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
                                    // Wait for icons to fall (approx 3s total) before showing action button
                                    setTimeout(() => setShowActionButtons(true), 3200);
                                }}
                                appMode={appMode}
                            />
                            
                            {/* In Drill Mode, user can start without uploads, but we'll still show the button */}
                            <div className={`transition-all duration-1000 ease-out ${showActionButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                <button 
                                    onClick={handleMainAction}
                                    // Disable for solver if no uploads, but enable for Exam/Drill
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

            {/* ANALYZING State (Solver/Exam/Drill) */}
            {appState === AppState.ANALYZING && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-700">
                <div className="relative flex flex-col items-center gap-8">
                    <div className="relative group">
                        {/* Removed blur-xl to prevent artifacts */}
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

            {/* SOLVED State - View depends on Mode */}
            {appState === AppState.SOLVED && (
                appMode === 'SOLVER' && activeSolution ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32 animate-in fade-in duration-500">
                         {/* Existing Solver UI - Left Col */}
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

                                <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/10">
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
                         
                         {/* Solver UI - Right Col */}
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
                                // Use simple fade-in to avoid sub-pixel blur caused by slide animations
                                <div className="animate-in fade-in duration-300">
                                    {loadingMarkscheme ? (
                                        <MarkschemeLoader />
                                    ) : activeSolution.markscheme ? (
                                        <div id="ib-markscheme-container">
                                            {/* Expandable-style block wrapper for consistency */}
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
                                                    {/* Applying the Robust Normalization logic here */}
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
                    // EXAM VIEWER MODE
                    <ExamViewer exam={generatedExam} />
                ) : appMode === 'DRILL' && (
                    // DRILL VIEWER MODE
                    <DrillSessionViewer 
                        question={drillQuestions[currentDrillIndex] || null} 
                        isLoading={loadingDrill} 
                        isNextLoading={isNextButtonLoading}
                        onNext={handleNextWithWait}
                        onPrev={handlePrevDrillQuestion}
                        hasPrev={currentDrillIndex > 0}
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
          />
      )}
      
    </div>
  );
};

export default App;
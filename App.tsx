
import React, { useState, useEffect, useRef } from 'react';
import { AppState, MathSolution, MathStep, UserInput } from './types';
import { analyzeMathInput } from './services/geminiService';
import UploadZone from './components/UploadZone';
import StepCard from './components/StepCard';
import ChatInterface from './components/ChatInterface';
import MarkdownRenderer from './components/MarkdownRenderer';
import { Pen, X, ArrowRight, Maximize2, Loader2, BookOpen, ChevronDown, FileText } from 'lucide-react';

/**
 * Magnetic Pencil Component
 * Clean, minimalistic signature icon.
 */
const MagneticPencil = ({ onClick, isOpen }: { onClick: () => void, isOpen: boolean }) => {
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
            <Pen size={20} className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
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

const SectionContainer = ({ title, children, isOpen, onToggle }: { title: string, children: React.ReactNode, isOpen: boolean, onToggle: () => void }) => {
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-[#0a0a0a]">
            <button 
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
            >
                <span className="font-bold text-gray-300 text-sm group-hover:text-white transition-colors uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 group-hover:bg-blue-400 transition-colors" />
                    {title}
                </span>
                <ChevronDown className={`text-gray-500 transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </button>
            <div className={`transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 pt-0 space-y-4 border-t border-white/5 mt-0">
                    <div className="h-2" /> {/* Spacer */}
                    {children}
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
        <span className="w-0.5 h-4 bg-blue-500 ml-1 animate-pulse" />
      </div>
    );
  };

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  
  // Multi-problem state
  const [uploads, setUploads] = useState<UserInput[]>([]);
  // Use map to store solutions by index to handle async completion out of order if needed
  const [solutions, setSolutions] = useState<(MathSolution | null)[]>([]); 
  const [activeTab, setActiveTab] = useState<number>(0);
  
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [analyzingIndex, setAnalyzingIndex] = useState<number>(-1);
  
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Section Management
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Computed active solution
  const activeSolution = solutions[activeTab];
  const activeInput = uploads[activeTab];

  // Loading phrases
  const loadingPhrases = [
    "Analyzing problem structure...",
    "Extracting mathematical context...",
    "Generating step-by-step solution...",
    "Double-checking calculations...",
    "Formatting LaTeX expressions..."
  ];

  // Group steps by section
  const stepGroups = React.useMemo(() => {
    if (!activeSolution) return [];
    
    const groups: { title: string; steps: { data: MathStep; index: number }[] }[] = [];
    
    activeSolution.steps.forEach((step, index) => {
        const sectionTitle = step.section || "Solution";
        
        // If groups is empty or the last group has a different title, start a new group
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

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
        const next = new Set(prev);
        if (next.has(title)) next.delete(title);
        else next.add(title);
        return next;
    });
  };

  useEffect(() => {
    if (appState === AppState.ANALYZING) {
        // Progress bar simulation (asymptotic to 90%)
        const progressInterval = setInterval(() => {
            setLoadingProgress(prev => {
                if (prev >= 95) return prev;
                // Slow down as it gets higher
                const increment = Math.max(0.2, (95 - prev) / 30); 
                return prev + increment;
            });
        }, 100);

        return () => {
            clearInterval(progressInterval);
        };
    } else {
        setLoadingProgress(0);
    }
  }, [appState]);

  const handleInputAdd = (input: UserInput) => {
    setUploads(prev => [...prev, input]);
    setErrorMsg(null);
  };

  const handleInputRemove = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const processRemainingProblems = async (startIndex: number, currentInputs: UserInput[]) => {
      for (let i = startIndex; i < currentInputs.length; i++) {
          try {
              const result = await analyzeMathInput(currentInputs[i]);
              setSolutions(prev => {
                  const next = [...prev];
                  next[i] = result;
                  return next;
              });
          } catch (e) {
              console.error(`Error processing input ${i}`, e);
          }
      }
  }

  const startAnalysis = async () => {
      if (uploads.length === 0) return;
      
      setAppState(AppState.ANALYZING);
      setAnalyzingIndex(0);
      setLoadingProgress(0);
      
      // Initialize solutions array with nulls
      setSolutions(new Array(uploads.length).fill(null));

      try {
        // Solve the first one strictly to show UI
        const firstResult = await analyzeMathInput(uploads[0]);
        
        setLoadingProgress(100); // Complete
        
        // Short delay to show 100%
        setTimeout(() => {
            setSolutions(prev => {
                const next = [...prev];
                next[0] = firstResult;
                return next;
            });
            
            // Transition to SOLVED
            setAppState(AppState.SOLVED);
            setActiveTab(0);
            setCurrentStepIndex(0);
            
            // Process the rest in background
            if (uploads.length > 1) {
                processRemainingProblems(1, uploads);
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

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setSolutions([]);
    setUploads([]);
    setCurrentStepIndex(0);
    setActiveTab(0);
    setIsChatOpen(false);
  };

  return (
    <div className="min-h-screen text-gray-100 bg-black selection:bg-blue-900/50 font-sans overflow-x-hidden text-sm">
      
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
             {/* Logo - Bubble. in clean sans-serif */}
             <button 
                onClick={handleReset}
                className="group flex items-center gap-2 focus:outline-none"
             >
                <span className="font-sans font-bold text-2xl tracking-tighter text-white group-hover:text-blue-400 transition-colors">
                    Bubble.
                </span>
             </button>
          </div>
          
          {/* Tab Bar (Only visible in SOLVED state with > 1 upload) */}
          {appState === AppState.SOLVED && uploads.length > 1 && (
             <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-[#121212] p-1 rounded-full border border-white/10">
                {uploads.map((_, idx) => {
                    const isReady = !!solutions[idx];
                    const isSelected = activeTab === idx;
                    
                    return (
                        <button
                            key={idx}
                            onClick={() => { 
                                if (isReady) {
                                    setActiveTab(idx); 
                                    setCurrentStepIndex(0); 
                                }
                            }}
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

      {/* Lightbox for Source Image */}
      {isLightboxOpen && activeInput?.type === 'image' && (
          <Lightbox src={activeInput.preview!} onClose={() => setIsLightboxOpen(false)} />
      )}

      {/* Magnetic Assistant Pencil */}
      {appState === AppState.SOLVED && (
        <MagneticPencil isOpen={isChatOpen} onClick={() => setIsChatOpen(!isChatOpen)} />
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

            {/* Idle / Upload / Preview State */}
            {appState === AppState.IDLE && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="space-y-10 w-full flex flex-col items-center">
                    <div className="text-center space-y-4 max-w-2xl">
                        <h1 className="text-5xl font-bold tracking-tight text-white">
                            Math explained. Simply.
                        </h1>
                        <p className="text-lg text-gray-500 font-normal max-w-md mx-auto">
                           Step-by-step IB HL analysis. Powered by Gemini.
                        </p>
                    </div>
                    
                    <div className="w-full flex flex-col items-center space-y-8">
                         <UploadZone 
                            uploads={uploads}
                            onUpload={handleInputAdd}
                            onRemove={handleInputRemove}
                         />
                         
                         {/* Action Button - Appears when there is at least 1 upload */}
                         {uploads.length > 0 && (
                             <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                                <button 
                                    onClick={startAnalysis}
                                    className="group flex items-center gap-2 bg-[#1c1c1e] hover:bg-[#252525] border border-blue-500/30 text-blue-100 text-sm font-semibold px-8 py-3 rounded-full transition-all hover:scale-105 shadow-lg shadow-blue-900/10"
                                >
                                    Analyze {uploads.length} Problem{uploads.length > 1 ? 's' : ''}
                                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform text-blue-400" />
                                </button>
                             </div>
                         )}
                    </div>
                </div>
            </div>
            )}

            {/* Analyzing State (Rich Loading Screen) */}
            {appState === AppState.ANALYZING && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-700">
                <div className="relative flex flex-col items-center gap-8">
                    {/* Dynamic Animated Pencil - Spin & Bounce */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full animate-pulse"></div>
                        <div className="relative z-10 animate-bounce duration-[2000ms]">
                             {/* Smaller pencil with complex rotation animation */}
                             <div className="animate-[spin_3s_ease-in-out_infinite]">
                                <Pen 
                                    size={24} 
                                    className="text-blue-400 transform -rotate-45"
                                />
                             </div>
                        </div>
                    </div>
                </div>
                
                {/* Typewriter Text */}
                <div className="min-h-[24px]">
                    <TypewriterLoader phrases={loadingPhrases} />
                </div>

                {/* Progress Bar Container */}
                <div className="w-full max-w-xs space-y-3 relative mb-6">
                    <div className="h-1.5 w-full bg-[#111] rounded-full overflow-hidden border border-white/5 relative">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out"
                            style={{ width: `${loadingProgress}%` }}
                        />
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full animate-[shimmer_1.5s_infinite]" />
                    </div>

                    {/* Percentage Floating Indicator - Moved to Bottom */}
                    <div 
                        className="absolute top-full mt-2 text-[10px] font-bold text-blue-400 transition-all duration-300 ease-linear"
                        style={{ left: `${Math.min(95, Math.max(0, loadingProgress - 2))}%` }}
                    >
                        {Math.round(loadingProgress)}%
                    </div>
                </div>
            </div>
            )}

            {/* Solved State */}
            {appState === AppState.SOLVED && activeSolution && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32 animate-in fade-in duration-500">
                
                {/* Left Column: Context & Image */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="sticky top-24 space-y-6">
                        
                        {/* Source Card - Adapts to Image or Text */}
                        {activeInput?.type === 'image' ? (
                             <div 
                                className="group relative h-40 w-full rounded-lg overflow-hidden bg-black border border-white/10 cursor-pointer hover:border-white/30 transition-colors flex items-center justify-center"
                                onClick={() => setIsLightboxOpen(true)}
                            >
                                <div className="absolute top-2 left-2 bg-black/80 text-[10px] font-bold text-white px-2 py-0.5 rounded border border-white/10 z-10 flex items-center gap-1.5 backdrop-blur-sm">
                                    SOURCE
                                    <Maximize2 size={10} className="text-gray-400" />
                                </div>
                                <img 
                                    src={activeInput.preview} 
                                    alt="Problem Source" 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-white/5 transition-colors" />
                            </div>
                        ) : (
                             <div className="h-40 w-full rounded-lg overflow-hidden bg-[#0a0a0a] border border-white/10 p-4 relative group">
                                <div className="absolute top-2 left-2 bg-black/80 text-[10px] font-bold text-green-400 px-2 py-0.5 rounded border border-white/10 z-10 flex items-center gap-1.5 backdrop-blur-sm">
                                    TEXT SOURCE
                                    <FileText size={10} className="text-green-500" />
                                </div>
                                <div className="mt-6 text-xs text-gray-400 font-mono leading-relaxed line-clamp-6">
                                    {activeInput?.content}
                                </div>
                             </div>
                        )}

                        {/* Summary Card */}
                        <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/10">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Summary</h3>
                                    <div className="text-gray-300 leading-relaxed text-sm">
                                        <MarkdownRenderer content={activeSolution.problemSummary} />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Final Answer</h3>
                                    {/* Made final answer smaller (text-sm/text-base instead of text-lg) */}
                                    <div className="bg-black p-4 rounded-lg border border-white/10">
                                        <div className="text-white font-medium text-base leading-relaxed">
                                            <MarkdownRenderer content={activeSolution.finalAnswer} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Interactive Steps */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-baseline justify-between px-1">
                        <h2 className="text-2xl font-bold text-white">
                            {solutions.length > 1 ? `Solution ${activeTab + 1}` : 'Solution'}
                        </h2>
                        <span className="text-xs font-bold text-gray-500">{activeSolution.steps.length} STEPS</span>
                    </div>

                    {/* Exercise Reference Section - Placed above steps */}
                    <div className="bg-[#111] rounded-xl p-6 border border-blue-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        
                        <div className="flex items-center gap-3 mb-3">
                             <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-1 rounded border border-blue-500/20 uppercase tracking-widest">
                                Exercise
                             </span>
                        </div>
                        <div className="text-gray-200 text-lg leading-relaxed font-medium">
                             <MarkdownRenderer content={activeSolution.exerciseStatement || "*Generating exercise text...*"} />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        {stepGroups.length === 1 ? (
                            // Flat list if only one section exists
                            stepGroups[0].steps.map(({ data, index }) => (
                                <StepCard 
                                    key={`${activeTab}-${index}`}
                                    step={data}
                                    index={index}
                                    isActive={currentStepIndex === index}
                                    problemContext={activeSolution.problemSummary}
                                    onClick={() => setCurrentStepIndex(index)}
                                    onNext={() => setCurrentStepIndex(index + 1)}
                                    onPrev={() => setCurrentStepIndex(index - 1)}
                                    isFirst={index === 0}
                                    isLast={index === activeSolution.steps.length - 1}
                                />
                            ))
                        ) : (
                            // Deployable Containers for Multi-Section Problems
                            stepGroups.map((group, gIdx) => (
                                <SectionContainer 
                                    key={gIdx} 
                                    title={group.title}
                                    isOpen={openSections.has(group.title)}
                                    onToggle={() => toggleSection(group.title)}
                                >
                                    {group.steps.map(({ data, index }) => (
                                        <StepCard 
                                            key={`${activeTab}-${index}`}
                                            step={data}
                                            index={index}
                                            isActive={currentStepIndex === index}
                                            problemContext={activeSolution.problemSummary}
                                            onClick={() => setCurrentStepIndex(index)}
                                            onNext={() => setCurrentStepIndex(index + 1)}
                                            onPrev={() => setCurrentStepIndex(index - 1)}
                                            isFirst={index === 0}
                                            isLast={index === activeSolution.steps.length - 1}
                                        />
                                    ))}
                                </SectionContainer>
                            ))
                        )}
                    </div>
                </div>

            </div>
            )}
        </main>
      </div>

      {/* Chat Bot Overlay */}
      {/* 
        Keyed by activeTab to ensure unique state per problem. 
        When switching tabs, this re-mounts the ChatInterface with the correct solution context.
      */}
      {activeSolution && (
          <ChatInterface 
            key={activeTab} 
            solution={activeSolution}
            currentStepIndex={currentStepIndex}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
      )}
      
    </div>
  );
};

export default App;

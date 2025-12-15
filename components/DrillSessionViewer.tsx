
import React, { useState, useEffect } from 'react';
import { DrillQuestion } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import StepCard from './StepCard';
import InteractiveGraph from './InteractiveGraph';
import { Calculator, Zap, ArrowRight, ArrowLeft, CheckCircle2, BookOpen, Lightbulb, Copy, Check, Loader2 } from 'lucide-react';

interface DrillSessionViewerProps {
    question: DrillQuestion | null;
    isLoading: boolean;
    isNextLoading?: boolean;
    onNext: () => void;
    onPrev?: () => void;
    hasPrev?: boolean;
    onGenerateSolution?: () => void; // New callback
    isGeneratingSolution?: boolean; // Loading state for solution
}

const TypewriterLoader = ({ phrases, speed = 50 }: { phrases: string[], speed?: number }) => {
    const [text, setText] = useState('');
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
  
    useEffect(() => {
      const currentPhrase = phrases[phraseIndex];
      const typingSpeed = isDeleting ? 30 : speed + Math.random() * 20;
      
      const handleType = () => {
        if (isDeleting) {
          setText(currentPhrase.substring(0, text.length - 1));
        } else {
          setText(currentPhrase.substring(0, text.length + 1));
        }
  
        if (!isDeleting && text === currentPhrase) {
          setTimeout(() => setIsDeleting(true), 1500);
        } else if (isDeleting && text === '') {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      };
  
      const timer = setTimeout(handleType, typingSpeed);
      return () => clearTimeout(timer);
    }, [text, isDeleting, phraseIndex, phrases, speed]);
  
    return <span>{text}</span>;
};

const DrillSessionViewer: React.FC<DrillSessionViewerProps> = ({ 
    question, isLoading, isNextLoading, onNext, onPrev, hasPrev,
    onGenerateSolution, isGeneratingSolution
}) => {
    const [showHint, setShowHint] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    useEffect(() => {
        setShowHint(false);
        setShowAnswer(false);
        setShowSolution(false);
        setActiveStepIndex(0);
    }, [question]);

    // Handle solution click logic: check if steps exist or need generation
    const handleSolutionClick = () => {
        if (!question) return;
        
        if (question.steps && question.steps.length > 0) {
            setShowSolution(!showSolution);
        } else {
            // No steps yet, trigger generation
            if (onGenerateSolution && !isGeneratingSolution) {
                setShowSolution(true); // Open the view, will show loader
                onGenerateSolution();
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                if (showSolution && question?.steps && question.steps.length > 0) {
                    if (activeStepIndex < question.steps.length - 1) {
                        setActiveStepIndex(prev => prev + 1);
                    } else {
                        setShowSolution(false);
                    }
                } else if (!isNextLoading && !isGeneratingSolution) {
                    onNext();
                }
            } else if (e.key === 'ArrowLeft') {
                if (showSolution && question?.steps && question.steps.length > 0) {
                    if (activeStepIndex > 0) {
                        setActiveStepIndex(prev => prev - 1);
                    } else {
                        setShowSolution(false);
                    }
                } else if (hasPrev) {
                    onPrev && onPrev();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showSolution, activeStepIndex, question, onNext, onPrev, hasPrev, isNextLoading, isGeneratingSolution]);


    const handleCopy = () => {
        if (!question) return;
        navigator.clipboard.writeText(question.questionText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const getDifficultyColor = (level: number) => {
        if (level <= 3) return "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]";
        if (level <= 6) return "bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]";
        if (level <= 8) return "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]";
        return "bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]";
    };

    const getDifficultyTextColor = (level: number) => {
        if (level <= 3) return "text-green-400";
        if (level <= 6) return "text-yellow-400";
        if (level <= 8) return "text-red-400";
        return "text-blue-400";
    };

    const QuestionBodyRenderer = ({ text }: { text: string }) => {
        const normalizedText = text.replace(/\\n/g, '\n');
        const blocks = normalizedText.split(/\n\n+/).filter(b => b.trim());
        
        const parts = [];
        let preamble = [];
        let foundFirstPart = false;

        const partStartRegex = /^(\([a-z]+\)|\([iv]+\))/i;

        for (const block of blocks) {
            const cleanBlock = block.replace(/\s*(\*\*\[\d+\]\*\*|\[\d+\])\s*$/g, '');
            const startsWithPart = partStartRegex.test(cleanBlock);

            if (startsWithPart || foundFirstPart) {
                foundFirstPart = true;
                parts.push({ content: cleanBlock });
            } else {
                preamble.push(cleanBlock);
            }
        }

        return (
            <div className="space-y-6 w-full">
                {preamble.length > 0 && (
                    <div className="text-gray-200 leading-relaxed font-serif text-base">
                        <MarkdownRenderer content={preamble.join('\n\n')} mode="DRILL" />
                    </div>
                )}
                {parts.length > 0 && (
                    <div className="space-y-4 w-full">
                        {parts.map((part, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-8 w-full group/part">
                                <div className="flex-1 min-w-0 text-gray-200 leading-relaxed font-serif text-base pt-0.5">
                                     <MarkdownRenderer content={part.content} mode="DRILL" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!question && isLoading) {
        return (
             <div className="max-w-3xl mx-auto space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-2 opacity-50">
                    <div className="flex items-center gap-4">
                        <span className="text-white font-bold text-xl tracking-tight">Drill Session</span>
                    </div>
                </div>
                
                <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative min-h-[400px] flex flex-col items-center justify-center">
                    <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/50 animate-pulse"></div>
                    <div className="flex flex-col items-center justify-center space-y-4 animate-pulse">
                        <Zap className="text-yellow-400" size={32} />
                        <div className="text-yellow-500 font-mono text-sm tracking-wide">
                             <TypewriterLoader phrases={["Preparing session...", "Calibrating difficulty...", "Loading questions..."]} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!question) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <span className="text-white font-bold text-xl tracking-tight">Q{question.number}</span>
                    <div className="h-4 w-px bg-white/10"></div>
                    <span className="text-gray-400 text-xs font-mono uppercase tracking-wider">{question.topic}</span>
                </div>
                
                <div className="flex items-center gap-3">
                     <div className="flex gap-0.5">
                        {[...Array(10)].map((_, i) => (
                            <div 
                                key={i} 
                                className={`w-1 h-3 rounded-full transition-colors ${
                                    i < question.difficultyLevel 
                                        ? getDifficultyColor(question.difficultyLevel) 
                                        : 'bg-white/5'
                                }`} 
                            />
                        ))}
                     </div>
                     <span className={`text-[10px] font-bold w-8 text-right ${getDifficultyTextColor(question.difficultyLevel)}`}>
                         {question.difficultyLevel.toFixed(1)}/10
                     </span>
                </div>
            </div>

            <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/50"></div>
                
                <div className="bg-[#181818] border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        {question.calculatorAllowed ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-900/10 px-2 py-0.5 rounded border border-green-500/20">
                                <Calculator size={10} /> CALC
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-900/10 px-2 py-0.5 rounded border border-red-500/20">
                                <Calculator size={10} /> NO CALC
                            </div>
                        )}
                     </div>

                     <button 
                        onClick={handleCopy}
                        className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 duration-200"
                        title="Copy Question"
                     >
                        {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14} />}
                     </button>
                </div>

                <div className="p-5 sm:p-8 min-h-[150px]">
                    <QuestionBodyRenderer text={question.questionText} />
                    {/* Interactive Graph Integration */}
                    {question.graphFunctions && question.graphFunctions.length > 0 && (
                        <div className="mt-6 flex justify-center">
                            <div className="max-w-[500px] w-full">
                                <InteractiveGraph functions={question.graphFunctions} mode="DRILL" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-[#0a0a0a] border-t border-white/5 p-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                         <div className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                             <button 
                                onClick={() => setShowHint(!showHint)}
                                className={`p-2 rounded-lg transition-colors border flex-shrink-0 ${
                                    showHint 
                                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/5'
                                }`}
                                title="Show Hint"
                             >
                                <Lightbulb size={16} />
                             </button>

                             <button 
                                onClick={() => setShowAnswer(!showAnswer)}
                                className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border flex-shrink-0 whitespace-nowrap ${
                                    showAnswer 
                                    ? 'bg-white/5 border-white/10 text-white' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                             >
                                <CheckCircle2 size={14} />
                                <span className="hidden sm:inline">Check Answer</span>
                                <span className="sm:hidden">Check</span>
                             </button>

                             <button 
                                onClick={handleSolutionClick}
                                disabled={isGeneratingSolution}
                                className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border flex-shrink-0 whitespace-nowrap ${
                                    showSolution 
                                    ? 'bg-white/5 border-white/10 text-white' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                             >
                                {isGeneratingSolution ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                                <span className="hidden sm:inline">Step-by-Step Solution</span>
                                <span className="sm:hidden">Solution</span>
                             </button>
                         </div>

                         <div className="flex items-center gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-white/5 sm:border-t-0">
                             <button 
                                onClick={onPrev}
                                disabled={!hasPrev || isNextLoading}
                                className={`text-gray-500 hover:text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-30 disabled:hover:text-gray-500 flex-1 sm:flex-initial justify-center`}
                             >
                                <ArrowLeft size={14} /> <span className="hidden sm:inline">Prev</span>
                             </button>

                             <button 
                                onClick={onNext}
                                disabled={isNextLoading || isGeneratingSolution}
                                className={`
                                    relative overflow-hidden font-bold text-xs px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all min-w-[100px] sm:min-w-[140px] justify-center flex-1 sm:flex-initial
                                    ${isNextLoading 
                                        ? 'border border-yellow-500/20 text-yellow-500/70 bg-yellow-500/5 cursor-wait' 
                                        : 'border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                    }
                                `}
                             >
                                {isNextLoading ? (
                                    <div className="font-mono text-[10px] tracking-wide">
                                        <TypewriterLoader phrases={["Loading...", "Generating..."]} speed={80} />
                                    </div>
                                ) : (
                                    <>
                                        <span className="hidden sm:inline">Next Question</span><span className="sm:hidden">Next</span> <ArrowRight size={14} />
                                    </>
                                )}
                             </button>
                         </div>
                    </div>
                    
                    <div className="space-y-4 pt-2">
                        {showHint && question.hint && (
                            <div className="animate-in slide-in-from-top-2 duration-200 bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-3">
                                <div className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold mb-1 flex items-center gap-1">Hint</div>
                                <div className="text-gray-300 text-sm italic">
                                    <MarkdownRenderer content={question.hint} mode="DRILL" />
                                </div>
                            </div>
                        )}

                        {showAnswer && (
                             <div className="animate-in slide-in-from-top-2 duration-200 bg-[#151515] border border-white/10 rounded-lg p-4">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Short Answer</div>
                                <div className="text-white text-sm font-medium">
                                    <MarkdownRenderer 
                                        content={question.shortAnswer.replace(/\\n/g, '\n').replace(/\n/g, '\n\n')} 
                                        mode="DRILL" 
                                    />
                                </div>
                            </div>
                        )}

                        {showSolution && (
                            <div className="animate-in slide-in-from-top-4 duration-300 space-y-4">
                                <div className="text-[10px] uppercase tracking-widest text-yellow-400 font-bold pl-1 flex items-center gap-2">
                                    <BookOpen size={12}/> Detailed Analysis
                                </div>
                                {isGeneratingSolution ? (
                                     <div className="bg-[#121212] border border-yellow-500/20 rounded-xl p-8 flex flex-col items-center justify-center space-y-4">
                                         <div className="animate-bounce duration-[2000ms]">
                                            <Zap size={24} className="text-yellow-400 fill-yellow-500/20" />
                                         </div>
                                         <div className="text-gray-300 text-xs font-mono">
                                            <TypewriterLoader phrases={["Generating step-by-step solution...", "Analyzing logic...", "Writing explanations..."]} speed={40} />
                                         </div>
                                     </div>
                                ) : question.steps && question.steps.length > 0 ? (
                                    <div className="space-y-4">
                                        {question.steps.map((step, index) => (
                                            <StepCard 
                                                key={index}
                                                step={step}
                                                index={index}
                                                isActive={activeStepIndex === index}
                                                problemContext={question.questionText}
                                                onClick={() => setActiveStepIndex(index)}
                                                onNext={() => {
                                                    if (index < question.steps.length - 1) {
                                                        setActiveStepIndex(index + 1);
                                                    } else {
                                                        setShowSolution(false);
                                                    }
                                                }}
                                                onPrev={() => {
                                                    if (index > 0) {
                                                        setActiveStepIndex(index - 1);
                                                    } else {
                                                        setShowSolution(false);
                                                    }
                                                }}
                                                isFirst={index === 0}
                                                isLast={index === question.steps.length - 1}
                                                mode="DRILL"
                                            />
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrillSessionViewer;

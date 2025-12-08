import React, { useState, useEffect } from 'react';
import { DrillQuestion } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { Calculator, Zap, ArrowRight, ArrowLeft, CheckCircle2, ListStart, Lightbulb, Copy, Check, Loader2 } from 'lucide-react';

interface DrillSessionViewerProps {
    question: DrillQuestion | null;
    isLoading: boolean;
    onNext: () => void;
    onPrev?: () => void;
    hasPrev?: boolean;
}

const TypewriterLoader = ({ phrases }: { phrases: string[] }) => {
    const [text, setText] = useState('');
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
  
    useEffect(() => {
      const currentPhrase = phrases[phraseIndex];
      const speed = isDeleting ? 30 : 50 + Math.random() * 50;
      
      const handleType = () => {
        if (isDeleting) {
          setText(currentPhrase.substring(0, text.length - 1));
        } else {
          setText(currentPhrase.substring(0, text.length + 1));
        }
  
        if (!isDeleting && text === currentPhrase) {
          setTimeout(() => setIsDeleting(true), 2000);
        } else if (isDeleting && text === '') {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      };
  
      const timer = setTimeout(handleType, speed);
      return () => clearTimeout(timer);
    }, [text, isDeleting, phraseIndex, phrases]);
  
    return (
      <div className="h-6 flex items-center justify-center text-yellow-500 font-mono text-xs tracking-wide">
        <span className="mr-2 opacity-50">Bubble.</span>
        <span>{text}</span>
        <span className="w-0.5 h-4 bg-yellow-400 ml-1 animate-pulse" />
      </div>
    );
};

const DrillSessionViewer: React.FC<DrillSessionViewerProps> = ({ question, isLoading, onNext, onPrev, hasPrev }) => {
    const [showHint, setShowHint] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [showMarkscheme, setShowMarkscheme] = useState(false);
    const [copied, setCopied] = useState(false);

    // Reset state when question changes
    useEffect(() => {
        setShowHint(false);
        setShowAnswer(false);
        setShowMarkscheme(false);
    }, [question]);

    const handleCopy = () => {
        if (!question) return;
        navigator.clipboard.writeText(question.questionText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const normalizeMarkdown = (text: string) => {
        if (!text || text === 'null') return "";
        return text.replace(/\\n/g, '\n').replace(/\n/g, '\n\n');
    };
    
    const normalizeMarkscheme = (text: string) => {
        if (!text || text === 'null') return "";
        let clean = text.replace(/\$\$/g, '$');
        clean = clean.replace(/\\n/g, '\n');
        clean = clean.replace(/<br\s*\/?>/gi, ' ');
        const lines = clean.split('\n');
        const mergedLines: string[] = [];
        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed.startsWith('|')) {
                mergedLines.push(trimmed);
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

    // Determine difficulty color based on level
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

    /**
     * Parses the question text to separate Preamble from Parts.
     * Looks for blocks that end with marks like **[x]**.
     */
    const QuestionBodyRenderer = ({ text }: { text: string }) => {
        const normalizedText = text.replace(/\\n/g, '\n');
        const blocks = normalizedText.split(/\n\n+/).filter(b => b.trim());
        
        const parts = [];
        let preamble = [];
        let foundFirstPart = false;

        const marksRegex = /\s*(\*\*\[\d+\]\*\*|\[\d+\])\s*$/;
        const partStartRegex = /^(\([a-z]+\)|\([iv]+\))/i;

        for (const block of blocks) {
            const hasMarks = marksRegex.test(block);
            const startsWithPart = partStartRegex.test(block);

            if (hasMarks || startsWithPart || foundFirstPart) {
                foundFirstPart = true;
                const match = block.match(marksRegex);
                let marks = '';
                let content = block;

                if (match) {
                    marks = match[1]; 
                    content = block.replace(marksRegex, '').trim();
                    marks = marks.replace(/\*\*/g, '');
                }
                parts.push({ content, marks });
            } else {
                preamble.push(block);
            }
        }

        return (
            <div className="space-y-6 w-full">
                {preamble.length > 0 && (
                    <div className="text-gray-200 leading-relaxed font-serif text-base">
                        <MarkdownRenderer content={preamble.join('\n\n')} />
                    </div>
                )}
                {parts.length > 0 && (
                    <div className="space-y-4 w-full">
                        {parts.map((part, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-8 w-full group/part">
                                <div className="flex-1 min-w-0 text-gray-200 leading-relaxed font-serif text-base pt-0.5">
                                     <MarkdownRenderer content={part.content} />
                                </div>
                                {part.marks && (
                                    <div className="flex-shrink-0 pt-0.5">
                                        <span className="text-white font-normal font-sans text-sm select-none opacity-60">
                                            {part.marks}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!question && isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 animate-in fade-in duration-500">
                <div className="relative">
                    <Zap className="text-yellow-400 animate-pulse" size={48} />
                </div>
                <TypewriterLoader phrases={[
                    "Analyzing your performance...",
                    "Calibrating next challenge...",
                    "Formatting LaTeX...",
                    "Generating hints..."
                ]} />
            </div>
        );
    }

    if (!question) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Stats */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <span className="text-white font-bold text-xl tracking-tight">Q{question.number}</span>
                    <div className="h-4 w-px bg-white/10"></div>
                    <span className="text-gray-400 text-xs font-mono uppercase tracking-wider">{question.topic}</span>
                </div>
                
                <div className="flex items-center gap-3">
                     {/* Difficulty Dots */}
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

            {/* Main Card */}
            <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative group">
                {/* Yellow accent top bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/50"></div>
                
                {/* Tools Header */}
                <div className="bg-[#181818] border-b border-white/5 px-6 py-3 flex items-center justify-between">
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

                {/* Question Body with Exam-Style Renderer */}
                <div className="p-8 min-h-[150px]">
                    <QuestionBodyRenderer text={question.questionText} />
                </div>

                {/* Interactive Footer */}
                <div className="bg-[#0a0a0a] border-t border-white/5 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                         <div className="flex gap-3">
                             <button 
                                onClick={() => setShowHint(!showHint)}
                                className={`p-2 rounded-lg transition-colors border ${
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
                                className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border ${
                                    showAnswer 
                                    ? 'bg-white/5 border-white/10 text-white' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                             >
                                <CheckCircle2 size={14} />
                                Check Answer
                             </button>

                             <button 
                                onClick={() => setShowMarkscheme(!showMarkscheme)}
                                className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border ${
                                    showMarkscheme 
                                    ? 'bg-white/5 border-white/10 text-white' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                             >
                                <ListStart size={14} />
                                Solution
                             </button>
                         </div>

                         <div className="flex items-center gap-3">
                             <button 
                                onClick={onPrev}
                                disabled={!hasPrev || isLoading}
                                className={`text-gray-500 hover:text-white font-bold text-xs px-3 py-2.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-30 disabled:hover:text-gray-500`}
                             >
                                <ArrowLeft size={14} /> Prev
                             </button>

                             <button 
                                onClick={onNext}
                                disabled={isLoading}
                                className={`
                                    font-bold text-xs px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all
                                    border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]
                                    disabled:opacity-50 disabled:border-white/10 disabled:text-gray-500 disabled:shadow-none
                                `}
                             >
                                {isLoading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <>
                                        Next Question <ArrowRight size={14} />
                                    </>
                                )}
                             </button>
                         </div>
                    </div>
                    
                    {/* Content Drawers */}
                    <div className="space-y-2">
                        {showHint && question.hint && (
                            <div className="animate-in slide-in-from-top-2 duration-200 bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-3">
                                <div className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold mb-1 flex items-center gap-1">Hint</div>
                                <div className="text-gray-300 text-sm italic">
                                    <MarkdownRenderer content={question.hint} />
                                </div>
                            </div>
                        )}

                        {showAnswer && (
                             <div className="animate-in slide-in-from-top-2 duration-200 bg-[#151515] border border-white/10 rounded-lg p-4">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Short Answer</div>
                                <div className="text-white text-sm font-medium">
                                    <MarkdownRenderer content={normalizeMarkdown(question.shortAnswer)} />
                                </div>
                            </div>
                        )}

                        {showMarkscheme && (
                            <div className="animate-in slide-in-from-top-2 duration-200 bg-[#151515] border border-purple-500/20 rounded-lg p-4">
                                <div className="text-[10px] uppercase tracking-widest text-purple-400 font-bold mb-2">Full Markscheme</div>
                                <div className="text-gray-300 text-sm">
                                    <MarkdownRenderer content={normalizeMarkscheme(question.markscheme)} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrillSessionViewer;

import React, { useState } from 'react';
import { ConceptExplanation, ConceptBlock, ConceptExample, ExampleDifficulty } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import StepCard from './StepCard'; // Re-use StepCard for exercises
import { breakdownConceptBlock } from '../services/geminiService';
import { BookOpen, GraduationCap, Variable, ListOrdered, Plus, X, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';

interface ConceptViewerProps {
    concept: ConceptExplanation;
    onChatAction?: (prompt: string) => void;
    onReloadExamples?: () => void;
}

const ConceptViewer: React.FC<ConceptViewerProps> = ({ concept, onChatAction, onReloadExamples }) => {
    const [reloading, setReloading] = useState(false);

    const handleReload = async () => {
        if (onReloadExamples) {
            setReloading(true);
            await onReloadExamples();
            setReloading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="text-center space-y-2 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/20 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                    <BookOpen size={12} /> Concept Explainer
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                    {concept.topicTitle}
                </h1>
            </div>

            {/* 1. Introduction Card */}
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50" />
                <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <GraduationCap size={14} /> Definition
                </h3>
                <div className="text-gray-200 text-sm leading-relaxed">
                    <MarkdownRenderer content={concept.introduction} mode="CONCEPT" />
                </div>
            </div>

            {/* 2. Concept Blocks (Body) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={16} className="text-white" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Theory Breakdown</h3>
                </div>
                {concept.conceptBlocks.map((block, idx) => (
                    <BlockCard key={idx} block={block} topic={concept.topicTitle} />
                ))}
            </div>

            {/* 3. Formulas (Optional) */}
            {concept.coreFormulas && concept.coreFormulas.length > 0 && (
                <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden p-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider mb-4">
                        <Variable size={14} className="text-blue-400" /> Core Formulas
                    </div>
                    <div className="grid gap-3 bg-black/20 rounded-xl p-4">
                        {concept.coreFormulas.map((formula, idx) => (
                            <div key={idx} className="flex justify-center">
                                <MarkdownRenderer content={`$$ ${formula} $$`} mode="CONCEPT" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Exercises */}
            <div className="space-y-6 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ListOrdered size={16} className="text-white" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Concept Checks</h3>
                    </div>
                    <button 
                        onClick={handleReload}
                        disabled={reloading}
                        className="text-[10px] font-bold text-gray-500 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={12} className={reloading ? "animate-spin" : ""} /> Reload (1 Credit)
                    </button>
                </div>

                <div className="grid gap-6">
                    {concept.examples.map((ex, idx) => (
                        <ConceptExerciseCard key={idx} example={ex} index={idx} />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface BlockCardProps {
    block: ConceptBlock;
    topic: string;
}

const BlockCard: React.FC<BlockCardProps> = ({ block, topic }) => {
    const [breakdown, setBreakdown] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleExpand = async () => {
        if (breakdown) {
            setBreakdown(null); // Close
            return;
        }
        setLoading(true);
        try {
            const text = await breakdownConceptBlock(block.content, topic);
            setBreakdown(text);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 relative group transition-all hover:border-white/20">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{block.title}</h4>
            
            <div className="text-sm text-gray-200 leading-relaxed mb-3">
                <MarkdownRenderer content={block.content} mode="CONCEPT" />
            </div>

            {block.keyEquation && (
                <div className="bg-black/40 border border-white/5 rounded-lg p-3 my-3 flex justify-center">
                    <MarkdownRenderer content={`$$ ${block.keyEquation} $$`} mode="CONCEPT" />
                </div>
            )}

            {/* Breakdown Toggle */}
            <div className="relative">
                <button 
                    onClick={handleExpand}
                    className="absolute -right-2 -bottom-2 p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10"
                    title="Breakdown this concept"
                >
                    {breakdown ? <X size={14} /> : <Plus size={14} className={loading ? "animate-pulse" : ""} />}
                </button>

                {breakdown && (
                    <div className="mt-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-xs text-green-300 font-bold mb-2 uppercase tracking-wide">Detailed Breakdown</div>
                        <div className="text-xs text-gray-400 leading-relaxed">
                            <MarkdownRenderer content={breakdown} mode="CONCEPT" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ConceptExerciseCardProps {
    example: ConceptExample;
    index: number;
}

const ConceptExerciseCard: React.FC<ConceptExerciseCardProps> = ({ example, index }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [showSolution, setShowSolution] = useState(false);

    const getDifficultyColor = (diff: ExampleDifficulty) => {
        switch (diff) {
            case 'BASIC': return 'text-green-400 border-green-500/30 bg-green-500/10';
            case 'EXAM': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
            case 'HARD': return 'text-red-400 border-red-500/30 bg-red-500/10';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="bg-[#121212] border border-white/10 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-[#181818] border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getDifficultyColor(example.difficulty)}`}>
                    {example.difficulty}
                </span>
                <span className="text-[10px] font-mono text-gray-500">Ex {index + 1}</span>
            </div>

            <div className="p-5">
                <div className="text-sm text-white font-medium mb-4">
                    <MarkdownRenderer content={example.question} mode="CONCEPT" />
                </div>

                {/* Controls */}
                <div className="flex gap-2 border-t border-white/5 pt-4">
                    <button 
                        onClick={() => setShowHint(!showHint)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showHint ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-transparent text-gray-500 border-white/10 hover:text-white'}`}
                    >
                        Hint
                    </button>
                    <button 
                        onClick={() => setShowSolution(!showSolution)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showSolution ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-transparent text-gray-500 border-white/10 hover:text-white'}`}
                    >
                        {showSolution ? 'Hide Solution' : 'Solve'}
                    </button>
                </div>

                {showHint && (
                    <div className="mt-3 p-3 bg-yellow-900/10 border border-yellow-500/20 rounded-lg text-xs text-gray-300 italic animate-in fade-in">
                        <MarkdownRenderer content={example.hint} mode="CONCEPT" />
                    </div>
                )}

                {showSolution && (
                    <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 fade-in">
                        {/* Brief Logic */}
                        <div className="flex gap-2 items-start bg-green-900/10 p-3 rounded border border-green-500/20 mb-4">
                            <CheckCircle2 size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
                            <div className="text-[10px] text-green-200/80 leading-relaxed">
                                <MarkdownRenderer content={example.explanation} mode="CONCEPT" />
                            </div>
                        </div>

                        {/* Steps */}
                        {example.solutionSteps.map((step, idx) => (
                            <StepCard 
                                key={idx}
                                step={step}
                                index={idx}
                                isActive={activeStep === idx}
                                problemContext={example.question}
                                onClick={() => setActiveStep(idx)}
                                onNext={() => setActiveStep(idx < example.solutionSteps.length - 1 ? idx + 1 : idx)}
                                onPrev={() => setActiveStep(idx > 0 ? idx - 1 : idx)}
                                isFirst={idx === 0}
                                isLast={idx === example.solutionSteps.length - 1}
                                mode="DRILL" // Use Drill styling for steps
                            />
                        ))}

                        {/* Final Answer */}
                        <div className="bg-[#080808] p-4 rounded-lg border border-white/10 mt-4">
                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Final Answer</div>
                            <div className="text-sm text-white">
                                <MarkdownRenderer content={example.finalAnswer} mode="CONCEPT" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConceptViewer;

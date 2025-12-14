
import React, { useState } from 'react';
import { ConceptExplanation, ExampleDifficulty } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { BookOpen, GraduationCap, CheckCircle, ChevronDown, Zap, Search, Layers, Variable, ListOrdered } from 'lucide-react';

interface ConceptViewerProps {
    concept: ConceptExplanation;
    onChatAction?: (prompt: string) => void;
}

const ConceptViewer: React.FC<ConceptViewerProps> = ({ concept, onChatAction }) => {
    const [activeExample, setActiveExample] = useState<number | null>(null);
    const [showFormulas, setShowFormulas] = useState(true);

    const getDifficultyColor = (diff: ExampleDifficulty) => {
        switch (diff) {
            case 'BASIC': return 'text-green-400 border-green-500/30 bg-green-500/10';
            case 'EXAM': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
            case 'HARD': return 'text-red-400 border-red-500/30 bg-red-500/10';
            default: return 'text-gray-400 border-gray-500/30';
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="text-center space-y-2 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/20 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                    <BookOpen size={12} /> Concept Explainer
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                    {concept.topicTitle}
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Theory & Core */}
                <div className="lg:col-span-7 space-y-6">
                    
                    {/* Introduction */}
                    <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50" />
                        <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <GraduationCap size={14} /> Definition
                        </h3>
                        <div className="text-gray-200 text-sm leading-relaxed">
                            <MarkdownRenderer content={concept.introduction} mode="CONCEPT" />
                        </div>
                    </div>

                    {/* Formula Deck */}
                    {concept.coreFormulas && concept.coreFormulas.length > 0 && (
                        <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden">
                            <button 
                                onClick={() => setShowFormulas(!showFormulas)}
                                className="w-full flex items-center justify-between p-4 bg-white/5 border-b border-white/5 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
                                    <Variable size={14} className="text-blue-400" /> Core Formulas
                                </div>
                                <ChevronDown size={16} className={`text-gray-500 transition-transform ${showFormulas ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {showFormulas && (
                                <div className="p-4 grid gap-3 bg-black/20">
                                    {concept.coreFormulas.map((formula, idx) => (
                                        <div key={idx} className="bg-[#050505] border border-white/10 rounded-xl p-4 flex items-center justify-center min-h-[60px] shadow-inner">
                                            <MarkdownRenderer content={`$$ ${formula} $$`} mode="CONCEPT" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Theoretical Content */}
                    <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 sm:p-8">
                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/5">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Layers size={14} /> Methodology
                            </h3>
                        </div>
                        <div className="text-gray-300 text-sm leading-loose">
                            <MarkdownRenderer content={concept.theoreticalContent} mode="CONCEPT" />
                        </div>
                    </div>

                    {/* Tools & Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => onChatAction?.("Generate a visual graph SVG representing this concept.")}
                            className="p-4 rounded-xl bg-[#151515] border border-white/10 hover:border-green-500/30 hover:bg-green-500/5 transition-all group text-left"
                        >
                            <Zap size={18} className="text-yellow-400 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-xs font-bold text-white">Visualize</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">Generate Graph</div>
                        </button>
                        <button 
                            onClick={() => onChatAction?.("Provide a detailed step-by-step mathematical proof/derivation for this.")}
                            className="p-4 rounded-xl bg-[#151515] border border-white/10 hover:border-green-500/30 hover:bg-green-500/5 transition-all group text-left"
                        >
                            <Search size={18} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-xs font-bold text-white">Derivation</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">See the Proof</div>
                        </button>
                    </div>
                </div>

                {/* Right Column: Examples */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <ListOrdered size={16} className="text-white" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Example Progression</h3>
                    </div>

                    {concept.examples.map((ex, idx) => (
                        <div key={idx} className="bg-[#121212] border border-white/10 rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:border-white/20">
                            
                            {/* Example Header */}
                            <div className="p-4 border-b border-white/5 bg-[#181818] flex items-center justify-between">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getDifficultyColor(ex.difficulty)}`}>
                                    {ex.difficulty}
                                </span>
                                <span className="text-[10px] font-mono text-gray-500">Ex {idx + 1}</span>
                            </div>

                            {/* Question Body */}
                            <div className="p-5">
                                <h4 className="text-xs font-bold text-white mb-3">{ex.title}</h4>
                                <div className="text-xs text-gray-300 bg-[#0a0a0a] p-3 rounded-lg border border-white/5 mb-4">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Requirements</span>
                                    <MarkdownRenderer content={ex.requirements} mode="CONCEPT" />
                                </div>

                                {/* Accordion for Solution */}
                                <button 
                                    onClick={() => setActiveExample(activeExample === idx ? null : idx)}
                                    className="w-full flex items-center justify-between text-xs font-bold text-gray-400 hover:text-white transition-colors py-2 border-t border-white/5"
                                >
                                    <span>{activeExample === idx ? 'Hide Solution' : 'View Solution'}</span>
                                    <ChevronDown size={14} className={`transition-transform duration-300 ${activeExample === idx ? 'rotate-180' : ''}`} />
                                </button>

                                <div className={`transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${activeExample === idx ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="pt-4 space-y-4">
                                        <div className="text-xs text-gray-300 leading-relaxed font-mono bg-[#080808] p-3 rounded border border-white/5">
                                            <MarkdownRenderer content={ex.solution} mode="CONCEPT" />
                                        </div>
                                        <div className="flex gap-2 items-start bg-green-900/10 p-3 rounded border border-green-500/20">
                                            <CheckCircle size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
                                            <div className="text-[10px] text-green-200/80 leading-relaxed">
                                                <MarkdownRenderer content={ex.explanation} mode="CONCEPT" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Conclusion Footer */}
            <div className="bg-[#121212] border-t border-white/10 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div>
                    <h3 className="text-sm font-bold text-white mb-1">Concept Mastered?</h3>
                    <div className="text-xs text-gray-400 max-w-lg">
                        <MarkdownRenderer content={concept.conclusion} mode="CONCEPT" />
                    </div>
                </div>
                <button 
                    onClick={() => onChatAction?.("Give me a quick 1-question quiz to test my understanding.")}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-full text-xs font-bold transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                >
                    Take Quiz
                </button>
            </div>
        </div>
    );
};

export default ConceptViewer;


import React, { useState } from 'react';
import { ConceptExplanation } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { BookOpen, GraduationCap, CheckCircle, ChevronDown } from 'lucide-react';

interface ConceptViewerProps {
    concept: ConceptExplanation;
}

const ConceptViewer: React.FC<ConceptViewerProps> = ({ concept }) => {
    const [activeExample, setActiveExample] = useState<number | null>(null);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
            
            {/* Header / Title */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-widest">
                    <BookOpen size={12} /> Concept Explainer
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                    {concept.topicTitle}
                </h1>
            </div>

            {/* Introduction Block */}
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50" />
                <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <GraduationCap size={16} /> Introduction
                </h3>
                <div className="text-gray-200 text-sm leading-relaxed">
                    <MarkdownRenderer content={concept.introduction} mode="CONCEPT" />
                </div>
            </div>

            {/* Core Content */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 pb-2 border-b border-white/5">
                    Core Concepts
                </h3>
                <div className="text-gray-300 text-sm leading-loose">
                    <MarkdownRenderer content={concept.content} mode="CONCEPT" />
                </div>
            </div>

            {/* Conclusion */}
            <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-6 flex gap-4 items-start">
                <CheckCircle size={24} className="text-green-400 flex-shrink-0 mt-1" />
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-white">Key Takeaways</h3>
                    <div className="text-xs text-gray-300 leading-relaxed">
                        <MarkdownRenderer content={concept.conclusion} mode="CONCEPT" />
                    </div>
                </div>
            </div>

            {/* IB Ready Examples */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white px-2">IB Exam Examples</h3>
                
                {concept.examples.map((ex, idx) => (
                    <div key={idx} className="bg-[#121212] border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-5 border-b border-white/5">
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest block mb-2">Example {idx + 1}</span>
                            <div className="text-sm text-gray-200">
                                <MarkdownRenderer content={ex.question} mode="CONCEPT" />
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setActiveExample(activeExample === idx ? null : idx)}
                            className="w-full px-5 py-3 bg-[#0f0f0f] hover:bg-[#151515] transition-colors flex items-center justify-between group"
                        >
                            <span className="text-xs font-bold text-gray-500 group-hover:text-white transition-colors">
                                {activeExample === idx ? 'Hide Solution' : 'View Solution & Explanation'}
                            </span>
                            <ChevronDown size={16} className={`text-gray-500 transition-transform duration-300 ${activeExample === idx ? 'rotate-180' : ''}`} />
                        </button>

                        <div className={`transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${activeExample === idx ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-5 bg-black/20 space-y-6 border-t border-white/5">
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Solution</h4>
                                    <div className="text-sm text-gray-300">
                                        <MarkdownRenderer content={ex.solution} mode="CONCEPT" />
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/5">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Explanation</h4>
                                    <div className="text-xs text-gray-400 italic">
                                        <MarkdownRenderer content={ex.explanation} mode="CONCEPT" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ConceptViewer;


import React, { useState } from 'react';
import { ConceptSettings, IBLevel, ConceptDepth } from '../types';
import { Lightbulb, Target, Layers, Play } from 'lucide-react';

interface ConceptConfigPanelProps {
    onStart: (settings: ConceptSettings) => void;
    onCancel: () => void;
    initialTopic?: string;
}

const ConceptConfigPanel: React.FC<ConceptConfigPanelProps> = ({ onStart, onCancel, initialTopic = '' }) => {
    const [topic, setTopic] = useState(initialTopic);
    const [level, setLevel] = useState<IBLevel>('HL');
    const [depth, setDepth] = useState<ConceptDepth>('DETAILED');

    const handleStart = () => {
        if (!topic.trim()) return;
        onStart({
            topic,
            level,
            depth
        });
    };

    return (
        <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Frosted translucent background */}
            <div className="bg-[#121212]/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="pt-10 pb-5 px-5 border-b border-white/5 bg-[#181818]/80 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Explain Concept</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Deep dive into IB Math topics.</p>
                    </div>
                    <Lightbulb size={20} className="text-green-400 opacity-80" />
                </div>

                <div className="p-6 space-y-6">
                    {/* Topic Input */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 font-medium flex items-center gap-2 uppercase tracking-wider">
                            <Target size={14} /> Concept / Question
                        </label>
                        <textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., Explain the Chain Rule, or how to solve Integration by Parts..."
                            className="w-full h-24 bg-[#0a0a0a]/50 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-green-500/50 transition-colors resize-none"
                        />
                    </div>

                    {/* Level Toggle */}
                    <div className="flex items-center justify-between bg-[#0a0a0a]/50 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-[#151515]/50 flex items-center justify-center">
                                <Layers size={14} className="text-gray-400" />
                            </div>
                            <div className="text-xs font-medium text-gray-300">IB Level</div>
                        </div>
                        <div className="flex bg-[#151515]/50 p-0.5 rounded-lg border border-white/5">
                            {(['SL', 'HL'] as IBLevel[]).map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setLevel(opt)}
                                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                                        level === opt 
                                            ? 'bg-gray-700 text-white shadow-sm' 
                                            : 'text-gray-600 hover:text-gray-400'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Depth Toggle */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 font-medium flex items-center gap-2 uppercase tracking-wider">
                            <Layers size={14} /> Detail Level
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setDepth('SUMMARY')}
                                className={`p-3 rounded-xl border text-left transition-all group ${
                                    depth === 'SUMMARY'
                                        ? 'bg-green-500/10 border-green-500/40'
                                        : 'bg-[#0a0a0a]/50 border-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className={`text-xs font-bold mb-1 ${depth === 'SUMMARY' ? 'text-green-400' : 'text-gray-300'}`}>Concise Summary</div>
                                <div className="text-[10px] text-gray-500">Quick overview and key formulas.</div>
                            </button>
                            <button
                                onClick={() => setDepth('DETAILED')}
                                className={`p-3 rounded-xl border text-left transition-all group ${
                                    depth === 'DETAILED'
                                        ? 'bg-green-500/10 border-green-500/40'
                                        : 'bg-[#0a0a0a]/50 border-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className={`text-xs font-bold mb-1 ${depth === 'DETAILED' ? 'text-green-400' : 'text-gray-300'}`}>In-Depth Analysis</div>
                                <div className="text-[10px] text-gray-500">Thorough explanation with derivation.</div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 bg-[#181818]/80 flex items-center justify-end gap-3">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleStart}
                        disabled={!topic.trim()}
                        className="px-6 py-2.5 bg-[#1c1c1e] hover:bg-[#252525] border border-green-500/30 text-green-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2 hover:border-green-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play size={12} fill="currentColor" />
                        Explain Concept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConceptConfigPanel;

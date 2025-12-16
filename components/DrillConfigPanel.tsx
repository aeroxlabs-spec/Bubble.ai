
import React, { useState } from 'react';
import { DrillSettings, ExamDifficulty, ExamCalculatorOption } from '../types';
import { Zap, Target, Calculator, Check, Plus, X, Play } from 'lucide-react';

interface DrillConfigPanelProps {
    onStart: (settings: DrillSettings) => void;
    onCancel: () => void;
}

const DrillConfigPanel: React.FC<DrillConfigPanelProps> = ({ onStart, onCancel }) => {
    const [difficulty, setDifficulty] = useState<ExamDifficulty>('STANDARD');
    const [calculator, setCalculator] = useState<ExamCalculatorOption>('MIXED');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [customTopic, setCustomTopic] = useState('');

    const defaultTopics = [
        "Algebra", "Functions", "Calculus", 
        "Vectors", "Statistics", "Complex Numbers"
    ];

    const toggleTopic = (topic: string) => {
        setSelectedTopics(prev => 
            prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
        );
    };

    const addCustomTopic = () => {
        const val = customTopic.trim();
        if (val && !selectedTopics.includes(val)) {
            setSelectedTopics(prev => [...prev, val]);
            setCustomTopic('');
        }
    };

    const removeTopic = (topic: string) => {
        setSelectedTopics(prev => prev.filter(t => t !== topic));
    };

    const handleStart = () => {
        onStart({
            difficulty,
            calculator,
            topics: selectedTopics
        });
    };

    return (
        <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="pt-10 pb-5 px-5 border-b border-white/5 bg-[#181818] flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Practice Drills</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Rapid-fire adaptive questions.</p>
                    </div>
                    <Zap size={20} className="text-yellow-400 opacity-80" />
                </div>

                <div className="p-6 space-y-6">
                    {/* Intro Note */}
                    <div className="bg-yellow-900/10 border border-yellow-500/10 rounded-lg p-3 text-xs text-yellow-200/70 flex gap-2 items-start">
                         <span className="font-bold">Mode:</span> 
                         Questions will get progressively harder as you complete them. Upload notes for better context.
                    </div>

                    {/* Difficulty Grid */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 font-medium flex items-center gap-2 uppercase tracking-wider">
                            <Target size={14} /> Start Difficulty
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['STANDARD', 'HARD', 'HELL'] as ExamDifficulty[]).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => setDifficulty(level)}
                                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all border ${
                                        difficulty === level 
                                        ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' 
                                        : 'bg-[#0a0a0a] border-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'
                                    }`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Topics Selection */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 font-medium flex items-center gap-2 uppercase tracking-wider">
                            <Target size={14} /> Practice Areas
                        </label>
                        
                        {/* Render Active Selected Topics */}
                        {selectedTopics.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedTopics.map(topic => (
                                    <span key={topic} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-[10px]">
                                        {topic}
                                        <button onClick={() => removeTopic(topic)} className="hover:text-red-400"><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {defaultTopics.map(topic => {
                                const active = selectedTopics.includes(topic);
                                return (
                                    <button
                                        key={topic}
                                        onClick={() => toggleTopic(topic)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                                            active
                                                ? 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40'
                                                : 'bg-transparent text-gray-500 border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        {active && <Check size={10} />}
                                        {topic}
                                    </button>
                                );
                            })}
                            
                            {/* Add Custom Topic Input */}
                            <div className="flex items-center bg-[#0a0a0a] border border-white/5 rounded-full px-2 py-0.5 focus-within:border-white/20 transition-colors">
                                <input 
                                    type="text" 
                                    value={customTopic}
                                    onChange={(e) => setCustomTopic(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
                                    placeholder="Add custom..."
                                    className="bg-transparent border-none text-[11px] text-gray-300 focus:outline-none w-20 px-1 placeholder:text-gray-700"
                                />
                                <button onClick={addCustomTopic} className="text-gray-600 hover:text-white transition-colors">
                                    <Plus size={12} />
                                </button>
                            </div>
                        </div>
                    </div>

                     {/* Calculator Toggle */}
                     <div className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-[#151515] flex items-center justify-center">
                                <Calculator size={14} className="text-gray-400" />
                            </div>
                            <div className="text-xs font-medium text-gray-300">Calculator Allowed?</div>
                        </div>
                        <div className="flex bg-[#151515] p-0.5 rounded-lg border border-white/5">
                            {(['YES', 'MIXED', 'NO'] as ExamCalculatorOption[]).map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setCalculator(opt)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                                        calculator === opt 
                                            ? 'bg-gray-700 text-white shadow-sm' 
                                            : 'text-gray-600 hover:text-gray-400'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                     </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 bg-[#181818] flex items-center justify-end gap-3">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleStart}
                        className="px-6 py-2.5 bg-[#1c1c1e] hover:bg-[#252525] border border-yellow-500/30 text-yellow-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2 hover:border-yellow-500/60"
                    >
                        <Play size={12} fill="currentColor" />
                        Start Drill
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrillConfigPanel;

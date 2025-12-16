
import React, { useState } from 'react';
import { ExamSettings, ExamDifficulty, ExamCalculatorOption } from '../types';
import { Clock, GraduationCap, Calculator, Target, Play, Plus, X } from 'lucide-react';

interface ExamConfigPanelProps {
    onStart: (settings: ExamSettings) => void;
    onCancel: () => void;
}

const ExamConfigPanel: React.FC<ExamConfigPanelProps> = ({ onStart, onCancel }) => {
    const [duration, setDuration] = useState(60);
    const [difficulty, setDifficulty] = useState<ExamDifficulty>('STANDARD');
    const [calculator, setCalculator] = useState<ExamCalculatorOption>('MIXED');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [customTopic, setCustomTopic] = useState('');

    const defaultTopics = [
        "Algebra", "Functions", "Trig", 
        "Vectors", "Stats", "Calculus"
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
            durationMinutes: duration,
            difficulty,
            calculator,
            topics: selectedTopics
        });
    };

    return (
        <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Removed backdrop-blur-xl to prevent text rendering blurriness */}
            <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header - Increased Top Padding as requested */}
                <div className="pt-10 pb-5 px-5 border-b border-white/5 bg-[#181818] flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Configure Exam</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Customize your IB Math AA HL paper.</p>
                    </div>
                    <GraduationCap size={20} className="text-purple-400 opacity-80" />
                </div>

                <div className="p-6 space-y-6">
                    {/* Disclaimer about source material */}
                    <div className="bg-blue-900/10 border border-blue-500/10 rounded-lg p-3 text-xs text-blue-200/70 flex gap-2 items-start">
                         <span className="font-bold">Note:</span> 
                         The more files/notes you upload, the more accurate and tailored the exam questions will be.
                    </div>

                    {/* Duration Slider - Compact */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <label className="text-gray-400 font-medium flex items-center gap-2 text-xs uppercase tracking-wider">
                                <Clock size={14} /> Duration
                            </label>
                            <span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded text-xs">{duration} min</span>
                        </div>
                        <input 
                            type="range" 
                            min="45" 
                            max="90" 
                            step="15" 
                            value={duration} 
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                            style={{
                                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(duration - 45) * 100 / 45}%, #333 ${(duration - 45) * 100 / 45}%, #333 100%)`
                            }}
                            className="w-full h-1 rounded-lg appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                        />
                         <div className="flex justify-between text-[9px] text-gray-600 font-mono uppercase">
                            <span>Short</span>
                            <span>Standard</span>
                            <span>Long</span>
                        </div>
                    </div>

                    {/* Difficulty Grid */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400 font-medium flex items-center gap-2 uppercase tracking-wider">
                            <Target size={14} /> Difficulty
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['STANDARD', 'HARD', 'HELL'] as ExamDifficulty[]).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => setDifficulty(level)}
                                    className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all border ${
                                        difficulty === level 
                                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
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
                            <Target size={14} /> Focus Topics
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
                                                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                                                : 'bg-transparent text-gray-500 border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        {active && <CheckIcon size={10} />}
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

                     {/* Calculator Toggle - 3 Options */}
                     <div className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-[#151515] flex items-center justify-center">
                                <Calculator size={14} className="text-gray-400" />
                            </div>
                            <div className="text-xs font-medium text-gray-300">Calculator Mode</div>
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

                {/* Footer - Buttons match solver style */}
                <div className="p-5 border-t border-white/5 bg-[#181818] flex items-center justify-end gap-3">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleStart}
                        className="px-6 py-2.5 bg-[#1c1c1e] hover:bg-[#252525] border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2 hover:border-blue-500/60"
                    >
                        <Play size={12} fill="currentColor" />
                        Generate Paper
                    </button>
                </div>
            </div>
        </div>
    );
};

const CheckIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
)

export default ExamConfigPanel;

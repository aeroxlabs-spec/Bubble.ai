
import React, { useRef, useEffect, useState } from 'react';
import { MathStep } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { ArrowRight, Plus, Lightbulb, ListStart, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import { getStepHint, getStepBreakdown } from '../services/geminiService';

interface StepCardProps {
  step: MathStep;
  index: number;
  isActive: boolean;
  problemContext: string;
  onClick: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ 
  step, index, isActive, problemContext, onClick,
  onNext, onPrev, isFirst, isLast 
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Hint State
  const [hintContent, setHintContent] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [loadingHint, setLoadingHint] = useState(false);

  // Breakdown State
  const [breakdownContent, setBreakdownContent] = useState<string[] | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  // Copy State
  const [isCopied, setIsCopied] = useState(false);

  // Swipe Refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    if (isActive && cardRef.current) {
      // Adjusted delay and behavior for smoother focus
      const timer = setTimeout(() => {
        cardRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        });
      }, 300); 
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Swipe Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isActive) {
        if (isLeftSwipe && onNext && !isLast) {
            onNext();
        }
        if (isRightSwipe && onPrev && !isFirst) {
            onPrev();
        }
    }
  };

  const handleHintClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) {
        onClick();
        return; 
    }
    
    // Toggle off if already showing
    if (showHint) {
        setShowHint(false);
        return;
    }

    // If we have content but it's hidden, just show it
    if (hintContent) {
        setShowHint(true);
        return;
    }

    setLoadingHint(true);
    try {
        const result = await getStepHint(step, problemContext);
        setHintContent(result);
        setShowHint(true);
    } catch (err) {
        console.error(err);
    } finally {
        setLoadingHint(false);
    }
  };

  const handleBreakdownClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isActive) {
          onClick();
          return;
      }
      
      // Toggle off if already showing
      if (showBreakdown) {
          setShowBreakdown(false);
          return;
      }

      // If we have content but it's hidden, just show it
      if (breakdownContent) {
          setShowBreakdown(true);
          return;
      }

      setLoadingBreakdown(true);
      try {
          const result = await getStepBreakdown(step, problemContext);
          setBreakdownContent(result);
          setShowBreakdown(true);
      } catch (err) {
          console.error(err);
      } finally {
          setLoadingBreakdown(false);
      }
  }

  const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(step.keyEquation);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div 
      ref={cardRef}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={`group relative rounded-xl transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer overflow-hidden border scroll-mt-32
        ${isActive 
          ? 'bg-[#121212] border-blue-500/30 shadow-lg shadow-blue-900/5' 
          : 'bg-black border-white/10 hover:border-white/20 hover:bg-[#0a0a0a]'
        }`}
    >
      <div className="p-6">
        <div className="flex items-start gap-5">
            {/* Step Number */}
            <div className={`flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-lg text-sm font-mono font-bold transition-colors duration-300
                ${isActive 
                    ? 'bg-[#1e293b] text-blue-400 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                    : 'bg-[#1c1c1e] text-gray-500 group-hover:bg-[#2c2c2e] group-hover:text-gray-300'
                }`}>
                {index + 1}
            </div>
            
            <div className="flex-1 min-w-0">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2 gap-4">
                     {/* Title using MarkdownRenderer for math support in titles, flattened to behave like inline-block */}
                     <div className={`font-medium text-base truncate transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                        <MarkdownRenderer content={step.title} className="inline-block [&>p]:mb-0 [&>p]:inline" />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                         {/* Breakdown Button */}
                        <button
                            onClick={handleBreakdownClick}
                            disabled={loadingBreakdown}
                            className={`relative w-8 h-8 rounded-md transition-all duration-300 flex items-center justify-center border
                                ${(showBreakdown || loadingBreakdown) 
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                                    : 'bg-transparent border-transparent text-gray-600 hover:text-blue-400 hover:bg-blue-500/5'
                                }`}
                            title="Break down this step"
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Plus 
                                    size={18} 
                                    className={`transition-all duration-500 ${
                                        loadingBreakdown 
                                            ? 'animate-pulse opacity-50' 
                                            : showBreakdown 
                                                ? 'rotate-45' 
                                                : ''
                                    }`} 
                                />
                            </div>
                        </button>

                        {/* Hint Button */}
                        <button
                            onClick={handleHintClick}
                            disabled={loadingHint}
                            className={`relative w-8 h-8 rounded-md transition-all duration-300 flex items-center justify-center border
                                ${(showHint || loadingHint) 
                                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' 
                                    : 'bg-transparent border-transparent text-gray-600 hover:text-yellow-500 hover:bg-yellow-500/10'
                                }`}
                            title="Get a hint"
                        >
                             <div className="absolute inset-0 flex items-center justify-center">
                                <Lightbulb 
                                    size={18} 
                                    className={`transition-all duration-500 ${
                                        loadingHint 
                                            ? 'animate-pulse opacity-50 fill-yellow-500/50' 
                                            : showHint 
                                                ? 'fill-yellow-500 text-yellow-500' 
                                                : ''
                                    }`} 
                                />
                             </div>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {/* Smoother ease-out-quart transition */}
                <div className={`transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${isActive ? 'max-h-[2500px] opacity-100 mt-5' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-6">
                        
                        {/* Explanation Block */}
                        <div className="text-gray-300 text-sm leading-relaxed">
                            <MarkdownRenderer content={step.explanation} />
                        </div>
                        
                        {/* Breakdown Block (Appears if requested) */}
                        {showBreakdown && breakdownContent && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-[#0e0e0e] rounded-lg p-4 border border-white/5">
                                 <div className="flex items-center gap-2 mb-3">
                                     <ListStart size={14} className="text-blue-400"/>
                                     <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Step Breakdown</span>
                                </div>
                                <div className="space-y-3">
                                    {breakdownContent.map((subStep, i) => (
                                        <div key={i} className="flex gap-4 text-xs text-gray-400 group/item">
                                            <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-blue-400 text-xs font-mono font-bold border border-blue-500/10 bg-blue-500/5 mt-0.5">
                                                {i + 1}
                                            </div>
                                            <div className="leading-relaxed pt-0.5 w-full">
                                                <MarkdownRenderer content={subStep} className="text-gray-300" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Math Block */}
                        {/* Improved padding and centering logic to avoid touching sides. Group for hover detection. */}
                        <div className="group/math bg-[#050505] rounded-xl py-8 px-6 border border-white/10 font-mono text-xl overflow-x-auto relative shadow-inner flex flex-col justify-center min-h-[6rem] hover:border-white/20 transition-colors">
                            
                            {/* Copy Button */}
                            <button
                                onClick={handleCopy}
                                className={`absolute top-2 right-2 p-1.5 rounded-md border transition-all duration-200 opacity-0 group-hover/math:opacity-100 z-10 ${
                                    isCopied 
                                        ? 'bg-green-500/10 border-green-500/30 text-green-400 opacity-100' 
                                        : 'bg-[#1a1a1a] border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                                }`}
                                title="Copy LaTeX"
                            >
                                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            </button>

                            <div className="text-white w-full text-center">
                                {/* Wrapper to ensure horizontal centering but left-align if overflow */}
                                <div className="inline-block min-w-full text-center">
                                    <MarkdownRenderer content={`$$ ${step.keyEquation} $$`} />
                                </div>
                            </div>
                        </div>

                        {/* Hint Block (Appears if requested) */}
                        {showHint && hintContent && (
                            <div className="bg-[#12110b] rounded-lg p-5 border-l-4 border-yellow-500 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center gap-2 mb-2">
                                     <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Tutor Tip</span>
                                </div>
                                <div className="text-gray-300 text-xs leading-relaxed italic">
                                    <MarkdownRenderer content={hintContent} />
                                </div>
                            </div>
                        )}

                        {/* Navigation Footer */}
                        <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-6 pb-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                                disabled={isFirst}
                                className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-lg transition-all duration-200 border border-transparent ${
                                    isFirst 
                                        ? 'text-gray-800 cursor-not-allowed' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/10'
                                }`}
                            >
                                <ChevronLeft size={16} />
                                Previous
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                                disabled={isLast}
                                className={`flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-lg transition-all duration-300 border ${
                                    isLast 
                                        ? 'text-gray-800 border-transparent cursor-not-allowed bg-[#0f0f0f]' 
                                        : 'bg-transparent border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 hover:text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] active:scale-95'
                                }`}
                            >
                                Next Step
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {!isActive && (
                    <div className="flex items-center text-xs text-gray-600 mt-2 group-hover:text-blue-400 transition-colors font-bold uppercase tracking-wide pl-1">
                        <span>Show details</span>
                        <ArrowRight size={12} className="ml-1" />
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default StepCard;

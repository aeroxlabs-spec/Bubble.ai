import React, { useRef, useEffect, useState } from 'react';
import { MathStep } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { ArrowRight, Plus, Lightbulb, ListStart, ChevronLeft, ChevronRight, Copy, Check, X } from 'lucide-react';
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
  mode?: 'SOLVER' | 'DRILL';
  nextLabel?: string;
  prevLabel?: string;
}

const StepCard: React.FC<StepCardProps> = ({ 
  step, index, isActive, problemContext, onClick,
  onNext, onPrev, isFirst, isLast, mode = 'SOLVER',
  nextLabel, prevLabel
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
  const [visibleSubSteps, setVisibleSubSteps] = useState(0);

  // Copy State
  const [copied, setCopied] = useState(false);

  // Swipe Refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  // Theme Configuration
  const theme = {
      SOLVER: {
          activeBg: 'bg-[#121212]',
          activeBorder: 'border-blue-500/30',
          activeShadow: 'shadow-blue-900/5',
          numberActive: 'bg-[#1e293b] text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
          breakdownActive: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          breakdownHover: 'hover:text-blue-400 hover:bg-blue-500/5',
          nextBtn: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 hover:text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
          breakdownTitle: 'text-blue-400',
          breakdownNumber: 'text-blue-400 border-blue-500/10 bg-blue-500/5 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
      },
      DRILL: {
          activeBg: 'bg-[#121212]',
          activeBorder: 'border-yellow-500/30',
          activeShadow: 'shadow-yellow-900/5',
          numberActive: 'bg-yellow-900/20 text-yellow-400 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]',
          breakdownActive: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
          breakdownHover: 'hover:text-yellow-400 hover:bg-yellow-500/5',
          nextBtn: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.05)] hover:shadow-[0_0_20px_rgba(234,179,8,0.15)]',
          breakdownTitle: 'text-yellow-400',
          breakdownNumber: 'text-yellow-400 border-yellow-500/10 bg-yellow-500/5 shadow-[0_0_10px_rgba(234,179,8,0.1)]',
      }
  }[mode];

  useEffect(() => {
    if (isActive && cardRef.current) {
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

  useEffect(() => {
    if (showBreakdown && breakdownContent) {
        setVisibleSubSteps(0);
        const interval = setInterval(() => {
            setVisibleSubSteps(prev => {
                if (prev < breakdownContent.length) return prev + 1;
                clearInterval(interval);
                return prev;
            });
        }, 500);
        return () => clearInterval(interval);
    } else {
        setVisibleSubSteps(0);
    }
  }, [showBreakdown, breakdownContent]);

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
    
    if (showHint) {
        setShowHint(false);
        return;
    }

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
      
      if (showBreakdown) {
          setShowBreakdown(false);
          return;
      }

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
    navigator.clipboard.writeText(`$$ ${step.keyEquation} $$`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          ? `${theme.activeBg} ${theme.activeBorder} shadow-lg ${theme.activeShadow}` 
          : 'bg-black border-white/10 hover:border-white/20 hover:bg-[#0a0a0a]'
        }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
            {/* Step Number - Adjusted sizing for mobile */}
            <div className={`flex flex-shrink-0 items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-mono font-bold transition-colors duration-300
                ${isActive 
                    ? theme.numberActive
                    : 'bg-[#1c1c1e] text-gray-500 group-hover:bg-[#2c2c2e] group-hover:text-gray-300'
                }`}>
                {index + 1}
            </div>
            
            <div className="flex-1 min-w-0">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2 gap-4">
                     <div className={`font-medium text-sm truncate transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                        <MarkdownRenderer content={step.title} className="inline-block [&>p]:mb-0 [&>p]:inline" mode={mode} />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                         {/* Breakdown Button */}
                        <button
                            onClick={handleBreakdownClick}
                            disabled={loadingBreakdown}
                            className={`relative w-7 h-7 rounded-md transition-all duration-300 flex items-center justify-center border
                                ${(showBreakdown || loadingBreakdown) 
                                    ? theme.breakdownActive
                                    : `bg-transparent border-transparent text-gray-600 ${theme.breakdownHover}`
                                }`}
                            title="Break down this step"
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Plus 
                                    size={16} 
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
                            className={`relative w-7 h-7 rounded-md transition-all duration-300 flex items-center justify-center border
                                ${(showHint || loadingHint) 
                                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' 
                                    : 'bg-transparent border-transparent text-gray-600 hover:text-yellow-500 hover:bg-yellow-500/10'
                                }`}
                            title="Get a hint"
                        >
                             <div className="absolute inset-0 flex items-center justify-center">
                                <Lightbulb 
                                    size={16} 
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
                <div className={`transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${isActive ? 'max-h-[2500px] opacity-100 mt-3 sm:mt-4' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-4 sm:space-y-5">
                        
                        <div className="text-gray-300 text-sm leading-relaxed">
                            <MarkdownRenderer content={step.explanation} mode={mode} />
                        </div>
                        
                        {showBreakdown && breakdownContent && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-[#0e0e0e] rounded-lg p-3 sm:p-4 border border-white/5">
                                 <div className="flex items-center gap-2 mb-3">
                                     <ListStart size={14} className={theme.breakdownTitle} />
                                     <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.breakdownTitle}`}>Step Breakdown</span>
                                </div>
                                <div className="space-y-4">
                                    {breakdownContent.slice(0, visibleSubSteps).map((subStep, i) => (
                                        <div key={i} className="flex gap-4 text-xs text-gray-400 group/item animate-in fade-in slide-in-from-left-4 duration-500">
                                            <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold border mt-0.5 ${theme.breakdownNumber}`}>
                                                {i + 1}
                                            </div>
                                            <div className="leading-relaxed pt-0.5 w-full">
                                                <MarkdownRenderer content={subStep} className="text-gray-300" mode={mode} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="group/math bg-[#050505] rounded-xl py-5 sm:py-6 px-4 sm:px-5 border border-white/10 font-mono text-lg overflow-x-auto relative shadow-inner flex flex-col justify-center min-h-[4.5rem] hover:border-white/20 transition-colors">
                            <button
                                onClick={handleCopy}
                                className={`absolute top-2 right-2 p-1.5 rounded-md transition-all duration-200 backdrop-blur-sm border ${
                                    copied 
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400 opacity-100' 
                                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10 opacity-0 group-hover/math:opacity-100'
                                }`}
                                title="Copy LaTeX"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>

                            <div className="text-white w-full text-center">
                                <div className="inline-block min-w-full text-center">
                                    <MarkdownRenderer content={`$$ ${step.keyEquation} $$`} mode={mode} />
                                </div>
                            </div>
                        </div>

                        {showHint && hintContent && (
                            <div className="bg-[#12110b] rounded-lg p-4 border-l-4 border-yellow-500 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center gap-2 mb-2">
                                     <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Tutor Tip</span>
                                </div>
                                <div className="text-gray-300 text-xs leading-relaxed italic">
                                    <MarkdownRenderer content={hintContent} mode={mode} />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 sm:pt-5 border-t border-white/5 mt-4 sm:mt-5 pb-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                                disabled={isFirst && !prevLabel}
                                className={`flex items-center gap-2 text-xs font-bold px-3 py-2 sm:px-4 rounded-lg transition-all duration-200 border border-transparent ${
                                    isFirst && !prevLabel
                                        ? 'text-gray-800 cursor-not-allowed' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/10'
                                }`}
                            >
                                {prevLabel === 'Close' ? <X size={14}/> : <ChevronLeft size={14} />}
                                {prevLabel || 'Previous'}
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                                disabled={isLast && !nextLabel}
                                className={`flex items-center gap-2 text-xs font-bold px-3 py-2 sm:px-4 rounded-lg transition-all duration-300 border ${
                                    isLast && !nextLabel
                                        ? 'text-gray-800 border-transparent cursor-not-allowed bg-[#0f0f0f]' 
                                        : `bg-transparent ${theme.nextBtn} active:scale-95`
                                }`}
                            >
                                {nextLabel || 'Next Step'}
                                {nextLabel === 'Close' ? <X size={14} /> : <ChevronRight size={14} />}
                            </button>
                        </div>
                    </div>
                </div>

                {!isActive && (
                    <div className={`flex items-center text-[10px] text-gray-600 mt-2 transition-colors font-bold uppercase tracking-wide pl-1 ${
                        mode === 'DRILL' ? 'group-hover:text-yellow-400' : 'group-hover:text-blue-400'
                    }`}>
                        <span>Show details</span>
                        <ArrowRight size={10} className="ml-1" />
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default StepCard;
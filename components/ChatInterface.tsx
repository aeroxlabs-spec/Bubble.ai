
import React, { useState, useEffect, useRef } from 'react';
import { Send, Pen, ChevronRight, ArrowRightLeft, ScrollText, Zap } from 'lucide-react';
import { ChatMessage, MathSolution, DrillQuestion, AppMode } from '../types';
import { createChatSession } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import { Chat } from '@google/genai';

interface ChatInterfaceProps {
  solution?: MathSolution;
  drillQuestion?: DrillQuestion;
  currentStepIndex: number;
  isOpen: boolean;
  onClose: () => void;
  activeView: 'steps' | 'markscheme';
  mode: AppMode;
}

type ChatScope = 'FULL' | 'STEP';

const TypewriterMessage = ({ text, onComplete, mode }: { text: string, onComplete?: () => void, mode: AppMode }) => {
    const [displayedText, setDisplayedText] = useState('');
    const index = useRef(0);

    useEffect(() => {
        setDisplayedText('');
        index.current = 0;
        
        const intervalId = setInterval(() => {
            if (index.current < text.length) {
                const nextChunk = text.slice(index.current, index.current + 3);
                setDisplayedText((prev) => prev + nextChunk);
                index.current += 3;
            } else {
                setDisplayedText(text);
                clearInterval(intervalId);
                if (onComplete) onComplete();
            }
        }, 10);

        return () => clearInterval(intervalId);
    }, [text]);

    return <MarkdownRenderer content={displayedText} className="prose-sm leading-snug" mode={mode} />;
};


const ChatInterface: React.FC<ChatInterfaceProps> = ({ solution, drillQuestion, currentStepIndex, isOpen, onClose, activeView, mode }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeScope, setActiveScope] = useState<ChatScope>('FULL');
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setHasStarted(false);
    setActiveScope('FULL');
    chatSessionRef.current = null;
  }, [solution, drillQuestion]);

  useEffect(() => {
      if (mode === 'SOLVER' && activeView === 'markscheme') {
          setActiveScope('FULL');
          if (messages.length > 0) {
               setMessages(prev => [...prev, {
                   role: 'model',
                   text: `_Context switched to **Markscheme**. I'll now focus on explaining the grading criteria (M1, A1, R1)._`,
                   timestamp: Date.now()
               }]);
          }
      }
  }, [activeView, mode]);

  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTop = container.scrollHeight;
    }
  }, [messages, isOpen, isLoading]);

  const initializeChat = (scope: ChatScope) => {
    setActiveScope(scope);
    
    let baseContext = "";
    let focusInstruction = "";

    if (mode === 'DRILL' && drillQuestion) {
        baseContext = `
            Drill Context:
            Question: ${drillQuestion.questionText}
            Topic: ${drillQuestion.topic}
            Difficulty: ${drillQuestion.difficultyLevel}/10
            Correct Answer: ${drillQuestion.shortAnswer}
            Solution Steps: ${JSON.stringify(drillQuestion.steps)}
        `;
        focusInstruction = `\nROLE: You are an encouraging Drill Coach.
        CONTEXT: User is practicing a Drill Question (Q${drillQuestion.number}).
        GOAL: Help them solve it WITHOUT giving the answer immediately. Give progressive hints.
        If they are wrong, explain the misconception.`;

    } else if (mode === 'SOLVER' && solution) {
        baseContext = `
          Problem Summary: ${solution.problemSummary}
          Final Answer: ${solution.finalAnswer}
          Full Steps JSON: ${JSON.stringify(solution.steps)}
          ${solution.markscheme ? `Markscheme Content: ${solution.markscheme}` : 'Markscheme not yet loaded.'}
        `;

        if (activeView === 'markscheme') {
            focusInstruction = `\nROLE: You are an expert IB Math AA HL Examiner.
            CONTEXT: The user is viewing the MARKSCHEME tab.
            TASK: Interpret the "Markscheme Content" provided. Explain why marks (M1, A1, R1, AG) are awarded.
            INSTRUCTION: Focus mainly on the grading logic. If the user asks for a solution, show how it earns specific marks based on the scheme.`;
        } else if (scope === 'STEP') {
            const currentStep = solution.steps[currentStepIndex];
            focusInstruction = `\nFOCUS: The user specifically wants help with STEP ${currentStepIndex + 1}: "${currentStep.title}". Prioritize explaining this specific step's logic and equation (${currentStep.keyEquation}).`;
        } else {
            focusInstruction = `\nFOCUS: The user wants help with the entire exercise. Be ready to explain the overall concept or any part of it.`;
        }
    }

    chatSessionRef.current = createChatSession(baseContext + focusInstruction);
    setHasStarted(true);
  };

  const handleSendMessage = async (text?: string) => {
    const msgText = text || inputValue;
    if (!msgText.trim() || isLoading) return;

    if (!chatSessionRef.current) {
        initializeChat(activeScope);
    }
    
    if (!hasStarted) setHasStarted(true);

    const userMsg: ChatMessage = { role: 'user', text: msgText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      let contextPreamble = "";
      
      if (mode === 'DRILL') {
          contextPreamble = `[System: User is asking about the Drill Question.]`;
      } else if (mode === 'SOLVER' && solution) {
          if (activeView === 'markscheme') {
               contextPreamble = `[SYSTEM: User is in MARKSCHEME mode. Reference Markscheme Content.]`;
          } else {
               contextPreamble = activeScope === 'STEP' 
                ? `[User viewing Step ${currentStepIndex + 1}]` 
                : `[User viewing full problem context]`;
          }
      }
      
      if (!chatSessionRef.current) throw new Error("Chat session not initialized");

      const result = await chatSessionRef.current.sendMessage({
        message: `${contextPreamble} ${msgText}`
      });
      
      const responseText = result.text;
      
      setMessages(prev => [...prev, {
        role: 'model',
        text: responseText || "Thinking...",
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "I encountered an error. Please try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleScope = () => {
      if (activeView === 'markscheme' || mode === 'DRILL') return;
      
      const newScope = activeScope === 'FULL' ? 'STEP' : 'FULL';
      initializeChat(newScope);
      setMessages([{
          role: 'model', 
          text: newScope === 'STEP' 
            ? `Switched context to **Step ${currentStepIndex + 1}**. How can I help?` 
            : `Switched context to **Full Problem**. Ask me anything!`,
          timestamp: Date.now()
      }]);
  }

  let suggestions: string[] = [];
  if (mode === 'DRILL') {
      suggestions = ["I'm stuck, give me a hint", "What topic is this?", "Show me the first step"];
  } else if (activeView === 'markscheme') {
      suggestions = ["Explain M1 marks", "Why A1 here?", "Show alternative method"];
  } else {
      suggestions = ["Clarify the logic", "Explain the formula", "Next step?"];
  }

  // UPDATED: Larger dimensions (w-[420px] h-[600px]) for prominence
  return (
    <div 
      className={`fixed bottom-24 right-6 w-[420px] h-[600px] max-h-[75vh] z-40 flex flex-col transition-all duration-300 ease-in-out font-sans
        ${isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
    >
      <div className="absolute inset-0 bg-[#121212] rounded-[1.25rem] border border-white/10 shadow-2xl flex flex-col" />
      
      <div className="relative flex flex-col h-full z-10 overflow-hidden rounded-[1.25rem]">
        
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between border-b border-white/5 bg-[#151515]">
          <div className="flex items-center gap-2">
             <div className={`transition-all duration-500 ease-in-out flex items-center overflow-hidden ${messages.length > 0 ? 'w-5 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4'}`}>
                {mode === 'DRILL' ? <Zap size={16} className="text-yellow-400" /> : <Pen size={16} className="text-blue-400 flex-shrink-0" />}
             </div>
             <span className="text-white font-sans font-bold text-lg tracking-tighter">Bubble.</span>
          </div>
          
          {mode === 'DRILL' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a0a0a] border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]"></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-200">
                      Drill Coach
                  </span>
              </div>
          ) : activeView === 'markscheme' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a0a0a] border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                      Markscheme
                  </span>
              </div>
          ) : (
              <button 
                onClick={toggleScope}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a0a0a] border border-white/10 hover:border-blue-500/30 transition-colors group"
              >
                   <div className={`w-1.5 h-1.5 rounded-full ${activeScope === 'STEP' ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-blue-200 w-16 text-center">
                      {activeScope === 'STEP' ? `Step ${currentStepIndex + 1}` : 'Problem'}
                   </span>
                   <ArrowRightLeft size={10} className="text-gray-600 group-hover:text-blue-400" />
              </button>
          )}
        </div>

        {/* Messages */}
        <div 
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 pb-5 space-y-4 bg-[#0e0e0e] overflow-x-hidden overscroll-contain"
            style={{ scrollBehavior: 'auto' }} 
        >
          {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  
                  <div className="animate-bounce duration-[3000ms] ease-in-out">
                     {mode === 'DRILL' 
                        ? <Zap size={24} className="text-yellow-400 fill-yellow-500/20" /> 
                        : <Pen size={22} className="text-blue-400 transform -rotate-12" />
                     }
                  </div>

                  {!hasStarted ? (
                      mode === 'DRILL' ? (
                          <>
                            <div className="text-center space-y-1">
                                <h3 className="text-lg font-bold text-white tracking-tight">Practice Assistant</h3>
                                <p className="text-gray-500 text-xs px-4">I'm here to coach you through this drill.</p>
                            </div>
                            <div className="w-full px-4">
                                 <button 
                                    onClick={() => initializeChat('FULL')}
                                    className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-yellow-500/5 border border-white/10 hover:border-yellow-500/30 rounded-xl transition-all group text-left shadow-[0_0_15px_rgba(234,179,8,0.05)]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-400 border border-yellow-500/20">
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <div className="text-yellow-200 font-semibold text-sm">Start Coaching</div>
                                            <div className="text-gray-500 text-xs">Hints, tips, & explanations</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-yellow-400 transition-colors" />
                                </button>
                            </div>
                          </>
                      ) : activeView === 'markscheme' ? (
                          <>
                            <div className="text-center space-y-1">
                                <h3 className="text-lg font-bold text-white tracking-tight">Markscheme Mode</h3>
                                <p className="text-gray-500 text-xs px-4">I can help you interpret the marking codes.</p>
                            </div>
                            <div className="w-full px-4">
                                 <button 
                                    onClick={() => initializeChat('FULL')}
                                    className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-blue-500/5 border border-white/10 hover:border-blue-500/30 rounded-xl transition-all group text-left shadow-[0_0_15px_rgba(59,130,246,0.05)]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400 border border-blue-500/20">
                                            <ScrollText size={18} />
                                        </div>
                                        <div>
                                            <div className="text-blue-200 font-semibold text-sm">Start Analysis</div>
                                            <div className="text-gray-500 text-xs">Ask about M1, A1, R1 marks</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                                </button>
                            </div>
                          </>
                      ) : (
                          <>
                            <div className="text-center space-y-1">
                                <h3 className="text-lg font-bold text-white tracking-tight">Focus your session</h3>
                                <p className="text-gray-500 text-xs px-4">Full problem or just the current step?</p>
                            </div>

                            <div className="w-full space-y-3 px-4">
                                <button 
                                    onClick={() => initializeChat('STEP')}
                                    className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-blue-500/5 border border-white/10 hover:border-blue-500/30 rounded-xl transition-all group text-left"
                                >
                                    <div>
                                        <div className="text-blue-400 font-semibold text-sm">Current Step Only</div>
                                        <div className="text-gray-500 text-xs">Deep dive into Step {currentStepIndex + 1}</div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                                </button>

                                <button 
                                    onClick={() => initializeChat('FULL')}
                                    className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-all group text-left"
                                >
                                    <div>
                                        <div className="text-white font-semibold text-sm">Entire Problem</div>
                                        <div className="text-gray-500 text-xs">General questions & concepts</div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                                </button>
                            </div>
                          </>
                      )
                  ) : (
                      <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         <h3 className="text-lg font-bold text-white">I'm ready to help.</h3>
                         <p className="text-gray-500 text-xs px-6 leading-relaxed">
                            {mode === 'DRILL'
                                ? <span>Practice mode active. I'll provide <b>hints</b> without spoiling the answer.</span>
                                : activeView === 'markscheme'
                                    ? <span>Context set to <b>Markscheme</b>. Ask about specific marks or method points.</span>
                                    : activeScope === 'STEP' 
                                        ? <span>Context set to <b>Step {currentStepIndex + 1}</b>. Ask for details, hints, or breakdown.</span>
                                        : <span>Context set to <b>Full Problem</b>. Ask about concepts or the overall strategy.</span>
                            }
                         </p>
                      </div>
                  )}

                  <div className="flex flex-wrap justify-center gap-2 pt-2 px-2">
                      {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleSendMessage(suggestion)}
                            className={`text-[10px] px-3 py-1.5 rounded-full border bg-transparent transition-colors cursor-pointer ${
                                mode === 'DRILL'
                                ? 'text-gray-500 hover:text-yellow-400 border-white/10 hover:border-yellow-500/30'
                                : 'text-gray-500 hover:text-blue-400 border-white/10 hover:border-blue-500/30'
                            }`}
                          >
                              {suggestion}
                          </button>
                      ))}
                  </div>
              </div>
          ) : (
            messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                    msg.role === 'user' 
                    ? (mode === 'DRILL' 
                        ? 'bg-yellow-900/20 border-yellow-500/10 text-yellow-100 rounded-br-sm' 
                        : 'bg-[#1e293b] border-blue-500/10 text-blue-100 rounded-br-sm'
                    ) 
                    : 'bg-[#1c1c1e] text-gray-200 border-white/5 rounded-bl-sm'
                }`}>
                    {msg.role === 'model' ? (
                        (idx === messages.length - 1 && !isLoading) 
                            ? <TypewriterMessage text={msg.text} mode={mode} /> 
                            : <MarkdownRenderer content={msg.text} className="prose-sm leading-snug" mode={mode} />
                    ) : (
                        <p>{msg.text}</p>
                    )}
                </div>
                </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#1c1c1e] px-4 py-3 rounded-2xl rounded-bl-sm border border-white/5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse delay-100" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse delay-200" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-[#151515] border-t border-white/5 flex flex-col p-3">
          <div className={`flex items-center gap-2 bg-[#0a0a0a] rounded-full border border-white/10 transition-colors ${
              mode === 'DRILL' 
              ? 'focus-within:border-yellow-500/30 shadow-none'
              : 'focus-within:border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
          }`}>
              <input
              type="text"
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-200 placeholder:text-gray-600 px-4 py-3"
              placeholder={hasStarted ? "Ask a follow-up..." : "Select an option..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className={`p-2 mr-1 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent ${
                  mode === 'DRILL' 
                  ? 'text-yellow-400 hover:bg-yellow-500/10' 
                  : 'text-blue-400 hover:bg-blue-500/10'
              }`}
              >
              <Send size={16} />
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

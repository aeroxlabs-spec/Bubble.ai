
import React, { useState, useEffect, useRef } from 'react';
import { Send, Pen, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { ChatMessage, MathSolution } from '../types';
import { createChatSession } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import { Chat } from '@google/genai';

interface ChatInterfaceProps {
  solution: MathSolution;
  currentStepIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

type ChatScope = 'FULL' | 'STEP';

// Typewriter component for the typing effect
const TypewriterMessage = ({ text, onComplete }: { text: string, onComplete?: () => void }) => {
    const [displayedText, setDisplayedText] = useState('');
    const index = useRef(0);

    useEffect(() => {
        setDisplayedText('');
        index.current = 0;
        
        const intervalId = setInterval(() => {
            if (index.current < text.length) {
                // Add chunks of characters for faster typing feeling
                const nextChunk = text.slice(index.current, index.current + 3);
                setDisplayedText((prev) => prev + nextChunk);
                index.current += 3;
            } else {
                setDisplayedText(text); // Ensure full text matches
                clearInterval(intervalId);
                if (onComplete) onComplete();
            }
        }, 10); // Speed of typing

        return () => clearInterval(intervalId);
    }, [text]);

    return <MarkdownRenderer content={displayedText} className="prose-sm" />;
};


const ChatInterface: React.FC<ChatInterfaceProps> = ({ solution, currentStepIndex, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeScope, setActiveScope] = useState<ChatScope>('FULL');
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // If the user switches solutions, reset state completely
  useEffect(() => {
    setMessages([]);
    setHasStarted(false);
    setActiveScope('FULL');
    chatSessionRef.current = null;
  }, [solution]);

  // Handle auto-scroll with direct manipulation for better robustness
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTop = container.scrollHeight;
    }
  }, [messages, isOpen, isLoading]);

  const initializeChat = (scope: ChatScope) => {
    setActiveScope(scope);
    const baseContext = `
      Problem Summary: ${solution.problemSummary}
      Final Answer: ${solution.finalAnswer}
      Full Steps JSON: ${JSON.stringify(solution.steps)}
    `;

    let focusInstruction = "";
    if (scope === 'STEP') {
        const currentStep = solution.steps[currentStepIndex];
        focusInstruction = `\nFOCUS: The user specifically wants help with STEP ${currentStepIndex + 1}: "${currentStep.title}". Prioritize explaining this specific step's logic and equation (${currentStep.keyEquation}).`;
    } else {
        focusInstruction = `\nFOCUS: The user wants help with the entire exercise. Be ready to explain the overall concept or any part of it.`;
    }

    chatSessionRef.current = createChatSession(baseContext + focusInstruction);
    setHasStarted(true);
  };

  const handleSendMessage = async (text?: string) => {
    const msgText = text || inputValue;
    if (!msgText.trim() || isLoading) return;

    // Lazy initialization if user types without clicking a scope button first
    if (!chatSessionRef.current) {
        initializeChat(activeScope);
    }
    
    if (!hasStarted) setHasStarted(true);

    const userMsg: ChatMessage = { role: 'user', text: msgText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const currentStep = solution.steps[currentStepIndex];
      const contextPreamble = activeScope === 'STEP' 
        ? `[User viewing Step ${currentStepIndex + 1}: ${currentStep.title}]` 
        : `[User viewing full problem context]`;
      
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
      const newScope = activeScope === 'FULL' ? 'STEP' : 'FULL';
      initializeChat(newScope);
      // Clear history when switching scope manually to avoid confusion
      setMessages([{
          role: 'model', 
          text: newScope === 'STEP' 
            ? `Switched context to **Step ${currentStepIndex + 1}**. How can I help?` 
            : `Switched context to **Full Problem**. Ask me anything!`,
          timestamp: Date.now()
      }]);
  }

  const suggestions = ["Clarify the logic", "Explain the formula", "Next step?"];

  return (
    <div 
      className={`fixed bottom-28 right-8 w-[380px] h-[550px] max-h-[70vh] z-40 flex flex-col transition-all duration-300 ease-in-out font-sans
        ${isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[#121212] rounded-[1.5rem] border border-white/10 shadow-xl flex flex-col" />
      
      <div className="relative flex flex-col h-full z-10 overflow-hidden rounded-[1.5rem]">
        
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 flex items-center justify-between border-b border-white/5 bg-[#151515]">
          <div className="flex items-center gap-2">
             {/* Animated Pencil - Only visible when messages exist, simulating movement from center */}
             <div className={`transition-all duration-500 ease-in-out flex items-center overflow-hidden ${messages.length > 0 ? 'w-6 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4'}`}>
                <Pen size={16} className="text-blue-400 flex-shrink-0" />
             </div>
             <span className="text-white font-sans font-bold text-lg tracking-tighter">Bubble.</span>
          </div>
          
          {/* Context Switch */}
          <button 
            onClick={toggleScope}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0a0a0a] border border-white/10 hover:border-blue-500/30 transition-colors group"
          >
               <div className={`w-1.5 h-1.5 rounded-full ${activeScope === 'STEP' ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
               <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-blue-200 w-16 text-center">
                  {activeScope === 'STEP' ? `Step ${currentStepIndex + 1}` : 'Problem'}
               </span>
               <ArrowRightLeft size={10} className="text-gray-600 group-hover:text-blue-400" />
          </button>
        </div>

        {/* Messages */}
        <div 
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto p-5 pb-6 space-y-5 bg-[#0e0e0e] overflow-x-hidden overscroll-contain"
            style={{ scrollBehavior: 'auto' }} 
        >
          {/* Empty State / Initial Selection View */}
          {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  
                  {/* Central Pencil Icon - The "Initial" State */}
                  {/* Reduced size to 20 per user request */}
                  <div className="animate-bounce duration-[3000ms] ease-in-out">
                     <Pen size={20} className="text-blue-400 transform -rotate-12" />
                  </div>

                  {!hasStarted ? (
                      // 1. Initial Mode Selection
                      <>
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-bold text-white tracking-tight">Focus your session</h3>
                            <p className="text-gray-500 text-xs px-4">Do you need help with the full problem or just the current step?</p>
                        </div>

                        <div className="w-full space-y-3 px-2">
                            <button 
                                onClick={() => initializeChat('STEP')}
                                className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-blue-500/5 border border-white/10 hover:border-blue-500/30 rounded-xl transition-all group text-left"
                            >
                                <div>
                                    <div className="text-blue-400 font-semibold text-sm">Current Step Only</div>
                                    <div className="text-gray-500 text-[11px]">Deep dive into Step {currentStepIndex + 1}</div>
                                </div>
                                <ChevronRight size={16} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                            </button>

                            <button 
                                onClick={() => initializeChat('FULL')}
                                className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-all group text-left"
                            >
                                <div>
                                    <div className="text-white font-semibold text-sm">Entire Problem</div>
                                    <div className="text-gray-500 text-[11px]">General questions & concepts</div>
                                </div>
                                <ChevronRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                            </button>
                        </div>
                      </>
                  ) : (
                      // 2. Mode Selected but no messages yet
                      <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         <h3 className="text-lg font-bold text-white">I'm ready to help.</h3>
                         <p className="text-gray-500 text-xs px-8 leading-relaxed">
                            {activeScope === 'STEP' 
                                ? <span>Context set to <b>Step {currentStepIndex + 1}</b>. Ask for details, hints, or breakdown.</span>
                                : <span>Context set to <b>Full Problem</b>. Ask about concepts or the overall strategy.</span>
                            }
                         </p>
                      </div>
                  )}

                  {/* Suggestions - Always visible when empty */}
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                      {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleSendMessage(suggestion)}
                            className="text-[10px] text-gray-500 hover:text-blue-400 px-3 py-1.5 rounded-full border border-white/10 hover:border-blue-500/30 bg-transparent transition-colors cursor-pointer"
                          >
                              {suggestion}
                          </button>
                      ))}
                  </div>
              </div>
          ) : (
            // Message List
            messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm border ${
                    msg.role === 'user' 
                    ? 'bg-[#1e293b] border-blue-500/10 text-blue-100 rounded-br-sm' 
                    : 'bg-[#1c1c1e] text-gray-200 border-white/5 rounded-bl-sm'
                }`}>
                    {msg.role === 'model' ? (
                        // Use Typewriter effect for the latest model message, static for older ones
                        (idx === messages.length - 1 && !isLoading) 
                            ? <TypewriterMessage text={msg.text} /> 
                            : <MarkdownRenderer content={msg.text} className="prose-sm" />
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
        <div className="flex-shrink-0 bg-[#151515] border-t border-white/5 flex flex-col p-4">
          <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-full border border-white/10 focus-within:border-blue-500/30 transition-colors">
              <input
              type="text"
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-200 placeholder:text-gray-600 px-5 py-3"
              placeholder={hasStarted ? "Ask a follow-up..." : "Select an option..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="p-2 mr-2 text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
              >
              <Send size={18} />
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

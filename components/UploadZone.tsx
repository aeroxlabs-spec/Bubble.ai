
import React, { useRef, useState } from 'react';
import { X, Image as ImageIcon, Type as TypeIcon, Plus, Pen, Sigma, Divide, Minus, Lightbulb, Percent, Hash, FileText, GraduationCap } from 'lucide-react';
import { UserInput, AppMode } from '../types';

interface UploadZoneProps {
  uploads: UserInput[];
  onUpload: (input: UserInput) => void;
  onRemove: (id: string) => void;
  onFirstInteraction?: () => void;
  appMode?: AppMode;
}

const TypewriterLabel = ({ text }: { text: string }) => {
    const [displayText, setDisplayText] = useState('');
    const [index, setIndex] = useState(0);

    React.useEffect(() => {
        setDisplayText('');
        setIndex(0);
    }, [text]);

    React.useEffect(() => {
        if (index < text.length) {
            const timeout = setTimeout(() => {
                setDisplayText(prev => prev + text.charAt(index));
                setIndex(prev => prev + 1);
            }, 40); 
            return () => clearTimeout(timeout);
        }
    }, [index, text]);

    return (
        <span className="font-mono text-sm font-medium text-blue-300 tracking-wide drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">
            {displayText}
            <span className="animate-pulse ml-0.5 opacity-80">|</span>
        </span>
    );
};

const UploadZone: React.FC<UploadZoneProps> = ({ uploads, onUpload, onRemove, onFirstInteraction, appMode = 'SOLVER' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [inputText, setInputText] = useState('');
  const [hasHovered, setHasHovered] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_UPLOADS = 5; 

  const handleMouseEnter = () => {
      if (!hasHovered) {
          onFirstInteraction?.();
          // Added 500ms delay before triggering the falling animation
          setTimeout(() => {
            setHasHovered(true);
          }, 500);
      }
  };

  const processFile = (file: File) => {
    if (uploads.length >= MAX_UPLOADS) {
        alert(`Maximum ${MAX_UPLOADS} uploads allowed.`);
        return;
    }
    
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (appMode === 'SOLVER' && !isImage) {
        alert("Please upload an image file for the Solver.");
        return;
    }
    
    if (appMode === 'EXAM' && !isImage && !isPdf) {
         if (!file.type.startsWith('text/')) {
             alert("Supported formats: Images (PNG/JPG) or PDF.");
         }
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      
      onUpload({
          id: crypto.randomUUID(),
          type: isImage ? 'image' : (isPdf ? 'pdf' : 'text'),
          content: isImage || isPdf ? base64Data : (reader.result as string), 
          mimeType: file.type,
          preview: isImage ? base64String : file.name,
          fileName: file.name
      });
    };
    
    if (isImage || isPdf) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
  };

  const handleFiles = (fileList: FileList | null) => {
      if (!fileList) return;
      Array.from(fileList).forEach(file => {
          processFile(file);
      });
  }

  const handleTextSubmit = () => {
      if (!inputText.trim()) return;
      if (uploads.length >= MAX_UPLOADS) {
          alert(`Maximum ${MAX_UPLOADS} uploads allowed.`);
          return;
      }
      
      onUpload({
          id: crypto.randomUUID(),
          type: 'text',
          content: inputText.trim(),
          mimeType: 'text/plain',
          preview: inputText.trim()
      });
      setInputText('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
              const file = items[i].getAsFile();
              if (file) {
                  processFile(file);
                  e.preventDefault(); 
              }
          }
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleTextSubmit();
      }
  }

  // Configuration for falling icons - Increased InitialX spread for better separation
  const icons = [
    { Icon: Sigma, color: 'text-red-400', x: -60, r: -145, delay: 0, duration: 2.2, initialX: -40 },
    { Icon: Divide, color: 'text-orange-400', x: 40, r: 80, delay: 0.1, duration: 2.1, initialX: 35 },
    { Icon: Minus, color: 'text-yellow-400', x: -25, r: -15, delay: 0.2, duration: 2.4, initialX: -15 },
    { Icon: Lightbulb, color: 'text-green-400', x: 85, r: 160, delay: 0.05, duration: 2.3, initialX: 55 },
    { Icon: Pen, color: 'text-blue-400', x: -100, r: -90, delay: 0.15, duration: 2.5, initialX: -55 },
    { Icon: Percent, color: 'text-purple-400', x: 20, r: 45, delay: 0.25, duration: 2.6, initialX: 10 },
    { Icon: Hash, color: 'text-pink-400', x: 120, r: 200, delay: 0.1, duration: 2.2, initialX: 8 },
    { Icon: GraduationCap, color: 'text-indigo-400', x: 50, r: -45, delay: 0.3, duration: 2.5, initialX: 25 },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 relative">
        
        {/* Uploaded Cards Row */}
        {uploads.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {uploads.map((upload, index) => (
                    <div 
                        key={upload.id} 
                        className="relative group w-20 h-20 rounded-xl border border-white/20 bg-[#111] overflow-hidden shadow-lg transition-transform hover:scale-105"
                    >
                        {upload.type === 'image' ? (
                            <img 
                                src={upload.preview} 
                                alt={`Upload ${index + 1}`} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100" 
                            />
                        ) : upload.type === 'pdf' ? (
                             <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-[#1a1a1a] gap-1">
                                <FileText size={24} className="text-red-400" />
                                <span className="text-[8px] text-gray-400 font-mono leading-tight text-center truncate w-full px-1">
                                    {upload.fileName || "PDF"}
                                </span>
                            </div>
                        ) : (
                            <div className="w-full h-full p-2 flex items-center justify-center bg-[#1a1a1a]">
                                <span className="text-[8px] text-gray-400 font-mono leading-tight line-clamp-4 break-words text-center">
                                    {upload.preview}
                                </span>
                            </div>
                        )}
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        
                        <button
                            onClick={() => onRemove(upload.id)}
                            className="absolute top-1 right-1 p-1 bg-black/60 text-white hover:bg-red-500/80 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <X size={10} />
                        </button>
                        
                        <div className="absolute bottom-1 left-0 right-0 text-center flex items-center justify-center gap-1">
                             {upload.type === 'image' && <ImageIcon size={8} className="text-blue-400"/>}
                             {upload.type === 'text' && <TypeIcon size={8} className="text-green-400"/>}
                             {upload.type === 'pdf' && <FileText size={8} className="text-red-400"/>}
                             <span className="text-[9px] font-bold text-gray-300">#{index + 1}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Wrapper for Input Box and Falling Icons */}
        <div className="relative">
            {/* Input Area */}
            {uploads.length < MAX_UPLOADS ? (
                <div 
                    className={`relative z-10 group bg-[#0a0a0a] rounded-2xl transition-all duration-300 overflow-hidden flex flex-col
                        ${isDragging 
                            ? appMode === 'EXAM'
                                ? 'border-[3px] border-dashed border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.15)] animate-[pulse_2s_ease-in-out_infinite]' 
                                : 'border-[3px] border-dashed border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.15)] animate-[pulse_2s_ease-in-out_infinite]'
                            : 'border border-white/10 hover:border-white/20 shadow-xl'
                        }
                    `}
                    onMouseEnter={handleMouseEnter}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    {/* Drag Overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-20 bg-[#0a0a0a]/95 flex flex-col items-center justify-center animate-in fade-in duration-200">
                            {/* Color Bar based on Mode */}
                            <div className={`w-20 h-0.5 rounded-full blur-[2px] mb-8 animate-pulse ${
                                appMode === 'EXAM' 
                                ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,1)]' 
                                : 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)]'
                            }`} />
                            
                            {/* Icon based on Mode */}
                            <div className="animate-[bounce_1s_infinite] mb-6">
                                {appMode === 'EXAM' ? (
                                     <GraduationCap 
                                        size={22} 
                                        className="text-purple-400 transform -rotate-12 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] fill-purple-500/10" 
                                     />
                                ) : (
                                    <Pen 
                                        size={22} 
                                        className="text-blue-400 transform -rotate-12 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] fill-blue-500/10" 
                                    />
                                )}
                            </div>
                            <TypewriterLabel text="Release to upload..." />
                        </div>
                    )}

                    {/* Input Controls */}
                    <div className="p-4">
                        <textarea
                            ref={textareaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={handleKeyDown}
                            placeholder={appMode === 'SOLVER' 
                                ? "Type a math problem here, or paste an image (Ctrl+V)..." 
                                : "Type instructions, or paste notes/images..."}
                            className="w-full bg-transparent border-none outline-none text-gray-200 placeholder:text-gray-600 text-sm font-medium resize-none min-h-[80px]"
                        />
                    </div>

                    {/* Footer Toolbar */}
                    <div className="px-4 py-3 bg-[#111] border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-xs font-medium border border-white/5 hover:border-white/10"
                                title="Upload File"
                            >
                                <ImageIcon size={14} />
                                <span>{appMode === 'EXAM' ? 'Files' : 'Image'}</span>
                            </button>
                        </div>

                        <button
                            onClick={handleTextSubmit}
                            disabled={!inputText.trim()}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border
                                ${inputText.trim() 
                                    ? 'bg-transparent border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]' 
                                    : 'bg-transparent border-white/5 text-gray-600 cursor-not-allowed'
                                }
                            `}
                        >
                            <span>Add</span>
                            <Plus size={14} />
                        </button>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple 
                        accept={appMode === 'EXAM' ? "image/*,application/pdf" : "image/*"}
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                </div>
            ) : (
                <div className="p-6 rounded-xl border border-dashed border-white/10 bg-[#0a0a0a] text-center z-10 relative">
                    <p className="text-gray-500 text-sm">Limit of {MAX_UPLOADS} uploads reached.</p>
                </div>
            )}

            {/* Icons Layer - Behind Input Box (z-0) */}
            <div className="absolute bottom-0 left-0 right-0 h-0 flex justify-center z-0 pointer-events-none overflow-visible">
                {icons.map((icon, i) => (
                    <div
                        key={i}
                        className={`absolute ${icon.color}`}
                        style={{
                            // Wider spread based on initialX
                            left: `calc(50% + ${icon.initialX}px)`,
                            bottom: '10px', 
                            opacity: 0,
                            '--fall-x': `${icon.x}px`,
                            '--fall-r': `${icon.r}deg`,
                            // Ease-in for natural gravity acceleration
                            animation: hasHovered 
                                ? `fall-gravity ${icon.duration}s cubic-bezier(0.42, 0, 1, 1) forwards` 
                                : 'none',
                            animationDelay: `${icon.delay}s`
                        } as React.CSSProperties}
                    >
                        <icon.Icon size={28} className="drop-shadow-lg" />
                    </div>
                ))}
            </div>
        </div>

        {/* Discrete Helper Text */}
        {uploads.length < MAX_UPLOADS && (
            <div className="flex justify-end px-2 -mt-2">
                 <p className="text-[10px] text-gray-600 font-mono tracking-tight opacity-60 hover:opacity-100 transition-opacity cursor-default">
                    {appMode === 'EXAM' ? "Drag & Drop Multiple Files" : "Drag & Drop Image"}
                 </p>
            </div>
        )}
        
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes fall-gravity {
                0% {
                    transform: translate(-50%, 0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translate(calc(-50% + var(--fall-x)), 80vh) rotate(var(--fall-r));
                    opacity: 0;
                }
            }
        `}} />
    </div>
  );
};

export default UploadZone;


import React, { useRef, useState, useEffect } from 'react';
import { X, Image as ImageIcon, Type as TypeIcon, Plus, Clipboard, Pen } from 'lucide-react';
import { UserInput } from '../types';

interface UploadZoneProps {
  uploads: UserInput[];
  onUpload: (input: UserInput) => void;
  onRemove: (id: string) => void;
}

const TypewriterLabel = ({ text }: { text: string }) => {
    const [displayText, setDisplayText] = useState('');
    const [index, setIndex] = useState(0);

    useEffect(() => {
        setDisplayText('');
        setIndex(0);
    }, [text]);

    useEffect(() => {
        if (index < text.length) {
            const timeout = setTimeout(() => {
                setDisplayText(prev => prev + text.charAt(index));
                setIndex(prev => prev + 1);
            }, 40); // Slightly faster typing
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

const UploadZone: React.FC<UploadZoneProps> = ({ uploads, onUpload, onRemove }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_UPLOADS = 3;

  const processFile = (file: File) => {
    if (uploads.length >= MAX_UPLOADS) {
        alert("Maximum 3 problems allowed.");
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert("Please upload an image file.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      
      onUpload({
          id: crypto.randomUUID(),
          type: 'image',
          content: base64Data,
          mimeType: file.type,
          preview: base64String
      });
    };
    reader.readAsDataURL(file);
  };

  const handleTextSubmit = () => {
      if (!inputText.trim()) return;
      if (uploads.length >= MAX_UPLOADS) {
          alert("Maximum 3 problems allowed.");
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
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      let handledImage = false;

      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
              const file = items[i].getAsFile();
              if (file) {
                  processFile(file);
                  handledImage = true;
                  e.preventDefault(); // Prevent pasting image name into text area
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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
        
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
                                alt={`Problem ${index + 1}`} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100" 
                            />
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
                            className="absolute top-1 right-1 p-1 bg-black/60 text-white hover:bg-red-500/80 rounded-full backdrop-blur-md transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <X size={10} />
                        </button>
                        
                        <div className="absolute bottom-1 left-0 right-0 text-center flex items-center justify-center gap-1">
                             {upload.type === 'image' ? <ImageIcon size={8} className="text-blue-400"/> : <TypeIcon size={8} className="text-green-400"/>}
                             <span className="text-[9px] font-bold text-gray-300">P{index + 1}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Unified Input Area */}
        {uploads.length < MAX_UPLOADS ? (
            <div 
                className={`relative group bg-[#0a0a0a] rounded-2xl transition-all duration-300 overflow-hidden flex flex-col
                    ${isDragging 
                        ? 'border-[3px] border-dashed border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.15)] animate-[pulse_2s_ease-in-out_infinite]' 
                        : 'border border-white/10 hover:border-white/20 shadow-xl'
                    }
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-20 bg-[#0a0a0a]/90 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-200">
                        
                        {/* Non-icon element: Glowing Orb/Line */}
                        <div className="w-20 h-0.5 bg-blue-500 rounded-full blur-[2px] mb-8 shadow-[0_0_15px_rgba(59,130,246,1)] animate-pulse" />

                        {/* Lively Pencil without background shape */}
                        <div className="animate-[bounce_1s_infinite] mb-6">
                             <Pen 
                                size={22} 
                                className="text-blue-400 transform -rotate-12 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] fill-blue-500/10" 
                             />
                        </div>
                        
                        {/* Typewriter Text */}
                        <TypewriterLabel text="Release to analyze..." />
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
                        placeholder="Type a math problem here, or paste an image (Ctrl+V)..."
                        className="w-full bg-transparent border-none outline-none text-gray-200 placeholder:text-gray-600 text-sm font-medium resize-none min-h-[80px]"
                    />
                </div>

                {/* Footer Toolbar */}
                <div className="px-4 py-3 bg-[#111] border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-xs font-medium border border-white/5 hover:border-white/10"
                            title="Upload Image"
                        >
                            <ImageIcon size={14} />
                            <span>Image</span>
                        </button>
                        <span className="text-[10px] text-gray-600 font-mono hidden sm:inline-block ml-3">
                            Drag & drop supported
                        </span>
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
                        <span>Add Problem</span>
                        <Plus size={14} />
                    </button>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
            </div>
        ) : (
             <div className="p-6 rounded-xl border border-dashed border-white/10 bg-[#0a0a0a] text-center">
                 <p className="text-gray-500 text-sm">Limit of {MAX_UPLOADS} problems reached.</p>
             </div>
        )}
        
        {/* Helper Text */}
        <div className="flex items-center justify-center gap-6 text-[10px] text-gray-600 font-mono uppercase tracking-wider">
             <span className="flex items-center gap-1.5">
                 <Clipboard size={10} /> Paste Enabled
             </span>
             <span className="flex items-center gap-1.5">
                 <ImageIcon size={10} /> PNG / JPG
             </span>
        </div>
    </div>
  );
};

export default UploadZone;

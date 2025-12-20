import React, { useState } from 'react';
import { ExamPaper } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import VisualContainer from './VisualContainer';
import { Clock, Download, CheckCircle2, Calculator, Lightbulb, ListStart, Copy, Check, Layers } from 'lucide-react';

interface ExamViewerProps {
    exam: ExamPaper;
}

const ExamViewer: React.FC<ExamViewerProps> = ({ exam }) => {
    const [openAnswers, setOpenAnswers] = useState<Set<string>>(new Set());
    const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
    const [openSolSteps, setOpenSolSteps] = useState<Set<string>>(new Set());
    const [activeHints, setActiveHints] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const toggleSet = (id: string, set: Set<string>, setFunction: React.Dispatch<React.SetStateAction<Set<string>>>) => {
        setFunction(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    const handleDownload = (type: 'PAPER' | 'MARKSCHEME') => {
        const elementId = type === 'PAPER' ? 'offscreen-exam-paper' : 'offscreen-markscheme';
        const element = document.getElementById(elementId);
        if (!element || !(window as any).html2pdf) return;
        const opt = {
            margin: 0.5,
            filename: type === 'PAPER' ? `${exam.title.replace(/\s+/g, '_')}_Paper.pdf` : `${exam.title.replace(/\s+/g, '_')}_Markscheme.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        (window as any).html2pdf().set(opt).from(element).save();
    };

    const normalizeMarkdown = (text: string) => {
        if (!text || text === 'null') return "";
        return text.replace(/\\n/g, '\n').replace(/\n/g, '\n\n');
    };

    const normalizeMarkscheme = (text: string) => {
        if (!text || text === 'null') return "";
        let clean = text.replace(/\*\*/g, ''); 
        clean = clean.replace(/\$\$/g, '$');
        clean = clean.replace(/\\n/g, '\n');
        clean = clean.replace(/<br\s*\/?>/gi, ' ');
        const lines = clean.split('\n');
        const mergedLines: string[] = [];
        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed.startsWith('|')) {
                const fixedLine = trimmed.replace(/\|\|/g, '| |');
                mergedLines.push(fixedLine);
            } else {
                if (mergedLines.length > 0) mergedLines[mergedLines.length - 1] += ' ' + trimmed;
                else mergedLines.push(trimmed);
            }
        });
        return '\n\n' + mergedLines.join('\n');
    };

    const QuestionBodyRenderer = ({ text }: { text: string }) => {
        const normalizedText = text.replace(/\\n/g, '\n');
        const blocks = normalizedText.split(/\n\n+/).filter(b => b.trim());
        const parts = [];
        let preamble = [];
        let foundFirstPart = false;
        const marksRegex = /\s*(\*\*\[\d+\]\*\*|\[\d+\])\s*$/;
        const partStartRegex = /^(\([a-z]+\)|\([iv]+\))/i;
        for (const block of blocks) {
            const hasMarks = marksRegex.test(block);
            const startsWithPart = partStartRegex.test(block);
            if (hasMarks || startsWithPart || foundFirstPart) {
                foundFirstPart = true;
                const match = block.match(marksRegex);
                let marks = '';
                let content = block;
                if (match) {
                    marks = match[1];
                    content = block.replace(marksRegex, '').trim();
                    marks = marks.replace(/\*\*/g, '');
                }
                parts.push({ content, marks });
            } else preamble.push(block);
        }
        return (
            <div className="space-y-6 w-full">
                {preamble.length > 0 && (
                    <div className="text-gray-200 leading-relaxed font-serif text-base">
                        <MarkdownRenderer content={preamble.join('\n\n')} mode="EXAM" />
                    </div>
                )}
                {parts.length > 0 && (
                    <div className="space-y-4 w-full">
                        {parts.map((part, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-8 w-full group/part">
                                <div className="flex-1 min-w-0 text-gray-200 leading-relaxed font-serif text-base pt-0.5">
                                     <MarkdownRenderer content={part.content} mode="EXAM" />
                                </div>
                                {part.marks && (
                                    <div className="flex-shrink-0 pt-0.5">
                                        <span className="text-white font-normal font-sans text-sm select-none">
                                            {part.marks}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between bg-[#121212]/80 backdrop-blur-md p-4 rounded-xl border border-white/10 sticky top-20 z-30 shadow-2xl">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-white hidden sm:block truncate max-w-[200px]">{exam.title}</h2>
                    <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                        <Clock size={12} />
                        <span>{exam.duration}m</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleDownload('PAPER')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/50 text-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:bg-purple-500/10 text-xs font-bold transition-all bg-transparent"
                    >
                        <Download size={14} /> Print Paper
                    </button>
                    <button 
                        onClick={() => handleDownload('MARKSCHEME')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 text-xs font-bold transition-all bg-transparent"
                    >
                        <ListStart size={14} /> Markscheme
                    </button>
                </div>
            </div>

            <div className="space-y-12">
                {exam.sections.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-6">
                        <div className="flex items-center gap-4 border-b border-white/10 pb-2">
                             <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                             <h3 className="text-lg font-bold text-gray-200 uppercase tracking-widest">{section.title}</h3>
                        </div>

                        {section.questions.map((q) => (
                            <div key={q.id} className="bg-[#0f0f0f] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors shadow-lg group">
                                <div className="bg-[#161616] px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/5">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-mono font-bold text-white">Q{q.number}</span>
                                        <span className="text-xs text-purple-200 font-bold px-3 py-1 rounded bg-purple-500/10 border border-purple-500/30 shadow-[0_0_5px_rgba(168,85,247,0.1)]">
                                            {q.marks} Marks
                                        </span>
                                        {q.calculatorAllowed ? (
                                            <div title="Calculator Allowed" className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold opacity-70">
                                                <Calculator size={10} /> CALC
                                            </div>
                                        ) : (
                                            <div title="No Calculator" className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold opacity-70">
                                                <Calculator size={10} /> NO CALC
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => handleCopy(q.questionText, q.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-500 hover:text-white rounded bg-white/5 hover:bg-white/10"
                                        title="Copy Question"
                                    >
                                        {copiedId === q.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                    </button>
                                </div>

                                <div className="p-5 sm:p-8">
                                    {/* Locked Schema Grid for Question and Visual */}
                                    <div className={`grid gap-8 ${q.visualMetadata ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                                        <QuestionBodyRenderer text={q.questionText} />
                                        {q.visualMetadata && (
                                            <div className="flex flex-col gap-4">
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2">
                                                    <Layers size={12} /> Question Diagram
                                                </div>
                                                <VisualContainer metadata={q.visualMetadata} />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {q.graphSvg && (
                                        <div className="mt-8 flex justify-center">
                                            <div className="bg-black border border-white/10 rounded-lg p-4 max-w-[500px] w-full shadow-inner" 
                                                 dangerouslySetInnerHTML={{ __html: q.graphSvg }} 
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="bg-[#0a0a0a] border-t border-white/5 p-4 flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button 
                                            onClick={() => toggleSet(q.id, openSolSteps, setOpenSolSteps)}
                                            className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5"
                                        >
                                            <Layers size={12} />
                                            {openSolSteps.has(q.id) ? 'Hide Steps' : 'Solution Steps'}
                                        </button>
                                        <div className="h-3 w-px bg-white/10 hidden sm:block" />
                                        <button 
                                            onClick={() => toggleSet(q.id, openAnswers, setOpenAnswers)}
                                            className="text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 size={12} />
                                            {openAnswers.has(q.id) ? 'Hide Answer' : 'Show Answer'}
                                        </button>
                                        <div className="h-3 w-px bg-white/10 hidden sm:block" />
                                        <button 
                                            onClick={() => toggleSet(q.id, openSteps, setOpenSteps)}
                                            className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5"
                                        >
                                            <ListStart size={12} />
                                            {openSteps.has(q.id) ? 'Hide Markscheme' : 'View Markscheme'}
                                        </button>
                                        <div className="flex-1" />
                                        {q.hint && (
                                            <button 
                                                onClick={() => toggleSet(q.id, activeHints, setActiveHints)}
                                                className={`p-1.5 rounded-md transition-colors ${activeHints.has(q.id) ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-600 hover:text-yellow-400'}`}
                                                title="Hint"
                                            >
                                                <Lightbulb size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3 mt-1">
                                        {openSolSteps.has(q.id) && q.steps && (
                                            <div className="animate-in slide-in-from-top-2 fade-in duration-200 bg-[#121212] border border-blue-500/20 rounded-lg p-4">
                                                <div className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-3 flex items-center gap-2">
                                                    <Layers size={10} /> Solution Logic
                                                </div>
                                                <ul className="space-y-2">
                                                    {q.steps.map((step, idx) => (
                                                        <li key={idx} className="flex gap-3 text-sm text-gray-300">
                                                            <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center bg-blue-500/10 text-blue-400 text-[10px] font-bold mt-0.5">{idx + 1}</span>
                                                            <span className="leading-relaxed"><MarkdownRenderer content={normalizeMarkdown(step)} mode="EXAM" /></span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {openAnswers.has(q.id) && (
                                            <div className="animate-in slide-in-from-top-2 fade-in duration-200 bg-[#121212] border border-gray-700/30 rounded-lg p-3">
                                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Final Answer</div>
                                                <div className="text-gray-300 font-mono text-sm">
                                                    <MarkdownRenderer content={normalizeMarkdown(q.shortAnswer)} mode="EXAM" />
                                                </div>
                                            </div>
                                        )}
                                        {activeHints.has(q.id) && q.hint && (
                                            <div className="animate-in slide-in-from-top-2 fade-in duration-200 bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-3">
                                                <div className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold mb-1 flex items-center gap-1"><Lightbulb size={10}/> Hint</div>
                                                <div className="text-gray-300 text-sm italic">
                                                    <MarkdownRenderer content={q.hint} mode="EXAM" />
                                                </div>
                                            </div>
                                        )}
                                        {openSteps.has(q.id) && (
                                            <div className="animate-in slide-in-from-top-2 fade-in duration-300 bg-[#121212] border border-purple-500/20 rounded-lg p-4">
                                                <div className="text-[10px] uppercase tracking-widest text-purple-500 font-bold mb-2">Detailed Markscheme</div>
                                                <div className="text-gray-300 text-sm">
                                                    <MarkdownRenderer content={normalizeMarkscheme(q.markscheme)} mode="EXAM" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '760px' }}>
                <div id="offscreen-exam-paper" className="bg-white text-black p-12 font-serif">
                    <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-widest">{exam.title}</h1>
                            <p className="text-sm mt-1 font-sans text-gray-600">Mathematics: Analysis and Approaches HL</p>
                        </div>
                        <div className="text-right">
                            <div className="border border-black px-3 py-1 text-sm font-bold inline-block mb-1">
                                {exam.totalMarks} Marks
                            </div>
                            <div className="text-sm font-sans">{exam.duration} minutes</div>
                        </div>
                    </div>
                    <div className="mb-8 p-4 border border-gray-400 bg-gray-50 text-sm font-sans">
                        <p className="font-bold mb-1">Instructions:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Answer all questions.</li>
                            <li>Unless stated, answers should be exact or to 3 s.f.</li>
                        </ul>
                    </div>
                    <div className="space-y-10">
                        {exam.sections.map((section, sIdx) => (
                            <div key={sIdx}>
                                <h3 className="text-lg font-bold uppercase border-b border-black w-full pb-1 mb-6">{section.title}</h3>
                                {section.questions.map((q) => (
                                    <div key={q.id} className="grid grid-cols-12 gap-4 mb-8 break-inside-avoid">
                                        <div className="col-span-1 font-bold text-lg">{q.number}.</div>
                                        <div className="col-span-11 text-base leading-relaxed markdown-light exam-question-print">
                                            <MarkdownRenderer content={q.questionText} className="text-black" theme="light" mode="EXAM" />
                                            <div className="mt-8 h-20 border-l-2 border-gray-200" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div id="offscreen-markscheme" className="bg-white text-black p-12 font-serif">
                    <div className="border-b-2 border-black pb-4 mb-8">
                            <h1 className="text-2xl font-bold uppercase tracking-widest">MARKSCHEME</h1>
                            <p className="text-sm mt-1 font-sans text-gray-600">{exam.title}</p>
                    </div>
                    <div className="space-y-8">
                        {exam.sections.map((section, sIdx) => (
                            <div key={sIdx}>
                                <h3 className="text-md font-bold text-gray-500 uppercase mb-4">{section.title}</h3>
                                {section.questions.map((q) => (
                                    <div key={q.id} className="mb-6 break-inside-avoid border-b border-gray-200 pb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-lg">{q.number}.</span>
                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">Total {q.marks}</span>
                                        </div>
                                        <div className="pl-6 text-sm font-mono text-black markdown-light">
                                            <MarkdownRenderer content={normalizeMarkscheme(q.markscheme)} theme="light" mode="EXAM" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
                .exam-question-print strong {
                    float: right;
                    color: #000;
                    font-weight: bold;
                }
            `}} />
        </div>
    );
};

export default ExamViewer;

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  theme?: 'dark' | 'light';
  mode?: 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', theme = 'dark', mode = 'SOLVER' }) => {
  const isDark = theme === 'dark';

  // Theme configuration map
  const themeColors = {
      SOLVER: {
          bold: 'text-blue-300',
          header: 'text-blue-100',
          math: 'text-blue-400',
          mathBg: 'bg-transparent',
          codeText: 'text-blue-200',
          codeBg: 'bg-blue-900/10',
          th: 'text-blue-400',
          
          mathLight: 'text-blue-700',
          codeTextLight: 'text-blue-800',
          codeBgLight: 'bg-blue-100'
      },
      DRILL: {
          bold: 'text-yellow-300',
          header: 'text-yellow-100',
          math: 'text-yellow-400',
          mathBg: 'bg-transparent',
          codeText: 'text-yellow-200',
          codeBg: 'bg-yellow-900/10',
          th: 'text-yellow-400',

          mathLight: 'text-yellow-700',
          codeTextLight: 'text-yellow-800',
          codeBgLight: 'bg-yellow-100'
      },
      EXAM: {
          bold: 'text-purple-300',
          header: 'text-purple-100',
          math: 'text-purple-400',
          mathBg: 'bg-transparent',
          codeText: 'text-purple-200',
          codeBg: 'bg-purple-900/10',
          th: 'text-purple-400',

          mathLight: 'text-purple-700',
          codeTextLight: 'text-purple-800',
          codeBgLight: 'bg-purple-100'
      },
      CONCEPT: {
          bold: 'text-green-300',
          header: 'text-green-100',
          math: 'text-green-400',
          mathBg: 'bg-transparent',
          codeText: 'text-green-200',
          codeBg: 'bg-green-900/10',
          th: 'text-green-400',

          mathLight: 'text-green-700',
          codeTextLight: 'text-green-800',
          codeBgLight: 'bg-green-100'
      }
  };

  const colors = themeColors[mode] || themeColors.SOLVER;

  // Robust Normalization: Handles the "messy code" issue (e.g. </li, </ln, <br> mismatches)
  const normalizedContent = useMemo(() => {
      if (!content) return "";
      let cleaned = content;

      // 1. Fix common LLM-generated line break tags and malformed breaks
      cleaned = cleaned.replace(/<\/ln>/gi, '\n');
      cleaned = cleaned.replace(/<ln>/gi, '\n');
      cleaned = cleaned.replace(/<\/br>/gi, '<br />'); 
      cleaned = cleaned.replace(/<br>/gi, '<br />');
      
      // 2. Aggressively fix truncated list tags (often occurs at end of generation)
      cleaned = cleaned.replace(/<\/li\s*$/gim, '</li>');
      cleaned = cleaned.replace(/<\/li\s*\n/gim, '</li>\n');
      cleaned = cleaned.replace(/<\/li[^>]*>/gi, '</li>'); // Fix </li without bracket if stuck
      
      // 3. Fix truncated math delimiters (rare but possible)
      // Ensure space around $ if it's potentially stuck to a word, unless it's currency
      // (This is risky, simplified for now to just standard cleanup)

      return cleaned;
  }, [content]);

  return (
    <div className={`prose max-w-none ${isDark ? 'prose-invert' : 'prose-light'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        // rehypeRaw allows rendering of HTML tags (<ul>, <li>, <br>) mixed in markdown
        rehypePlugins={[[rehypeRaw], [rehypeKatex, { throwOnError: false, strict: false, errorColor: '#cc0000' }]]}
        components={{
            p: ({node, ...props}) => <p className={`mb-2 leading-relaxed ${isDark ? 'text-gray-300' : 'text-black'}`} {...props} />,
            h1: ({node, ...props}) => <h1 className={`text-base font-bold mb-2 ${isDark ? colors.header : 'text-black'}`} {...props} />,
            h2: ({node, ...props}) => <h2 className={`text-sm font-bold mb-2 ${isDark ? colors.header : 'text-black'}`} {...props} />,
            
            // Lists: Handle both Markdown (-) and HTML (<ul>) formats via same components
            // Added explicit marker classes to ensure visibility
            ul: ({node, ...props}) => <ul className={`list-disc pl-5 mb-2 ${isDark ? 'text-gray-300' : 'text-black'} marker:${isDark ? 'text-gray-500' : 'text-gray-600'}`} {...props} />,
            ol: ({node, ...props}) => <ol className={`list-decimal pl-5 mb-2 ${isDark ? 'text-gray-300' : 'text-black'} marker:${isDark ? 'text-gray-500' : 'text-gray-600'}`} {...props} />,
            li: ({node, ...props}) => <li className={`pl-1 mb-1 ${isDark ? 'text-gray-300' : 'text-black'}`} {...props} />,
            
            // Breaks
            br: ({node, ...props}) => <br {...props} />,

            // Code blocks
            code: ({node, className, children, ...props}) => {
                const isMath = className?.includes('math');
                return (
                    <code 
                        className={`font-mono text-sm px-1 py-0.5 rounded ${
                            isMath 
                                ? (isDark ? `${colors.math} bg-transparent` : `${colors.mathLight} bg-transparent`)
                                : (isDark ? `${colors.codeText} ${colors.codeBg}` : `${colors.codeTextLight} ${colors.codeBgLight}`)
                        }`} 
                        {...props}
                    >
                        {children}
                    </code>
                )
            },
            
            // Error handling: If span has katex-error, return null (hide it or show clean error)
            span: ({node, className, children, ...props}) => {
                if (className?.includes('katex-error') || className?.includes('error')) {
                    // console.warn("Katex Error:", children);
                    return <span className="text-red-400 font-mono text-xs" title="Math rendering error">?</span>;
                }
                return <span className={className} {...props}>{children}</span>
            },

            // Strong text
            strong: ({node, ...props}) => <strong className={`font-bold ${isDark ? colors.bold : 'text-black'}`} {...props} />,
            
            // Tables - Strict Grid with Sharp Text & Fixed Proportions
            table: ({node, ...props}) => (
                <div className={`overflow-x-auto my-4 rounded-lg border ${isDark ? 'border-white/10' : 'border-black'}`}>
                    <table className="w-full text-left text-sm border-collapse min-w-[480px]" {...props} />
                </div>
            ),
            thead: ({node, ...props}) => (
                <thead className={`${isDark ? 'bg-[#1a1a1a] text-gray-300' : 'bg-gray-200 text-black'} text-xs font-bold uppercase tracking-wider`} {...props} />
            ),
            tbody: ({node, ...props}) => (
                <tbody className={isDark ? 'bg-[#0e0e0e]' : 'bg-white'} {...props} />
            ),
            tr: ({node, ...props}) => (
                <tr className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-200'}`} {...props} />
            ),
            th: ({node, ...props}) => (
                <th className={`px-4 py-3 font-semibold whitespace-nowrap ${isDark ? colors.th : 'text-black'} first:w-[45px] last:w-[75px]`} {...props} />
            ),
            td: ({node, ...props}) => (
                <td className={`px-4 py-2.5 align-top leading-relaxed whitespace-pre-wrap ${
                    isDark ? 'text-gray-300' : 'text-black'
                } first:font-mono first:text-xs first:text-gray-500 last:font-bold last:text-right last:whitespace-nowrap`} {...props} />
            ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

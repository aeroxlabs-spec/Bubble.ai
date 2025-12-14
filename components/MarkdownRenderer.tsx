
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

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

  return (
    <div className={`prose max-w-none ${isDark ? 'prose-invert' : 'prose-light'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, errorColor: '#cc0000' }]]}
        components={{
            p: ({node, ...props}) => <p className={`mb-2 leading-relaxed ${isDark ? 'text-gray-300' : 'text-black'}`} {...props} />,
            h1: ({node, ...props}) => <h1 className={`text-base font-bold mb-2 ${isDark ? colors.header : 'text-black'}`} {...props} />,
            h2: ({node, ...props}) => <h2 className={`text-sm font-bold mb-2 ${isDark ? colors.header : 'text-black'}`} {...props} />,
            ul: ({node, ...props}) => <ul className={`list-disc pl-5 mb-2 ${isDark ? 'text-gray-300' : 'text-black'}`} {...props} />,
            ol: ({node, ...props}) => <ol className={`list-decimal pl-5 mb-2 ${isDark ? 'text-gray-300' : 'text-black'}`} {...props} />,
            li: ({node, ...props}) => <li className={`pl-1 mb-1 marker:text-gray-500 ${isDark ? 'text-gray-300' : 'text-black'}`} {...props} />,
            
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
            
            // Error handling: If span has katex-error, return null (hide it)
            span: ({node, className, children, ...props}) => {
                if (className?.includes('katex-error') || className?.includes('error')) {
                    return null;
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
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

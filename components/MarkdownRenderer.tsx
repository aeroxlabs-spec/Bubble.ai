import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, errorColor: '#cc0000' }]]}
        components={{
            p: ({node, ...props}) => <p className="mb-2 leading-relaxed text-gray-300" {...props} />,
            // Reduced font sizes for less "overwhelming" look
            h1: ({node, ...props}) => <h1 className="text-base font-bold mb-2 text-blue-100" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-sm font-bold mb-2 text-blue-100" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 text-gray-300" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 text-gray-300" {...props} />,
            // Reverted list items to gray (neutral), relying on strong/code for highlighting. No blue for lists.
            li: ({node, ...props}) => <li className="pl-1 mb-1 text-gray-300 marker:text-gray-500" {...props} />,
            // Strictly style code to avoid default "red" text
            code: ({node, className, children, ...props}) => {
                const isMath = className?.includes('math');
                return (
                    <code 
                        className={`font-mono text-sm px-1 py-0.5 rounded ${
                            isMath 
                                ? 'text-blue-400 bg-transparent' // Math specific
                                : 'text-blue-200 bg-blue-900/10' // Inline code/variables
                        }`} 
                        {...props}
                    >
                        {children}
                    </code>
                )
            },
            // Handle error spans from katex gracefully
            span: ({node, className, children, ...props}) => {
                if (className?.includes('katex-error')) {
                    return <span className="text-red-400/80 font-mono text-[10px]" title={`${children}`}>[Math Syntax Error]</span>
                }
                return <span className={className} {...props}>{children}</span>
            },
            // Strong text remains blue for "critical part" visibility
            strong: ({node, ...props}) => <strong className="font-bold text-blue-300" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
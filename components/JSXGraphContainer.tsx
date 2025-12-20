import React, { useEffect, useRef } from 'react';

interface JSXGraphContainerProps {
  commands: string;
  className?: string;
}

const JSXGraphContainer: React.FC<JSXGraphContainerProps> = ({ commands, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<any>(null);
  const id = useRef(`jsxgraph-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (containerRef.current && (window as any).JXG) {
      const board = (window as any).JXG.JSXGraph.initBoard(id.current, {
        boundingbox: [-10, 10, 10, -10],
        axis: true,
        showNavigation: true,
        showCopyright: false,
        keepaspectratio: true,
        theme: 'dark'
      });
      
      boardRef.current = board;

      // Simple parsing of pseudo-commands for demonstration
      const commandList = commands.split(';');
      commandList.forEach(cmd => {
        const [type, data] = cmd.split(':');
        if (!type || !data) return;

        try {
          const params = JSON.parse(data);
          board.create(type.trim(), params, { strokeColor: '#3b82f6', fillColor: '#3b82f622' });
        } catch (e) {
          console.warn("JSXGraph Parsing Error:", e);
        }
      });
    }
    
    return () => {
      if (boardRef.current) {
        (window as any).JXG.JSXGraph.freeBoard(boardRef.current);
      }
    };
  }, [commands]);

  return (
    <div 
      id={id.current}
      ref={containerRef} 
      className={`jxgbox relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-inner ${className}`}
    />
  );
};

export default JSXGraphContainer;
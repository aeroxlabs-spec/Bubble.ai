import React, { useEffect, useRef } from 'react';

interface DesmosGraphProps {
  expressions: string[];
  className?: string;
}

const DesmosGraph: React.FC<DesmosGraphProps> = ({ expressions, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);

  useEffect(() => {
    if (containerRef.current && (window as any).Desmos) {
      // Clear container before re-initializing to avoid duplicates
      containerRef.current.innerHTML = "";
      
      const elt = document.createElement('div');
      elt.style.width = '100%';
      elt.style.height = '100%';
      containerRef.current.appendChild(elt);

      const calculator = (window as any).Desmos.GraphingCalculator(elt, {
        keypad: false,
        expressions: false,
        settingsMenu: false,
        zoomButtons: true,
        backgroundColor: '#0a0a0a',
        textColor: '#ffffff',
        invertedColors: true
      });
      
      calculatorRef.current = calculator;

      expressions.forEach((expr, idx) => {
        if (expr.trim()) {
          calculator.setExpression({ id: `expr-${idx}`, latex: expr.trim() });
        }
      });
    }
    
    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
      }
    };
  }, [expressions]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-inner ${className}`}
    />
  );
};

export default DesmosGraph;
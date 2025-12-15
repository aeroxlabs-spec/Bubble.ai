
import React, { useEffect, useRef } from 'react';

interface InteractiveGraphProps {
    functions: string[]; // e.g. ["x^2", "sin(x)"]
    className?: string;
    height?: number;
    mode?: 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';
}

const InteractiveGraph: React.FC<InteractiveGraphProps> = ({ functions, className = '', height = 300, mode = 'SOLVER' }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const graphId = useRef(`graph-${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        if (!rootRef.current || !functions || functions.length === 0) return;
        if (!(window as any).functionPlot) return;

        try {
            const width = rootRef.current.offsetWidth;
            
            // Theme colors based on mode
            let color = '#3b82f6'; // Blue (Solver)
            if (mode === 'DRILL') color = '#fbbf24'; // Yellow
            if (mode === 'EXAM') color = '#c084fc'; // Purple
            if (mode === 'CONCEPT') color = '#4ade80'; // Green

            // Determine data array
            const data = functions.map(fn => ({
                fn: fn,
                color: color,
                graphType: 'polyline'
            }));

            (window as any).functionPlot({
                target: `#${graphId.current}`,
                width: width,
                height: height,
                yAxis: { domain: [-10, 10] },
                xAxis: { domain: [-10, 10] },
                grid: true,
                data: data,
                tip: {
                    xLine: true,    // dashed line parallel to y = 0
                    yLine: true,    // dashed line parallel to x = 0
                    renderer: function (x: number, y: number, index: number) {
                      // Custom tooltip logic if needed
                    }
                },
                style: {
                    // Custom CSS Injection for Function Plot to match dark theme
                    // This library injects SVG, so we control colors via props or basic CSS
                }
            });

            // Styling adjustments for dark mode compatibility manually via D3 selection if needed
            // But basic library support usually handles white background. 
            // We need to invert specific strokes via CSS in global styles or here.

        } catch (e) {
            console.error("Graph rendering failed", e);
        }
    }, [functions, height, mode]);

    return (
        <div className={`w-full overflow-hidden rounded-lg bg-[#050505] border border-white/10 relative ${className}`}>
            <div id={graphId.current} ref={rootRef} className="interactive-graph-container" />
            <div className="absolute top-2 right-2 text-[10px] text-gray-500 font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                Interactive: Pan & Zoom
            </div>
            
            {/* Scoped Styles for this graph instance to force dark mode SVG props */}
            <style dangerouslySetInnerHTML={{__html: `
                #${graphId.current} .function-plot {
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                }
                #${graphId.current} text {
                    fill: #9ca3af !important; /* gray-400 */
                    font-size: 10px !important;
                }
                #${graphId.current} .domain {
                    stroke: #374151 !important; /* gray-700 */
                }
                #${graphId.current} .origin {
                    stroke: #4b5563 !important; /* gray-600 */
                    opacity: 0.5;
                }
                #${graphId.current} .grid .tick line {
                    stroke: #374151 !important; /* gray-700 */
                    opacity: 0.3;
                }
            `}} />
        </div>
    );
};

export default InteractiveGraph;

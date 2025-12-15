
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface InteractiveGraphProps {
    functions: string[]; // e.g. ["x^2", "sin(x)"]
    className?: string;
    height?: number;
    mode?: 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';
}

const InteractiveGraph: React.FC<InteractiveGraphProps> = ({ functions, className = '', height = 300, mode = 'SOLVER' }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const graphId = useRef(`graph-${Math.random().toString(36).substr(2, 9)}`);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [key, setKey] = useState(0); // Used to force re-mount on reset

    // Function to safely evaluate string for plotting (FunctionPlot handles this, but we clean inputs)
    const cleanFunction = (fn: string) => {
        // Replace unicode characters that might break eval
        return fn.replace(/–/g, '-').replace(/—/g, '-').trim();
    };

    const drawGraph = () => {
        if (!containerRef.current || !functions || functions.length === 0) return;
        if (!(window as any).functionPlot) {
            setRenderError("Graphing library not loaded.");
            return;
        }

        try {
            // Clear previous graph contents explicitly
            containerRef.current.innerHTML = '';
            setRenderError(null);

            const width = containerRef.current.offsetWidth || 300;
            const validFunctions = functions.map(cleanFunction).filter(f => f.length > 0);

            if (validFunctions.length === 0) {
                setRenderError("No valid functions to plot.");
                return;
            }
            
            // Theme colors based on mode
            let color = '#3b82f6'; // Blue (Solver)
            if (mode === 'DRILL') color = '#fbbf24'; // Yellow
            if (mode === 'EXAM') color = '#c084fc'; // Purple
            if (mode === 'CONCEPT') color = '#4ade80'; // Green

            // Determine data array
            const data = validFunctions.map(fn => ({
                fn: fn,
                color: color,
                graphType: 'polyline',
                // Add derivative for visual richness if it's a simple polynomial? No, confusing.
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
                    xLine: true,
                    yLine: true,
                    renderer: function (x: number, y: number, index: number) {
                        // basic tip
                        return `(${x.toFixed(3)}, ${y.toFixed(3)})`;
                    }
                }
            });

        } catch (e: any) {
            console.error("Graph rendering failed", e);
            setRenderError("Could not render function. Check syntax.");
        }
    };

    useEffect(() => {
        // Initial Draw
        const timer = setTimeout(drawGraph, 100);

        // Resize Observer to handle layout changes
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(drawGraph);
        });

        if (rootRef.current) {
            resizeObserver.observe(rootRef.current);
        }

        return () => {
            clearTimeout(timer);
            resizeObserver.disconnect();
        };
    }, [functions, height, mode, key]);

    return (
        <div ref={rootRef} className={`w-full overflow-hidden rounded-lg bg-[#050505] border border-white/10 relative ${className}`}>
            
            {renderError ? (
                <div className="flex items-center justify-center h-full text-xs text-red-400 p-4 bg-red-900/10 font-mono">
                    {renderError}
                </div>
            ) : (
                <div id={graphId.current} ref={containerRef} className="interactive-graph-container" />
            )}

            {/* Controls Overlay */}
            <div className="absolute top-2 right-2 flex gap-2 pointer-events-none">
                <div className="text-[10px] text-gray-500 font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                    Zoom & Pan
                </div>
                <button 
                    onClick={() => setKey(k => k + 1)} // Force Reset
                    className="pointer-events-auto p-1 rounded bg-black/50 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Reset View"
                >
                    <RefreshCw size={12} />
                </button>
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

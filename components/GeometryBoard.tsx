
import React, { useEffect, useRef, useState } from 'react';
import { GeometryConfig } from '../types';
import { RefreshCw } from 'lucide-react';

interface GeometryBoardProps {
    config: GeometryConfig;
    className?: string;
    height?: number;
    mode?: 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';
}

const GeometryBoard: React.FC<GeometryBoardProps> = ({ config, className = '', height = 350, mode = 'SOLVER' }) => {
    const boardId = useRef(`jxgbox-${Math.random().toString(36).substr(2, 9)}`);
    const boardRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [key, setKey] = useState(0);

    useEffect(() => {
        // Ensure JXG is loaded
        if (!(window as any).JXG) {
            setRenderError("Geometry library (JSXGraph) not loaded.");
            return;
        }

        if (!config || !config.objects || config.objects.length === 0) {
            setRenderError("No geometry objects to render.");
            return;
        }

        try {
            // Cleanup previous board
            if (boardRef.current) {
                (window as any).JXG.JSXGraph.freeBoard(boardRef.current);
                boardRef.current = null;
            }
            
            // Clear container content explicitly to prevent stacking
            const container = document.getElementById(boardId.current);
            if (container) container.innerHTML = '';

            const JXG = (window as any).JXG;

            // Initialize Board
            // Theme colors
            let mainColor = '#3b82f6'; // Blue
            if (mode === 'DRILL') mainColor = '#fbbf24'; // Yellow
            if (mode === 'EXAM') mainColor = '#c084fc'; // Purple
            if (mode === 'CONCEPT') mainColor = '#4ade80'; // Green

            const board = JXG.JSXGraph.initBoard(boardId.current, {
                boundingbox: [config.xmin || -5, config.ymax || 5, config.xmax || 5, config.ymin || -5],
                axis: true,
                showCopyright: false,
                showNavigation: false,
                pan: { enabled: true, needShift: false },
                zoom: { enabled: true, needShift: false },
                defaultAxes: {
                    x: { color: '#666', strokeColor: '#666', ticks: { strokeColor: '#444' } },
                    y: { color: '#666', strokeColor: '#666', ticks: { strokeColor: '#444' } }
                },
                grid: { strokeColor: '#222' }
            });

            boardRef.current = board;

            // Element Map to store created objects by ID for referencing
            const elements: Record<string, any> = {};

            // Render loop
            config.objects.forEach(obj => {
                try {
                    const commonProps = {
                        name: obj.label || '',
                        withLabel: !!obj.label,
                        strokeColor: mainColor,
                        fillColor: mainColor,
                        highlightStrokeColor: '#fff',
                        highlightFillColor: '#fff',
                        fixed: true, // Non-draggable by default for problems
                        label: { color: '#ccc' }
                    };

                    let el;

                    switch (obj.type) {
                        case 'point':
                            if (obj.coords) {
                                el = board.create('point', obj.coords, {
                                    ...commonProps,
                                    size: 3,
                                    label: { offset: [5, 5], color: '#ccc' }
                                });
                            }
                            break;
                        
                        case 'segment':
                        case 'line':
                            if (obj.parents && obj.parents.length >= 2) {
                                const p1 = elements[obj.parents[0]];
                                const p2 = elements[obj.parents[1]];
                                if (p1 && p2) {
                                    el = board.create(obj.type, [p1, p2], {
                                        ...commonProps,
                                        strokeWidth: 2
                                    });
                                }
                            } else if (obj.coords && obj.coords.length >= 4) {
                                // Fallback: Coords defined line [x1, y1, x2, y2]
                                const p1 = board.create('point', [obj.coords[0], obj.coords[1]], { visible: false });
                                const p2 = board.create('point', [obj.coords[2], obj.coords[3]], { visible: false });
                                el = board.create(obj.type, [p1, p2], { ...commonProps, strokeWidth: 2 });
                            }
                            break;

                        case 'vector':
                            // Vectors can be [x, y] (from origin) or have parents/start
                            let start = [0, 0];
                            let end = [0, 0];
                            
                            if (obj.parents && obj.parents.length === 2) {
                                const p1 = elements[obj.parents[0]];
                                const p2 = elements[obj.parents[1]];
                                if (p1 && p2) {
                                    el = board.create('arrow', [p1, p2], { ...commonProps, strokeWidth: 2 });
                                }
                            } else if (obj.coords) {
                                // If coords has 4 items: x1,y1, x2,y2
                                if (obj.coords.length === 4) {
                                    start = [obj.coords[0], obj.coords[1]];
                                    end = [obj.coords[2], obj.coords[3]];
                                } else if (obj.coords.length === 2) {
                                    // Origin vector
                                    end = [obj.coords[0], obj.coords[1]];
                                }
                                
                                const pStart = board.create('point', start, { visible: false, fixed: true });
                                const pEnd = board.create('point', end, { visible: false, fixed: true });
                                el = board.create('arrow', [pStart, pEnd], { ...commonProps, strokeWidth: 2 });
                            }
                            break;

                        case 'circle':
                            if (obj.parents && obj.radius !== undefined) {
                                const center = elements[obj.parents[0]];
                                if (center) {
                                    el = board.create('circle', [center, obj.radius], { ...commonProps, strokeWidth: 2, fillColor: 'transparent' });
                                }
                            } else if (obj.parents && obj.parents.length >= 2) {
                                const center = elements[obj.parents[0]];
                                const pointOn = elements[obj.parents[1]];
                                if (center && pointOn) {
                                    el = board.create('circle', [center, pointOn], { ...commonProps, strokeWidth: 2, fillColor: 'transparent' });
                                }
                            }
                            break;
                        
                        case 'polygon':
                            if (obj.parents && obj.parents.length >= 3) {
                                const points = obj.parents.map(pid => elements[pid]).filter(p => p);
                                if (points.length >= 3) {
                                    el = board.create('polygon', points, { 
                                        ...commonProps, 
                                        fillColor: mainColor, 
                                        fillOpacity: 0.1, 
                                        borders: { strokeWidth: 2, strokeColor: mainColor } 
                                    });
                                }
                            }
                            break;
                        
                        case 'angle':
                            if (obj.parents && obj.parents.length === 3) {
                                const p1 = elements[obj.parents[0]];
                                const p2 = elements[obj.parents[1]]; // vertex
                                const p3 = elements[obj.parents[2]];
                                if (p1 && p2 && p3) {
                                    el = board.create('angle', [p1, p2, p3], { 
                                        ...commonProps, 
                                        fillColor: mainColor, 
                                        fillOpacity: 0.3,
                                        radius: 1
                                    });
                                }
                            }
                            break;
                    }

                    if (el && obj.id) {
                        elements[obj.id] = el;
                    }

                } catch (err) {
                    console.warn(`Failed to create geometry object ${obj.id}`, err);
                }
            });

            setRenderError(null);

        } catch (e: any) {
            console.error("Board Initialization Error", e);
            setRenderError("Failed to initialize geometry board.");
        }

    }, [config, mode, key, height]);

    return (
        <div className={`w-full rounded-xl bg-[#050505] border border-white/10 relative overflow-hidden ${className}`} style={{ height }}>
            {renderError ? (
                <div className="flex items-center justify-center h-full text-xs text-red-400 p-4 font-mono">
                    {renderError}
                </div>
            ) : (
                <div id={boardId.current} className="jxgbox w-full h-full" style={{ width: '100%', height: '100%' }} />
            )}
            
            <button 
                onClick={() => setKey(k => k + 1)}
                className="absolute top-2 right-2 p-1.5 rounded bg-black/50 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
                title="Reset View"
            >
                <RefreshCw size={14} />
            </button>
        </div>
    );
};

export default GeometryBoard;

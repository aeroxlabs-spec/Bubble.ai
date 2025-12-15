import React, { useMemo } from 'react';
import { GeometryConfig, GeometryObject } from '../types';
import { RefreshCw } from 'lucide-react';

interface GeometryBoardProps {
    config: GeometryConfig;
    className?: string;
    height?: number;
    mode?: 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';
}

const GeometryBoard: React.FC<GeometryBoardProps> = ({ config, className = '', height = 350, mode = 'SOLVER' }) => {
    // 1. Theme Configuration
    const theme = {
        stroke: mode === 'DRILL' ? '#fbbf24' : mode === 'CONCEPT' ? '#4ade80' : mode === 'EXAM' ? '#c084fc' : '#60a5fa',
        fill: mode === 'DRILL' ? 'rgba(251, 191, 36, 0.1)' : mode === 'CONCEPT' ? 'rgba(74, 222, 128, 0.1)' : mode === 'EXAM' ? 'rgba(192, 132, 252, 0.1)' : 'rgba(96, 165, 250, 0.1)',
        text: '#e5e7eb', // Bright gray/white for high contrast
        grid: '#333333',
        axis: '#666666'
    };

    // 2. ViewBox Calculation
    const { xmin, xmax, ymin, ymax } = config;
    const padding = 1;
    const viewBox = `${xmin - padding} ${-ymax - padding} ${(xmax - xmin) + 2 * padding} ${(ymax - ymin) + 2 * padding}`;

    // 3. Helper: Map coordinates to SVG space (SVG y is down, Math y is up)
    // We use a transform on the group to handle this easier, but keeping utility if needed.
    // Actually, best way is to use scale(1, -1) on a main group.

    // 4. Clean Labels
    const cleanLabel = (label?: string) => {
        if (!label) return null;
        return label.replace(/\$/g, '')
            .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\theta/g, 'θ')
            .replace(/\\gamma/g, 'γ').replace(/\\pi/g, 'π').replace(/\\angle/g, '∠')
            .replace(/\\vec/g, '').replace(/_/g, '').replace(/{|}/g, '');
    };

    // 5. Determine if we need a grid (Vectors/Functions need it, Pure Geom often doesn't)
    const hasGrid = config.objects.some(o => o.type === 'vector');

    // 6. Object Processing
    const renderObject = (obj: GeometryObject, index: number) => {
        const id = obj.id || `obj-${index}`;
        const label = cleanLabel(obj.label);
        
        // Resolve coordinates
        let coords = obj.coords || [];
        
        // Resolve parents if coords missing
        if (obj.parents && (!coords || coords.length === 0)) {
            // Find parent objects
            const parents = obj.parents.map(pid => config.objects.find(o => o.id === pid));
            // Simple logic for lines defined by 2 points
            if (parents.length === 2 && parents[0]?.coords && parents[1]?.coords) {
                coords = [...parents[0].coords, ...parents[1].coords];
            }
        }

        switch (obj.type) {
            case 'point':
                if (coords.length < 2) return null;
                return (
                    <g key={id}>
                        <circle cx={coords[0]} cy={-coords[1]} r={0.15} fill={theme.stroke} stroke="white" strokeWidth={0.05} />
                        {label && (
                            <text 
                                x={coords[0] + 0.3} 
                                y={-coords[1] - 0.3} 
                                fontSize="0.5" 
                                fill={theme.text} 
                                fontFamily="ui-monospace, monospace"
                                fontWeight="bold"
                                style={{ textShadow: '0px 0px 4px black' }}
                            >
                                {label}
                            </text>
                        )}
                    </g>
                );

            case 'segment':
            case 'line':
                if (coords.length < 4) return null;
                return (
                    <g key={id}>
                        <line 
                            x1={coords[0]} y1={-coords[1]} 
                            x2={coords[2]} y2={-coords[3]} 
                            stroke={theme.stroke} 
                            strokeWidth={0.08} 
                            strokeLinecap="round"
                        />
                        {label && (
                            <text 
                                x={(coords[0] + coords[2]) / 2} 
                                y={-(coords[1] + coords[3]) / 2 - 0.3} 
                                fontSize="0.4" 
                                fill={theme.text}
                                textAnchor="middle"
                                style={{ textShadow: '0px 0px 3px black' }}
                            >
                                {label}
                            </text>
                        )}
                    </g>
                );

            case 'vector':
                if (coords.length < 2) return null;
                // If 2 coords, assume origin start. If 4, explicit start/end.
                const start = coords.length === 4 ? [coords[0], coords[1]] : [0, 0];
                const end = coords.length === 4 ? [coords[2], coords[3]] : [coords[0], coords[1]];
                return (
                    <g key={id}>
                        <line 
                            x1={start[0]} y1={-start[1]} 
                            x2={end[0]} y2={-end[1]} 
                            stroke={theme.stroke} 
                            strokeWidth={0.1} 
                            markerEnd="url(#arrowhead)"
                        />
                        {label && (
                            <text 
                                x={(start[0] + end[0]) / 2} 
                                y={-(start[1] + end[1]) / 2 - 0.4} 
                                fontSize="0.4" 
                                fill={theme.text}
                                fontWeight="bold"
                                style={{ textShadow: '0px 0px 3px black' }}
                            >
                                {label}
                            </text>
                        )}
                    </g>
                );

            case 'circle':
                if (!coords || coords.length < 2) {
                    // Try parents: Center + Point on circle
                    if (obj.parents?.length === 2) {
                        const center = config.objects.find(o => o.id === obj.parents![0]);
                        const point = config.objects.find(o => o.id === obj.parents![1]);
                        if (center?.coords && point?.coords) {
                            const r = Math.sqrt(Math.pow(point.coords[0] - center.coords[0], 2) + Math.pow(point.coords[1] - center.coords[1], 2));
                            return (
                                <circle 
                                    key={id} cx={center.coords[0]} cy={-center.coords[1]} r={r} 
                                    stroke={theme.stroke} strokeWidth={0.05} fill="none" 
                                />
                            );
                        }
                    }
                    // Try Radius provided
                    if (obj.radius && obj.parents?.length === 1) {
                         const center = config.objects.find(o => o.id === obj.parents![0]);
                         if (center?.coords) {
                             return (
                                <circle 
                                    key={id} cx={center.coords[0]} cy={-center.coords[1]} r={obj.radius} 
                                    stroke={theme.stroke} strokeWidth={0.05} fill="none" 
                                />
                             );
                         }
                    }
                    return null;
                }
                return null;

            case 'polygon':
                if (obj.parents && obj.parents.length >= 3) {
                    const points = obj.parents.map(pid => config.objects.find(o => o.id === pid)).filter(p => p?.coords);
                    if (points.length < 3) return null;
                    const pathData = points.map((p, i) => `${i===0?'M':'L'} ${p!.coords![0]} ${-p!.coords![1]}`).join(' ') + ' Z';
                    return (
                        <path 
                            key={id} 
                            d={pathData} 
                            stroke={theme.stroke} 
                            strokeWidth={0.05} 
                            fill={theme.fill} 
                        />
                    );
                }
                return null;
            
            case 'angle':
                // Simple arc rendering
                if (obj.parents?.length === 3) {
                    const p1 = config.objects.find(o => o.id === obj.parents![0])?.coords;
                    const vertex = config.objects.find(o => o.id === obj.parents![1])?.coords;
                    const p3 = config.objects.find(o => o.id === obj.parents![2])?.coords;
                    
                    if (p1 && vertex && p3) {
                        // Calculate angles
                        const angle1 = Math.atan2(p1[1] - vertex[1], p1[0] - vertex[0]);
                        const angle2 = Math.atan2(p3[1] - vertex[1], p3[0] - vertex[0]);
                        
                        // Draw a small arc
                        const r = 0.8;
                        const startX = vertex[0] + r * Math.cos(angle1);
                        const startY = -vertex[1] - r * Math.sin(angle1); // SVG y inverted
                        const endX = vertex[0] + r * Math.cos(angle2);
                        const endY = -vertex[1] - r * Math.sin(angle2);
                        
                        // Determine arc flags (simple assumption for now, can be improved)
                        const largeArcFlag = 0;
                        const sweepFlag = 0; 

                        return (
                            <g key={id}>
                                <path 
                                    d={`M ${vertex[0]} ${-vertex[1]} L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY} Z`}
                                    fill={theme.fill}
                                    stroke={theme.stroke}
                                    strokeWidth={0.02}
                                    fillOpacity={0.3}
                                />
                                {label && (
                                    <text 
                                        x={vertex[0] + (r + 0.3)} 
                                        y={-vertex[1] - (r + 0.3)} 
                                        fontSize="0.4" 
                                        fill={theme.text}
                                    >
                                        {label}
                                    </text>
                                )}
                            </g>
                        )
                    }
                }
                return null;

            default:
                return null;
        }
    };

    return (
        <div className={`w-full bg-[#050505] rounded-xl border border-white/10 overflow-hidden relative select-none ${className}`} style={{ height }}>
            <svg 
                width="100%" 
                height="100%" 
                viewBox={viewBox} 
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-full"
            >
                <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M 0 0 L 6 3 L 0 6 z" fill={theme.stroke} />
                    </marker>
                </defs>

                {/* Grid (Only for Vectors/Functions) */}
                {hasGrid && (
                    <g className="grid-layer" opacity="0.3">
                        {Array.from({ length: Math.ceil(xmax - xmin) + 1 }).map((_, i) => (
                            <line 
                                key={`v-${i}`} 
                                x1={Math.floor(xmin) + i} y1={-ymax} 
                                x2={Math.floor(xmin) + i} y2={-ymin} 
                                stroke={theme.grid} 
                                strokeWidth={0.02} 
                            />
                        ))}
                        {Array.from({ length: Math.ceil(ymax - ymin) + 1 }).map((_, i) => (
                            <line 
                                key={`h-${i}`} 
                                x1={xmin} y1={-(Math.floor(ymin) + i)} 
                                x2={xmax} y2={-(Math.floor(ymin) + i)} 
                                stroke={theme.grid} 
                                strokeWidth={0.02} 
                            />
                        ))}
                        {/* Axes */}
                        <line x1={xmin} y1={0} x2={xmax} y2={0} stroke={theme.axis} strokeWidth={0.05} />
                        <line x1={0} y1={-ymax} x2={0} y2={-ymin} stroke={theme.axis} strokeWidth={0.05} />
                    </g>
                )}

                {/* Geometry Objects */}
                {config.objects.map((obj, i) => renderObject(obj, i))}

            </svg>
            
            <button 
                onClick={() => { /* Simple refresh logic if needed, usually handled by parent key */ }}
                className="absolute top-2 right-2 p-1.5 rounded bg-black/50 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
                title="Reset View"
            >
                <RefreshCw size={14} />
            </button>
        </div>
    );
};

export default GeometryBoard;
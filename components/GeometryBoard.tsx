
import React from 'react';
import { GeometryConfig, GeometryObject } from '../types';
import { Mafs, Coordinates, Point, Line, Vector, Circle, Polygon, Text, Theme } from 'mafs';
import { RefreshCw } from 'lucide-react';

interface GeometryBoardProps {
    config: GeometryConfig;
    className?: string;
    height?: number;
    mode?: 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';
}

const GeometryBoard: React.FC<GeometryBoardProps> = ({ config, className = '', height = 350, mode = 'SOLVER' }) => {
    // 1. Theme Configuration matching App Modes
    const themeColor = {
        SOLVER: '#60a5fa', // Blue
        DRILL: '#facc15', // Yellow
        EXAM: '#c084fc', // Purple
        CONCEPT: '#4ade80' // Green
    }[mode];

    // 2. ViewBox Calculation
    const { xmin, xmax, ymin, ymax } = config;
    // Add some padding to the viewbox
    const xPadding = (xmax - xmin) * 0.1;
    const yPadding = (ymax - ymin) * 0.1;

    // 3. Clean Labels
    const cleanLabel = (label?: string) => {
        if (!label) return null;
        return label.replace(/\$/g, '')
            .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\theta/g, 'θ')
            .replace(/\\gamma/g, 'γ').replace(/\\pi/g, 'π').replace(/\\angle/g, '∠')
            .replace(/\\vec/g, '').replace(/_/g, '').replace(/{|}/g, '');
    };

    // 4. Determine if we need a grid (Vectors/Functions need it, Pure Geom usually doesn't)
    // The prompt requested: "unless vectors, be in a normal, non grid background"
    const hasVectors = config.objects.some(o => o.type === 'vector');
    
    // 5. Object Rendering Logic
    const renderObject = (obj: GeometryObject, index: number) => {
        const id = obj.id || `obj-${index}`;
        const label = cleanLabel(obj.label);
        
        let coords = obj.coords || [];
        
        // Parent resolution fallback (simplified)
        if (obj.parents && (!coords || coords.length === 0)) {
            const parents = obj.parents.map(pid => config.objects.find(o => o.id === pid));
            if (parents.length === 2 && parents[0]?.coords && parents[1]?.coords) {
                coords = [...parents[0].coords, ...parents[1].coords];
            }
        }

        switch (obj.type) {
            case 'point':
                if (coords.length < 2) return null;
                return (
                    <React.Fragment key={id}>
                        <Point x={coords[0]} y={coords[1]} color={themeColor} />
                        {label && (
                            <Text x={coords[0]} y={coords[1]} attach="ne" size={20} color={Theme.foreground}>
                                {label}
                            </Text>
                        )}
                    </React.Fragment>
                );

            case 'segment':
            case 'line':
                if (coords.length < 4) return null;
                return (
                    <React.Fragment key={id}>
                        <Line.Segment 
                            point1={[coords[0], coords[1]]} 
                            point2={[coords[2], coords[3]]} 
                            color={themeColor} 
                        />
                        {label && (
                            <Text x={(coords[0]+coords[2])/2} y={(coords[1]+coords[3])/2} attach="n" size={20} color={Theme.foreground}>
                                {label}
                            </Text>
                        )}
                    </React.Fragment>
                );

            case 'vector':
                if (coords.length < 2) return null;
                const tail: [number, number] = coords.length === 4 ? [coords[0], coords[1]] : [0, 0];
                const tip: [number, number] = coords.length === 4 ? [coords[2], coords[3]] : [coords[0], coords[1]];
                return (
                    <React.Fragment key={id}>
                        <Vector tail={tail} tip={tip} color={themeColor} />
                        {label && (
                            <Text x={(tail[0]+tip[0])/2} y={(tail[1]+tip[1])/2} attach="n" size={20} color={Theme.foreground}>
                                {label}
                            </Text>
                        )}
                    </React.Fragment>
                );

            case 'circle':
                // Try parents: Center + Point on circle
                if (obj.parents?.length === 2) {
                    const center = config.objects.find(o => o.id === obj.parents![0]);
                    const point = config.objects.find(o => o.id === obj.parents![1]);
                    if (center?.coords && point?.coords) {
                        const r = Math.sqrt(Math.pow(point.coords[0] - center.coords[0], 2) + Math.pow(point.coords[1] - center.coords[1], 2));
                        return <Circle key={id} center={[center.coords[0], center.coords[1]]} radius={r} color={themeColor} />;
                    }
                }
                // Try Radius provided
                if (obj.radius && obj.parents?.length === 1) {
                        const center = config.objects.find(o => o.id === obj.parents![0]);
                        if (center?.coords) {
                            return <Circle key={id} center={[center.coords[0], center.coords[1]]} radius={obj.radius} color={themeColor} />;
                        }
                }
                return null;

            case 'polygon':
                if (obj.parents && obj.parents.length >= 3) {
                    const points = obj.parents.map(pid => config.objects.find(o => o.id === pid)).filter(p => p?.coords).map(p => [p!.coords![0], p!.coords![1]] as [number, number]);
                    if (points.length < 3) return null;
                    return (
                        <Polygon key={id} points={points} color={themeColor} strokeStyle="solid" />
                    );
                }
                return null;
            
            // Note: 'angle' requires complex arc math in base Mafs or `Angle` component if available. 
            // For stability, we rely on the points/lines being drawn and skip complex angle arcs unless essential.
            default:
                return null;
        }
    };

    return (
        <div className={`w-full bg-[#050505] rounded-xl border border-white/10 overflow-hidden relative select-none ${className}`} style={{ height }}>
            
            {/* Mafs Container */}
            <Mafs 
                viewBox={{ 
                    x: [xmin - xPadding, xmax + xPadding], 
                    y: [ymin - yPadding, ymax + yPadding],
                    padding: 0 // We handle padding in viewbox
                }}
                preserveAspectRatio="contain"
                zoom={true}
                pan={true}
            >
                {/* 
                   Grid Logic: 
                   - Vectors/Functions: Show Cartesian Grid
                   - Pure Geometry: No Grid (as requested)
                */}
                {hasVectors && (
                    <Coordinates.Cartesian />
                )}

                {/* Render Objects */}
                {config.objects.map((obj, i) => renderObject(obj, i))}

            </Mafs>
            
            {/* Reset Button (Optional, as Mafs handles zoom/pan well) */}
            <div className="absolute top-2 right-2 z-10 pointer-events-none">
                 <span className="text-[10px] text-gray-500 font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/5">
                    Mafs Visualization
                 </span>
            </div>
        </div>
    );
};

export default GeometryBoard;

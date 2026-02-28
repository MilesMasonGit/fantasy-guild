import React from 'react';
import { cn } from '../../../utils/cn.js';
import { Map, AlertTriangle } from 'lucide-react';

/**
 * AreaDeckBadge
 * A specialized overlay tag for Area cards indicating progression (e.g., Depth) and local Threat.
 * Designed to float over the top-right corner of an Area BaseCard.
 * 
 * @param {Object} props
 * @param {number} props.currentDepth - The current progression depth
 * @param {number} props.maxDepth - The maximum depth of the area
 * @param {number} props.threatLevel - The current threat level percentage (0-100)
 */
const AreaDeckBadge = ({ currentDepth, maxDepth, threatLevel, className }) => {
    // Treat threat as an arbitrary percentage
    const isHighThreat = threatLevel >= 75;

    return (
        <div className={cn(
            "absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none z-10",
            className
        )}>
            {/* Depth Badge */}
            {(currentDepth !== undefined && maxDepth !== undefined) && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded border border-white/10 shadow-sm">
                    <Map size={12} className="text-[#3b82f6]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-300">
                        {currentDepth} <span className="text-gray-500">/</span> {maxDepth}
                    </span>
                </div>
            )}

            {/* Threat Badge */}
            {threatLevel !== undefined && (
                <div className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 backdrop-blur-md rounded border shadow-sm",
                    isHighThreat
                        ? "bg-gi-danger/20 border-gi-danger/50 text-gi-danger animate-pulse"
                        : "bg-black/40 border-white/10 text-gray-400"
                )}>
                    <AlertTriangle size={12} className={isHighThreat ? "text-gi-danger" : "text-gray-500"} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">
                        {threatLevel}%
                    </span>
                </div>
            )}
        </div>
    );
};

export default AreaDeckBadge;

import React from 'react';
import { cn } from '../../utils/cn.js';
import { Archive, MapPin, Plus } from 'lucide-react';

/**
 * LibraryPip: Represents one copy of a card in the collection.
 * Shows status icon and handles reclaim interactions.
 */
const LibraryPip = ({ status, areaId, onReclaim, onWithdraw }) => {
    const isUndiscovered = status === 'undiscovered';
    const isAvailable = status === 'available';
    const isInUse = status === 'in-use';

    // Tooltip text
    let tooltip = "Undiscovered";
    if (isAvailable) tooltip = "Available - Click to Withdraw";
    if (isInUse) tooltip = `In Use at ${areaId.replace(/_/g, ' ')}`;

    return (
        <div
            onClick={(e) => {
                if (isAvailable && onWithdraw) {
                    e.stopPropagation();
                    onWithdraw();
                }
            }}
            className={cn(
                "group relative w-6 h-6 flex items-center justify-center rounded-full transition-all border",
                isUndiscovered && "border-white/5 bg-white/5 opacity-30 cursor-default",
                isAvailable && "border-gi-primary/40 bg-gi-primary/10 text-gi-primary shadow-[0_0_8px_rgba(6,182,212,0.2)] cursor-pointer hover:bg-gi-primary/30 hover:scale-110",
                isInUse && "border-gi-warning/40 bg-gi-warning/10 text-gi-warning cursor-default"
            )}
            title={tooltip}
        >
            {/* Status Icon */}
            {isUndiscovered && <div className="w-1.5 h-1.5 rounded-full bg-white/40" />}
            {isAvailable && (
                <div className="flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-gi-primary animate-pulse-slow" />
                    <Plus size={12} className="absolute opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
            {isInUse && <MapPin size={10} />}

            {/* Reclaim Action Overlay (only if in-use) */}
            {isInUse && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onReclaim(areaId);
                    }}
                    className={cn(
                        "absolute inset-0 flex items-center justify-center rounded-full",
                        "bg-gi-danger text-white opacity-0 group-hover:opacity-100",
                        "transition-opacity shadow-lg scale-110 z-10"
                    )}
                    title={`Reclaim from ${areaId}`}
                >
                    <Archive size={12} />
                </button>
            )}
        </div>
    );
};

export default LibraryPip;

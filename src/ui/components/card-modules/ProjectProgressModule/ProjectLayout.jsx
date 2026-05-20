import React from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { cn } from '@/ui/utils/cn.js';
import { ProgressRow } from './ProgressRow.jsx';

/**
 * Shared Layout for Project Progress
 */
export const ProjectLayout = React.memo(({ 
    showTitle, 
    percentComplete, 
    className, 
    keys, 
    entrySource, 
    getInventoryCount, 
    getItemDef, 
    label, 
    isReadyForUpgrade, 
    onUpgrade, 
    nextLevel, 
    currentLevel, 
    totalTiers 
}) => (
    <div className={cn("flex flex-col gap-2 w-full mt-1", className)}>
        {showTitle && (
            <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
                <span className="text-pixel-base uppercase font-bold tracking-widest text-[#6B7280]">
                    Tier {currentLevel + 1} out of {totalTiers}
                </span>
            </div>
        )}

        <div className="flex flex-col gap-1.5 w-full">
            {isReadyForUpgrade ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onUpgrade) onUpgrade();
                    }}
                    className={cn(
                        "w-full py-4 px-2 rounded-lg border-2 border-yellow-400 group relative overflow-hidden transition-all active:scale-95",
                        "bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-700 shadow-[0_0_20px_rgba(251,191,36,0.3)]",
                        "flex flex-col items-center justify-center gap-1"
                    )}
                >
                    {/* Retro Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    
                    <div className="group-hover:animate-pulse flex items-center gap-2">
                        <ArrowUpCircle className="text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]" size={24} />
                        <span className="text-white font-pixel text-lg font-bold uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                            Upgrade Project
                        </span>
                    </div>
                    <span className="text-yellow-100 font-pixel text-[10px] uppercase tracking-tighter opacity-80">
                        Unlock Tier {nextLevel}
                    </span>
                </button>
            ) : (
                keys.map((key) => (
                    <ProgressRow
                        key={key}
                        itemKey={key}
                        data={entrySource[key]}
                        getInventoryCount={getInventoryCount}
                        getItemDef={getItemDef}
                    />
                ))
            )}
        </div>
    </div>
));

export default ProjectLayout;

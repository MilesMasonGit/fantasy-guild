import React from 'react';
import { Layers, Sword, ChevronRight } from 'lucide-react';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * DungeonModule
 * Displays dungeon progress (Floor X/Y) and the next enemy in the sequence.
 */
export const DungeonModule = React.memo(({ trait, card }) => {
    const completed = card.completedCount || 0;
    const total = card.totalCount || 1;
    const currentFloor = Math.min(total, completed + 1);
    
    // Resolve next enemy name from the queue
    const nextEnemyId = card.enemyQueue && card.enemyQueue.length > 0 ? card.enemyQueue[0] : null;
    const nextEnemyDef = nextEnemyId ? getEnemy(nextEnemyId) : null;
    const nextEnemyName = nextEnemyDef?.name || (completed < total ? 'Unknown' : 'Cleared');
    
    const progress = (completed / total) * 100;
    
    return (
        <div className="flex flex-col gap-2 px-3 py-2 bg-gi-accent/5 border-t border-gi-accent/10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gi-accent">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest font-display">
                        Dungeon: Floor {currentFloor}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-gi-text">
                    <span className="text-gi-accent">{completed}</span>
                    <span className="text-gi-muted">/</span>
                    <span>{total}</span>
                    <span className="text-[9px] text-gi-muted ml-0.5 uppercase tracking-tighter">Done</span>
                </div>
            </div>
            
            {/* Dungeon Progress Bar */}
            <div className="h-1.5 bg-black/40 rounded-full p-[1px] border border-gi-accent/20 relative">
                <div 
                    className="h-full bg-gi-accent rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-1 overflow-hidden">
                    <Sword className="w-2.5 h-2.5 text-gi-accent/60 flex-shrink-0" />
                    <span className="text-[9px] text-gi-muted uppercase font-bold tracking-tighter truncate">
                        {completed >= total ? 'Dungeon Cleared' : (
                            <span className="flex items-center gap-0.5">
                                Next: <span className="text-gi-text">{nextEnemyName}</span>
                            </span>
                        )}
                    </span>
                </div>
                {completed < total && (
                    <ChevronRight className="w-2.5 h-2.5 text-gi-accent/40 animate-pulse" />
                )}
            </div>
        </div>
    );
});

export default DungeonModule;

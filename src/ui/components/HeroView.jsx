import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import HeroIdentityStrip from './HeroIdentityStrip.jsx';
import QuestPanel from './QuestPanel.jsx';
import { Users } from 'lucide-react';
import { cn } from '../utils/cn.js';
import { useDndTarget } from '../hooks/useDndTarget.js';

/**
 * HeroView: The Left Panel rendering the roster of hired Heroes.
 * Reactively subscribes to `state.heroes`.
 */
export const HeroView = React.memo(({ isTavernOpen, onTavernToggle }) => {
    const engine = useEngine();
    
    // DROPPABLE: Allow benched heroes to be dropped back onto the roster
    const { setNodeRef, isOver } = useDroppable({
        id: 'hero-view-roster',
        data: {
            type: 'roster'
        }
    });

    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts: ['hero']
    });

    // Fast ID projection prevents structural cloning the entire array when only one hero changes
    const activeHeroIds = useGameState(state => {
        const roster = state.heroes || [];
        return roster.filter(h => h.status !== 'dead').map(h => h.id);
    }, ['heroes_updated']);

    const rosterLimit = useGameState(state => state.progress?.rosterLimit || 5);

    return (
        <div 
            ref={setNodeRef}
            data-droppable-id="hero-view-roster"
            data-type="roster"
            data-no-outline="true"
            data-drag-valid={isAnyDragging ? (isValidTarget ? "true" : "false") : undefined}
            className={cn(
                "w-64 h-full bg-gi-surface border-r border-gi-border flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-[90] transition-colors duration-200 dnd-target",
                isOver && "bg-gi-primary/5"
            )}
        >

            {/* Header */}
            <div className="border-b border-gi-border/50 bg-gi-base/50 flex flex-col shadow-md">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-gi-primary/20 rounded border border-gi-primary/30">
                            <Users className="w-5 h-5 text-gi-primary" />
                        </div>
                        <h2 className="font-display font-bold text-lg text-gi-text tracking-wider text-shadow-neon">ROSTER</h2>
                    </div>
                    <div className={cn(
                        "text-xs font-bold px-2 py-1 rounded border shadow-sm transition-colors",
                        activeHeroIds.length >= rosterLimit
                            ? "text-gi-danger bg-gi-danger/10 border-gi-danger/30"
                            : "text-gi-muted bg-gi-surface border-gi-border"
                    )}>
                        {activeHeroIds.length} / {rosterLimit}
                    </div>
                </div>

                {/* Sub-Header Controls */}
                <div className="flex border-t border-gi-border/20">
                    <button
                        onClick={onTavernToggle}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2 transition-colors",
                            isTavernOpen
                                ? "bg-gi-primary/20 text-gi-primary border-b-2 border-gi-primary/60"
                                : "hover:bg-gi-primary/10 hover:text-gi-primary text-gi-muted"
                        )}
                    >
                        <span className="gi-text-14 font-bold uppercase tracking-tight">Tavern</span>
                    </button>
                </div>
            </div>

            {/* Scrollable Hero List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {activeHeroIds.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gi-muted/50 p-6 text-center border-2 border-dashed border-gi-border/30 rounded-xl">
                        <Users className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-display text-sm">No Heroes Hired</p>
                        <p className="text-xs mt-2">Recruit heroes from the Tavern or specialized Events.</p>
                    </div>
                ) : (
                    activeHeroIds.map(heroId => (
                        <HeroIdentityStrip 
                            key={heroId} 
                            heroId={heroId} 
                            isTavernOpen={isTavernOpen}
                        />
                    ))
                )}
            </div>

            {/* Footer / Info */}
            <div className="p-3 border-t border-gi-border/50 bg-gi-base/30 text-[10px] text-center text-gi-muted uppercase tracking-widest font-bold">
                Deploy heroes via drag-and-drop
            </div>

            {/* Quest Panel integrated into Left Panel below Hero List */}
            <div className="border-t border-gi-border">
                <QuestPanel />
            </div>
        </div>
    );
});
HeroView.displayName = 'HeroView';

export default HeroView;

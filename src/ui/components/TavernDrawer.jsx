import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import { Beer, X, UserMinus } from 'lucide-react';
import HeroIdentityStrip from './HeroIdentityStrip.jsx';
import GISurface from './base/GISurface.jsx';
import { useDndTarget } from '../hooks/useDndTarget.js';

/**
 * TavernDrawer: A sliding side-panel that shows benched heroes.
 * Emerging from the left (behind the HeroView).
 */
export const TavernDrawer = React.memo(({ isOpen, onClose }) => {
    const engine = useEngine();

    // Subscribe to the benched heroes
    const benchedHeroIds = useGameState(state => {
        return (state.bench || []).map(h => h.id);
    }, ['heroes_updated']);

    // DROPPABLE: Allow heroes to be dropped into the tavern to bench them
    const { setNodeRef, isOver } = useDroppable({
        id: 'tavern-drawer',
        data: {
            type: 'tavern',
            accepts: ['hero']
        }
    });

    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts: ['hero']
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="absolute inset-0 z-[70] pointer-events-none">
                    {/* The Drawer */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="absolute top-0 bottom-0 left-64 w-72 pointer-events-auto"
                    >
                        <GISurface 
                            ref={setNodeRef}
                            data-droppable-id="tavern-drawer"
                            data-type="tavern"
                            data-no-outline="true"
                            data-drag-valid={isAnyDragging ? (isValidTarget ? "true" : "false") : undefined}
                            className={cn(
                                "h-full flex flex-col border-r border-gi-border shadow-[10px_0_30px_rgba(0,0,0,0.4)] relative overflow-hidden dnd-target",
                                isAnyDragging && !isValidTarget && "opacity-20 grayscale",
                                isOver && "bg-gi-primary/10"
                            )}
                        >
                            {/* PERFORMANCE: Highlighting is now handled by CSS via [data-drag-over="true"] */}
                            <div className="absolute inset-0 bg-gi-primary/5 ring-inset ring-2 ring-gi-primary/20 z-0 pointer-events-none opacity-0 [[data-drag-over='true']_&]:opacity-100 transition-opacity" />

                            <div className="relative z-10 flex flex-col h-full">
                            {/* Header */}
                            <div className="p-4 border-b border-gi-border/50 bg-gi-base/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-gi-primary/20 rounded border border-gi-primary/30">
                                        <Beer className="w-5 h-5 text-gi-primary" />
                                    </div>
                                    <h2 className="font-display font-bold text-lg text-gi-text tracking-wider">TAVERN</h2>
                                </div>
                                <button 
                                    onClick={onClose}
                                    className="p-1.5 rounded-md text-gi-muted hover:text-gi-danger hover:bg-gi-danger/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Bench Info */}
                            <div className="px-4 py-2 bg-gi-base/30 border-b border-gi-border/20 text-[10px] text-gi-muted uppercase tracking-widest font-bold flex justify-between">
                                <span>Benched Heroes</span>
                                <span>{benchedHeroIds.length}</span>
                            </div>

                            {/* Scrollable Hero List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {benchedHeroIds.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gi-muted/30 p-6 text-center border-2 border-dashed border-gi-border/20 rounded-xl">
                                        <UserMinus className="w-12 h-12 mb-4 opacity-50" />
                                        <p className="font-display text-sm">Bench Empty</p>
                                        <p className="text-[10px] mt-2">Drag heroes here to make room in the active roster.</p>
                                    </div>
                                ) : (
                                    benchedHeroIds.map(heroId => (
                                        <HeroIdentityStrip 
                                            key={heroId} 
                                            heroId={heroId} 
                                            idPrefix="bench" 
                                        />
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-3 border-t border-gi-border/50 bg-gi-base/30 text-[9px] text-center text-gi-muted uppercase tracking-widest font-bold">
                                Benched heroes don't count towards roster limit
                            </div>
                            </div>
                        </GISurface>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
});

export default TavernDrawer;

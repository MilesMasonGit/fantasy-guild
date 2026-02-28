import React from 'react';
import { useGameState } from '../hooks/useGameState.js';
import { AnimatePresence, motion } from 'framer-motion';
import GICard from './base/GICard.jsx';
import GICardSlot from './base/GICardSlot.jsx';
import { getCard } from '../../config/registries/index.js';

/**
 * CardView: The main interactive component for the center of the screen.
 * Automatically maps over `state.cards.active` and renders them with entrance/exit physics.
 */
export const CardView = () => {
    // We only care about the active board state for rendering the dashboard
    const activeCards = useGameState(state => state.cards?.active || []);
    const boardMax = useGameState(state => state.cards?.limits?.boardMax || 5);

    // Calculate how many empty slots are available
    const emptySlotsCount = Math.max(0, boardMax - activeCards.length);
    const emptySlots = Array.from({ length: emptySlotsCount }, (_, i) => `empty-slot-${i}`);

    return (
        <div className="w-full h-full flex items-center justify-center p-8 gap-6 flex-wrap">
            <AnimatePresence>
                {/* 1. Render all active cards spawned by the engine */}
                {activeCards.map(cardState => {
                    const template = getCard(cardState.templateId);

                    return (
                        <motion.div
                            key={cardState.id}
                            initial={{ opacity: 0, y: 50, scale: 0.9, rotateY: 90 }}
                            animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
                            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                            transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        >
                            {/* Pass standard Engine state into our UI component */}
                            <GICard
                                rarity={template?.rarity || 'common'}
                            >
                                <div className="p-4 flex flex-col h-full z-10 relative">
                                    <div className="text-xl font-bold font-display text-gi-text mb-1 drop-shadow-md">
                                        {template?.name || 'Unknown Card'}
                                    </div>
                                    <div className="text-sm font-bold text-gi-primary font-display uppercase tracking-widest mb-4 drop-shadow-md">
                                        {template?.type || 'Mystery'}
                                    </div>
                                    <div className="text-sm text-gi-muted italic flex-1 drop-shadow-md">
                                        {template?.description}
                                    </div>

                                    {/* The Droppable Target for Heroes */}
                                    <div className="mt-4">
                                        <GICardSlot
                                            id={`slot-${cardState.id}`}
                                            data={{ targetType: 'card', cardId: cardState.id }}
                                        />
                                    </div>
                                </div>
                            </GICard>
                        </motion.div>
                    );
                })}

                {/* 2. Render empty slots as indicators up to the board limit */}
                {emptySlots.map(slotId => (
                    <motion.div
                        key={slotId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-80 h-[450px] rounded-xl border-2 border-dashed border-gi-border/30 bg-gi-surface/20 flex flex-col items-center justify-center text-gi-muted/40 transition-colors hover:border-gi-border hover:bg-gi-surface/40"
                    >
                        <div className="text-4xl mb-2">+</div>
                        <div className="font-display tracking-widest uppercase text-xs">Available Slot</div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default CardView;

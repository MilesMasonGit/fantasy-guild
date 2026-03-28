import React, { useMemo } from 'react';
import isEqual from 'fast-deep-equal/es6';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import { motion } from 'framer-motion';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import GISurface from './base/GISurface.jsx';
import { Package, Scroll, Gift } from 'lucide-react';

import { useDroppable, useDraggable } from '@dnd-kit/core';

/**
 * DeckCardView: Renders deck-type cards (pack_deck, quest_deck, chest_deck) on the playmat
 * with a stacked card effect and quantity badge.
 */
const DeckCardView = React.memo(({ cardId, onOpenPack }) => {
    const { GameState } = useEngine();

    // Two-hook pattern: _rev is a primitive → no structuredClone, instant equality
    const cardRev = useGameState(
        state => state.getCardById(cardId)?._rev ?? 0,
        ['cards_updated'],
        (eventData) => !eventData?.cardId || eventData.cardId === cardId
    );

    // Only clone the full card when _rev changes
    const cardState = useMemo(() => {
        const card = GameState.getCardById(cardId);
        return card ? structuredClone(card) : null;
    }, [cardRev, cardId, GameState]);

    const engine = useEngine();
    const { GameState: gs } = engine;

    const {
        attributes,
        listeners,
        setNodeRef: setDraggableRef,
        transform,
        isDragging
    } = useDraggable({
        id: cardId,
        data: {
            type: 'card',
            id: cardId,
            icon: '📦' // Generic icon for draggable state before rehydration
        }
    });

    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `area-${cardId}`,
        data: {
            targetType: 'card_area',
            cardId: cardId
        }
    });

    if (!cardState) return null;

    // Merge refs
    const setNodeRef = (el) => {
        setDraggableRef(el);
        setDroppableRef(el);
    };

    const dragStyle = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 1000 : 200,
        opacity: isDragging ? 0.5 : 1
    } : {};

    const areaSet = getAreaSet(cardState.areaSetId);
    const quantity = cardState.quantity || 0;

    // Determine deck-specific visual config
    const deckConfig = {
        [CARD_TYPES.PACK_DECK]: {
            label: 'Packs',
            icon: Package,
            accentColor: 'text-yellow-400',
            bgAccent: 'bg-yellow-500/20',
            borderAccent: 'border-yellow-500/40',
            glowColor: 'shadow-[0_0_15px_rgba(234,179,8,0.3)]',
        },
        [CARD_TYPES.QUEST_DECK]: {
            label: 'Quests',
            icon: Scroll,
            accentColor: 'text-emerald-400',
            bgAccent: 'bg-emerald-500/20',
            borderAccent: 'border-emerald-500/40',
            glowColor: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        },
        [CARD_TYPES.CHEST_DECK]: {
            label: 'Chests',
            icon: Gift,
            accentColor: 'text-purple-400',
            bgAccent: 'bg-purple-500/20',
            borderAccent: 'border-purple-500/40',
            glowColor: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
        },
    };

    const config = deckConfig[cardState.cardType] || deckConfig[CARD_TYPES.PACK_DECK];
    const IconComponent = config.icon;

    const handleClick = () => {
        if (quantity <= 0) return;

        if (cardState.cardType === CARD_TYPES.PACK_DECK) {
            // Open pack — delegate to parent via callback so ReactRoot can show overlay
            if (onOpenPack) {
                onOpenPack(cardState.areaSetId);
            }
        } else if (cardState.cardType === CARD_TYPES.QUEST_DECK) {
            engine.DeckSystem.drawQuestFromDeck(cardState.id);
        } else if (cardState.cardType === CARD_TYPES.CHEST_DECK) {
            // TODO: Open chest
            console.log('[DeckCardView] Chest opening not yet implemented');
        }
    };

    // Blocked state for quest decks with an active quest
    const isBlocked = cardState.cardType === CARD_TYPES.QUEST_DECK && cardState.activeQuestCardId;

    return (
        <div
            ref={setNodeRef}
            className="relative no-pan"
            onClick={handleClick}
            style={{
                cursor: 'grab',
                ...dragStyle
            }}
            {...attributes}
            {...listeners}
        >
            {/* Stacked card effect — offset background cards */}
            {quantity > 2 && (
                <div className={cn(
                    "absolute inset-0 rounded-xl bg-gi-surface/40 border border-gi-border/30",
                    "translate-x-2 translate-y-2 -z-20"
                )} />
            )}
            {quantity > 1 && (
                <div className={cn(
                    "absolute inset-0 rounded-xl bg-gi-surface/60 border border-gi-border/40",
                    "translate-x-1 translate-y-1 -z-10"
                )} />
            )}

            {/* Main card */}
            <GISurface
                className={cn(
                    "w-48 min-h-56 flex flex-col items-center justify-center p-4 relative overflow-hidden",
                    "cursor-pointer transition-all duration-300",
                    config.borderAccent,
                    quantity > 0 ? config.glowColor : "opacity-60",
                    quantity > 0 && "hover:scale-105 hover:shadow-xl",
                    isBlocked && "opacity-50 cursor-not-allowed"
                )}
                interactive={quantity > 0 && !isBlocked}
                blur={false}
            >
                {/* Ambient glow */}
                <div className={cn(
                    "absolute inset-0 opacity-5 pointer-events-none",
                    config.bgAccent
                )} />

                {/* Quantity badge */}
                <div className={cn(
                    "absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-xs font-bold font-display",
                    config.bgAccent, config.accentColor,
                    "border", config.borderAccent
                )}>
                    x{quantity}
                </div>

                {/* Icon */}
                <div className={cn(
                    "p-3 rounded-full mb-3",
                    config.bgAccent,
                    "border", config.borderAccent
                )}>
                    <IconComponent className={cn("w-8 h-8", config.accentColor)} />
                </div>

                {/* Area name */}
                <div className="text-sm font-bold font-display text-gi-text tracking-wide text-center z-10">
                    {areaSet?.name || 'Unknown'}
                </div>

                {/* Deck type label */}
                <div className={cn(
                    "text-xs font-display uppercase tracking-widest mt-1",
                    config.accentColor
                )}>
                    {config.label}
                </div>

                {/* Blocked indicator */}
                {isBlocked && (
                    <div className="text-xs text-gi-warning mt-2 font-display tracking-wide">
                        Quest Active
                    </div>
                )}

                {/* Empty state */}
                {quantity <= 0 && (
                    <div className="text-xs text-gi-muted mt-2 italic">
                        Empty
                    </div>
                )}
            </GISurface>
        </div>
    );
});
DeckCardView.displayName = 'DeckCardView';

export default DeckCardView;

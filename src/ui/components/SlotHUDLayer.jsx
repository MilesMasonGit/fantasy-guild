import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useDndContext } from '@dnd-kit/core';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { getCard } from '../../config/registries/index.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { renderTraitModule } from './card-modules/ModuleRegistry.jsx';
import { getLogicalPosition } from '../../utils/CoordinateUtils.js';
import { CARD_WIDTH, CARD_HEIGHT } from '../../config/registries/layoutConstants.js';
import BadgeGutter from './hud/BadgeGutter.jsx';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';

/**
 * SlotGutter: Renders the slots for a single card.
 */
const SlotGutter = React.memo(({ cardId }) => {
    const { GameState } = useEngine();
    const [isDragging, setIsDragging] = React.useState(false);

    // Track dragging state via EventBus instead of useDndContext
    // This prevents re-rendering on every single mouse move/pixel change.
    React.useEffect(() => {
        const handleStart = (data) => {
            if (data.id === cardId) setIsDragging(true);
        };
        const handleEnd = () => {
            setIsDragging(false);
        };

        const subStart = EventBus.subscribe('dnd:drag-start', handleStart);
        const subEnd = EventBus.subscribe('dnd:drag-end', handleEnd);
        
        return () => {
            subStart();
            subEnd();
        };
    }, [cardId]);

    const cardState = useGameState(
        state => state.getCardById(cardId),
        ['cards_updated'],
        (eventData) => !eventData?.cardId || eventData.cardId === cardId,
    );

    if (!cardState) return null;

    const template = getCard(cardState.templateId);
    if (!template) return null;

    const externalTraitTypes = ['heroslot', 'blueprintslot', 'inputslot', 'toolslot'];
    const externalTraits = (cardState.traits || [])
        .filter(t => externalTraitTypes.includes(t.type))
        .sort((a, b) => {
            const order = { 'heroslot': 0, 'blueprintslot': 1, 'toolslot': 2, 'inputslot': 3 };
            return (order[a.type] ?? 99) - (order[b.type] ?? 99);
        });

    if (externalTraits.length === 0) return null;

    return (
        <motion.div
            initial={false}
            animate={{ opacity: isDragging ? 0 : 1 }}
            className="absolute flex flex-col gap-3 z-50 pointer-events-none items-start"
            style={{
                left: (CARD_WIDTH / 2) + 8, // Position on the RIGHT side
                top: -(CARD_HEIGHT / 2),    // Align with card top
                height: CARD_HEIGHT
            }}
        >
            <div className="flex flex-col gap-3 pointer-events-auto">
                {externalTraits.map((trait, index) => renderTraitModule(trait, cardState, `${index}-${cardState._rev || 0}`))}
            </div>
        </motion.div>
    );
});

/**
 * SlotHUDLayer: Renders Hero and Item slots at fixed grid positions.
 * Gated under the deck loop rework (Phase 1) — card gutter slots don't exist
 * in the new mode (heroes attach to Areas, inputs come from the bank).
 */
const SlotHUDLayer = ({ cards = [], minX = 0, minY = 0 }) => {
    if (USE_DECK_LOOP) return null;
    return (
        <div 
            style={{ pointerEvents: 'none' }} 
            className="absolute inset-0 z-[300]"
        >
            {cards.map((card) => {
                const { px, py } = getLogicalPosition(card.x, card.y, minX, minY);
                return (
                    <div
                        key={`slot-hud-${card.id}`}
                        className="absolute"
                        style={{ left: px, top: py }}
                    >
                        <SlotGutter cardId={card.id} />
                    </div>
                );
            })}
        </div>
    );
};

export default React.memo(SlotHUDLayer);

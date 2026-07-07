import React from 'react';
import { CardSlot } from '../base/CardSlot.jsx';
import { useEngine } from '../../hooks/useEngine.js';
import { cn } from '../../utils/cn.js';

const HeroSlotItem = React.memo(({ slotConfig, cardId, assignedHeroId, card }) => {
    const engine = useEngine();
    const slotId = `${cardId}-hero-0`;
    const hero = assignedHeroId ? engine?.HeroManager?.getHero(assignedHeroId) : null;

    const label = "DRAG HERO HERE";
    const isAssigned = !!assignedHeroId;

    return (
        <div
            key={slotId}
            data-droppable-id={slotId}
            data-type="heroSlot"
            data-card-id={cardId}
            data-slot-index={0}
            className={cn(
                "h-[72px] relative flex flex-row items-center bg-black/80 border border-white/10 rounded-xl overflow-hidden group/drawer dnd-target",
                "gi-slot-drawer",
                isAssigned ? "" : "border-dashed opacity-80"
            )}
        >
            {/* Compact Icon / Slot */}
            <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center relative z-10">
                <CardSlot
                    id={slotId}
                    data={{ targetType: 'card', type: 'heroSlot', requirement: slotConfig, cardId, slotIndex: 0 }}
                    label={label}
                    className="w-[72px] h-[72px] border-none bg-transparent !p-0"
                    hero={hero}
                    onRemove={() => {
                        if (engine?.CardManager?.unassignHero) {
                            engine.CardManager.unassignHero(cardId);
                            engine.EventBus.publish('audio:play', { clip: 'unassign', type: 'ui' });
                        }
                    }}
                >
                    {!hero && (
                        <div className="w-full h-full flex items-center justify-center bg-black/40 rounded border border-white/5 text-gi-muted/50">
                            <span className="text-3xl font-light">+</span>
                        </div>
                    )}
                </CardSlot>
            </div>

            {/* Label / Name */}
            <div className="flex-1 flex flex-col whitespace-nowrap pr-4 overflow-hidden pointer-events-none items-start gi-slot-label">
                <span className="text-[10px] text-gi-primary font-bold uppercase tracking-wider leading-none mb-1">
                    {isAssigned ? "Active Hero" : "Required"}
                </span>
                <span className="text-sm font-bold text-white leading-none">
                    {isAssigned ? hero?.name : "Empty Slot"}
                </span>
            </div>
        </div>
    );
});

HeroSlotItem.displayName = 'HeroSlotItem';

/**
 * CardAssignmentModule
 * Renders Hero drop zones based on the 'heroslot' trait.
 * 
 * @param {Object} props
 * @param {Object} props.trait - The heroslot trait configuration from the engine.
 * @param {Object} props.card - The parent card.
 */
const CardAssignmentModule = React.memo(({ trait, card }) => {
    const cardId = card?.id || card?.instanceId;
    const assignedHeroId = card?.assignedHeroId;
    const slotConfig = trait?.requirements || {};

    return (
        <HeroSlotItem
            slotConfig={slotConfig}
            cardId={cardId}
            assignedHeroId={assignedHeroId}
            card={card}
        />
    );
});

CardAssignmentModule.displayName = 'CardAssignmentModule';

export default CardAssignmentModule;

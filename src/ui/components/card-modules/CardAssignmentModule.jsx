import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { useDndContext } from '@dnd-kit/core';
import { CardSlot } from '../base/CardSlot.jsx';
import { useEngine } from '../../hooks/useEngine.js';
import { cn } from '../../utils/cn.js';

const HeroSlotItem = ({ slotConfig, index, cardId, assignedHeroId, globalIndex, card }) => {
    const engine = useEngine();
    const [isHovered, setIsHovered] = React.useState(false);
    const slotId = `${cardId}-hero-${index}`;
    const hero = assignedHeroId ? engine?.HeroManager?.getHero(assignedHeroId) : null;

    const label = "DRAG HERO HERE";
    const isAssigned = !!assignedHeroId;

    return (
        <motion.div
            key={slotId}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={false}
            animate={{ 
                width: isHovered ? 208 : 72
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
                "h-[72px] relative flex flex-row items-center bg-black/80 border border-white/10 rounded-xl overflow-hidden group/drawer",
                isAssigned ? "" : "border-dashed opacity-80"
            )}
        >
            {/* Compact Icon / Slot */}
            <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center relative z-10">
                <CardSlot
                    id={slotId}
                    data={{ targetType: 'card', type: 'heroSlot', requirement: slotConfig, cardId, slotIndex: index }}
                    label={label}
                    className="w-[72px] h-[72px] border-none bg-transparent !p-0"
                    hero={hero}
                    onRemove={() => {
                        if (engine?.CardManager?.unassignHero) {
                            engine.CardManager.unassignHero(cardId, index);
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

            {/* Label / Name (Revealed on hover) */}
            <motion.div 
                animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -10 }}
                className="flex-1 flex flex-col whitespace-nowrap pr-4 overflow-hidden pointer-events-none items-start"
            >
                <span className="text-[10px] text-gi-primary font-bold uppercase tracking-wider leading-none mb-1">
                    {isAssigned ? "Active Hero" : "Required"}
                </span>
                <span className="text-sm font-bold text-white leading-none">
                    {isAssigned ? hero?.name : "Empty Slot"}
                </span>
            </motion.div>
        </motion.div>
    );
};

/**
 * CardAssignmentModule
 * Renders Hero drop zones based on the 'heroslot' trait.
 * 
 * @param {Object} props
 * @param {Object} props.trait - The heroslot trait configuration from the engine.
 * @param {Object} props.card - The parent card.
 */
const CardAssignmentModule = ({ trait, card, isFirst, globalIndex = 0 }) => {
    // Determine the array of required heroes based on the trait
    let heroSlots = [];
    if (Array.isArray(trait?.slots)) {
        heroSlots = trait.slots;
    } else if (typeof trait?.slots === 'number') {
        heroSlots = Array(trait.slots).fill({});
    } else if (Array.isArray(trait?.requirements)) {
        heroSlots = trait.requirements;
    } else if (trait?.requirements) {
        heroSlots = [trait.requirements];
    } else {
        heroSlots = [{ required: true }];
    }

    const cardId = card?.id || card?.instanceId;

    if (!heroSlots || heroSlots.length === 0) return null;

    return (
        <React.Fragment>
            {heroSlots.map((slotConfig, index) => {
                const assignedHeroId = card?.heroSlots?.[index] || (index === 0 ? card?.assignedHeroId : null);
                return (
                    <HeroSlotItem
                        key={`${cardId}-hero-${index}`}
                        slotConfig={slotConfig}
                        index={index}
                        cardId={cardId}
                        assignedHeroId={assignedHeroId}
                        globalIndex={globalIndex}
                        card={card}
                    />
                );
            })}
        </React.Fragment>
    );
};

export default CardAssignmentModule;

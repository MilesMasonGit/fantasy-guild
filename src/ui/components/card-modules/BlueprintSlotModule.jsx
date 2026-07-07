import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { cn } from '../../utils/cn.js';
import { X } from 'lucide-react';
import EntityDraggable from '../base/EntityDraggable.jsx';
import { CardSlot } from '../base/CardSlot.jsx';
import { useDndTarget } from '../../hooks/useDndTarget.js';

/**
 * BlueprintSlotModule
 * Renders the specialized slot for Blueprint cards.
 */
const BlueprintSlotModule = React.memo(({ trait, card }) => {
    const engine = useEngine();
    const [isHovered, setIsHovered] = React.useState(false);

    const blueprintId = card.assignedBlueprintId;
    const blueprintTemplate = blueprintId ? engine.GameState.getCardById(blueprintId) : null;
    const isAssigned = !!blueprintId;

    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts: ['card', 'blueprint'],
        validate: (activeData) => activeData.cardType === 'blueprint' || activeData.type === 'blueprint'
    });

    const slotId = `${card.id}-blueprint-slot`;

    const handleRemove = () => {
        if (engine?.CardManager?.unassignBlueprint) {
            engine.CardManager.unassignBlueprint(card.id);
        }
    };

    return (
        <div
            data-droppable-id={slotId}
            data-type="blueprintSlot"
            data-card-id={card.id}
            data-drag-valid={isAnyDragging ? (isValidTarget ? "true" : "false") : undefined}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            className={cn(
                "h-[72px] relative flex flex-row items-center bg-black/80 border border-white/10 rounded-xl overflow-hidden group/drawer dnd-target",
                "gi-slot-drawer",
                isAssigned ? "" : "border-dashed opacity-80",
                isHovered ? "gi-slot-drawer--expanded" : ""
            )}
        >
            {/* Compact Icon / Slot */}
            <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center relative z-10">
                 <CardSlot
                    id={slotId}
                    data={{
                        type: 'blueprintSlot',
                        cardId: card.id
                    }}
                    label={isAssigned ? blueprintTemplate?.name : "Blueprint"}
                    className="w-[72px] h-[72px] border-none bg-transparent !p-0"
                    onContextMenu={(e) => {
                        if (isAssigned) {
                            e.preventDefault();
                            handleRemove();
                        }
                    }}
                >
                    <div className="relative w-full h-full flex items-center justify-center">
                        {isAssigned ? (
                            <EntityDraggable
                                id={`assigned-blueprint-${card.id}`}
                                data={{
                                    type: 'card',
                                    cardType: 'blueprint',
                                    id: blueprintId,
                                    icon: blueprintTemplate?.icon || '📜',
                                    sourceCardId: card.id,
                                    sourceSlotType: 'blueprintSlot'
                                }}
                                className="w-full h-full flex items-center justify-center"
                            >
                                <span className="text-3xl drop-shadow-sm cursor-grab active:cursor-grabbing">
                                    {blueprintTemplate?.icon || '📜'}
                                </span>
                            </EntityDraggable>
                        ) : (
                            <span className="text-3xl drop-shadow-sm opacity-20 grayscale brightness-75">
                                ⚙️
                            </span>
                        )}
                    </div>
                </CardSlot>
            </div>

            {/* Expansion Content (Revealed on hover) */}
            <div
                className={cn(
                    "flex-1 flex flex-row items-center justify-between px-3 overflow-hidden pointer-events-none",
                    "gi-slot-label",
                    isHovered ? "gi-slot-label--visible" : ""
                )}
            >
                <div className="flex flex-col min-w-0 items-start pl-3 text-left">
                    <span className="text-[10px] text-gi-primary font-bold uppercase tracking-wider leading-none mb-1 truncate">
                        {isAssigned ? "Active Spec" : "Specialization"}
                    </span>
                    <span className="text-sm font-bold text-white leading-none truncate pr-2">
                        {isAssigned ? blueprintTemplate?.name : `Requires: ${card.skill ? (card.skill.charAt(0).toUpperCase() + card.skill.slice(1)) : 'Any'} Spec`}
                    </span>
                </div>
            </div>

            {/* Quick-remove hint (Mobile/Desktop friendly) */}
            {isAssigned && isHovered && (
                <button 
                    onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-500 pointer-events-auto"
                >
                    <X size={10} />
                </button>
            )}
        </div>
    );
});
BlueprintSlotModule.displayName = 'BlueprintSlotModule';

export default BlueprintSlotModule;

import React from 'react';
import { CardSlot } from '../../base/CardSlot.jsx';
import { useEngine } from '@/ui/hooks/useEngine.js';
import { cn } from '@/ui/utils/cn.js';
import { X } from 'lucide-react';
import { getItem } from '@/config/registries/itemRegistry.js';
import { ItemIcon } from '../../base/ItemIcon.jsx';
import { useGameState } from '@/ui/hooks/useGameState.js';
import { formatCompact } from '@/utils/Formatters.js';
import EntityDraggable from '../../base/EntityDraggable.jsx';
import { Badge } from '../../base/Badge.jsx';
import { useDndTarget } from '@/ui/hooks/useDndTarget.js';

/**
 * InputSlotItem
 * An interactive drop-zone for card requirements.
 */
export const InputSlotItem = React.memo(({ input, index, cardId, isIndividual, trait, assignedItems, globalIndex, card }) => {
    const engine = useEngine();
    const [isHovered, setIsHovered] = React.useState(false);

    const slotIndex = isIndividual ? (trait.slotIndex ?? 0) : index;
    const slotId = `${cardId}-input-${slotIndex}`;
    const assignedValue = assignedItems[slotIndex];
    const assignedItemId = assignedValue?.id || assignedValue;

    // Reactively subscribe ONLY to this specific item's quantity changes
    const requiredItemCount = useGameState(
        state => input.itemId ? state.inventory?.items?.[input.itemId]?.quantity || 0 : 0,
        ['inventory_updated']
    );

    const assignedItemCount = useGameState(
        state => assignedItemId ? state.inventory?.items?.[assignedItemId]?.quantity || 0 : 0,
        ['inventory_updated']
    );

    let label = "Drop Item";
    let itemDef = null;

    if (input.itemId) {
        itemDef = getItem(input.itemId);
        label = itemDef?.name || input.itemId;
    } else if (input.acceptTags && input.acceptTags.length > 0) {
        label = input.acceptTags.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ');
    } else if (input.acceptTag) {
        label = `Any ${input.acceptTag}`;
    }

    const isAssigned = !!assignedItemId;
    const displayItem = isAssigned ? getItem(assignedItemId) : itemDef;
    const invCount = isAssigned ? assignedItemCount : requiredItemCount;

    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts: ['item'],
        validate: (activeData) => {
            const item = getItem(activeData.id);
            if (!item) return false;
            
            if (input.itemId) return activeData.id === input.itemId;
            if (input.acceptTags) return input.acceptTags.some(tag => item.tags?.includes(tag));
            if (input.acceptTag) return item.tags?.includes(input.acceptTag);
            return true;
        }
    });

    const handleRemoveItem = () => {
        if (engine?.CardManager?.unassignItemFromSlot) {
            engine.CardManager.unassignItemFromSlot(cardId, slotIndex);
            engine.EventBus.publish('audio:play', { clip: 'unassign', type: 'ui' });
        }
    };

    return (
        <div
            key={slotId}
            data-droppable-id={slotId}
            data-type="inputSlot"
            data-card-id={cardId}
            data-slot-index={slotIndex}
            data-drag-valid={isAnyDragging ? (isValidTarget ? "true" : "false") : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "h-[72px] relative flex flex-row items-center bg-black/80 border border-white/10 rounded-xl overflow-hidden group/drawer dnd-target",
                "gi-slot-drawer",
                isHovered ? "gi-slot-drawer--expanded" : "",
                isAssigned ? "" : "border-dashed opacity-80",
            )}
            data-accept-type="item"
            data-accept-id={input.itemId || ""}
            data-accept-tag={input.acceptTag || ""}
            data-accept-tags={input.acceptTags ? input.acceptTags.join(',') : ""}
            data-is-assigned={isAssigned ? "true" : "false"}
        >
            {/* Compact Icon / Slot */}
            <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center relative z-10">
                 <CardSlot
                    id={slotId}
                    data={{
                        targetType: 'card',
                        type: 'inputSlot',
                        inputRequirement: input,
                        cardId,
                        slotIndex: slotIndex
                    }}
                    label={label}
                    className="w-[72px] h-[72px] border-none bg-transparent !p-0"
                    onContextMenu={(e) => {
                        if (isAssigned) {
                            e.preventDefault();
                            handleRemoveItem();
                        }
                    }}
                >
                    <div className="relative w-full h-full flex items-center justify-center">
                        {isAssigned ? (
                           <EntityDraggable
                                id={`assigned-item-${cardId}-${slotIndex}`}
                                data={{
                                    type: 'item',
                                    id: assignedItemId,
                                    icon: displayItem?.icon || '📦',
                                    sourceCardId: cardId,
                                    sourceSlotIndex: slotIndex,
                                }}
                                className="w-full h-full flex items-center justify-center"
                            >
                                <ItemIcon item={displayItem} size={64} />
                            </EntityDraggable>
                        ) : (
                            <ItemIcon 
                                item={displayItem || input.itemId} 
                                size={64} 
                                className={cn(!isAssigned && "opacity-40 grayscale contrast-125 brightness-75")}
                            />
                        )}
                        
                        <div className="absolute bottom-0 right-0 z-20 pointer-events-none">
                            <Badge value={`x${input.quantity || 1}`} variant="requirement" size="xs" />
                        </div>
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
                <div className="flex flex-col min-w-0 items-start pl-3">
                    <span className="text-[10px] text-gi-primary font-bold uppercase tracking-wider leading-none mb-1 truncate">
                        {isAssigned ? "Equipped" : "Required"}
                    </span>
                    <span className="text-sm font-bold text-white leading-none truncate pr-2">
                        {isAssigned ? (displayItem?.name || assignedItemId) : label}
                    </span>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge value={`x${input.quantity || 1}`} variant="requirement" size="base" />
                    <Badge value={formatCompact(invCount, 1)} variant="count" size="base" />
                </div>
            </div>

            {/* Quick-remove hint */}
            {isAssigned && isHovered && (
                <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveItem(); }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-500 pointer-events-auto"
                >
                    <X size={10} />
                </button>
            )}
        </div>
    );
}, (prev, next) => {
    // OPTIMIZATION: Eliminate JSON.stringify.
    // Use card revision and trait stability to drive re-renders.
    return prev.card?._rev === next.card?._rev && 
           prev.globalIndex === next.globalIndex &&
           prev.assignedItems === next.assignedItems; 
           // assignedItems is usually a piece of the card state handled by GameState (immutable refs)
});

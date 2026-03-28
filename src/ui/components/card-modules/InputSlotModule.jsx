import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { useDndContext } from '@dnd-kit/core';
import { CardSlot } from '../base/CardSlot.jsx';
import { useEngine } from '../../hooks/useEngine.js';
import { useRenderTrace } from '../../hooks/useRenderTrace.js';
import { cn } from '../../utils/cn.js';
import { Package, X } from 'lucide-react';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { ItemDurabilityBar } from '../vault/ItemDurabilityBar.jsx';
import { getTagIconData } from '../../../utils/IconUtils.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { formatCompact } from '../../../utils/Formatters.js';
import EntityDraggable from '../base/EntityDraggable.jsx';
import { Badge } from '../base/Badge.jsx';

/**
 * ItemIdentityStrip
 * A miniature visual representation of an assigned item.
 */
const ItemIdentityStrip = ({ item, onRemove, className, inventoryCount }) => {
    const itemDef = getItem(item.id || item.itemId);
    const itemName = itemDef?.name || item?.name || item?.id || "Unknown Item";
    const quantity = item?.quantity || 1;

    return (
        <div
            className={cn(
                "flex items-center gap-2 py-0.5 w-full bg-gi-surface group relative overflow-hidden transition-colors",
                className
            )}
            onContextMenu={(e) => {
                if (onRemove) {
                    e.preventDefault();
                    onRemove();
                }
            }}
        >
            <div className="flex-shrink-0">
                <ItemIcon item={itemDef || item} size={32} className="bg-black/30 border border-white/5 rounded shadow-inner" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="gi-text-16 font-bold text-gi-text truncate">{itemName}</div>
            </div>

            <div className="flex items-center gap-1 ml-auto mr-5">
                <Badge value={`x${formatCompact(quantity, 1)}`} variant="requirement" size="base" />
                {typeof inventoryCount !== 'undefined' && (
                    <Badge value={formatCompact(inventoryCount, 1)} variant="count" size="base" title="In Inventory" />
                )}
            </div>

            {/* Durability Bar */}
            {itemDef?.maxDurability && (
                <ItemDurabilityBar
                    current={item.durability}
                    max={itemDef.maxDurability}
                    className="opacity-60"
                />
            )}

        </div>
    );
};

const InputSlotItem = React.memo(({ input, index, cardId, isIndividual, trait, assignedItems, globalIndex, card }) => {
    useRenderTrace(`InputSlotItem-${cardId}-${index}`, { input, index, cardId, isIndividual, trait, assignedItems, globalIndex, card });
    const engine = useEngine();
    const [isHovered, setIsHovered] = React.useState(false);

    const slotIndex = isIndividual ? (trait.slotIndex ?? 0) : index;
    const slotId = `${cardId}-input-${slotIndex}`;
    const assignedItemId = assignedItems[slotIndex];

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
    let ghostIcon = null;
    let inventoryCount = 0;
    let itemDef = null;

    if (input.itemId) {
        itemDef = getItem(input.itemId);
        label = itemDef?.name || input.itemId;
        inventoryCount = requiredItemCount;
    } else if (input.acceptTags && input.acceptTags.length > 0) {
        label = input.acceptTags.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ');
    } else if (input.acceptTag) {
        label = `Any ${input.acceptTag}`;
    }

    const isAssigned = !!assignedItemId;
    const displayItem = isAssigned ? getItem(assignedItemId) : itemDef;
    const invCount = isAssigned ? assignedItemCount : inventoryCount;

    const handleRemoveItem = () => {
        if (engine?.CardManager?.unassignItemFromSlot) {
            engine.CardManager.unassignItemFromSlot(cardId, slotIndex);
            engine.EventBus.publish('audio:play', { clip: 'unassign', type: 'ui' });
        }
    };

    return (
        <motion.div
            key={slotId}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={false}
            animate={{ 
                width: isHovered ? 228 : 72
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
                "h-[72px] relative flex flex-row items-center bg-black/80 border border-white/10 rounded-xl overflow-hidden group/drawer",
                isAssigned ? "" : "border-dashed opacity-80"
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
                        
                        {/* Fixed quantity badge (always visible over sprite) */}
                        <div className="absolute bottom-0 right-0 z-20 pointer-events-none">
                            <Badge value={`x${input.quantity || 1}`} variant="requirement" size="xs" />
                        </div>
                    </div>
                </CardSlot>
            </div>

            {/* Expansion Content (Revealed on hover) */}
            <motion.div 
                animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -10 }}
                className="flex-1 flex flex-row items-center justify-between px-3 overflow-hidden pointer-events-none"
            >
                <div className="flex flex-col min-w-0 items-start pl-3">
                    <span className="text-[10px] text-gi-primary font-bold uppercase tracking-wider leading-none mb-1 truncate">
                        {isAssigned ? "Equipped" : "Required"}
                    </span>
                    <span className="text-sm font-bold text-white leading-none truncate pr-2">
                        {isAssigned ? displayItem?.name : label}
                    </span>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge value={`x${input.quantity || 1}`} variant="requirement" size="base" />
                    <Badge value={formatCompact(invCount, 1)} variant="count" size="base" />
                </div>
            </motion.div>

            {/* Quick-remove hint (Mobile/Desktop friendly) */}
            {isAssigned && isHovered && (
                <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveItem(); }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-500 pointer-events-auto"
                >
                    <X size={10} />
                </button>
            )}
        </motion.div>
    );
}, (prev, next) => {
    return prev.card._rev === next.card._rev &&
        JSON.stringify(prev.assignedItems) === JSON.stringify(next.assignedItems) &&
        prev.globalIndex === next.globalIndex;
});

/**
 * InputSlotModule
 * Transforms resource requirements into interactive Drag & Drop zones.
 * 
 * Supports both:
 * 1. "Batch" traits (type: 'inputslot', inputs: [...])
 * 2. "Individual" traits (type: 'inputslot', itemId: '...', quantity: 1, etc.)
 */
const InputSlotModule = React.memo(({ trait, card, isFirst, globalIndex = 0 }) => {
    const engine = useEngine();
    // const { active } = useDndContext();
    const cardId = card?.id || card?.instanceId;

    // ... rest of the setup
    const hasAcceptTags = trait?.acceptTags && trait.acceptTags.length > 0;
    const inputs = trait?.inputs || (trait?.itemId || trait?.acceptTag || hasAcceptTags ? [trait] : []);
    const isIndividual = !trait?.inputs && (trait?.itemId || trait?.acceptTag || hasAcceptTags);
    const assignedItems = card?.assignedItems || {};

    if (!inputs || inputs.length === 0) return null;

    return (
        <React.Fragment>
            {inputs.map((input, index) => (
                <InputSlotItem
                    key={`${cardId}-input-${index}`}
                    input={input}
                    index={index}
                    cardId={cardId}
                    isIndividual={isIndividual}
                    trait={trait}
                    assignedItems={assignedItems}
                    globalIndex={globalIndex}
                    card={card}
                />
            ))}
        </React.Fragment>
    );
}, (prev, next) => {
    return prev.card._rev === next.card._rev && prev.trait === next.trait;
});

export default InputSlotModule;

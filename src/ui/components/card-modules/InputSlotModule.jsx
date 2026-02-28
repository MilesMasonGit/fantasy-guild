import React from 'react';
import { CardSlot } from '../base/CardSlot.jsx';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../../utils/cn.js';
import { Package, X } from 'lucide-react';
// import { getItem } from '../../../config/registries/itemRegistry.js'; // Will be used when integrating real data
// import { getTagIconData } from '../../../utils/AssetManager.js';

/**
 * ItemIdentityStrip
 * A miniature visual representation of an assigned item, styled similarly to HeroIdentityStrip,
 * but more compact to fit inside a resource slot.
 */
const ItemIdentityStrip = ({ item, onRemove }) => {
    // Fallback display if full item def isn't available yet
    const itemName = item?.name || item?.id || "Unknown Item";
    const quantity = item?.quantity || 1;
    const icon = item?.icon || <Package size={16} />;

    return (
        <div className="flex items-center gap-2 p-1.5 w-full bg-gi-surface border border-gi-border hover:border-gi-primary/50 rounded shadow-sm group relative">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-black/30 border border-white/5 flex-shrink-0 text-xl text-gray-300">
                {icon}
            </div>
            <div className="flex-1 min-w-0 pr-6">
                <div className="text-xs font-bold text-gi-text truncate">{itemName}</div>
                <div className="text-[10px] text-gi-muted uppercase tracking-wider font-bold">Qty: {quantity}</div>
            </div>

            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id || item.instanceId);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-sm bg-black/40 text-gray-400 hover:text-white hover:bg-gi-danger transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove Item"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
};

/**
 * InputSlotModule
 * Transforms resource requirements into interactive Drag & Drop zones.
 * 
 * @param {Object} props
 * @param {Array} props.inputs - Array of required inputs: [{itemId, quantity}] or [{acceptTag, quantity, slotLabel}]
 * @param {Array} props.assignedItems - Array of items currently dropped into these slots
 * @param {string} props.cardId - Used to generate unique droppable IDs
 * @param {Function} props.onRemoveItem - Callback when a player clicks to remove an assigned item
 */
const InputSlotModule = ({ inputs = [], assignedItems = [], cardId, onRemoveItem }) => {
    if (!inputs || inputs.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 w-full mt-2">
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280] border-b border-white/10 pb-0.5">
                Required Materials
            </div>

            <div className="flex flex-col gap-1.5">
                {inputs.map((input, index) => {
                    const slotId = `${cardId}-input-${index}`;
                    const assignedItem = assignedItems[index]; // Map roughly 1:1 for now

                    // Determine label based on requirement type
                    let label = "Drop Item";
                    if (input.itemId) {
                        label = `${input.quantity}x ${input.itemId.split('_').pop()}`; // Rough fallback name
                    } else if (input.acceptTag) {
                        label = input.slotLabel || `${input.quantity}x Any ${input.acceptTag}`;
                    }

                    return (
                        <div key={slotId} className="w-full">
                            {assignedItem ? (
                                <ItemIdentityStrip
                                    item={assignedItem}
                                    onRemove={() => onRemoveItem(index, assignedItem)}
                                />
                            ) : (
                                <CardSlot
                                    id={slotId}
                                    data={{ type: 'inputSlot', inputRequirement: input, cardId, slotIndex: index }}
                                    label={label}
                                    className="min-h-[46px] py-1.5 border-dashed border-white/20 bg-black/20 text-gray-400 text-[10px]"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InputSlotModule;

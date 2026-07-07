import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { CardSlot } from '../base/CardSlot.jsx';
import { EntityDraggable } from '../base/EntityDraggable.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { X } from 'lucide-react';
import { ItemDurabilityBar } from '../vault/ItemDurabilityBar.jsx';
import { useDndTarget } from '../../hooks/useDndTarget.js';

/**
 * ToolSlotModule - A specialized input slot for tools using dnd-kit.
 */
export const ToolSlotModule = React.memo(({ trait, card }) => {
    const engine = useEngine();
    const [isHovered, setIsHovered] = React.useState(false);

    const { toolType, minTier = 0 } = trait;
    const assignedToolId = card.assignedToolId;
    const assignedTool = assignedToolId ? getItem(assignedToolId) : null;
    const isAssigned = !!assignedTool;

    // Get live instance from inventory for durability
    const invItem = assignedToolId ? engine.GameState.inventory.items[assignedToolId] : null;
    const currentDurability = invItem?.dur;

    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts: ['item'],
        validate: (activeData) => {
            const item = getItem(activeData.id);
            if (!item) return false;
            // Basic tool type check
            return item.toolType === toolType || item.tags?.includes(toolType);
        }
    });

    const slotId = `${card.id}-tool-slot`;

    const handleUnassign = (e) => {
        if (e) e.stopPropagation();
        engine.CardManager.unassignTool(card.id);
    };

    return (
        <div
            data-droppable-id={slotId}
            data-type="toolSlot"
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
                        type: 'toolSlot',
                        cardId: card.id,
                        toolType,
                        minTier
                    }}
                    className="w-[72px] h-[72px] border-none bg-transparent !p-0"
                    onRemove={isAssigned ? handleUnassign : null}
                    onContextMenu={(e) => {
                        if (isAssigned) {
                            e.preventDefault();
                            handleUnassign();
                        }
                    }}
                >
                    <div className="relative w-full h-full flex items-center justify-center">
                        {isAssigned ? (
                             <EntityDraggable
                                id={`assigned-tool-${card.id}`}
                                data={{
                                    type: 'item',
                                    id: assignedToolId,
                                    icon: assignedTool.icon || '🛠️',
                                    sourceCardId: card.id,
                                    isTool: true
                                }}
                                className="w-full h-full flex items-center justify-center"
                            >
                                <ItemIcon item={assignedTool} size={48} />
                                {currentDurability !== undefined && (
                                    <ItemDurabilityBar 
                                        current={currentDurability} 
                                        max={assignedTool?.maxDurability || 100} 
                                    />
                                )}
                            </EntityDraggable>
                        ) : (
                            <div className="flex items-center justify-center opacity-20 filter grayscale">
                                <span className="text-3xl">
                                    {toolType === 'pickaxe' ? '⛏️' : (toolType === 'axe' ? '🪓' : '🛠️')}
                                </span>
                            </div>
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
                        {isAssigned ? "Active Tool" : (toolType ? `${toolType} Required` : "Tool Required")}
                    </span>
                    <span className="text-sm font-bold text-white leading-none truncate pr-2">
                        {isAssigned ? assignedTool.name : `Requires Tier ${minTier}+`}
                    </span>
                </div>
                
                {isAssigned && assignedTool.speedBonus && (
                    <div className="flex-shrink-0 bg-gi-primary/20 px-2 py-1 rounded border border-gi-primary/30">
                        <span className="text-[10px] font-bold text-gi-primary">
                            +{Math.round(assignedTool.speedBonus * 100)}% Speed
                        </span>
                    </div>
                )}
            </div>

            {/* Quick-remove hint (Mobile/Desktop friendly) */}
            {isAssigned && isHovered && (
                <button 
                    onClick={handleUnassign}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-500 pointer-events-auto"
                >
                    <X size={10} />
                </button>
            )}
        </div>
    );
});
ToolSlotModule.displayName = 'ToolSlotModule';

export default ToolSlotModule;

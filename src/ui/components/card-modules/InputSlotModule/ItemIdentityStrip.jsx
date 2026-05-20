import React from 'react';
import { cn } from '@/ui/utils/cn.js';
import { getItem } from '@/config/registries/itemRegistry.js';
import { ItemIcon } from '../../base/ItemIcon.jsx';
import { ItemDurabilityBar } from '../../vault/ItemDurabilityBar.jsx';
import { Badge } from '../../base/Badge.jsx';
import { formatCompact } from '@/utils/Formatters.js';

/**
 * ItemIdentityStrip
 * A miniature visual representation of an assigned item.
 */
export const ItemIdentityStrip = ({ item, onRemove, className, inventoryCount }) => {
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

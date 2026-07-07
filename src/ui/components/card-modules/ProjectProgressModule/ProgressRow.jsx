import React from 'react';
import ItemIcon from '../../base/ItemIcon.jsx';
import ProgressBar from '../../base/ProgressBar.jsx';
import { cn } from '@/ui/utils/cn.js';
import { getTagIconData } from '@/utils/IconUtils.js';

const getTagIconUrl = (tag) => {
    const data = getTagIconData(tag);
    return data?.id || '📦';
};

/**
 * Renders a single resource progress bar row
 */
export const ProgressRow = ({ itemKey, data, getInventoryCount, getItemDef }) => {
    const required = data.required !== undefined ? data.required : data;
    const current = data.current || 0;

    let itemName = itemKey;
    let icon;

    // Resolve Name and Icon
    if (itemKey.startsWith('tag:')) {
        const tag = itemKey.substring(4);
        itemName = `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
        icon = <ItemIcon item={getTagIconUrl(tag)} size={16} />;
    } else {
        const itemDef = getItemDef ? getItemDef(itemKey) : null;
        if (itemDef) {
            itemName = itemDef.name || itemKey;
        }
        icon = <ItemIcon item={itemDef || itemKey} size={16} />;
    }

    const isComplete = current >= required;
    const inventoryCount = getInventoryCount ? getInventoryCount(itemKey) : 0;

    return (
        <div className={cn(
            "flex flex-col gap-1 p-2 rounded-md border",
            isComplete ? "bg-gi-accent/10 border-gi-accent/30 shadow-[0_0_10px_rgba(251,191,36,0.1)]" : "bg-black/20 border-white/5"
        )}>
            <div className="flex justify-between items-center text-pixel-base">
                <div className="flex items-center gap-1.5 font-pixel text-gray-200 min-w-0">
                    <div className="w-4 h-4 flex items-center justify-center bg-black/40 rounded-sm flex-shrink-0">
                        {icon}
                    </div>
                    <span className="truncate uppercase font-bold" title={itemName}>{itemName}</span>
                </div>
                <span className={cn(
                    "font-mono flex-shrink-0 ml-2",
                    isComplete ? "text-gi-accent font-bold" : "text-gray-400"
                )}>
                    {current}/{required}
                </span>
            </div>

            <ProgressBar
                current={current}
                max={required}
                color={isComplete ? 'success' : 'primary'}
                size="sm"
                showText={false}
                showBitDrift={false}
            />

            <div className="text-pixel-sm text-gray-500 italic mt-0.5">
                In inventory: {inventoryCount}
            </div>
        </div>
    );
};

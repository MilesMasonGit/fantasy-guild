import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * ItemQuantityBadge
 * An absolute-positioned badge overlaying an item icon to display its stack count.
 * 
 * @param {Object} props
 * @param {number} props.count - The quantity of the item.
 */
export const ItemQuantityBadge = ({
    count = 1,
    className
}) => {
    // Standard game convention: don't show a badge if there is only 1
    if (count <= 1) return null;

    // Cap the visual text at 999k+ if needed, but for now just raw number
    const displayCount = count > 9999 ? `${(count / 1000).toFixed(1)}k` : count;

    return (
        <div className={cn(
            "absolute -bottom-1 -right-1 z-10",
            "bg-black/80 border border-white/20 rounded px-1 min-w-[16px] text-center",
            "text-[8px] font-pixel text-white font-bold tracking-tighter shadow-md backdrop-blur-sm",
            className
        )}>
            {displayCount}
        </div>
    );
};

export default ItemQuantityBadge;

import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * ItemDurabilityBar
 * A tiny progress bar that sits underneath gear/weapons to indicate their remaining condition.
 * Designed to cleanly span the bottom edge of an ItemSlot.
 * 
 * @param {Object} props
 * @param {number} props.current - Current durability.
 * @param {number} props.max - Maximum durability.
 */
export const ItemDurabilityBar = ({
    current = 0,
    max = 100,
    className
}) => {
    // If not gear, max might be 0 or undefined.
    if (!max || max <= 0) return null;

    const percent = Math.max(0, Math.min(100, (current / max) * 100));

    // Color code based on remaining %
    const colorClass = percent > 50 ? 'bg-gi-success' : percent > 20 ? 'bg-gi-warning' : 'bg-gi-danger';

    return (
        <div className={cn(
            "absolute bottom-0 left-0 w-full h-1 bg-black/60 z-10 overflow-hidden",
            className
        )}>
            <div
                className={cn("h-full transition-all duration-300", colorClass)}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
};

export default ItemDurabilityBar;

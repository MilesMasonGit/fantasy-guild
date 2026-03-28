import React, { useState } from 'react';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * ItemIcon Component
 * Optimized renderer for Item Sprites with emoji fallback.
 * 
 * @param {Object} props
 * @param {string|Object} props.item - Item ID or Item object
 * @param {number} props.size - Pixel size (default 32)
 * @param {boolean} props.isDiscovered - Whether the item is discovered (default true)
 * @param {string} props.className - Additional classes
 */
export const ItemIcon = ({ item, size = 32, isDiscovered = true, className }) => {
    const [hasError, setHasError] = useState(false);

    // If not discovered, show consistent question mark
    if (!isDiscovered) {
        const validSize = [16, 32, 64, 128].includes(Number(size)) ? Number(size) : 32;
        const sizeClass = `gi-icon-${validSize}`;
        return (
            <div
                className={cn("flex items-center justify-center select-none grayscale opacity-60", sizeClass, className)}
                style={{ fontSize: validSize * 0.6 }}
                title="???"
            >
                ❓
            </div>
        );
    }

    // Resolve sprite path via manifest-backed AssetManager
    const spritePath = resolveSpritePath(item);

    // Constrain size to standards: 16, 32, 64, 128. Fast fallback to 32.
    const validSize = [16, 32, 64, 128].includes(Number(size)) ? Number(size) : 32;
    const sizeClass = `gi-icon-${validSize}`;

    // Improve emoji resolution for string IDs
    let emoji = '📦';
    let name = '';

    if (typeof item === 'object' && item !== null) {
        emoji = item.icon || '📦';
        name = item.name || '';
    } else if (typeof item === 'string') {
        // If it's a short string (like a raw emoji), use it directly
        if (item.length <= 4) {
            emoji = item;
        } else {
            // Otherwise, try to look up in registries
            const itemDef = getItem(item);
            const enemyDef = !itemDef ? getEnemy(item) : null;
            emoji = itemDef?.icon || enemyDef?.icon || '📦';
            name = itemDef?.name || enemyDef?.name || item;
        }
    }

    // If no sprite path exists at all, go straight to emoji
    if (!spritePath || hasError) {
        return (
            <div
                className={cn("flex items-center justify-center select-none", sizeClass, className)}
                style={{ fontSize: validSize * 0.6 }}
                title={name}
            >
                {emoji}
            </div>
        );
    }

    return (
        <div
            className={cn("relative flex items-center justify-center overflow-hidden", sizeClass, className)}
            title={name}
        >
            <img
                src={spritePath}
                alt={name}
                className="pixel-art w-full h-full object-contain"
                onError={() => setHasError(true)}
                loading="lazy"
            />
        </div>
    );
};

export default ItemIcon;

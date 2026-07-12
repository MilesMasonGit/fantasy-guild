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

    // Resolve the item or enemy object from its string ID to retrieve correct sprite properties
    let resolvedItem = item;
    if (typeof item === 'string' && item.length > 4) {
        const itemDef = getItem(item);
        const enemyDef = !itemDef ? getEnemy(item) : null;
        if (itemDef || enemyDef) {
            resolvedItem = itemDef || enemyDef;
        }
    }

    // Resolve sprite path via manifest-backed AssetManager
    const spritePath = resolveSpritePath(resolvedItem);

    // Constrain size to standards: 16, 32, 64, 128. Fast fallback to 32.
    const validSize = [16, 32, 64, 128].includes(Number(size)) ? Number(size) : 32;
    const sizeClass = `gi-icon-${validSize}`;

    // Improve emoji resolution for string IDs
    let emoji = '📦';
    let name = '';

    if (typeof resolvedItem === 'object' && resolvedItem !== null) {
        emoji = resolvedItem.icon || '📦';
        name = resolvedItem.name || '';
    } else if (typeof resolvedItem === 'string') {
        // If it's a short string (like a raw emoji), use it directly
        if (resolvedItem.length <= 4) {
            emoji = resolvedItem;
        } else {
            emoji = '📦';
            name = resolvedItem;
        }
    }

    // If no sprite path exists at all, go straight to placeholder SVG
    if (!spritePath || hasError) {
        return (
            <div
                className={cn("flex items-center justify-center select-none border border-white/5 rounded bg-black/20 text-gray-500", sizeClass, className)}
                title={name}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '50%', height: '50%', opacity: 0.4 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
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

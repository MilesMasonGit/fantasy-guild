import { useState } from 'react';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { PixelGlyph } from './PixelGlyph.jsx';

/**
 * ItemIcon Component
 * Optimized renderer for Item Sprites; an undiscovered item is the pixel "?".
 * 
 * @param {Object} props
 * @param {string|Object} props.item - Item ID or Item object
 * @param {number} props.size - Pixel size (default 32)
 * @param {boolean} props.isDiscovered - Whether the item is discovered (default true)
 * @param {string} props.className - Additional classes
 * @param {string|null} [props.title] - Hover text, the item's name by default; `null` for none,
 *   where a shared Tooltip around the icon says it instead.
 */
export const ItemIcon = ({ item, size = 32, isDiscovered = true, className, title }) => {
    const [hasError, setHasError] = useState(false);

    if (!isDiscovered) {
        const validSize = [16, 32, 64, 128].includes(Number(size)) ? Number(size) : 32;
        const sizeClass = `gi-icon-${validSize}`;
        // The pixel "?" at the largest whole scale that fits the icon's box.
        return (
            <div
                data-item-unknown
                className={cn("flex items-center justify-center select-none text-gi-muted/60", sizeClass, className)}
                title={title === null ? undefined : '???'}
            >
                <PixelGlyph name="unknown" scale={Math.max(1, Math.floor(validSize / 16))} />
            </div>
        );
    }

    // Resolve the item or Token object from its string ID to retrieve correct sprite
    // properties. The fallback is `getTokenType`, which covers every enemy (enemies are
    // Tokens) plus every other Token that reaches this icon by id.
    let resolvedItem = item;
    if (typeof item === 'string' && item.length > 4) {
        const itemDef = getItem(item);
        const tokenDef = !itemDef ? getTokenType(item) : null;
        if (itemDef || tokenDef) {
            resolvedItem = itemDef || tokenDef;
        }
    }

    const spritePath = resolveSpritePath(resolvedItem);

    // Constrain size to standards: 16, 32, 64, 128. Fast fallback to 32.
    const validSize = [16, 32, 64, 128].includes(Number(size)) ? Number(size) : 32;
    const sizeClass = `gi-icon-${validSize}`;

    let name = '';

    if (typeof resolvedItem === 'object' && resolvedItem !== null) {
        name = resolvedItem.name || '';
    } else if (typeof resolvedItem === 'string' && resolvedItem.length > 4) {
        name = resolvedItem;
    }

    if (!spritePath || hasError) {
        return (
            <div
                className={cn("flex items-center justify-center select-none bg-black/20 text-gray-500", sizeClass, className)}
                title={title === null ? undefined : (title || name)}
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
            title={title === null ? undefined : (title || name)}
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

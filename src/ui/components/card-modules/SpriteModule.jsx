import React from 'react';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { ItemIcon } from '../base/ItemIcon.jsx';

/**
 * SpriteModule
 * A generic UI module for visually displaying a card's assigned sprite or icon.
 * Intended for items, blueprints, and minimal objects that don't need complex workcycles.
 */
const SpriteModule = React.memo(({ trait, card }) => {
    if (!card) return null;

    const template = getCard(card.templateId) || {};
    const spriteOrIcon = card.sprite || template.sprite || card.icon || template.icon;

    if (!spriteOrIcon) return null;

    return (
        <div className="flex flex-col items-center justify-center py-4 relative z-10 w-full">
            <ItemIcon item={spriteOrIcon} size={64} className="drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
        </div>
    );
}, (prev, next) => {
    return prev.card?._rev === next.card?._rev && prev.trait === next.trait;
});

export default SpriteModule;

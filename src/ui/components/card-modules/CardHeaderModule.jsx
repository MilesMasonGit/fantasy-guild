import React from 'react';
import { getCard } from '../../../config/registries/cardRegistry.js';
import Badge from '../base/Badge.jsx';

/**
 * CardHeaderModule
 * Renders the main Title, Type, and Tags/Rarity for a Card.
 */
const CardHeaderModule = React.memo(({ trait, card, isFirst, globalIndex = 0 }) => {
    if (!card) return null;

    const template = getCard(card.templateId) || {};

    return (
        <div className="flex flex-col relative z-10 w-full bg-black/30 p-2 rounded-lg border border-white/5">
            {/* Title */}
            <div className="flex flex-col items-center justify-center gap-1 mb-1 text-center relative">
                <span className="gi-card-title font-bold text-white tracking-widest uppercase">
                    {card.name || template.name || 'Unknown Card'}
                </span>
            </div>

            {/* Tags (Matte GI Labels) */}
            {card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-1 px-2">
                    {card.tags.map(tag => (
                        <span key={tag} className="gi-label-matte">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    return prev.card?._rev === next.card?._rev && prev.trait === next.trait;
});

export default CardHeaderModule;

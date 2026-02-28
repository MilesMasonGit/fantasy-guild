import React from 'react';
import { getBiome } from '../../../config/registries/biomeRegistry.js';
import { getModifier } from '../../../config/registries/modifierRegistry.js';
import { RARITY_INFO } from '../../../config/registries/cardRegistry.js';

export const GICardMetadataModule = ({ card, options = {} }) => {
    const { showSource = true, showRarity = true, showTags = true } = options;

    if (!card) return null;

    // --- Rarity ---
    const rarity = card.rarity || 'basic';
    const rarityInfo = RARITY_INFO[rarity] || { label: 'Basic' };

    // --- Source Info (Biome + Modifier) ---
    // Only show source for non-area cards
    const shouldShowSource = showSource && card.cardType !== 'area';
    let sourceName = '';

    if (shouldShowSource) {
        if (!card.biomeId) {
            sourceName = 'Guild Hall';
        } else {
            const biome = getBiome(card.biomeId);
            const modifier = card.modifierId ? getModifier(card.modifierId) : null;

            const modifierName = modifier?.name || '';
            const biomeName = biome?.name || 'Unknown';

            sourceName = modifier ? `${modifierName} ${biomeName}` : biomeName;
        }
    }

    // --- Tags ---
    const tags = card.tags || [];
    const type = card.cardType || card.type || '';

    return (
        <div className="flex flex-wrap gap-2 px-3 mb-1">
            {/* Source Badge (Defaults to showing Rarity colors like the legacy UI) */}
            {shouldShowSource && (
                <span className={`card__rarity-badge card__rarity-badge--${rarity} !text-[0.65rem] !px-2 !py-0.5`}>
                    {sourceName}
                </span>
            )}

            {/* If we aren't showing the Source but want to show Rarity explicitly */}
            {showRarity && !shouldShowSource && rarity !== 'basic' && (
                <span className={`card__rarity-badge card__rarity-badge--${rarity} !text-[0.65rem] !px-2 !py-0.5`}>
                    {rarityInfo.label}
                </span>
            )}

            {/* Custom Tailwind Pill Tags for Card Type and specific Tags */}
            {showTags && type && (
                <span className="px-2 py-0.5 rounded-full text-[0.65rem] uppercase tracking-wider font-bold bg-white/10 text-[var(--text-secondary)] shadow-sm">
                    {type}
                </span>
            )}
            {showTags && tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-[0.65rem] uppercase tracking-wider font-semibold bg-[var(--color-bg-panel-inset)] text-[var(--text-secondary)] border border-white/5 shadow-sm">
                    {tag}
                </span>
            ))}
        </div>
    );
};

export default GICardMetadataModule;

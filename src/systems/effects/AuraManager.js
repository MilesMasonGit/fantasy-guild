import { GameState } from '../../state/GameState.js';
import { logger } from '../../utils/Logger.js';
import { ModifierAggregator } from './ModifierAggregator.js';
import { getTileType } from '../../config/registries/tileRegistry.js';

/**
 * AuraManager - Handles grid-based proximity bonuses and pulses.
 */
export class AuraManager {
    constructor() {
        this.activeAuras = new Map(); // sourceId -> Set(targetIds)
    }

    /**
     * Trigger an aura pulse for the entire grid.
     * Usually called on card movement or placement.
     */
    pulseGrid() {
        // 1. Get all relevant entities
        const activeCards = GameState.state.cards?.active || [];
        const heroes = Object.values(GameState.state.heroes || {});

        // 2. Perform Expiry Cleanup (Temporal logic)
        for (const card of activeCards) {
            if (card.aggregator) card.aggregator.purgeExpired();
        }
        for (const hero of heroes) {
            if (hero.aggregator) hero.aggregator.purgeExpired();
        }
        
        // 3. Wipe current aura-based modifiers from all cards
        for (const card of activeCards) {
            if (card.aggregator) {
                this.clearAuraModifiers(card);
            }
        }

        // 4. Scan every card for proximity sources
        for (const sourceCard of activeCards) {
            this.processCardAuras(sourceCard, activeCards);
        }

        // 5. Process Tile Auras (Environmental)
        this.processTileAuras(activeCards);

        logger.debug('AuraManager', 'Grid pulse complete');
    }

    /**
     * Clear all modifiers from an entity that originated from an aura/tile
     */
    clearAuraModifiers(entity) {
        if (!entity.aggregator) return;
        
        for (const [sourceId, mods] of entity.aggregator.modifiers) {
            if (sourceId.startsWith('aura:') || sourceId.startsWith('tile:')) {
                entity.aggregator.removeModifiersBySource(sourceId);
            }
        }
    }

    /**
     * Scans and applies auras for a specific card
     */
    processCardAuras(sourceCard, allCards) {
        const traits = sourceCard.traits || [];
        const proximityTraits = traits.filter(t => t.type === 'proximity_buff' || t.type === 'aura');

        for (const trait of proximityTraits) {
            const range = trait.radius || trait.range || 1;
            const sx = sourceCard.position?.x;
            const sy = sourceCard.position?.y;

            if (sx === undefined || sy === undefined || sx === null || sy === null) continue;

            for (const targetCard of allCards) {
                if (sourceCard.id === targetCard.id) continue;

                const tx = targetCard.position?.x;
                const ty = targetCard.position?.y;
                if (tx === undefined || ty === undefined || tx === null || ty === null) continue;

                // Chebyshev distance for 8-way (Moore) neighborhood
                const dist = Math.max(Math.abs(sx - tx), Math.abs(sy - ty));
                
                if (dist <= range) {
                    this.applyAuraModifier(targetCard, sourceCard.id, trait.effect || trait);
                }
            }
        }
    }

    /**
     * Processes static tile environmental bonuses
     */
    processTileAuras(allCards) {
        const tileMap = GameState.grid?.tileMap || {};
        const propsMap = GameState.grid?.propsMap || {};

        for (const card of allCards) {
            const cx = card.position?.x;
            const cy = card.position?.y;
            if (cx === undefined || cy === undefined || cx === null || cy === null) continue;

            // Simple 3x3 scan for tile adjacency
            for (let x = cx - 1; x <= cx + 1; x++) {
                for (let y = cy - 1; y <= cy + 1; y++) {
                    const tileKey = `${x},${y}`;
                    const tileIds = [];
                    if (tileMap[tileKey]) tileIds.push(tileMap[tileKey]);
                    if (propsMap[tileKey]) tileIds.push(propsMap[tileKey]);

                    for (const tileId of tileIds) {
                        const tile = getTileType(tileId);
                        if (!tile || !tile.bonuses) continue;

                        // Distance from card to tile
                        const dist = Math.max(Math.abs(cx - x), Math.abs(cy - y));

                        for (const bonus of tile.bonuses) {
                            const range = bonus.range === 'self' ? 0 : 1;
                            if (dist <= range) {
                                this.applyAuraModifier(card, `tile:${tileKey}`, bonus);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Helper to wrap and apply a UMI modifier
     */
    applyAuraModifier(target, sourceId, effect) {
        if (!target.aggregator) {
            target.aggregator = new ModifierAggregator(target.id);
        }

        // Normalize constants and mapping
        // 1. Ensure type is UPPERCASE (matches EFFECT_TYPES)
        // Prioritize effectType (e.g. 'SPEED') over trait type (e.g. 'aura')
        const type = (effect.effectType || effect.type || '').toUpperCase();
        
        // 2. Map 'category' to 'target.category' if missing
        const targetCategory = (effect.target?.category || effect.category || effect.targetCategory || 'all').toLowerCase();

        const umi = {
            source: `aura:${sourceId}`,
            type: type,
            target: { category: targetCategory },
            value: effect.value || effect.bonus || 0,
            metadata: effect.metadata || {}
        };

        target.aggregator.addModifier(umi);
    }
}

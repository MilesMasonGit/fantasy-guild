// Fantasy Guild - Assignment System
// Phase 2: Single-Hero Standardization

import { EventBus } from '../core/EventBus.js';
import { GameState } from '../../state/GameState.js';
import { logger } from '../../utils/Logger.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as CardManager from '../cards/CardManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';

/**
 * AssignmentSystem
 * Central orchestrator for "dropping" entities onto cards.
 * Standardized on Single-Hero model for Phase 2.
 */
export const AssignmentSystem = {
    init() {
        // Reactive re-sync for heroes who level up while assigned
        EventBus.subscribe('heroes_updated', (data) => {
            if (data?.heroId && data.source !== 'setAssignment') {
                const hero = HeroManager.getHero(data.heroId);
                if (hero?.assignedCardId) {
                    const card = CardManager.getCard(hero.assignedCardId);
                    if (card) {
                        this.syncHeroModifiersToCard(hero, card);
                        CardManager.bumpCardRev(card);
                    }
                }
            }
        });
    },

    /**
     * Assign a hero to a card.
     * Standardized: Only one hero per card, no slots.
     */
    assignHero(heroId, cardId) {
        const hero = HeroManager.getHero(heroId);
        const card = CardManager.getCard(cardId);

        if (!hero || !card) return { success: false, error: 'ENTITY_NOT_FOUND' };
        if (hero.status === 'wounded') return { success: false, error: 'HERO_WOUNDED' };
        if (hero.assignedCardId) return { success: false, error: 'HERO_BUSY' };

        // 1. Update Card State (Atomic)
        CardManager.setAssignedHero(cardId, heroId);

        // 2. Update Hero State (Atomic)
        HeroManager.setAssignment(heroId, cardId);

        // 3. Sync Modifiers
        this.syncHeroModifiersToCard(hero, card);

        // 4. Status Handling
        if (['task', 'combat', 'invasion'].includes(card.cardType)) {
            card.status = 'active';
        }

        EventBus.publish('hero_assigned', { heroId, cardId });
        CardManager.publishCardUpdate(cardId);
        logger.info('AssignmentSystem', `Hero ${heroId} assigned to ${cardId}`);
        return { success: true };
    },

    /**
     * Unassign a hero from their current card.
     */
    unassignHero(heroId) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || !hero.assignedCardId) return { success: true };

        const cardId = hero.assignedCardId;
        const card = CardManager.getCard(cardId);

        // 1. Clear Card State
        if (card) {
            CardManager.clearAssignedHero(cardId);
            this.clearHeroModifiersFromCard(heroId, card);
            card.status = 'idle';
            card.progress = 0;
        }

        // 2. Clear Hero State
        HeroManager.setAssignment(heroId, null);

        EventBus.publish('hero_unassigned', { heroId, cardId });
        if (cardId) CardManager.publishCardUpdate(cardId);
        logger.info('AssignmentSystem', `Hero ${heroId} unassigned from ${cardId}`);
        return { success: true };
    },

    /**
     * Silently unlink a hero from their card.
     * Prevents notifications and status resets during snapshots.
     */
    silentUnlinkHero(heroId) {
        const hero = HeroManager.getHero(heroId);
        if (!hero) return;
        hero.assignedCardId = null;
        hero.status = 'idle';
    },

    /**
     * Silently clear assigned hero from a card.
     */
    silentUnlinkCard(cardId) {
        const card = CardManager.getCard(cardId);
        if (card && card.assignedHeroId) {
            const heroId = card.assignedHeroId;
            CardManager.clearAssignedHero(cardId);
            this.clearHeroModifiersFromCard(heroId, card);
        }
    },

    /**
     * Professional Sync: Prefixes all hero modifiers for traceability and clean reversal.
     */
    syncHeroModifiersToCard(hero, card) {
        if (!card.aggregator) card.aggregator = new ModifierAggregator(card.id);

        const prefix = `hero:${hero.id}`;
        card.aggregator.removeModifiersBySource(prefix);

        if (hero.aggregator) {
            for (const [sourceId, mods] of hero.aggregator.modifiers) {
                for (const mod of mods) {
                    card.aggregator.addModifier({
                        ...mod,
                        source: `${prefix}:${sourceId}`
                    });
                }
            }
        }
    },

    /**
     * Clear all modifiers belonging to a specific hero from a card.
     */
    clearHeroModifiersFromCard(heroId, card) {
        if (!card.aggregator) return;
        const prefix = `hero:${heroId}`;
        const sourcesToRemove = [];
        
        for (const sourceId of card.aggregator.modifiers.keys()) {
            if (sourceId.startsWith(prefix)) sourcesToRemove.push(sourceId);
        }
        
        sourcesToRemove.forEach(s => card.aggregator.removeModifiersBySource(s));
    },

    // ========================================
    // Other Assignments (Blueprint, Tool, Item)
    // ========================================

    assignBlueprint(blueprintId, buildingId) {
        const blueprint = CardManager.getCard(blueprintId);
        const building = CardManager.getCard(buildingId);
        if (!blueprint || !building) return { success: false, error: 'NOT_FOUND' };

        if (building.assignedBlueprintId) this.unassignBlueprint(buildingId);
        building.assignedBlueprintId = blueprintId;
        blueprint.isHidden = true;

        CardManager.bumpCardRev(building);
        CardManager.bumpCardRev(blueprint);
        EventBus.publish('blueprint_assigned', { blueprintId, buildingId });
        CardManager.publishCardUpdate(buildingId);
        CardManager.publishCardUpdate(blueprintId);
        return { success: true };
    },

    unassignBlueprint(buildingId) {
        const building = CardManager.getCard(buildingId);
        if (!building?.assignedBlueprintId) return { success: true };

        const blueprint = CardManager.getCard(building.assignedBlueprintId);
        building.assignedBlueprintId = null;
        if (blueprint) blueprint.isHidden = false;

        CardManager.bumpCardRev(building);
        if (blueprint) CardManager.bumpCardRev(blueprint);
        EventBus.publish('blueprint_unassigned', { buildingId });
        CardManager.publishCardUpdate(buildingId);
        if (blueprint) CardManager.publishCardUpdate(blueprint.id);
        return { success: true };
    },

    assignTool(cardId, itemId) {
        const card = CardManager.getCard(cardId);
        if (!card) return { success: false, error: 'CARD_NOT_FOUND' };
        if (!InventoryManager.hasItem(itemId)) return { success: false, error: 'ITEM_NOT_AVAILABLE' };

        card.assignedToolId = itemId;
        CardManager.bumpCardRev(card);
        EventBus.publish('tool_assigned', { cardId, itemId });
        CardManager.publishCardUpdate(cardId);
        return { success: true };
    },

    unassignTool(cardId) {
        const card = CardManager.getCard(cardId);
        if (!card?.assignedToolId) return { success: true };

        card.assignedToolId = null;
        CardManager.bumpCardRev(card);
        EventBus.publish('tool_unassigned', { cardId });
        CardManager.publishCardUpdate(cardId);
        return { success: true };
    },

    assignItem(cardId, slotIndex, itemId, amount = 1) {
        const card = CardManager.getCard(cardId);
        if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

        if (!card.assignedItems) card.assignedItems = {};
        card.assignedItems[slotIndex] = { id: itemId, amount, isGhost: true };

        CardManager.bumpCardRev(card);
        EventBus.publish('item_assigned', { cardId, slotIndex, itemId });
        CardManager.publishCardUpdate(cardId);
        return { success: true };
    },

    unassignItem(cardId, slotIndex) {
        const card = CardManager.getCard(cardId);
        if (!card?.assignedItems?.[slotIndex]) return { success: true };

        delete card.assignedItems[slotIndex];
        CardManager.bumpCardRev(card);
        EventBus.publish('item_unassigned', { cardId, slotIndex });
        CardManager.publishCardUpdate(cardId);
        return { success: true };
    },

    /**
     * Helper to check if an item is already present on a card (input or tool).
     */
    isItemAlreadyAssigned(card, itemId) {
        const inInputs = card.assignedItems && Object.values(card.assignedItems).some(a => (a?.id || a) === itemId);
        const asTool = card.assignedToolId === itemId;
        return inInputs || asTool;
    },

    /**
     * Unified unassign logic.
     */
    unassignSlot(cardId, slotKey) {
        const [type, indexStr] = slotKey.split('-');
        const index = parseInt(indexStr, 10);

        if (type === 'hero') {
            const card = CardManager.getCard(cardId);
            if (card?.assignedHeroId) return this.unassignHero(card.assignedHeroId);
        }
        if (type === 'input') return this.unassignItem(cardId, index);
        if (type === 'tool') return this.unassignTool(cardId);
        if (type === 'blueprint') return this.unassignBlueprint(cardId);

        return { success: false };
    },

    /**
     * Smart routing - The "One Large Hitbox" logic.
     * Scans card traits to find the first valid slot for the dropped entity.
     */
    smartAssignEntity(cardId, entityType, entityId) {
        const card = CardManager.getCard(cardId);
        if (!card || !card.traits) return { success: false, error: 'CARD_NOT_FOUND' };

        const traits = card.traits.reduce((acc, t) => {
            const type = t.type.toLowerCase();
            if (!acc[type]) acc[type] = [];
            acc[type].push(t);
            return acc;
        }, {});

        // 1. HERO ASSIGNMENT
        if (entityType === 'hero') {
            if (traits.heroslot) return this.assignHero(entityId, cardId);
            return { success: false, error: 'NO_HERO_SLOT' };
        }

        // 2. BLUEPRINT ASSIGNMENT
        if (entityType === 'blueprint' || (entityType === 'card' && entityId.includes('blueprint'))) {
            if (traits.blueprintslot || traits.inputslot) return this.assignBlueprint(entityId, cardId);
            return { success: false, error: 'NO_BLUEPRINT_SLOT' };
        }

        // 3. ITEM / TOOL ASSIGNMENT
        if (entityType === 'item') {
            const itemDef = getItem(entityId);
            if (!itemDef) return { success: false, error: 'ITEM_NOT_FOUND' };

            if (this.isItemAlreadyAssigned(card, entityId)) {
                return { success: false, error: 'ALREADY_ASSIGNED' };
            }

            // A. Check for Dynamic Input Slots first (Workstations)
            if (traits.dynamic_inputslots) {
                for (let i = 0; i < 4; i++) {
                    if (!card.assignedItems?.[i]) {
                        return this.assignItem(cardId, i, entityId);
                    }
                }
            }

            // B. Check for Input Slots (finding first EMPTY valid slot)
            if (traits.inputslot) {
                for (const trait of traits.inputslot) {
                    const inputs = trait.inputs || [trait];
                    for (let i = 0; i < inputs.length; i++) {
                        const req = inputs[i];
                        const slotIndex = trait.inputs ? i : (trait.slotIndex ?? 0);
                        
                        let matches = false;
                        if (req.itemId) matches = (entityId === req.itemId);
                        else if (req.acceptTag) matches = itemDef.tags?.includes(req.acceptTag);
                        else matches = true;

                        if (matches && !card.assignedItems?.[slotIndex]) {
                            return this.assignItem(cardId, slotIndex, entityId);
                        }
                    }
                }
            }

            // B. Fallback to Tool Slots
            if (traits.toolslot) {
                for (const trait of traits.toolslot) {
                    let matches = false;
                    if (trait.toolType) matches = (itemDef.toolType === trait.toolType || itemDef.tags?.includes(trait.toolType));
                    else matches = true;

                    if (matches && !card.assignedToolId) {
                        return this.assignTool(cardId, entityId);
                    }
                }
            }
        }

        return { success: false, error: 'NO_VALID_SLOT' };
    }
};

export default AssignmentSystem;

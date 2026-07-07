// Fantasy Guild - Assignment System
// Phase 2: Single-Hero Standardization

import { EventBus } from '../core/EventBus.js';
import * as CardManager from '../cards/CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';

// Sub-routines
import * as HeroHelper from './HeroAssignmentHelper.js';
import * as NonHeroHelper from './NonHeroAssignmentHelper.js';

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

    // --- Hero assignments (proxied to HeroAssignmentHelper) ---
    assignHero: HeroHelper.assignHero,
    unassignHero: HeroHelper.unassignHero,
    silentUnlinkHero: HeroHelper.silentUnlinkHero,
    silentUnlinkCard: HeroHelper.silentUnlinkCard,
    syncHeroModifiersToCard: HeroHelper.syncHeroModifiersToCard,
    clearHeroModifiersFromCard: HeroHelper.clearHeroModifiersFromCard,

    // --- Non-hero assignments (proxied to NonHeroAssignmentHelper) ---
    assignBlueprint: NonHeroHelper.assignBlueprint,
    unassignBlueprint: NonHeroHelper.unassignBlueprint,
    assignTool: NonHeroHelper.assignTool,
    unassignTool: NonHeroHelper.unassignTool,
    assignItem: NonHeroHelper.assignItem,
    unassignItem: NonHeroHelper.unassignItem,

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

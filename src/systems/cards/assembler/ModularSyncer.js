import { GameState } from '../../../state/GameState.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { CARD_TYPES } from '../../../config/registries/cardRegistry.js';
import * as TraitRegistry from './TraitRegistry.js';
import { buildSlotsFromTraits } from './SlotMapper.js';

/**
 * Modular Syncer: Live state-to-trait synchronization.
 */

export function isModular(card) {
    return !!(card.traits && Array.isArray(card.traits));
}

export function ensureModular(card, template) {
    // 1. Resolve basic presentation (Icon)
    syncCardIcon(card, template);

    if (isModular(card)) {
        // 2. Sync Common Traits (Workcycle, Rewards)
        syncCommonTraits(card, template);

        // 3. Sync Combat Traits
        if (card.cardType === CARD_TYPES.COMBAT || template?.cardType === CARD_TYPES.COMBAT) {
            if (!card.traits.some(t => t.type === 'combat')) {
                card.traits = TraitRegistry.generateCombatTraits(card, template);
            }
        }

        // 4. Sync Project Traits (Tiers & Levels)
        if (card.cardType === 'project' || template?.isProject) {
            syncProjectCardState(card, template);
        }

        // 5. Sync Blueprint/Recipe Overlays
        syncBlueprintOverlay(card, template);

        // 6. Project traits back to slots
        buildSlotsFromTraits(card);
        return true;
    }

    // Default Generation
    const cardType = template?.cardType || card?.cardType;
    switch (cardType) {
        case CARD_TYPES.TASK:
        case CARD_TYPES.CRAFTING:
            card.traits = TraitRegistry.generateTaskTraits(card, template);
            break;
        case CARD_TYPES.COMBAT:
            card.traits = TraitRegistry.generateCombatTraits(card, template);
            break;
        case CARD_TYPES.INVASION:
            card.traits = TraitRegistry.generateInvasionTraits(card, template);
            break;
        case CARD_TYPES.PROJECT:
            card.traits = TraitRegistry.generateProjectTraits(card, template);
            break;
        case CARD_TYPES.DUNGEON:
            card.traits = TraitRegistry.generateDungeonTraits(card, template);
            break;
        default:
            return false;
    }

    buildSlotsFromTraits(card);
    return true;
}

/**
 * Internal: Sync card icon from output items if default icon is present.
 */
function syncCardIcon(card, template) {
    if (!card.icon || ['📜', '🃏', '❓'].includes(card.icon)) {
        const config = template?.config || card?.config || {};
        const primaryOutput = config.outputs?.[0];
        if (primaryOutput) {
            const item = getItem(primaryOutput.itemId);
            if (item?.icon) card.icon = item.icon;
        } else if (template?.icon) {
            card.icon = template.icon;
        }
    }
}

/**
 * Internal: Sync generic traits shared by most cards.
 */
function syncCommonTraits(card, template) {
    const config = template?.config || card?.config || {};
    
    // Workcycle taskIcon sync
    const workcycle = card.traits.find(t => t.type === 'workcycle');
    if (workcycle && ['📜', '🃏', '❓'].includes(workcycle.taskIcon)) {
        workcycle.taskIcon = config.outputs?.[0]?.itemId || template?.icon || card.icon || '📜';
    }

    // Unified Reward sync
    if (config.xp > 0 && !card.traits.some(t => t.type === 'unifiedreward')) {
        card.traits.push({ id: 'reward', type: 'unifiedreward', xp: config.xp });
    }
}

/**
 * Internal: Handle Project level syncing and slot re-generation.
 */
function syncProjectCardState(card, template) {
    const projectState = GameState.state.progress.projects?.[template?.id || card.templateId];
    if (projectState) {
        if (!card.project) card.project = {};
        card.project.level = projectState.level || 0;
        card.project.progress = { ...(projectState.inputProgress || {}) };
        card.project.isReady = !!projectState.isReadyForUpgrade;

        const currentTier = template?.tiers?.[card.project.level];
        if (currentTier?.requirements) {
            const reqCount = Object.keys(currentTier.requirements).length;
            const existingSlots = card.traits.filter(t => t.type === 'inputslot');

            if (existingSlots.length !== reqCount) {
                card.traits = TraitRegistry.generateProjectTraits(card, template);
            } else {
                Object.entries(currentTier.requirements).forEach(([itemId, qty], index) => {
                    const slot = existingSlots[index];
                    if (slot) { slot.itemId = itemId; slot.quantity = qty; }
                });
            }
        }
    }
}

/**
 * Internal: Apply Blueprint recipe overlays to generic-slot cards.
 */
function syncBlueprintOverlay(card, template) {
    // Blueprint slot presence
    if (!card.traits.some(t => t.type === 'blueprintslot') && (template?.acceptsBlueprints || card?.acceptsBlueprints)) {
        const acceptList = template?.acceptedBlueprints || card?.acceptedBlueprints || [];
        card.traits.push({ id: 'blueprint', type: 'blueprintslot', acceptedBlueprints: acceptList });
    }

    const activeRecipe = card.activeRecipe || null;
    if (activeRecipe) {
        card.inputs = activeRecipe.inputs || [];
        card.outputs = activeRecipe.outputs || [];
        card.baseTickTime = activeRecipe.baseTickTime || template?.baseTickTime || 10000;
        card.xpAwarded = activeRecipe.xp || template?.xpAwarded || 0;

        // Sync inputs traits if not using generic evaluator
        if (!template?.config?.genericSlots && !card?.config?.genericSlots) {
            const inputTraits = card.traits.filter(t => t.type === 'inputslot');
            if (inputTraits.length !== (activeRecipe.inputs?.length || 0)) {
                card.traits = TraitRegistry.generateTaskTraits(card, template);
            }
        }
    }
}

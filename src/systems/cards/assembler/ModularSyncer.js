import { GameState } from '../../../state/GameState.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { CARD_TYPES, getCard as getCardTemplate } from '../../../config/registries/cardRegistry.js';
import { getRecipesBySubskill } from '../../../config/registries/recipeRegistry.js';
import * as TraitRegistry from './TraitRegistry.js';
import { buildSlotsFromTraits } from './SlotMapper.js';

/**
 * Modular Syncer: Live state-to-trait synchronization.
 */

export function isModular(card) {
    return !!(card.traits && Array.isArray(card.traits));
}

export function evaluateStationRecipe(card) {
    const template = card.templateId ? getCardTemplate(card.templateId) : null;
    const subskillId = template?.config?.recipeGroup || card.config?.recipeGroup;
    const skillCap = template?.config?.skillCap || card.config?.skillCap || 90;

    if (!subskillId) return;

    // Get all recipes for this subskill
    const recipes = getRecipesBySubskill(subskillId);
    
    // Filter recipes under the skill cap
    const validRecipes = recipes.filter(r => r.levelRequirement <= skillCap);

    let matchedRecipe = null;

    // 1. If a recipe is explicitly selected, check if it's valid
    if (card.selectedRecipeId) {
        matchedRecipe = validRecipes.find(r => r.id === card.selectedRecipeId) || null;
    }

    // 2. If no explicit recipe is selected, try matching dynamically based on slot inputs
    if (!matchedRecipe) {
        const assigned = card.assignedItems || {};
        const currentItems = Object.values(assigned).filter(Boolean).map(item => item?.id || item);

        if (currentItems.length > 0) {
            for (const recipe of validRecipes) {
                const recipeInputs = recipe.inputs || [];
                if (recipeInputs.length === 0) continue;

                let isMatch = true;
                const itemsPool = [...currentItems];

                for (const input of recipeInputs) {
                    let index = -1;
                    if (input.itemId) {
                        index = itemsPool.indexOf(input.itemId);
                    } else if (input.tag) {
                        index = itemsPool.findIndex(itemId => {
                            const item = getItem(itemId);
                            return item?.tags?.includes(input.tag) || item?.toolType === input.tag;
                        });
                    }

                    if (index !== -1) {
                        itemsPool.splice(index, 1);
                    } else {
                        isMatch = false;
                        break;
                    }
                }

                if (isMatch) {
                    matchedRecipe = recipe;
                    break;
                }
            }
        }
    }

    // Apply recipe properties
    if (matchedRecipe) {
        card.activeRecipe = matchedRecipe;
        card.activeRecipeId = matchedRecipe.id;
        card.inputs = matchedRecipe.inputs || [];
        card.outputs = matchedRecipe.outputs || [];
        card.baseTickTime = matchedRecipe.baseTickTime || template?.baseTickTime || 10000;
        card.xpAwarded = matchedRecipe.xpAwarded || matchedRecipe.xp || 0;
    } else {
        card.activeRecipe = null;
        card.activeRecipeId = null;
        card.inputs = [];
        card.outputs = [];
        card.baseTickTime = template?.baseTickTime || 10000;
        card.xpAwarded = template?.xpAwarded || 0;
    }
}

export function ensureModular(card, template) {
    // 1. Resolve basic presentation (Icon)
    syncCardIcon(card, template);

    // Evaluate station recipe overlay first
    if (card.cardType === CARD_TYPES.STATION || template?.cardType === CARD_TYPES.STATION) {
        evaluateStationRecipe(card);
    }

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

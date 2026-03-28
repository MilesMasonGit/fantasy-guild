import { CARD_TYPES } from '../../config/registries/cardRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { GameState } from '../../state/GameState.js';

/**
 * Rigid vertical order for card modules - DEPRECATED
 * Layout order is now handled by the UI (e.g., CardView.jsx)
 */
// const MODULE_ORDER = [...]; 

/**
 * Generate traits for a Task card from its template/config
 */
export function generateTaskTraits(card, template) {
    const traits = [];
    const config = template?.config || card?.config || {};

    // Header (card name, type, metadata badges)
    traits.push({ id: 'header', type: 'header' });

    // Description
    traits.push({ id: 'desc', type: 'description' });

    // Skill requirement (if skill is defined)
    if (config.skill) {
        traits.push({
            id: 'skill_req',
            type: 'skillrequirement',
            skill: config.skill,
            level: template?.levelRequired || config.levelRequired || 1
        });
    }

    // Hero slot
    traits.push({ id: 'hero', type: 'heroslot', title: 'Worker' });

    // Blueprint slot (if card accepts blueprints)
    if (template?.acceptsBlueprints || card?.acceptsBlueprints || template?.acceptedBlueprints || card?.acceptedBlueprints) {
        traits.push({
            id: 'blueprint',
            type: 'blueprintslot',
            acceptedBlueprints: template?.acceptedBlueprints || card?.acceptedBlueprints || []
        });
    }

    // Tool slot (if card accepts tools)
    const acceptedToolType = template?.acceptedToolType || card?.acceptedToolType || config.acceptedToolType;
    if (acceptedToolType) {
        traits.push({
            id: 'tool',
            type: 'toolslot',
            toolType: acceptedToolType,
            minTier: template?.minToolTier || card?.minToolTier || config.minToolTier || 0
        });
    }

    // Input slots
    if (config.genericSlots) {
        config.genericSlots.forEach((slot, index) => {
            traits.push({
                id: `input_${index}`,
                type: 'inputslot',
                slotIndex: index,
                acceptTags: slot.acceptTags || [],
                slotLabel: slot.slotLabel
            });
        });
    } else if (config.inputs && config.inputs.length > 0) {
        traits.push({ id: 'inputs', type: 'inputslot', inputs: config.inputs });
    }

    // Resolve primary output ID for the TaskDisplay theater
    let taskIcon = template?.icon || card?.icon || '📜';
    if (config.outputs && config.outputs.length > 0) {
        taskIcon = config.outputs[0].itemId;

        // Update card base icon if it's currently a default
        if (!card.icon || card.icon === '📜' || card.icon === '🃏' || card.icon === '❓') {
            const item = getItem(taskIcon);
            if (item?.icon) card.icon = item.icon;
        }
    }

    // Work cycle bar
    traits.push({
        id: 'workcycle',
        type: 'workcycle',
        taskIcon: taskIcon,
        skill: config.skill,
        taskCategory: config.taskCategory || null
    });

    // Loot/outputs preview (if outputs defined)
    if (config.outputs && config.outputs.length > 0) {
        traits.push({ id: 'loot', type: 'loot', outputs: config.outputs });
    }

    // Unified Reward (XP)
    if (config.xp > 0) {
        traits.push({
            id: 'reward',
            type: 'unifiedreward',
            xp: config.xp
        });
    }

    return traits;
}

/**
 * Generate traits for a Blueprint card
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {Array} Generated traits
 */
export function generateBlueprintTraits(card, template) {
    const skillRaw = template.requiredSkill || "unknown";
    const skillName = skillRaw.charAt(0).toUpperCase() + skillRaw.slice(1);

    return [
        { id: 'header', type: 'header' },
        { id: 'img', type: 'sprite' },
        { id: 'desc', type: 'description', text: `For ${skillName} tasks.` },
        { id: 'draggable', type: 'draggable' }
    ];
}

/**
 * Generate traits for a Combat card
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {Array} Generated traits
 */
export function generateCombatTraits(card, template) {
    const traits = [];

    traits.push({ id: 'header', type: 'header' });
    traits.push({ id: 'desc', type: 'description' });
    traits.push({ id: 'hero', type: 'heroslot', title: 'Fighter' });
    traits.push({ id: 'combat', type: 'combat', enemyId: card.enemyId || template?.enemyId });
    traits.push({ id: 'loot', type: 'loot' });

    return traits;
}

/**
 * Generate traits for an Invasion card
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {Array} Generated traits
 */
export function generateInvasionTraits(card, template) {
    const traits = [];

    traits.push({ id: 'header', type: 'header' });
    traits.push({ id: 'desc', type: 'description' });
    traits.push({ id: 'invasion', type: 'invasionpanel' });
    traits.push({ id: 'hero', type: 'heroslot', title: 'Defender' });
    traits.push({ id: 'combat', type: 'combat', enemyId: card.enemyId || template?.enemyId });

    return traits;
}

/**
 * Generate traits for a Dungeon card
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {Array} Generated traits
 */
export function generateDungeonTraits(card, template) {
    const traits = [];

    traits.push({ id: 'header', type: 'header' });
    traits.push({ id: 'desc', type: 'description' });
    traits.push({ id: 'dungeon', type: 'dungeon' });
    traits.push({ id: 'hero', type: 'heroslot', title: 'Fighter' });
    traits.push({ id: 'combat', type: 'combat', enemyId: card.enemyId });
    traits.push({ id: 'loot', type: 'loot', label: 'Final Reward' });

    return traits;
}

/**
 * Generate traits for a Project card
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {Array} Generated traits
 */
export function generateProjectTraits(card, template) {
    const traits = generateTaskTraits(card, template);

    // Add input slots based on Tier 0 (initial view)
    const initialTier = template.tiers?.[0] || template.tiers?.["0"];
    if (initialTier && initialTier.requirements) {
        Object.entries(initialTier.requirements).forEach(([itemId, qty], index) => {
            traits.push({
                id: `project_input_${index}`,
                type: 'inputslot',
                slotIndex: index,
                itemId: itemId,
                quantity: qty,
                slotLabel: 'Supplies'
            });
        });
    } else if (template.tiers) {
        // Fallback for tiered projects with no Tier 0 (unlikely)
        traits.push({ id: 'project_input_0', type: 'inputslot', slotIndex: 0, slotLabel: 'Supplies' });
    }

    // Add projectpanel - will be handled by ProjectProgressModule
    traits.push({ id: 'project_progress', type: 'projectpanel' });

    return traits;
}

/**
 * Check if a card is using the modular trait system
 */
export function isModular(card) {
    return !!(card.traits && Array.isArray(card.traits));
}

/**
 * Ensure a card has traits, generating them if needed
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {boolean} True if card now has traits
 */
export function ensureModular(card, template) {
    // Always sync icon if missing or default (to fix legacy cards)
    if (!card.icon || card.icon === '📜' || card.icon === '🃏' || card.icon === '❓') {
        const config = template?.config || card?.config || {};
        const primaryOutput = config.outputs?.[0];
        if (primaryOutput) {
            const item = getItem(primaryOutput.itemId);
            if (item?.icon) card.icon = item.icon;
        } else if (template?.icon) {
            card.icon = template.icon;
        }
    }

    if (isModular(card)) {
        // Even if modular, check if workcycle trait needs the new taskIcon property
        const workcycle = card.traits.find(t => t.type === 'workcycle');
        if (workcycle && (!workcycle.taskIcon || workcycle.taskIcon === '📜' || workcycle.taskIcon === '🃏' || workcycle.taskIcon === '❓')) {
            const config = template?.config || card?.config || {};
            const primaryOutput = config.outputs?.[0];
            if (primaryOutput) {
                workcycle.taskIcon = primaryOutput.itemId;
            } else {
                workcycle.taskIcon = template?.icon || card?.icon || '📜';
            }
        }

        // Ensure unifiedreward exists if XP is defined in config
        const reward = card.traits.find(t => t.type === 'unifiedreward');
        if (!reward) {
            const config = template?.config || card?.config || {};
            if (config.xp > 0) {
                card.traits.push({
                    id: 'reward',
                    type: 'unifiedreward',
                    xp: config.xp
                });
            }
        }

        // Combat Trait Syncing (Sync new modular combat UI to legacy modular cards)
        if (card.cardType === CARD_TYPES.COMBAT || template?.cardType === CARD_TYPES.COMBAT) {
            const combatTrait = card.traits.find(t => t.type === 'combat');
            if (!combatTrait) {
                card.traits = generateCombatTraits(card, template);
            }
        }

        // Project Slot & Progress Syncing
        if (card.cardType === 'project' || template?.isProject) {
            // ... (existing project logic) ...
            const projectState = GameState.state.progress.projects?.[template?.id || card.templateId];

            // NEW: Initialize card-local progress mirror for UI reactivity
            if (!card.inputProgress) card.inputProgress = {};

            if (projectState) {
                // Sync current level for UI trait lookups
                card.level = projectState.level || 0;

                // Sync progress mirror (overwrite to reset on level-up)
                card.inputProgress = { ...(projectState.inputProgress || {}) };
                card.isReadyForUpgrade = !!projectState.isReadyForUpgrade;

                const currentTier = template?.tiers?.[projectState.level];
                if (currentTier && currentTier.requirements) {
                    const reqEntries = Object.entries(currentTier.requirements);

                    // Check if we already have the correct number of slots
                    const existingSlots = card.traits.filter(t => t.type === 'inputslot');

                    if (existingSlots.length !== reqEntries.length) {
                        // Re-generate traits to get correct slot count/types
                        // Note: This preserves assignedItems state since that's on the card, not the trait
                        card.traits = generateProjectTraits(card, template);
                    } else {
                        // Sync existing slots data
                        reqEntries.forEach(([itemId, qty], index) => {
                            const slot = existingSlots[index];
                            if (slot) {
                                slot.itemId = itemId;
                                slot.quantity = qty;
                            }
                        });
                    }
                }
            }
        }

        // DYNAMIC PRESET SYNCING: Ensure blueprint slot exists if template accepts blueprints
        const blueprintTrait = card.traits.find(t => t.type === 'blueprintslot');
        if (!blueprintTrait && (template?.acceptsBlueprints || card?.acceptsBlueprints || template?.acceptedBlueprints || card?.acceptedBlueprints)) {
            const acceptList = template?.acceptedBlueprints || card?.acceptedBlueprints || [];
            const inputIndex = card.traits.findIndex(t => t.type === 'inputslot');
            const traitData = { id: 'blueprint', type: 'blueprintslot', acceptedBlueprints: acceptList };
            if (inputIndex !== -1) {
                card.traits.splice(inputIndex, 0, traitData);
            } else {
                card.traits.push(traitData);
            }
        }

        // BLUEPRINT SYNCING (Phase 2)
        // If the card has a blueprint assigned, we need to ensure traits reflect the blueprint's recipe.
        const blueprintId = card.assignedBlueprintId;
        const blueprintTemplate = blueprintId ? GameState.getCardById(blueprintId) : null;

        // Determine active recipe traits
        let activeRecipe = null;
        const hasGenericSlots = !!(template?.config?.genericSlots || card?.config?.genericSlots);

        if (hasGenericSlots) {
            // Evaluator pattern: use whatever CardManager locked in
            activeRecipe = card.activeRecipe;
        } else {
            // Legacy fixed-slot pattern
            if (blueprintTemplate) {
                activeRecipe = blueprintTemplate.grantedRecipeTraits;
            } else if (template?.nativeRecipeTraits) {
                activeRecipe = template.nativeRecipeTraits;
            }
        }

        if (activeRecipe) {
            // Update card properties for engine parity
            card.inputs = activeRecipe.inputs || [];
            card.outputs = activeRecipe.outputs || [];
            card.baseTickTime = activeRecipe.baseTickTime || template?.baseTickTime || 10000;
            card.xpAwarded = activeRecipe.xp || template?.xpAwarded || 0;

            // Sync Traits (Input slots, Workcycle icon, Loot preview)
            // 1. Inputs - Sync only if NOT using generic slots
            if (!hasGenericSlots) {
                const inputTraits = card.traits.filter(t => t.type === 'inputslot');
                if (inputTraits.length !== (activeRecipe.inputs?.length || 0)) {
                    // If count mismatch, re-generate everything (safest way to handle layout changes)
                    card.traits = generateTaskTraits(card, template);
                } else {
                    // Update existing inputs
                    activeRecipe.inputs?.forEach((input, i) => {
                        const slot = inputTraits[i];
                        if (slot) {
                            slot.itemId = input.itemId;
                            slot.quantity = input.quantity || 1;
                        }
                    });
                }
            }
            // 2. Workcycle & Loot
            const workcycle = card.traits.find(t => t.type === 'workcycle');
            if (workcycle) {
                workcycle.taskIcon = card.outputs[0]?.itemId || template?.icon || card.icon;
                workcycle.baseTickTime = card.baseTickTime;
            }

            const loot = card.traits.find(t => t.type === 'loot');
            if (loot) {
                loot.items = card.outputs;
            }

            const reward = card.traits.find(t => t.type === 'unifiedreward');
            if (reward) {
                reward.xp = card.xpAwarded;
            }
        }
        return true;
    }

    const cardType = template?.cardType || card?.cardType;

    switch (cardType) {
        case CARD_TYPES.TASK:
        case CARD_TYPES.CRAFTING:
            card.traits = generateTaskTraits(card, template);
            return true;
        case CARD_TYPES.COMBAT:
            card.traits = generateCombatTraits(card, template);
            return true;
        case CARD_TYPES.INVASION:
            card.traits = generateInvasionTraits(card, template);
            return true;
        case CARD_TYPES.PROJECT:
            card.traits = generateProjectTraits(card, template);
            return true;
        case CARD_TYPES.DUNGEON:
            card.traits = generateDungeonTraits(card, template);
            return true;
        default:
            return false;
    }
}

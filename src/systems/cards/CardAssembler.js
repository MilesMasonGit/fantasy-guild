// Fantasy Guild - Card Assembler Engine
// Handles sorting and preparing modular card traits for rendering

import { CARD_TYPES } from '../../config/registries/cardRegistry.js';

/**
 * Rigid vertical order for card modules
 * Modules not in this list will be sorted to the end
 */
const MODULE_ORDER = [
    'header',
    'description',
    'skillrequirement',
    'exploreselector',
    'heroslot',
    'statrequirement',
    'inputslot',
    'workcycle',
    'combat',
    'quest',
    'projectpanel',      // Project info/buffs panel
    'reward',           // Quest completion claim UI
    'progress',
    'modifier',
    'unifiedreward',
    'discovery',
    'loot',             // Loot preview 
    'invasionpanel'     // Invasion-specific combined module
];

/**
 * Get the sort order for a module type
 * Returns 99 for unknown types so they sort to the end
 */
function getModuleOrder(type) {
    const index = MODULE_ORDER.indexOf(type.toLowerCase());
    return index === -1 ? 99 : index;
}

/**
 * Generate traits for a Task card from its template/config
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {Array} Generated traits
 */
export function generateTaskTraits(card, template) {
    const traits = [];
    const config = template?.config || card?.config || {};

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

    // Input slots (if inputs are defined)
    if (config.inputs && config.inputs.length > 0) {
        traits.push({ id: 'inputs', type: 'inputslot', inputs: config.inputs });
    }

    // Work cycle bar
    traits.push({ id: 'workcycle', type: 'workcycle' });

    // Loot/outputs preview (if outputs defined)
    if (config.outputs && config.outputs.length > 0) {
        traits.push({ id: 'loot', type: 'loot', outputs: config.outputs });
    }

    return traits;
}

/**
 * Generate traits for a Combat card
 * @param {Object} card - Card instance
 * @param {Object} template - Card template
 * @returns {Array} Generated traits
 */
export function generateCombatTraits(card, template) {
    const traits = [];

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

    traits.push({ id: 'desc', type: 'description' });
    traits.push({ id: 'invasion', type: 'invasionpanel' });
    traits.push({ id: 'hero', type: 'heroslot', title: 'Defender' });

    return traits;
}

/**
 * Assemble and sort traits for a card
 * @param {Object} card - The card instance
 * @param {Array} traits - List of trait definitions from the template/card
 * @returns {Array} Sorted and processed module list
 */
export function assembleCardModules(card, traits = []) {
    if (!traits || traits.length === 0) return [];

    // Sort based on the rigid order
    const sortedTraits = [...traits].sort((a, b) => {
        const orderA = getModuleOrder(a.type);
        const orderB = getModuleOrder(b.type);
        return orderA - orderB;
    });

    return sortedTraits;
}

/**
 * Check if a card is using the modular trait system
 * @param {Object} card 
 * @returns {boolean}
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
    if (isModular(card)) return true;

    const cardType = template?.cardType || card?.cardType;

    switch (cardType) {
        case CARD_TYPES.TASK:
            card.traits = generateTaskTraits(card, template);
            return true;
        case CARD_TYPES.COMBAT:
            card.traits = generateCombatTraits(card, template);
            return true;
        case CARD_TYPES.INVASION:
            card.traits = generateInvasionTraits(card, template);
            return true;
        default:
            return false;
    }
}

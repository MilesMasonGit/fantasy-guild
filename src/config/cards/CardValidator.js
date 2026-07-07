/**
 * Fantasy Guild - Card Validator
 * Validates card definitions and references at startup
 */

import { getItem } from '../registries/itemRegistry.js';
import { getEnemy } from '../registries/enemyRegistry.js';
import { getBiome } from '../registries/biomeRegistry.js';
import { SKILLS, SUB_SKILL_TO_PARENT } from '../registries/skillRegistry.js';
import { getPresetNames } from './card-presets.js';
import { logger } from '../../utils/Logger.js';

/**
 * Validate all loaded cards
 * Logs warnings for issues but does not prevent game from starting
 * @param {Object} cards - Cards object keyed by ID
 * @returns {Object} Validation results { valid: number, warnings: Array }
 */
export function validateAllCards(cards) {
    const results = {
        valid: 0,
        warnings: []
    };

    const validPresets = getPresetNames();

    for (const [cardId, card] of Object.entries(cards)) {
        const cardWarnings = validateCard(cardId, card, validPresets);

        if (cardWarnings.length === 0) {
            results.valid++;
        } else {
            results.warnings.push(...cardWarnings);
        }
    }

    // Log summary
    const totalCards = Object.keys(cards).length;
    if (results.warnings.length > 0) {
        logger.warn('CardValidator', `Validation complete: ${results.valid}/${totalCards} cards valid, ${results.warnings.length} warnings`);
        results.warnings.forEach(w => logger.warn('CardValidator', w));
    } else {
        logger.info('CardValidator', `Validation complete: ${totalCards} cards, no issues found`);
    }

    return results;
}

/**
 * Validate a single card
 * @param {string} cardId 
 * @param {Object} card 
 * @param {Array<string>} validPresets 
 * @returns {Array<string>} Array of warning messages
 */
function validateCard(cardId, card, validPresets) {
    const warnings = [];

    // Required fields
    if (!card.id) {
        warnings.push(`[${cardId}] Missing required field: id`);
    }

    if (!card.cardType) {
        warnings.push(`[${cardId}] Missing required field: cardType`);
    }

    if (!card.name) {
        warnings.push(`[${cardId}] Missing required field: name`);
    }

    // Preset validation
    if (card.preset && !validPresets.includes(card.preset)) {
        warnings.push(`[${cardId}] Invalid preset: "${card.preset}". Valid presets: ${validPresets.join(', ')}`);
    }

    // Must have either preset or traits
    if (!card.preset && !card.traits) {
        warnings.push(`[${cardId}] Card must have either 'preset' or 'traits' defined`);
    }

    // Validate item references in outputs
    if (card.outputs && Array.isArray(card.outputs)) {
        for (const output of card.outputs) {
            if (output.itemId && !getItem(output.itemId)) {
                warnings.push(`[${cardId}] Output references unknown item: "${output.itemId}"`);
            }
        }
    }

    // Validate item references in config.outputs
    if (card.config?.outputs && Array.isArray(card.config.outputs)) {
        for (const output of card.config.outputs) {
            if (output.itemId && !getItem(output.itemId)) {
                warnings.push(`[${cardId}] Config output references unknown item: "${output.itemId}"`);
            }
        }
    }

    // Validate item references in inputs
    if (card.inputs && Array.isArray(card.inputs)) {
        for (const input of card.inputs) {
            if (input.itemId && !getItem(input.itemId)) {
                warnings.push(`[${cardId}] Input references unknown item: "${input.itemId}"`);
            }
        }
    }

    // Validate enemy references
    if (card.enemyId && !getEnemy(card.enemyId)) {
        warnings.push(`[${cardId}] References unknown enemy: "${card.enemyId}"`);
    }

    if (card.config?.enemyId && !getEnemy(card.config.enemyId)) {
        warnings.push(`[${cardId}] Config references unknown enemy: "${card.config.enemyId}"`);
    }

    // Validate area/biome references
    if (card.areaId && !getBiome(card.areaId)) {
        warnings.push(`[${cardId}] References unknown area: "${card.areaId}"`);
    }

    // Validate parent quest (can't validate fully without quest registry, so just check format)
    if (card.parentQuest && typeof card.parentQuest !== 'string') {
        warnings.push(`[${cardId}] parentQuest must be a string (quest ID)`);
    }

    // Validate skill references
    if (card.config?.skill) {
        const skillId = card.config.skill;
        const isValid = SKILLS[skillId] || SUB_SKILL_TO_PARENT[skillId];
        if (!isValid) {
            warnings.push(`[${cardId}] Config references unknown skill or sub-skill tag: "${skillId}"`);
        }
    }

    return warnings;
}

/**
 * Quick validation for a single card being added
 * @param {Object} card 
 * @returns {{ valid: boolean, warnings: Array<string> }}
 */
export function validateSingleCard(card) {
    const validPresets = getPresetNames();
    const warnings = validateCard(card.id || 'unknown', card, validPresets);
    return {
        valid: warnings.length === 0,
        warnings
    };
}

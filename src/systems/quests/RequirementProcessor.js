import { validate } from './RequirementRegistry.js';

/**
 * Comprehensive requirement check for modular cards
 * @param {Object} card 
 * @param {Object} hero 
 * @returns {Object} { met: boolean, missing: Array }
 */
export function checkRequirements(card) {
    if (!card.traits) return { met: true, missing: [] };

    const missing = [];
    for (const trait of card.traits) {
        const result = validate(trait, card);
        if (result) {
            if (Array.isArray(result)) {
                missing.push(...result);
            } else {
                missing.push(result);
            }
        }
    }

    return {
        met: missing.length === 0,
        missing: missing
    };
}

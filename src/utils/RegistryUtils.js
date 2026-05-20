/**
 * RegistryUtils - Utilities for automated Flyweight rehydration
 */
import { logger } from '../utils/Logger.js';

/**
 * Automatically rehydrates an entity (Card, Hero) from its template registry.
 * @param {Object} entity - The saved entity instance
 * @param {Function} getTemplate - Function to retrieve a template by ID
 * @param {string} idField - Field name containing the template ID (default: 'templateId')
 */
export function rehydrateEntity(entity, getTemplate, idField = 'templateId') {
    const templateId = entity[idField];
    if (!templateId) {
        logger.warn('RegistryUtils', `Entity ${entity.id} missing ${idField}, skipping rehydration`);
        return false;
    }

    const template = getTemplate(templateId);
    if (!template) {
        logger.warn('RegistryUtils', `Template not found for ${templateId}, entity ${entity.id} may be broken`);
        return false;
    }

    // Standard merge logic: Merge template props into entity
    // We only merge props that DON'T overwrite the entity's unique instance data (like health, position)
    // For this project, we target specific "static" keys or just merge all non-clashing ones.
    const keysToCopy = [
        'name', 'description', 'icon', 'cardType', 'traits', 'config',
        'skill', 'skillRequirement', 'taskCategory', 'biomeId', 'isUnique',
        'baseTickTime', 'baseEnergyCost', 'toolRequired', 'inputs', 'outputs', 
        'outputMap', 'xpAwarded', 'rarity'
    ];

    for (const key of keysToCopy) {
        if (template[key] !== undefined) {
            entity[key] = template[key];
        } else if (template.config && template.config[key] !== undefined) {
            // Legacy fallback for nested config
            entity[key] = template.config[key];
        }
    }

    return true;
}

/**
 * Rehydrates a list of entities
 */
export function rehydrateList(list, getTemplate, idField = 'templateId') {
    if (!Array.isArray(list)) return 0;
    let count = 0;
    for (const entity of list) {
        if (rehydrateEntity(entity, getTemplate, idField)) {
            count++;
        }
    }
    return count;
}

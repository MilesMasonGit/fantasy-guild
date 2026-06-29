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

    let template = entity._template || getTemplate(templateId);
    if (!template) {
        logger.warn('RegistryUtils', `Template not found for ${templateId}, entity ${entity.id} may be broken`);
        return false;
    }

    // Cache template reference on entity to avoid repetitive lookups and support unregistered/ad-hoc templates
    Object.defineProperty(entity, '_template', {
        value: template,
        writable: true,
        configurable: true,
        enumerable: false
    });

    const keysToCopy = [
        'name', 'description', 'icon', 'cardType', 'traits', 'config',
        'skill', 'skillRequirement', 'taskCategory', 'biomeId', 'isUnique',
        'baseTickTime', 'baseEnergyCost', 'toolRequired', 'inputs', 'outputs', 
        'outputMap', 'xpAwarded', 'rarity'
    ];

    for (const key of keysToCopy) {
        Object.defineProperty(entity, key, {
            get() {
                const temp = this._template || getTemplate(this[idField]);
                if (temp) {
                    if (temp[key] !== undefined) return temp[key];
                    if (temp.config && temp.config[key] !== undefined) return temp.config[key];
                }
                return undefined;
            },
            set(val) {
                Object.defineProperty(this, key, {
                    value: val,
                    writable: true,
                    configurable: true,
                    enumerable: true
                });
            },
            configurable: true,
            enumerable: true
        });
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

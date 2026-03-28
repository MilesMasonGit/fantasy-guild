// Fantasy Guild - Equipment Manager
// Hero Equipment System - Phase 3

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

/**
 * EquipmentManager - Manages hero equipment slots
 * 
 * Equipment slots: weapon, armor, food, drink
 * Items stay in shared inventory pool - heroes just "link" to them
 */

// Equipment slot types
export const EQUIPMENT_SLOTS = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    FOOD: 'food',
    DRINK: 'drink'
};

// Slot display info
export const SLOT_INFO = {
    weapon: { icon: '⚔️', label: 'Weapon' },
    armor: { icon: '🛡️', label: 'Armor' },
    food: { icon: '🍖', label: 'Food' },
    drink: { icon: '🍺', label: 'Drink' }
};

/**
 * Check if an item can be equipped to a specific slot
 * @param {string} itemId 
 * @param {string} slotType 
 * @returns {boolean}
 */
export function canEquipToSlot(itemId, slotType) {
    const template = getItem(itemId);
    if (!template) return false;
    return template.equipSlot === slotType;
}

/**
 * Check if a hero meets the skill requirements to equip an item
 * @param {string} heroId 
 * @param {string} itemId 
 * @returns {{ canEquip: boolean, reason?: string }}
 */
export function canHeroEquip(heroId, itemId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) {
        return { canEquip: false, reason: 'Hero not found' };
    }

    if (hero.isVillager) {
        return { canEquip: false, reason: 'Villagers cannot equip items.' };
    }

    const template = getItem(itemId);
    if (!template) {
        return { canEquip: false, reason: 'Item not found' };
    }

    // Food and drink have no requirements
    if (template.equipSlot === 'food' || template.equipSlot === 'drink') {
        return { canEquip: true };
    }

    // Check skill requirement
    if (template.skillRequired && template.levelRequired) {
        const skillLevel = SkillSystem.getSkillLevel(heroId, template.skillRequired);
        if (skillLevel < template.levelRequired) {
            return {
                canEquip: false,
                reason: `Requires ${template.skillRequired} level ${template.levelRequired} `
            };
        }
    }

    return { canEquip: true };
}

/**
 * Equip an item to a hero's slot
 * @param {string} heroId 
 * @param {string} itemId 
 * @returns {{ success: boolean, error?: string }}
 */
export function equipItem(heroId, itemId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) {
        return { success: false, error: 'Hero not found' };
    }

    const template = getItem(itemId);
    if (!template) {
        return { success: false, error: 'Item not found' };
    }

    if (!template.equipSlot) {
        return { success: false, error: 'Item is not equippable' };
    }

    // Check if item exists in inventory
    if (!InventoryManager.hasItem(itemId, 1)) {
        return { success: false, error: 'Item not in inventory' };
    }

    // Check skill requirements
    const { canEquip, reason } = canHeroEquip(heroId, itemId);
    if (!canEquip) {
        NotificationSystem.error(`${hero.name} cannot equip ${template.name}: ${reason} `);
        return { success: false, error: reason };
    }

    // Check if slot is occupied and return old item if so
    const slot = template.equipSlot;
    if (hero.equipment[slot]) {
        const oldItemId = hero.equipment[slot];
        const oldTemplate = getItem(oldItemId);
        
        // Remove old modifiers
        hero.aggregator.removeModifiersBySource(`equip:${slot}`);
        
        // Return old item to inventory
        InventoryManager.addItem(oldItemId, 1);
        logger.info('EquipmentManager', `Returned ${oldTemplate?.name || oldItemId} to inventory from ${slot}`);
    }

    // Equip the item
    hero.equipment[slot] = itemId;
 
    // NOTE: Shared Reference Model - We NO LONGER removeItem from inventory
    // InventoryManager.removeItem(itemId, 1);
 
    // Apply modifiers to aggregator
    const bonusStats = ['damage', 'defense', 'hpBonus', 'tickSpeedBonus'];
    bonusStats.forEach(stat => {
        if (template[stat]) {
            hero.aggregator.addModifier({
                type: stat.toUpperCase(),
                value: template[stat],
                source: `equip:${slot}`,
                persistent: true
            });
        }
    });

    // Handle tool bonuses
    if (template.skillBonus) {
        hero.aggregator.addModifier({
            type: 'SKILL_LEVEL',
            value: template.skillBonus.value,
            target: { skillId: template.skillBonus.skill },
            source: `equip:${slot}`,
            persistent: true
        });
    }

    EventBus.publish('hero_equipment_changed', {
        heroId,
        slot,
        itemId,
        action: 'equip'
    });
    EventBus.publish('heroes_updated', { source: 'equipItem', heroId });

    logger.info('EquipmentManager', `${hero.name} equipped ${template.name} to ${slot}`);
    return { success: true };
}

/**
 * Unequip an item from a hero's slot
 * @param {string} heroId 
 * @param {string} slot 
 * @returns {{ success: boolean, error?: string }}
 */
export function unequipItem(heroId, slot) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) {
        return { success: false, error: 'Hero not found' };
    }

    if (!hero.equipment[slot]) {
        return { success: false, error: 'Slot is empty' };
    }

    const itemId = hero.equipment[slot];
    hero.equipment[slot] = null;
 
    // Remove modifiers from aggregator
    hero.aggregator.removeModifiersBySource(`equip:${slot}`);
 
    // NOTE: Shared Reference Model - We NO LONGER addItem back to inventory
    // InventoryManager.addItem(itemId, 1);

    EventBus.publish('hero_equipment_changed', {
        heroId,
        slot,
        itemId: null,
        previousItemId: itemId,
        action: 'unequip'
    });
    EventBus.publish('heroes_updated', { source: 'unequipItem', heroId });

    const template = getItem(itemId);
    logger.info('EquipmentManager', `${hero.name} unequipped ${template?.name || itemId} from ${slot}`);
    return { success: true };
}

/**
 * Get the item equipped in a hero's slot
 * @param {string} heroId 
 * @param {string} slot 
 * @returns {string|null} Item ID or null
 */
export function getEquippedItem(heroId, slot) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return null;
    return hero.equipment?.[slot] || null;
}

/**
 * Get all equipped items for a hero
 * @param {string} heroId 
 * @returns {Object} { weapon, armor, food, drink }
 */
export function getAllEquipment(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return { weapon: null, armor: null, food: null, drink: null };
    return { ...hero.equipment };
}

/**
 * Calculate total equipment bonuses for a hero
 * @param {string} heroId 
 * @returns {Object} { damage, defense, hpBonus, tickSpeedBonus }
 */
export function getEquipmentBonuses(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) {
        return { damage: 0, defense: 0, hpBonus: 0, tickSpeedBonus: 0 };
    }
 
    // 1. Sync modifiers based on vault availability
    syncEquipmentModifiers(heroId);
 
    // 2. Query the aggregator for all currently enabled stats
    return {
        damage: hero.aggregator.query('DAMAGE'),
        defense: hero.aggregator.query('DEFENSE'),
        hpBonus: hero.aggregator.query('HPBONUS'),
        tickSpeedBonus: hero.aggregator.query('TICKSPEEDBONUS')
    };
}
 
/**
 * Sync equipment modifiers with inventory state.
 * Disables bonuses for items that are currently out of stock in the vault.
 * @param {string} heroId 
 */
export function syncEquipmentModifiers(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !hero.equipment) return;
 
    for (const [slot, itemId] of Object.entries(hero.equipment)) {
        if (!itemId) continue;
        
        const hasStock = InventoryManager.hasItem(itemId, 1);
        hero.aggregator.setSourceEnabled(`equip:${slot}`, hasStock);
    }
}

/**
 * Check if a hero has any equipment that has been depleted from inventory
 * and auto-unequip those items
 * @param {string} heroId 
 */
export function validateEquipment(heroId) {
    const equipment = getAllEquipment(heroId);
 
    for (const [slot, itemId] of Object.entries(equipment)) {
        if (!itemId) continue;
 
        if (!InventoryManager.hasItem(itemId, 1)) {
            const template = getItem(itemId);
            // PERSISTENT LINKS: We no longer unequip on depletion.
            // unequipItem(heroId, slot);
            // NotificationSystem.warning(`${HeroManager.getHero(heroId)?.name}'s ${template?.name || 'item'} has been depleted!`);
        }
    }
}

/**
 * Reduce durability of an item in a specific slot.
 * Initial baseline: Just log the reduction for now.
 * 
 * @param {string} heroId 
 * @param {string} slot 
 */
export function reduceDurability(heroId, slot) {
    const hero = HeroManager.getHero(heroId);
    const itemId = hero.equipment?.[slot];
    if (!hero || !itemId) return;
 
    // Call inventory manager to handle consumable stack logic
    InventoryManager.decrementDurability(itemId, 1);
}

export default {
    EQUIPMENT_SLOTS,
    SLOT_INFO,
    canEquipToSlot,
    canHeroEquip,
    equipItem,
    unequipItem,
    getEquippedItem,
    getAllEquipment,
    getEquipmentBonuses,
    validateEquipment,
    reduceDurability
};

// Fantasy Guild - Consumable System
// Hero Equipment System - Phase 6: Auto-Consume

import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as EquipmentManager from './EquipmentManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { EventBus } from '../core/EventBus.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

/**
 * ConsumableSystem - Handles auto-consumption of food and drink
 * 
 * Design:
 * - Food auto-consumes when HP < 20%
 * - Drink auto-consumes when Energy < 20%
 * - Consumption "skips" next work tick (handled by caller)
 * - Returns whether hero should skip their next action
 */

// Thresholds for auto-consume (as percentage)
const HP_THRESHOLD = 0.20;     // 20%
const ENERGY_THRESHOLD = 0.20; // 20%

// Cooldown between consumptions per hero (prevent spam)
const CONSUME_COOLDOWN_MS = 2000;
const lastConsumeTime = new Map(); // heroId -> timestamp

/**
 * Check if a hero needs to auto-consume and do so if needed
 * @param {string} heroId 
 * @returns {{ consumed: boolean, type?: 'food'|'drink', skipTick: boolean }}
 */
export function checkAndConsume(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return { consumed: false, skipTick: false };

    // Check cooldown
    const now = Date.now();
    const lastTime = lastConsumeTime.get(heroId) || 0;
    if (now - lastTime < CONSUME_COOLDOWN_MS) {
        return { consumed: false, skipTick: false };
    }

    // Check Energy first (more common to run low)
    const energyPercent = hero.energy.current / hero.energy.max;
    if (energyPercent < ENERGY_THRESHOLD) {
        const drinkId = EquipmentManager.getEquippedItem(heroId, 'drink');
        if (drinkId && InventoryManager.hasItem(drinkId, 1)) {
            return consumeDrink(hero, drinkId);
        }
    }

    // Check HP
    const hpPercent = hero.hp.current / hero.hp.max;
    if (hpPercent < HP_THRESHOLD) {
        const foodId = EquipmentManager.getEquippedItem(heroId, 'food');
        if (foodId && InventoryManager.hasItem(foodId, 1)) {
            return consumeFood(hero, foodId);
        }
    }

    return { consumed: false, skipTick: false };
}

/**
 * Consume drink to restore energy
 * @param {Object} hero 
 * @param {string} drinkId 
 * @returns {{ consumed: boolean, type: 'drink', skipTick: boolean }}
 */
function consumeDrink(hero, drinkId) {
    const template = getItem(drinkId);
    if (!template) return { consumed: false, skipTick: false };

    const restoreAmount = template.restoreAmount || 10;

    // Remove 1 from inventory
    const removed = InventoryManager.removeItem(drinkId, 1);
    if (!removed) return { consumed: false, skipTick: false };

    // Restore energy
    HeroManager.modifyHeroEnergy(hero.id, restoreAmount);

    // Set cooldown
    lastConsumeTime.set(hero.id, Date.now());

    // Check if depleted
    if (!InventoryManager.hasItem(drinkId, 1)) {
        EquipmentManager.unequipItem(hero.id, 'drink');
        NotificationSystem.warning(`${hero.name}'s ${template.name} supply is exhausted!`);
    } else {
        NotificationSystem.info(`${hero.name} drinks ${template.name} (+${restoreAmount} Energy)`);
    }

    EventBus.publish('heroes_updated', { source: 'consumeDrink' });

    return { consumed: true, type: 'drink', skipTick: true };
}

/**
 * Consume food to restore HP
 * @param {Object} hero 
 * @param {string} foodId 
 * @returns {{ consumed: boolean, type: 'food', skipTick: boolean }}
 */
function consumeFood(hero, foodId) {
    const template = getItem(foodId);
    if (!template) return { consumed: false, skipTick: false };

    const restoreAmount = template.restoreAmount || 10;

    // Remove 1 from inventory
    const removed = InventoryManager.removeItem(foodId, 1);
    if (!removed) return { consumed: false, skipTick: false };

    // Restore HP
    HeroManager.modifyHeroHp(hero.id, restoreAmount);

    // Set cooldown
    lastConsumeTime.set(hero.id, Date.now());

    // Check if depleted
    if (!InventoryManager.hasItem(foodId, 1)) {
        EquipmentManager.unequipItem(hero.id, 'food');
        NotificationSystem.warning(`${hero.name}'s ${template.name} supply is exhausted!`);
    } else {
        NotificationSystem.info(`${hero.name} eats ${template.name} (+${restoreAmount} HP)`);
    }

    EventBus.publish('heroes_updated', { source: 'consumeFood' });

    return { consumed: true, type: 'food', skipTick: true };
}

/**
 * Process auto-consume for all working heroes
 * Call this from TaskSystem or GameLoop
 * @returns {Set<string>} Hero IDs that consumed and should skip tick
 */
export function processAutoConsume() {
    const heroesWhoConsumed = new Set();

    const heroes = HeroManager.getAllHeroes();
    for (const hero of heroes) {
        // Only check working heroes
        if (hero.status !== 'working') continue;

        const result = checkAndConsume(hero.id);
        if (result.consumed && result.skipTick) {
            heroesWhoConsumed.add(hero.id);
        }
    }

    return heroesWhoConsumed;
}

/**
 * Reset cooldowns (for testing)
 */
export function resetCooldowns() {
    lastConsumeTime.clear();
}

export default {
    checkAndConsume,
    processAutoConsume,
    resetCooldowns,
    HP_THRESHOLD,
    ENERGY_THRESHOLD
};

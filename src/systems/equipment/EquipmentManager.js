// Fantasy Guild - Equipment Manager
// Phase 40: Equipment Architecture Evolution (Auditor Refactor)

import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    createEmptyEquipment, getGrid,
    findFreeSlot, slotsInCategory, getCategoryCap, isEquipCategory
} from '../../config/registries/equipmentConstants.js';
import * as EquipmentValidator from './EquipmentValidator.js';

/**
 * EquipmentManager - Hub for Hero equipment state and modifier syncing.
 * 
 * Enforces the "Shared Reference" model: Items stay in the shared Inventory stack,
 * and heroes "link" to them in their equipment slots.
 */
/**
 * Which grid slot an item of `category` should go into for this hero.
 *
 * The grid is positionally free (D-7), so placement is simply "the first empty
 * slot". The only rule is the category's cap (D-55): once a hero already
 * carries the maximum of a category, a further item of it DISPLACES the oldest
 * one rather than taking a new slot — which preserves the old behaviour where
 * a third weapon swapped out the first, without needing named instances.
 *
 * @returns {{ slot: number, displaces: number|null }|null}
 *          null when the item can't be placed at all (grid full, no cap).
 */
export function resolveTargetSlot(hero, category) {
    const cap = getCategoryCap(category);
    if (!cap) return null;

    const held = slotsInCategory(hero, category);
    if (held.length >= cap) {
        // At the cap — replace the earliest of this category in grid order.
        return { slot: held[0], displaces: held[0] };
    }

    const free = findFreeSlot(hero);
    if (free === -1) return null;                 // grid full
    return { slot: free, displaces: null };
}

/**
 * Equip an item to a hero. The slot is derived from the item's category —
 * callers don't choose it (see resolveTargetSlot).
 */
export function equipItem(heroId, itemId, preferredSlot = null) {
    const hero = HeroManager.getHero(heroId);
    const template = getItem(itemId);
    if (!hero || !template) return { success: false, error: 'Target not found' };

    // 1. Validation Logic (Delegated)
    if (!InventoryManager.hasItem(itemId, 1)) return { success: false, error: 'Out of stock' };
    
    const { canEquip, reason } = EquipmentValidator.canHeroEquip(heroId, itemId);
    if (!canEquip) {
        NotificationSystem.error(`${hero.name} cannot equip ${template.name}: ${reason}`);
        return { success: false, error: reason };
    }

    // 2. Resolve category -> grid slot. Heroes carry gear AND consumables in
    //    one flexible grid now (D-7), so food/drink/consumable are equippable
    //    categories again — this is the CR-029 reversal made concrete.
    const category = template.equipSlot;
    if (!category || !isEquipCategory(category)) {
        return { success: false, error: 'Item cannot be equipped' };
    }

    // Carrying the same item twice buffs nothing (D-18), so refuse the
    // duplicate outright rather than silently wasting a slot.
    if (getGrid(hero).includes(itemId)) {
        return { success: false, error: `${template.name} is already equipped` };
    }

    let slot = null;
    if (preferredSlot !== null && preferredSlot >= 0 && preferredSlot < 9) {
        const held = slotsInCategory(hero, category).filter(s => s !== preferredSlot);
        const cap = getCategoryCap(category);
        if (held.length >= cap) {
            slot = held[0]; // Cap reached: displace earliest in category
        } else {
            slot = preferredSlot;
        }
    } else {
        const target = resolveTargetSlot(hero, category);
        if (!target) {
            const cap = getCategoryCap(category);
            return {
                success: false,
                error: cap ? 'No free slot in the loadout' : 'Item cannot be equipped'
            };
        }
        slot = target.slot;
    }

    if (getGrid(hero)[slot]) unequipItem(heroId, slot);

    // 3. Apply State & Modifiers
    if (!Array.isArray(hero.equipment)) hero.equipment = createEmptyEquipment();
    hero.equipment[slot] = itemId;
    recalculateEquipmentModifiers(hero);

    EventBus.publish('hero_equipment_changed', { heroId, slot, itemId, action: 'equip' });
    EventBus.publish('heroes_updated', { source: 'equipItem', heroId });
    
    logger.info('EquipmentManager', `${hero.name} equipped ${template.name} to ${slot}`);
    return { success: true };
}

/**
 * Unequip an item from a hero's slot
 */
export function unequipItem(heroId, slot) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.equipment?.[slot]) return { success: false, error: 'Slot is empty' };

    const itemId = hero.equipment[slot];
    hero.equipment[slot] = null;

    // Recalculate all equipment modifiers
    recalculateEquipmentModifiers(hero);

    EventBus.publish('hero_equipment_changed', { heroId, slot, itemId: null, previousItemId: itemId, action: 'unequip' });
    EventBus.publish('heroes_updated', { source: 'unequipItem', heroId });
    
    logger.info('EquipmentManager', `${hero.name} unequipped ${itemId} from ${slot}`);
    return { success: true };
}

/**
 * Sync equipment modifiers with inventory state (Vault-Check)
 * Disables bonuses if the item is out of stock in the shared vault.
 */
export function syncEquipmentModifiers(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.equipment) return;

    getGrid(hero).forEach((itemId, slot) => {
        if (!itemId) return;
        const hasStock = InventoryManager.hasItem(itemId, 1);
        hero.aggregator.setSourceEnabled(`equip:${slot}`, hasStock);
    });
}

/**
 * Get the item equipped in a specific slot
 */
export function getEquippedItem(heroId, slot) {
    return HeroManager.getHero(heroId)?.equipment?.[slot] || null;
}

/**
 * Get all equipment for a hero
 */
export function getAllEquipment(heroId) {
    const hero = HeroManager.getHero(heroId);
    return hero ? [...getGrid(hero)] : createEmptyEquipment();
}

/**
 * Recalculate and apply all active equipment modifiers to the hero aggregator.
 * Collects flat stats, sums matching gear assigned effect levels, caps at level V (5),
 * and converts them to unified math-ready modifiers.
 */
export function recalculateEquipmentModifiers(hero) {
    if (!hero || !hero.aggregator) return;

    // 1. Wipe all existing equipment modifiers
    for (const sourceId of Array.from(hero.aggregator.modifiers.keys())) {
        if (sourceId.startsWith('equip:')) {
            hero.aggregator.removeModifiersBySource(sourceId);
        }
    }

    const activeEffects = {}; // effectId -> sum of scales

    // 2. Scan the loadout grid. Consumables share it with gear now (D-7) and
    //    simply contribute no stats, so no filtering is needed here.
    const grid = getGrid(hero);
    for (let slot = 0; slot < grid.length; slot++) {
        const itemId = grid[slot];
        if (!itemId) continue;
        const template = getItem(itemId);
        if (!template) continue;

        const source = `equip:${slot}`;

        // Apply primary flat stats (damage, defense, etc.)
        ['damage', 'defense', 'hpBonus', 'tickSpeedBonus'].forEach(stat => {
            if (template[stat]) {
                hero.aggregator.addModifier({
                    type: stat.toUpperCase(),
                    value: template[stat],
                    source,
                    persistent: true
                });
            }
        });

        // Apply skill bonuses
        if (template.skillBonus) {
            hero.aggregator.addModifier({
                type: 'SKILL_LEVEL',
                value: template.skillBonus.value,
                target: { skillId: template.skillBonus.skill },
                source,
                persistent: true
            });
        }

        // Collect assigned effects (single assignedEffect or assignedEffects array)
        const effectsToProcess = [];
        if (template.assignedEffect) {
            effectsToProcess.push(template.assignedEffect);
        }
        if (Array.isArray(template.assignedEffects)) {
            effectsToProcess.push(...template.assignedEffects);
        }

        effectsToProcess.forEach(eff => {
            const id = typeof eff === 'string' ? eff : eff.effectId;
            const scale = (typeof eff === 'object' ? eff.scale || eff.level : 1) || 1;
            if (id) {
                activeEffects[id] = (activeEffects[id] || 0) + scale;
            }
        });
    }

    // 3. Register consolidated modifiers to hero aggregator (capped at Level V/5)
    const source = 'equip:aggregated_effects';
    for (const [effectId, rawScale] of Object.entries(activeEffects)) {
        const scale = Math.min(5, rawScale);
        if (scale <= 0) continue;

        switch (effectId) {
            case 'flatDamage':
            case 'damage':
                hero.aggregator.addModifier({
                    type: 'DAMAGE',
                    value: 3 * scale,
                    source,
                    persistent: true
                });
                break;
            case 'accuracyBonus':
            case 'finesse':
                hero.aggregator.addModifier({
                    type: 'ACCURACY',
                    value: 5 * scale,
                    source,
                    persistent: true
                });
                break;
            case 'slowAttack':
            case 'stun':
                hero.aggregator.addModifier({
                    type: 'SLOW_ENEMY',
                    value: 100 * scale,
                    source,
                    persistent: true
                });
                break;
            case 'penetration':
            case 'sunder':
                hero.aggregator.addModifier({
                    type: 'SUNDER',
                    value: 0.10 * scale,
                    source,
                    persistent: true
                });
                break;
            case 'defenseBonus':
            case 'resistance':
                hero.aggregator.addModifier({
                    type: 'RESIST_FLAT',
                    value: 2 * scale,
                    source,
                    persistent: true
                });
                break;
            case 'evasionBonus':
            case 'deflection':
                hero.aggregator.addModifier({
                    type: 'EVASION',
                    value: 5 * scale,
                    source,
                    persistent: true
                });
                break;
            case 'energyEfficiency':
            case 'light':
                hero.aggregator.addModifier({
                    type: 'LIGHT',
                    value: 0.10 * scale,
                    source,
                    persistent: true
                });
                break;
            case 'attackSpeedPenalty':
            case 'mobile':
                hero.aggregator.addModifier({
                    type: 'HASTE',
                    value: -100 * scale,
                    source,
                    persistent: true
                });
                break;
            default:
                console.warn(`[EquipmentManager] Unrecognized equipment effect: ${effectId}`);
        }
    }
}

/**
 * Gear durability is retired (D-118).
 *
 * **Token depletion is the only wear mechanic in the game now** — it covers
 * resources, enemies, tools and everything else placed on the board, and hero
 * equipment is permanent. `DurabilitySystem.js` was deleted with the deck loop.
 *
 * Equipment still leaves a hero, but only through defeat-loss (D-74). ⚠️ That
 * makes gear demand come solely from roster growth and better recipes — logged
 * as risk 12: if the crafting chain feels dead between Map unlocks, promotion
 * costs are the natural place to add gear demand.
 *
 * This no-op stays so combat's attack path keeps one call shape while the board
 * combat port settles in Phase 6; it is removed there.
 */
export function reduceDurability(_heroId, _slot, _amount = 1) {
    return null;
}

// Backward compatibility (Default object)
export const EquipmentManager = {
    equipItem,
    unequipItem,
    resolveTargetSlot,
    syncEquipmentModifiers,
    getEquippedItem,
    getAllEquipment,
    reduceDurability,
    recalculateEquipmentModifiers
};

export default EquipmentManager;

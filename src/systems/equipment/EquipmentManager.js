// Fantasy Guild - Equipment Manager
// Phase 40: Equipment Architecture Evolution (Auditor Refactor)

import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { EQUIPMENT_SLOTS } from '../../config/registries/equipmentConstants.js';
import * as EquipmentValidator from './EquipmentValidator.js';
import * as DurabilitySystem from './DurabilitySystem.js';

/**
 * EquipmentManager - Hub for Hero equipment state and modifier syncing.
 * 
 * Enforces the "Shared Reference" model: Items stay in the shared Inventory stack,
 * and heroes "link" to them in their equipment slots.
 */
/**
 * Equip an item to a hero's slot
 */
export function equipItem(heroId, itemId) {
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

    // 2. Clear existing slot
    const slot = template.equipSlot || (template.type === 'food' ? 'food' : (template.type === 'drink' ? 'drink' : null));
    if (!slot) {
        logger.error('EquipmentManager', `Item ${template.id} has no valid equipSlot and cannot be inferred from type ${template.type}`);
        return { success: false, error: 'Item cannot be equipped' };
    }

    if (hero.equipment[slot]) unequipItem(heroId, slot);

    // 3. Apply State & Modifiers
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
    if (!hero?.equipment[slot]) return { success: false, error: 'Slot is empty' };

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

    for (const [slot, itemId] of Object.entries(hero.equipment)) {
        if (!itemId) continue;
        const hasStock = InventoryManager.hasItem(itemId, 1);
        hero.aggregator.setSourceEnabled(`equip:${slot}`, hasStock);
    }
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
    return hero ? { ...hero.equipment } : { weapon: null, armor: null, food: null, drink: null };
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

    // 2. Scan all equipment slots
    for (const [slot, itemId] of Object.entries(hero.equipment || {})) {
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
 * Legacy wrapper for readability - delegates to DurabilitySystem
 */
export function reduceDurability(heroId, slot, amount = 1) {
    return DurabilitySystem.reduceHeroEquipmentDurability(heroId, slot, amount);
}

// Backward compatibility (Default object)
export const EquipmentManager = {
    equipItem,
    unequipItem,
    syncEquipmentModifiers,
    getEquippedItem,
    getAllEquipment,
    reduceDurability,
    recalculateEquipmentModifiers
};

export default EquipmentManager;

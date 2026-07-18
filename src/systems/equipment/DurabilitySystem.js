// Fantasy Guild - Durability System (Unified)
// Phase 40: Equipment Architecture Evolution

import { InventoryManager } from '../inventory/InventoryManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';

/**
 * DurabilitySystem - Central hub for all item wear and tear.
 * 
 * Each item's health is tracked by the Vault (InventoryManager).
 * This system provides the automation layer for consuming stock on breakage.
 */
/**
 * Reduce weapon durability (Combat)
 */
export function applyWeaponWear(heroId) {
    reduceHeroEquipmentDurability(heroId, 'weapon', 1);
}

/**
 * Reduce armor durability (Combat)
 */
export function applyArmorWear(heroId) {
    reduceHeroEquipmentDurability(heroId, 'armor', 1);
}

/**
 * Reduce durability for a specific hero slot
 * Primary entry point for hero gear wear.
 */
export function reduceHeroEquipmentDurability(heroId, slot, amount = 1) {
    const hero = HeroManager.getHero(heroId);
    const itemId = hero?.equipment?.[slot];
    if (!hero || !itemId) return;

    // (CR-030) The old "auxiliary armor slot wear" rolled head/body/hands/feet
    // — slots that never existed in EQUIPMENT_SLOTS — and was removed with the
    // Wave 4 sweep along with the card-tool durability path (no callers).
    InventoryManager.decrementDurability(itemId, amount);
}

/**
 * Get durability percentage for display
 */
export function getDurabilityPercent(itemId) {
    if (!itemId) return 0;
    const template = getItem(itemId);
    if (!template?.maxDurability) return 100;

    const currentDur = InventoryManager.getDurability(itemId);
    return currentDur === null ? 100 : Math.max(0, Math.min(100, (currentDur / template.maxDurability) * 100));
}

export const DurabilitySystem = {
    applyWeaponWear,
    applyArmorWear,
    reduceHeroEquipmentDurability,
    getDurabilityPercent
};

export default DurabilitySystem;

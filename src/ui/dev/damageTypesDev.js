// the QA panel's damage types check: a Fire wand and an Ice wand against a Fire Elemental, a bow shooting arrows at a crab
// ⚠️ DEV BUILDS ONLY: reached from `DamageTypesDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { getTokenType, registerTokenTypes } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { qaOrder } from './qaOrders.js';
import { fighterAt, placeBesideHall } from './combatScreenDev.js';

/**
 * The scene, everything made in memory for this check only (never written to `data/`, gone on
 * reload), three fights below the Guild Hall:
 * - **Aela**, an **Ember Wand** (Magic, Fire), on a **Fire Elemental** (resists Fire 100 %, weak
 *   to Ice 50 %): every hit says "Resisted" and does 0;
 * - **Bram**, a **Frost Wand** (Magic, Ice), on a second Fire Elemental: every hit says "Weak!";
 * - **Cara**, a **Spark Bow** (Ranged, Electric) with 40 **Bodkin Arrows** (Stab), on a **Rock
 *   Crab** (Armoured: resists Physical 50 %; weak to Crush 50 %): each shot spends an arrow and
 *   shows both types, the arrow's half resisted. Its style is Stealth, even with Ranged, so the
 *   matchup does not move the numbers.
 * The wands and the bow hit 2 (the bow 1, its arrow 1), so a 1.5 or a 3 shows the fraction roll.
 * Each hero carries Shrimp when the content has them, so the fights last long enough to look at.
 */
export const QA_V1 = Object.freeze({
    ELEMENTAL: 'qa_v1_fire_elemental',
    CRAB: 'qa_v1_rock_crab',
    EMBER_WAND: 'qa_v1_ember_wand',
    FROST_WAND: 'qa_v1_frost_wand',
    SPARK_BOW: 'qa_v1_spark_bow',
    ARROW: 'qa_v1_bodkin_arrow'
});

const ARROWS = 40;

function registerQaContent() {
    const weapon = (id, name, sprite, style, damage, damageType) => ({
        id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite, styles: [style], damage, damageType
    });
    registerItems({
        [QA_V1.EMBER_WAND]: weapon(QA_V1.EMBER_WAND, 'Ember Wand', 'i_rod_wood', 'magic', 2, 'fire'),
        [QA_V1.FROST_WAND]: weapon(QA_V1.FROST_WAND, 'Frost Wand', 'i_rod_wood', 'magic', 2, 'ice'),
        [QA_V1.SPARK_BOW]: weapon(QA_V1.SPARK_BOW, 'Spark Bow', 'i_arrow', 'ranged', 1, 'electric'),
        [QA_V1.ARROW]: {
            id: QA_V1.ARROW, name: 'Bodkin Arrow', type: 'material', equipSlot: 'consumable', stackable: true,
            sprite: 'i_arrow', arrow: { damage: 1, damageType: 'stab' }
        }
    });
    const enemy = (id, name, sprite, enemyBlock) => ({
        id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite, requiresHero: true,
        enemy: { style: 'melee', ...enemyBlock },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
    });
    const elementalArt = getTokenType('token_fire_elemental')?.sprite || 's_crime';
    const crabArt = getTokenType('token_crab')?.sprite || 's_crime';
    registerTokenTypes({
        [QA_V1.ELEMENTAL]: enemy(QA_V1.ELEMENTAL, 'Fire Elemental', elementalArt, { level: 10, resistances: { fire: 100, ice: -50 } }),
        [QA_V1.CRAB]: enemy(QA_V1.CRAB, 'Rock Crab', crabArt, { level: 10, style: 'stealth', kinds: ['armoured'], resistances: { crush: -50 } })
    });
}

/** A level-10 hero holding `weaponId` (and `extra` consumables), sent at `target`. */
function sendFighter(name, weaponId, target, extra = []) {
    const hero = fighterAt(10, name);
    if (!HeroManager.addHero(hero)) return null;
    InventoryManager.addItem(weaponId, 1);
    EquipmentManager.equipItem(hero.id, weaponId);
    for (const id of extra) if (getItem(id)) EquipmentManager.equipItem(hero.id, id);
    qaOrder(hero.id, { x: target.x, y: target.y });
    return hero;
}

/**
 * The scene: two Fire Elementals below-left and below-right of the Guild Hall, a Rock Crab below
 * it, each with its hero on it. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpDamageTypesScene() {
    registerQaContent();
    const left = placeBesideHall(QA_V1.ELEMENTAL, -300, 230);
    const right = placeBesideHall(QA_V1.ELEMENTAL, 320, 230);
    const crab = placeBesideHall(QA_V1.CRAB, 20, 330);
    if (!left || !right || !crab) return { ok: false, error: 'No room below the Guild Hall for the scene' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 3);
    GuildUpgradeManager.recompute();

    const food = getItem('item_shrimp') ? ['item_shrimp'] : [];
    if (food.length) InventoryManager.addItem('item_shrimp', 60);
    InventoryManager.addItem(QA_V1.ARROW, ARROWS);

    sendFighter('Aela', QA_V1.EMBER_WAND, left, food);
    sendFighter('Bram', QA_V1.FROST_WAND, right, food);
    sendFighter('Cara', QA_V1.SPARK_BOW, crab, [QA_V1.ARROW, ...food]);
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_damage_types_scene' });
    return { ok: true };
}

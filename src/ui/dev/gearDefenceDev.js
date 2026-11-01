// the QA panel's gear and defence check: armour and a shield resisting a Venomous enemy, a mage with and without a chestplate, a spear sundering a crab
// ⚠️ DEV BUILDS ONLY: reached from `GearDefenceDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { getTokenType, registerTokenTypes } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { EFFECTS, registerEffects } from '../../config/registries/effectRegistry.js';
import { VENOM_EFFECT_ID } from '../../config/registries/enemyKinds.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { makeStatement, KEYWORD } from '../../systems/effects/statements.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { qaOrder } from './qaOrders.js';
import { fighterAt, placeBesideHall } from './combatScreenDev.js';

/**
 * The scene, everything made in memory for this check only (never written to `data/`, gone on
 * reload), four fights below the Guild Hall:
 * - **Dara** (Melee 30), a sword, a **Plate Chestplate** (Physical 20 %; Magic −30 %, Stealth −15 %)
 *   and a **Kite Shield** in her second hand (Physical 15 %, Fire 10 %; Bulwark: +5 Dodge), on a
 *   **Venomous Rat**: every swing that lands on her says "Resisted", and Venom stacks on her;
 * - **Eli** (Magic 30), a **Frost Wand**, in nothing, on a **Training Dummy**;
 * - **Fen** (Magic 30), the same wand in the Plate Chestplate, on another dummy: 30 % softer hits
 *   (the versus card says what the gear cuts);
 * - **Gus** (Melee 30), a **Sundering Spear** (Stab; every hit lands Sunder: −10 to every
 *   resistance a stack, three stacks), on a **Rock Crab** (Armoured, Physical 50 %; weak to Crush):
 *   its Physical falls 50 → 40 → 30 → 20 in the panel, and its hits stop saying "Resisted" as often.
 * Each hero carries Shrimp when the content has them, so the fights last long enough to look at.
 */
export const QA_V2 = Object.freeze({
    RAT: 'qa_v2_venom_rat',
    DUMMY: 'qa_v2_training_dummy',
    CRAB: 'qa_v2_rock_crab',
    SWORD: 'qa_v2_sword',
    PLATE: 'qa_v2_plate_chestplate',
    PLATE_B: 'qa_v2_plate_chestplate_b',
    SHIELD: 'qa_v2_kite_shield',
    WAND: 'qa_v2_frost_wand',
    WAND_B: 'qa_v2_frost_wand_b',
    SPEAR: 'qa_v2_sundering_spear',
    SUNDER: 'qa_v2_sunder'
});

const tick = (id) => ({
    ...makeStatement(KEYWORD.DEALS), id, when: { event: 'EFFECT_TICK', scope: 'self' },
    target: { role: ROLE.SELF }, payload: { amount: 1 }
});
const provides = (id, type, value) => ({ ...makeStatement(KEYWORD.PROVIDES), id, to: null, payload: { type, bucket: 'flat', value } });

/** The content's own Sunder status when it has one by that name, else this scene's. */
function sunderId() {
    const own = Object.values(EFFECTS).find(e => e?.status && /^sunder/i.test(e.name || ''));
    return own?.id || QA_V2.SUNDER;
}

function registerQaContent() {
    if (!EFFECTS[VENOM_EFFECT_ID]) {
        registerEffects({ [VENOM_EFFECT_ID]: { id: VENOM_EFFECT_ID, name: 'Venom', status: { stacks: 3, ticks: 0 }, statements: [tick('stm_qa_v2_venom')] } });
    }
    if (sunderId() === QA_V2.SUNDER) {
        registerEffects({
            [QA_V2.SUNDER]: { id: QA_V2.SUNDER, name: 'Sunder', status: { stacks: 3, ticks: 0 }, statements: [provides('stm_qa_v2_sunder', EFFECT_TYPES.SUNDER, 10)] }
        });
    }
    registerEffects({
        qa_v2_bulwark: { id: 'qa_v2_bulwark', name: 'Bulwark', statements: [provides('stm_qa_v2_bulwark', EFFECT_TYPES.DODGE, 5)] },
        qa_v2_sundering: {
            id: 'qa_v2_sundering', name: 'Sundering',
            statements: [{
                ...makeStatement(KEYWORD.APPLIES), id: 'stm_qa_v2_sundering',
                when: { event: 'FIGHT_HIT', scope: 'self', every: 1 },
                target: { role: ROLE.OPPONENT },
                payload: { effectId: sunderId(), chance: 100 }
            }]
        }
    });
    const weapon = (id, name, sprite, style, damage, extra = {}) => ({
        id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite, styles: [style], damage, ...extra
    });
    const plate = (id) => ({
        id, name: 'Plate Chestplate', type: 'armor', equipSlot: 'chest', stackable: true,
        sprite: getItem('item_iron_chestplate')?.sprite || 'i_pick_copper',
        resistances: { physical: 20 }, damageCut: { magic: 30, stealth: 15 },
        description: 'Test armour: a metal piece resisting Physical, at a price for mages and rogues.'
    });
    registerItems({
        [QA_V2.SWORD]: weapon(QA_V2.SWORD, 'Test Sword', getItem('item_copper_sword')?.sprite || 'i_pick_copper', 'melee', 2),
        [QA_V2.WAND]: weapon(QA_V2.WAND, 'Frost Wand', 'i_rod_wood', 'magic', 2, { damageType: 'ice' }),
        [QA_V2.WAND_B]: weapon(QA_V2.WAND_B, 'Frost Wand', 'i_rod_wood', 'magic', 2, { damageType: 'ice' }),
        [QA_V2.SPEAR]: weapon(QA_V2.SPEAR, 'Sundering Spear', getItem('item_copper_sword')?.sprite || 'i_pick_copper', 'melee', 2,
            { damageType: 'stab', effects: [{ effectId: 'qa_v2_sundering', scale: 1 }] }),
        [QA_V2.PLATE]: plate(QA_V2.PLATE),
        [QA_V2.PLATE_B]: plate(QA_V2.PLATE_B),
        [QA_V2.SHIELD]: {
            id: QA_V2.SHIELD, name: 'Kite Shield', type: 'armor', equipSlot: 'hand', stackable: true, offHand: true,
            sprite: getItem('item_copper_helmet')?.sprite || 'i_pick_copper',
            resistances: { physical: 15, fire: 10 }, effects: [{ effectId: 'qa_v2_bulwark', scale: 1 }],
            description: 'Test off-hand item: held beside a weapon, it lends like a piece of armour.'
        }
    });
    const enemy = (id, name, sprite, enemyBlock) => ({
        id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite, requiresHero: true,
        enemy: { style: 'melee', ...enemyBlock },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
    });
    const art = (typeId) => getTokenType(typeId)?.sprite || 's_crime';
    registerTokenTypes({
        [QA_V2.RAT]: enemy(QA_V2.RAT, 'Venomous Rat', art('token_goblin'), { level: 10, hp: 60, hit: 3, kinds: ['venomous'] }),
        [QA_V2.DUMMY]: enemy(QA_V2.DUMMY, 'Training Dummy', art('token_cow'), { level: 10, hp: 400, hit: 1 }),
        [QA_V2.CRAB]: enemy(QA_V2.CRAB, 'Rock Crab', art('token_crab'), { level: 10, hp: 120, kinds: ['armoured'], resistances: { crush: -50 } })
    });
}

/** A level-30 hero carrying `itemIds` (and Shrimp when the content has them), sent at `target`. */
function sendFighter(name, itemIds, target, food) {
    const hero = fighterAt(30, name);
    if (!HeroManager.addHero(hero)) return null;
    for (const id of itemIds) {
        if (!getItem(id)) continue;
        InventoryManager.addItem(id, 1);
        EquipmentManager.equipItem(hero.id, id);
    }
    if (food) EquipmentManager.equipItem(hero.id, food);
    qaOrder(hero.id, { x: target.x, y: target.y });
    return hero;
}

/**
 * The scene: the rat below-left of the Guild Hall, the two dummies below and below-right, the crab
 * far right, each with its hero on it. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpGearDefenceScene() {
    registerQaContent();
    const rat = placeBesideHall(QA_V2.RAT, -500, 240);
    const bare = placeBesideHall(QA_V2.DUMMY, -170, 330);
    const plated = placeBesideHall(QA_V2.DUMMY, 170, 330);
    const crab = placeBesideHall(QA_V2.CRAB, 500, 240);
    if (!rat || !bare || !plated || !crab) return { ok: false, error: 'No room below the Guild Hall for the scene' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 4);
    GuildUpgradeManager.recompute();

    const food = getItem('item_shrimp') ? 'item_shrimp' : null;
    if (food) InventoryManager.addItem(food, 80);

    sendFighter('Dara', [QA_V2.SWORD, QA_V2.PLATE, QA_V2.SHIELD], rat, food);
    sendFighter('Eli', [QA_V2.WAND], bare, food);
    sendFighter('Fen', [QA_V2.WAND_B, QA_V2.PLATE_B], plated, food);
    sendFighter('Gus', [QA_V2.SPEAR], crab, food);
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_gear_defence_scene' });
    return { ok: true };
}

// the eye-check scenes for the combat styles' ammo, crit cap and poisons (brief 750)
// ⚠️ QA BUILDS ONLY, and temporary: wired to QA panel buttons for the owner's look (brief 750 S2),
// then deleted with its test once that eye-check is accepted.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Orders from '../../systems/board/Orders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for these checks only (never written to `data/`, gone on reload): a QA Training
 * Dummy (level 1, 300 health, weak hits) and the Test items below. Each scene puts a dummy on the
 * mat, a QA hero beside it ordered onto it, and sets the Bank's count of its Test items exactly:
 * - Archer, 3 arrows: a Test Bow and 3 Test Arrows. Three shots, then the archer lets go, waits
 *   by the dummy (which heals back) and says Needs Test Arrow.
 * - Archer, no arrows: the same with none: no fight, Needs Test Arrow at once.
 * - Mage, 3 Motes: a Test Ember Wand burning Test Fire Motes, 3 in the Bank: three casts, then casts
 *   at half and says Needs Test Fire Mote once.
 * - Kunai, none spare: one Test Kunai in hand, none in the Bank: half damage and Needs Test Kunai.
 * - Crit cap: a Melee hero with a Copper Sword and a Test Lucky Charm (+100 Crit Chance): crit
 *   chance 75 %, about three hits in four crit, each double.
 * - Poison: a dagger hero and a sword hero each carrying Test Venom (+3 Damage for 5 attacks), 3 in
 *   the Bank: the dagger hero takes one and is coated for five attacks; the sword hero takes none.
 */
const DUMMY = 'qa_cs_dummy';
export const QA_CS = Object.freeze({
    BOW: 'qa_cs_bow', ARROW: 'qa_cs_arrow', WAND: 'qa_cs_wand', MOTE: 'qa_cs_mote', KUNAI: 'qa_cs_kunai',
    CHARM: 'qa_cs_charm', VENOM: 'qa_cs_venom', SWORD: 'item_copper_sword', DAGGER: 'item_copper_dagger'
});

function register() {
    const rule = (id, payload, when = null) => ({
        id, keyword: when ? 'applies' : 'provides', chargeDelta: 0, target: null, when, upkeep: null, to: null, payload
    });
    registerEffects({
        qa_cs_luck: { id: 'qa_cs_luck', name: 'Test Luck', statements: [rule('stm_qa_cs_luck', { type: EFFECT_TYPES.CRIT_CHANCE, bucket: 'flat', value: 100 })] },
        qa_cs_coat: { id: 'qa_cs_coat', name: 'Test Venom Coat', statements: [rule('stm_qa_cs_coat', { type: EFFECT_TYPES.DAMAGE, bucket: 'flat', value: 3 })] },
        qa_cs_venom_rule: {
            id: 'qa_cs_venom_rule', name: 'Test Venom',
            statements: [rule('stm_qa_cs_venom', { effectId: 'qa_cs_coat', scale: 1, chance: 100, forAttacks: 5 }, { event: 'COMBAT_ENGAGED', scope: 'self' })]
        }
    });
    const weapon = (id, name, sprite, extra) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite, ...extra });
    registerItems({
        [QA_CS.BOW]: weapon(QA_CS.BOW, 'Test Bow', 'i_arrow', { styles: ['ranged'], damage: 1 }),
        [QA_CS.ARROW]: { id: QA_CS.ARROW, name: 'Test Arrow', type: 'material', equipSlot: 'consumable', stackable: true, sprite: 'i_arrow', arrow: { damage: 1, damageType: 'stab' } },
        [QA_CS.MOTE]: { id: QA_CS.MOTE, name: 'Test Fire Mote', type: 'material', equipSlot: 'consumable', stackable: true, sprite: 'i_ruby' },
        [QA_CS.WAND]: weapon(QA_CS.WAND, 'Test Ember Wand', 'i_rod_wood', { styles: ['magic'], damage: 2, damageType: 'fire', mote: QA_CS.MOTE }),
        [QA_CS.KUNAI]: weapon(QA_CS.KUNAI, 'Test Kunai', 'i_longsword_copper', { styles: ['stealth'], damage: 2, speed: 'fast', thrown: true }),
        [QA_CS.CHARM]: { id: QA_CS.CHARM, name: 'Test Lucky Charm', type: 'armor', equipSlot: 'trinket', stackable: true, sprite: 'i_ring_silver_ruby', effects: [{ effectId: 'qa_cs_luck', scale: 1 }] },
        [QA_CS.VENOM]: { id: QA_CS.VENOM, name: 'Test Venom', type: 'consumable', equipSlot: 'consumable', stackable: true, sprite: 'i_potion_myst_purple', effects: [{ effectId: 'qa_cs_venom_rule', scale: 1 }] }
    });
    registerTokenTypes({
        [DUMMY]: {
            id: DUMMY, name: 'QA Training Dummy', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 1, sprite: 'e_goblin', requiresHero: true,
            enemy: { level: 1, style: 'ranged', hp: 300, hit: 0.25 },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        }
    });
}

/** A new QA hero at `level` in `skill`, healthy enough to outlast the dummy, the roster cap raised for them. */
function qaHero(name, skill, level) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    hero.skills = { ...(hero.skills || {}), [skill]: { ...(hero.skills?.[skill] || {}), level, xp: xpForLevel(level) } };
    if (!HeroManager.addHero(hero)) return null;
    // Sturdy for the look: a fight runs for minutes without a knock-out (a reload sets it back).
    hero.hp = { current: 500, max: 500 };
    return hero;
}

/** The Bank holds exactly `n` of `itemId`. */
function setBank(itemId, n) {
    const have = InventoryManager.getItemCount(itemId);
    if (have > n) InventoryManager.removeItem(itemId, have - n);
    if (have < n) InventoryManager.addItem(itemId, n - have);
}

/** Put `itemId` in the hero's loadout (one copy from the Bank for gear, a slot naming it for a Consumable). */
function give(hero, itemId) {
    if (!InventoryManager.hasItem(itemId, 1)) InventoryManager.addItem(itemId, 1);
    return EquipmentManager.equipItem(hero.id, itemId).success === true;
}

/** A QA Training Dummy near `aim`, or null with no room. */
function placeDummy(aim) {
    const at = MatPlacement.findSpot(DUMMY, aim, { reach: 600 });
    const instance = at ? BoardState.createTokenInstance(DUMMY, tokenStartingUses(DUMMY)) : null;
    return instance && Placement.placeTokenAt(instance, at)?.success ? instance : null;
}

/** Where the next dummy goes: across the mat's middle, a step further each time. */
let next = 0;
const aimFor = () => ({ x: 420 + (next++ % 5) * 180, y: 460 + Math.floor((next - 1) / 5 % 3) * 180 });

/**
 * One scene: a dummy, then each hero made by `heroes` (`[{ name, skill, level, items }]`) given its
 * items and sent at its own dummy, after `bank` (`{ itemId: n }`) is set. ⚠️ Changes the game, like
 * Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
function scene(heroes, bank) {
    register();
    for (const { items } of heroes) {
        for (const id of items) if (!getItem(id)) return { ok: false, error: `No ${id} in the content` };
    }
    for (const spec of heroes) {
        const dummy = placeDummy(aimFor());
        if (!dummy) return { ok: false, error: 'No room on the mat for a QA Training Dummy' };
        const hero = qaHero(spec.name, spec.skill, spec.level);
        if (!hero) return { ok: false, error: 'The roster would not take a QA hero' };
        for (const id of spec.items) {
            if (!give(hero, id)) return { ok: false, error: `${spec.name} would not take ${getItem(id)?.name || id}` };
        }
        spec.at = dummy;
        spec.hero = hero;
    }
    for (const [itemId, n] of Object.entries(bank)) setBank(itemId, n);
    TileModifiers.rebuildAll();
    for (const spec of heroes) {
        const order = Orders.orderAt(spec.hero.id, { x: spec.at.x, y: spec.at.y });
        if (!order?.success) return { ok: false, error: order?.reason || `${spec.name} would not take their order` };
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_combat_styles_scene' });
    return { ok: true };
}

export const setUpArcherScene = (arrows) => scene(
    [{ name: arrows ? 'QA Archer' : 'QA Archer, no arrows', skill: 'ranged', level: 10, items: [QA_CS.BOW, QA_CS.ARROW] }],
    { [QA_CS.ARROW]: arrows }
);
export const setUpMageScene = () => scene(
    [{ name: 'QA Mage', skill: 'magic', level: 10, items: [QA_CS.WAND, QA_CS.MOTE] }],
    { [QA_CS.MOTE]: 3 }
);
export const setUpKunaiScene = () => scene(
    [{ name: 'QA Kunai Thrower', skill: 'stealth', level: 10, items: [QA_CS.KUNAI] }],
    { [QA_CS.KUNAI]: 0 }
);
export const setUpCritScene = () => scene(
    [{ name: 'QA Lucky Fighter', skill: 'melee', level: 10, items: [QA_CS.SWORD, QA_CS.CHARM] }],
    {}
);
export const setUpPoisonScene = () => scene(
    [
        { name: 'QA Poisoner', skill: 'stealth', level: 10, items: [QA_CS.DAGGER, QA_CS.VENOM] },
        { name: 'QA Swordsman', skill: 'melee', level: 10, items: [QA_CS.SWORD, QA_CS.VENOM] }
    ],
    { [QA_CS.VENOM]: 3 }
);

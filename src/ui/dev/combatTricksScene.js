// the eye-check scenes for the combat tricks: Second Wind, Unbreakable, Twin Shot, Double Cast, Shadowstep (brief 800 P5)
// ⚠️ QA BUILDS ONLY, and temporary: wired to QA panel buttons for the owner's look, then deleted with
// its test once that eye-check is accepted (or once the content agent's perk pack brings the real perks).

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
import { registerSkillPerks, perkRowsFor } from '../../config/registries/perkRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for these checks only (never written to `data/`, gone on reload): five Test perks
 * at level 99 (Second Wind at 75), each on its style's perk table, a QA hero at 99 in that style, and
 * QA enemies. Each scene sends one QA hero at its enemy:
 * - Second Wind: a Melee hero at half health at a QA Weak Camp (a weak enemy every 2 s): each kill
 *   heals 3, "Test Second Wind: QA Brawler heals +3" in the fight log.
 * - Unbreakable: a Melee hero with 10 health at a QA Brute (every landed blow would defeat them):
 *   the first leaves them at 1 ("Test Unbreakable: … holds on at 1 health"), the next defeats them.
 * - Twin Shot: an archer with a Test Bow and 6 Test Arrows at a QA Training Dummy: each shot hits
 *   twice, so twelve attacks for six arrows ("Test Twin Shot: … attacks again").
 * - Double Cast: a mage with a Test Ember Wand and 4 Test Fire Motes: each cast twice, one Mote.
 * - Shadowstep: a Stealth hero with a Copper Dagger at a QA Clumsy Dummy (it misses often): after
 *   each miss the hero's next hit is a crit ("Test Shadowstep: …'s hit is a sure crit").
 */
export const QA_CT = Object.freeze({
    BOW: 'qa_ct_bow', ARROW: 'qa_ct_arrow', WAND: 'qa_ct_wand', MOTE: 'qa_ct_mote',
    SWORD: 'item_copper_sword', DAGGER: 'item_copper_dagger',
    DUMMY: 'qa_ct_dummy', CLUMSY: 'qa_ct_clumsy', BRUTE: 'qa_ct_brute', WEAK: 'qa_ct_weak', CAMP: 'qa_ct_weak_camp'
});

const PERKS = {
    melee: [{ level: 75, effectId: 'qa_ct_second_wind' }, { level: 99, effectId: 'qa_ct_unbreakable' }],
    ranged: [{ level: 99, effectId: 'qa_ct_twin_shot' }],
    magic: [{ level: 99, effectId: 'qa_ct_double_cast' }],
    stealth: [{ level: 99, effectId: 'qa_ct_shadowstep' }]
};

function register() {
    const trick = (id, name, type, value, category) => ({
        id, name,
        statements: [{
            id: `stm_${id}`, keyword: 'provides', chargeDelta: 0, target: null, when: null, upkeep: null, to: null,
            payload: { type, bucket: 'flat', value, category }
        }]
    });
    registerEffects({
        qa_ct_second_wind: trick('qa_ct_second_wind', 'Test Second Wind', EFFECT_TYPES.KILL_HEAL, 3, 'melee'),
        qa_ct_unbreakable: trick('qa_ct_unbreakable', 'Test Unbreakable', EFFECT_TYPES.LAST_STAND, 100, 'melee'),
        qa_ct_twin_shot: trick('qa_ct_twin_shot', 'Test Twin Shot', EFFECT_TYPES.TWIN_STRIKE, 100, 'ranged'),
        qa_ct_double_cast: trick('qa_ct_double_cast', 'Test Double Cast', EFFECT_TYPES.TWIN_STRIKE, 100, 'magic'),
        qa_ct_shadowstep: trick('qa_ct_shadowstep', 'Test Shadowstep', EFFECT_TYPES.DODGE_CRIT, 100, 'stealth')
    });
    // A style's own table keeps its rows; the Test perk is added beside them, once.
    const tables = {};
    for (const [skill, rows] of Object.entries(PERKS)) {
        const held = perkRowsFor(skill).filter(r => !rows.some(q => q.effectId === r.effectId));
        tables[skill] = { perks: [...held, ...rows] };
    }
    registerSkillPerks(tables);

    const weapon = (id, name, sprite, extra) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite, ...extra });
    registerItems({
        [QA_CT.BOW]: weapon(QA_CT.BOW, 'Test Bow', 'i_arrow', { styles: ['ranged'], damage: 1 }),
        [QA_CT.ARROW]: { id: QA_CT.ARROW, name: 'Test Arrow', type: 'material', equipSlot: 'consumable', stackable: true, sprite: 'i_arrow', arrow: { damage: 1, damageType: 'stab' } },
        [QA_CT.MOTE]: { id: QA_CT.MOTE, name: 'Test Fire Mote', type: 'material', equipSlot: 'consumable', stackable: true, sprite: 'i_ruby' },
        [QA_CT.WAND]: weapon(QA_CT.WAND, 'Test Ember Wand', 'i_rod_wood', { styles: ['magic'], damage: 4, damageType: 'fire', mote: QA_CT.MOTE })
    });
    const enemy = (id, name, stats, uses = 1) => ({
        id, name, tokenType: 'enemy', rarity: 'common', theme: 'qa', uses, sprite: 'e_goblin', requiresHero: true,
        enemy: { level: 1, style: 'ranged', ...stats },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    });
    registerTokenTypes({
        [QA_CT.DUMMY]: enemy(QA_CT.DUMMY, 'QA Training Dummy', { hp: 300, hit: 0.25 }),
        [QA_CT.CLUMSY]: enemy(QA_CT.CLUMSY, 'QA Clumsy Dummy', { hp: 300, hit: 0.25, accuracy: -40 }),
        [QA_CT.BRUTE]: enemy(QA_CT.BRUTE, 'QA Brute', { hp: 100000, hit: 50, accuracy: 30 }),
        [QA_CT.WEAK]: enemy(QA_CT.WEAK, 'QA Weakling', { hp: 8, hit: 0.25 }),
        [QA_CT.CAMP]: {
            id: QA_CT.CAMP, name: 'QA Weak Camp', tokenType: 'spawner', rarity: 'common', theme: 'qa', uses: null, sprite: 's_crime',
            spawner: { spawns: [{ typeId: QA_CT.WEAK, weight: 1 }], allowance: 1, intervalMs: 2000, upkeep: [] }
        }
    });
}

/** A new QA hero at `level` in `skill`, the roster cap raised for them. */
function qaHero(name, skill, level, hp) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    hero.skills = { ...(hero.skills || {}), [skill]: { ...(hero.skills?.[skill] || {}), level, xp: xpForLevel(level) } };
    if (!HeroManager.addHero(hero)) return null;
    hero.hp = { ...hp };
    return hero;
}

/** The Bank holds exactly `n` of `itemId`. */
function setBank(itemId, n) {
    const have = InventoryManager.getItemCount(itemId);
    if (have > n) InventoryManager.removeItem(itemId, have - n);
    if (have < n) InventoryManager.addItem(itemId, n - have);
}

function give(hero, itemId) {
    if (!InventoryManager.hasItem(itemId, 1)) InventoryManager.addItem(itemId, 1);
    return EquipmentManager.equipItem(hero.id, itemId).success === true;
}

function place(typeId, aim) {
    const at = MatPlacement.findSpot(typeId, aim, { reach: 600 });
    const instance = at ? BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)) : null;
    return instance && Placement.placeTokenAt(instance, at)?.success ? instance : null;
}

let next = 0;
const aimFor = () => ({ x: 420 + (next++ % 5) * 180, y: 820 + Math.floor((next - 1) / 5 % 2) * 180 });

/**
 * One scene: its enemy on the mat, a QA hero at 99 in `skill` (who holds the Test perks) given
 * `items` and sent at it, after `bank` is set. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
function scene({ name, skill, items, at, hp = { current: 500, max: 500 }, bank = {} }) {
    register();
    for (const id of items) if (!getItem(id)) return { ok: false, error: `No ${id} in the content` };
    const target = place(at, aimFor());
    if (!target) return { ok: false, error: 'No room on the mat for the QA enemy' };
    const hero = qaHero(name, skill, 99, hp);
    if (!hero) return { ok: false, error: 'The roster would not take a QA hero' };
    for (const id of items) {
        if (!give(hero, id)) return { ok: false, error: `${name} would not take ${getItem(id)?.name || id}` };
    }
    for (const [itemId, n] of Object.entries(bank)) setBank(itemId, n);
    TileModifiers.rebuildAll();
    const order = Orders.orderAt(hero.id, { x: target.x, y: target.y });
    if (!order?.success) return { ok: false, error: order?.reason || `${name} would not take their order` };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_combat_tricks_scene' });
    return { ok: true };
}

export const setUpSecondWindScene = () => scene({ name: 'QA Brawler', skill: 'melee', items: [QA_CT.SWORD], at: QA_CT.CAMP, hp: { current: 50, max: 109 } });
export const setUpUnbreakableScene = () => scene({ name: 'QA Last Stand', skill: 'melee', items: [QA_CT.SWORD], at: QA_CT.BRUTE, hp: { current: 10, max: 10 } });
export const setUpTwinShotScene = () => scene({ name: 'QA Twin Archer', skill: 'ranged', items: [QA_CT.BOW, QA_CT.ARROW], at: QA_CT.DUMMY, bank: { [QA_CT.ARROW]: 6 } });
export const setUpDoubleCastScene = () => scene({ name: 'QA Double Mage', skill: 'magic', items: [QA_CT.WAND, QA_CT.MOTE], at: QA_CT.DUMMY, bank: { [QA_CT.MOTE]: 4 } });
export const setUpShadowstepScene = () => scene({ name: 'QA Shadow', skill: 'stealth', items: [QA_CT.DAGGER], at: QA_CT.CLUMSY });

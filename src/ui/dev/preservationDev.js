// the QA panel's Preservation check: a building and a Hall star keeping a forge's Ore, a building keeping an archer's arrows
// ⚠️ DEV BUILDS ONLY: reached from `PreservationDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as SpriteLayer from '../../systems/board/SpriteLayer.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as EquipmentManager from '../../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, tokenName } from '../../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../../config/registries/itemRegistry.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { CARRIED_KIND } from '../../config/registries/carriedKinds.js';
import { HALL_NODE } from '../../config/guildUpgrades.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { qaOrder } from './qaOrders.js';
import { fighterAt } from './combatScreenDev.js';

/**
 * Test Tokens, items and a test star made in memory for this check only (never written to `data/`,
 * gone on reload):
 * - QA Preservation Forge (near): 2 Copper Ore make 1 Copper Ingot, 2 s a cycle;
 * - QA Preservation Cellar: a building giving Preservation 100 % (everything) to the near forge in
 *   reach, so it never takes its Ore;
 * - QA Preservation Forge (star): 2 Stone make 1 Copper Ingot, out of the Cellar's reach;
 * - QA Thrifty Hands: a Hall star, rank 1 held, Preservation 50 % aimed at the star forge, so about
 *   half its cycles take no Stone;
 * - the archer's part: a QA Dummy (an enemy with 500 health), a QA Quiver Post beside it giving
 *   Preservation 100 % on Ammo to it, and a QA Archer with a QA Bow and 40 QA Arrows, none of which
 *   the shots spend.
 */
export const QA_PRESERVATION = Object.freeze({
    NEAR_FORGE: 'qa_preservation_forge_near',
    STAR_FORGE: 'qa_preservation_forge_star',
    CELLAR: 'qa_preservation_cellar',
    STAR: 'qa_preservation_star',
    DUMMY: 'qa_preservation_dummy',
    POST: 'qa_preservation_quiver_post',
    BOW: 'qa_preservation_bow',
    ARROW: 'qa_preservation_arrow'
});
const T = QA_PRESERVATION;
const ORE = 'item_copper_ore';
const STONE = 'item_stone';
const INGOT = 'item_copper_ingot';
const CELLAR_CHANCE = 100;
const STAR_CHANCE = 50;
const STOCK = 40;
const ARROWS = 40;

const forge = (id, name, input) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null, sprite: 't_mineshaft_copper',
    requiresHero: true, staysPut: true,
    config: {
        skill: 'smithing', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
        inputs: [{ itemId: input, quantity: 2 }], outputs: [{ itemId: INGOT, chance: 100, minQty: 1, maxQty: 1 }]
    }
});
const building = (id, name, sprite, to, value, category) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: false,
    statements: [{
        id: `stm_${id}`, keyword: 'provides', to, reach: 'nearby',
        payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value, ...(category ? { category } : {}) }
    }]
});

function registerQaContent() {
    registerItems({
        [T.BOW]: { id: T.BOW, name: 'QA Bow', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_arrow', styles: ['ranged'], damage: 1 },
        [T.ARROW]: {
            id: T.ARROW, name: 'QA Arrow', type: 'material', equipSlot: 'consumable', stackable: true,
            sprite: 'i_arrow', arrow: { damage: 1, damageType: 'stab' }
        }
    });
    registerTokenTypes({
        [T.NEAR_FORGE]: forge(T.NEAR_FORGE, 'QA Preservation Forge (near)', ORE),
        [T.STAR_FORGE]: forge(T.STAR_FORGE, 'QA Preservation Forge (star)', STONE),
        [T.CELLAR]: building(T.CELLAR, 'QA Preservation Cellar', 't_mineshaft_copper', { mode: 'id', value: T.NEAR_FORGE }, CELLAR_CHANCE),
        [T.POST]: building(T.POST, 'QA Quiver Post', 't_mineshaft_copper', { mode: 'id', value: T.DUMMY }, 100, CARRIED_KIND.AMMO),
        [T.DUMMY]: {
            id: T.DUMMY, name: 'QA Dummy', tokenType: 'enemy', rarity: 'common', theme: 'qa', uses: 50, sprite: 's_occult', requiresHero: true,
            enemy: { level: 1, style: 'melee', hp: 500 },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
        }
    });
}

/** The authored sky with one more star by the Hall, its rank 1 held. */
function installQaStar() {
    const authored = authoredHallSky();
    const star = {
        id: T.STAR, constellation: 'qa_preservation', name: 'QA Thrifty Hands',
        description: 'The QA Preservation Forge (star) sometimes takes none of its Stone.',
        node: { x: -1.25, y: 0.35 }, links: [HALL_NODE], tag: 'left',
        ranks: [{
            tier: 1, price: [], lines: [],
            rules: [{
                id: `stm_${T.STAR}`, keyword: 'provides', chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                to: { mode: 'id', value: T.STAR_FORGE },
                payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value: STAR_CHANCE }
            }]
        }]
    };
    registerHallSky({
        constellations: { ...authored.constellations, qa_preservation: { id: 'qa_preservation', name: 'QA Preservation', label: { x: -1.3, y: 0.6 } } },
        stars: { ...authored.stars, [T.STAR]: star }
    });
    GuildUpgradeManager.getRanks()[T.STAR] = 1;
}

function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 200 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** Room for `n` more heroes on the roster. */
function makeRoom(n) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + n);
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
}

/** Where the scenes stand: the mat's upper right, the star's forge well out of the Cellar's reach. */
export const PRESERVATION_SPOTS = Object.freeze({
    near: { x: 1500, y: 260 },
    cellar: { x: 1650, y: 260 },
    star: { x: 1500, y: 640 },
    dummy: { x: 1100, y: 260 },
    post: { x: 1250, y: 260 }
});

const scene = { forges: null, archer: null };
let unsubscribe = null;

/** Count each scene Token's finished cycles and each QA Archer shot. Listened to once. */
function listen() {
    if (unsubscribe) return;
    const offCycle = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => {
        const f = scene.forges;
        if (f && e.instanceId in f.cycles) f.cycles[e.instanceId] += 1;
    }, UI_LISTENER);
    const offShot = EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (e) => {
        if (scene.archer && e.heroId === scene.archer.heroId) scene.archer.shots += 1;
    }, UI_LISTENER);
    unsubscribe = () => { offCycle?.(); offShot?.(); };
}

/**
 * The mat's upper right: a QA Preservation Forge beside a QA Preservation Cellar (Preservation
 * 100 %), and below it a second forge the QA Thrifty Hands star reaches (Preservation 50 %), a QA
 * Smith on each, and 40 Copper Ore and 40 Stone in the Bank. The Copper Ore never drops; the Stone
 * drops on about half the cycles. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpPreservationForges() {
    if (!getItem(ORE) || !getItem(STONE) || !getItem(INGOT)) return { ok: false, error: 'No Copper Ore, Stone or Copper Ingot in the content' };
    registerQaContent();
    installQaStar();
    const s = PRESERVATION_SPOTS;
    const near = put(T.NEAR_FORGE, s.near);
    const cellar = put(T.CELLAR, s.cellar);
    const star = put(T.STAR_FORGE, s.star);
    if (!near || !cellar || !star) return { ok: false, error: 'No room at the mat’s upper right for the scene' };
    TileModifiers.rebuildAll();
    makeRoom(2);
    InventoryManager.addItem(ORE, STOCK);
    InventoryManager.addItem(STONE, STOCK);

    for (const [inst, name] of [[near, 'QA Smith (Cellar)'], [star, 'QA Smith (star)']]) {
        const smith = generateHero({ name });
        smith.skills = { smithing: { ...(smith.skills?.smithing || {}), level: 10, xp: xpForLevel(10) } };
        if (!HeroManager.addHero(smith)) return { ok: false, error: 'The roster would not take another hero' };
        qaOrder(smith.id, { x: inst.x, y: inst.y });
    }

    scene.forges = { near: near.id, star: star.id, cycles: { [near.id]: 0, [star.id]: 0 } };
    listen();
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_preservation_forges' });
    return { ok: true };
}

/**
 * The mat's upper middle: a QA Dummy beside a QA Quiver Post (Preservation 100 % on Ammo), and a
 * QA Archer shooting it with 40 QA Arrows that never drop. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpPreservationArcher() {
    registerQaContent();
    const s = PRESERVATION_SPOTS;
    const dummy = put(T.DUMMY, s.dummy);
    const post = put(T.POST, s.post);
    if (!dummy || !post) return { ok: false, error: 'No room at the mat’s upper middle for the scene' };
    TileModifiers.rebuildAll();
    makeRoom(1);

    const archer = fighterAt(10, 'QA Archer');
    if (!HeroManager.addHero(archer)) return { ok: false, error: 'The roster would not take another hero' };
    InventoryManager.addItem(T.BOW, 1);
    EquipmentManager.equipItem(archer.id, T.BOW);
    InventoryManager.addItem(T.ARROW, ARROWS);
    EquipmentManager.equipItem(archer.id, T.ARROW);
    qaOrder(archer.id, { x: dummy.x, y: dummy.y });

    scene.archer = { heroId: archer.id, dummy: dummy.id, shots: 0 };
    listen();
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_preservation_archer' });
    return { ok: true };
}

const made = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);

function forgeLine(id, input, chanceFrom) {
    const t = BoardState.getTokenById(id);
    if (!t) return null;
    const chance = TileModifiers.resolveAxis(id, EFFECT_TYPES.PRESERVATION, 0, 'smithing');
    return `${tokenName(t.typeId)}: ${getItem(input)?.name} in the Bank ${InventoryManager.getItemCount(input)}; Preservation ${chance} % (${chanceFrom}); ${scene.forges.cycles[id]} cycles`;
}

/**
 * What the scenes show, read from the engine.
 * @returns {string[]}
 */
export function preservationReadout() {
    const lines = [];
    if (scene.forges) {
        lines.push(
            forgeLine(scene.forges.near, ORE, 'the Cellar beside it'),
            forgeLine(scene.forges.star, STONE, `the QA Thrifty Hands star, rank ${GuildUpgradeManager.getRanks()[T.STAR] || 0}`),
            `Copper Ingots made (Bank and floor): ${made(INGOT)}`
        );
    }
    if (scene.archer && BoardState.getTokenById(scene.archer.dummy)) {
        const chance = TileModifiers.resolveAxis(scene.archer.dummy, EFFECT_TYPES.PRESERVATION, 0, [T.ARROW, CARRIED_KIND.AMMO]);
        lines.push(`QA Archer: ${scene.archer.shots} shots; QA Arrows in the Bank ${InventoryManager.getItemCount(T.ARROW)} of ${ARROWS}; Preservation on Ammo ${chance} % (the Quiver Post beside the Dummy)`);
    }
    return lines.filter(Boolean);
}

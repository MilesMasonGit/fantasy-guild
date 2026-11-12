// the QA panel's Refresh check: a building's Refresh keeping a vein's charges, a Hall star's keeping another's
// ⚠️ DEV BUILDS ONLY: reached from `RefreshDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Respawn from '../../systems/board/Respawn.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, tokenName } from '../../config/registries/tokenRegistry.js';
import { authoredHallSky, registerHallSky } from '../../config/registries/hallStarRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { HALL_NODE } from '../../config/guildUpgrades.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { qaOrder } from './qaOrders.js';

/**
 * Test Tokens and a test star made in memory for this check only (never written to `data/`, gone on
 * reload):
 * - QA Refresh Vein (near): 5 Copper Ore charges, 2 s a cycle; at 0 it rests a minute, then refills;
 * - QA Refresh Well: a building giving Refresh 100 % to QA Refresh Veins (near) in reach, so the
 *   vein beside it never spends a charge;
 * - QA Refresh Vein (star): the same vein, out of the Well's reach;
 * - QA Fresh Seams: a Hall star, rank 1 held, Refresh 50 % aimed at QA Refresh Veins (star), so
 *   about half that vein's cycles spend nothing.
 */
export const QA_REFRESH = Object.freeze({
    NEAR_VEIN: 'qa_refresh_vein_near',
    STAR_VEIN: 'qa_refresh_vein_star',
    WELL: 'qa_refresh_well',
    STAR: 'qa_refresh_star'
});
const T = QA_REFRESH;
const ORE = 'item_copper_ore';
const USES = 5;
const WELL_CHANCE = 100;
const STAR_CHANCE = 50;

const vein = (id, name) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: USES, sprite: 't_ore_vein_copper', tags: ['Ore'],
    requiresHero: true, staysPut: true,
    respawn: { mode: 'refill', afterMs: 60000, restingSprite: 't_vein_stone' },
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
});

function registerQaTypes() {
    registerTokenTypes({
        [T.NEAR_VEIN]: vein(T.NEAR_VEIN, 'QA Refresh Vein (near)'),
        [T.STAR_VEIN]: vein(T.STAR_VEIN, 'QA Refresh Vein (star)'),
        [T.WELL]: {
            id: T.WELL, name: 'QA Refresh Well', tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_mineshaft_copper', requiresHero: false,
            statements: [{
                id: `stm_${T.WELL}`, keyword: 'provides', to: { mode: 'id', value: T.NEAR_VEIN }, reach: 'nearby',
                payload: { type: EFFECT_TYPES.REFRESH, bucket: 'flat', value: WELL_CHANCE, category: 'mining' }
            }]
        }
    });
}

/** The authored sky with one more star by the Hall, its rank 1 held. */
function installQaStar() {
    const authored = authoredHallSky();
    const star = {
        id: T.STAR, constellation: 'qa_refresh', name: 'QA Fresh Seams',
        description: 'QA Refresh Veins (star) sometimes spend none of their charges.',
        node: { x: 1.25, y: 0.35 }, links: [HALL_NODE], tag: 'right',
        ranks: [{
            tier: 1, price: [], lines: [],
            rules: [{
                id: `stm_${T.STAR}`, keyword: 'provides', chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
                to: { mode: 'id', value: T.STAR_VEIN },
                payload: { type: EFFECT_TYPES.REFRESH, bucket: 'flat', value: STAR_CHANCE }
            }]
        }]
    };
    registerHallSky({
        constellations: { ...authored.constellations, qa_refresh: { id: 'qa_refresh', name: 'QA Refresh', label: { x: 1.3, y: 0.6 } } },
        stars: { ...authored.stars, [T.STAR]: star }
    });
    const ranks = GuildUpgradeManager.getRanks();
    ranks[T.STAR] = 1;
}

function put(typeId, point) {
    const at = MatPlacement.findSpot(typeId, point, { reach: 200 }) || point;
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, at)?.success ? inst : null;
}

/** Where the scene stands: the mat's upper left, the star's vein well out of the Well's reach. */
export const REFRESH_SPOTS = Object.freeze({
    near: { x: 260, y: 260 },
    well: { x: 410, y: 260 },
    star: { x: 260, y: 640 }
});

let scene = null;
let unsubscribe = null;

/**
 * The mat's upper left: a QA Refresh Vein beside a QA Refresh Well (Refresh 100 %), and below it a
 * second vein the QA Fresh Seams star reaches (Refresh 50 %), a QA Miner on each. The near vein's
 * charges never drop; the star's vein drops on about half its cycles. ⚠️ Changes the game, like
 * Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpRefreshScene() {
    if (!getItem(ORE)) return { ok: false, error: 'No Copper Ore in the content' };
    registerQaTypes();
    installQaStar();
    const s = REFRESH_SPOTS;
    const near = put(T.NEAR_VEIN, s.near);
    const well = put(T.WELL, s.well);
    const star = put(T.STAR_VEIN, s.star);
    if (!near || !well || !star) return { ok: false, error: 'No room at the mat’s upper left for the scene' };
    TileModifiers.rebuildAll();

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 2);
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});

    const miners = [];
    for (const [inst, name] of [[near, 'QA Refresh Miner'], [star, 'QA Star Miner']]) {
        const miner = generateHero({ name });
        miner.skills = { mining: { ...(miner.skills?.mining || {}), level: 10, xp: xpForLevel(10) } };
        if (!HeroManager.addHero(miner)) return { ok: false, error: 'The roster would not take another hero' };
        qaOrder(miner.id, { x: inst.x, y: inst.y });
        miners.push(miner.id);
    }

    scene = { near: near.id, star: star.id, cycles: { [near.id]: 0, [star.id]: 0 }, spent: { [near.id]: 0, [star.id]: 0 } };
    unsubscribe?.();
    const offCycle = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => {
        if (scene && e.instanceId in scene.cycles) scene.cycles[e.instanceId] += 1;
    }, UI_LISTENER);
    const offCharges = EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (e) => {
        if (scene && e.instanceId in scene.spent && e.delta < 0) scene.spent[e.instanceId] -= e.delta;
    }, UI_LISTENER);
    unsubscribe = () => { offCycle?.(); offCharges?.(); };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_refresh_scene' });
    return { ok: true };
}

function veinLine(id, chanceFrom) {
    const t = BoardState.getTokenById(id);
    if (!t) return null;
    const chance = TileModifiers.resolveAxis(id, EFFECT_TYPES.REFRESH, 0, 'mining');
    const rest = Respawn.nextRespawn(t);
    const charges = rest ? `resting, refills in ${Math.ceil(rest.inMs / 1000)} s` : `${t.usesRemaining} of ${USES} charges`;
    return `${tokenName(t.typeId)}: ${charges}; Refresh ${chance} % (${chanceFrom}); ${scene.cycles[id]} cycles, ${scene.spent[id]} charges spent`;
}

/**
 * What the scene shows, read from the engine.
 * @returns {string[]}
 */
export function refreshReadout() {
    if (!scene) return [];
    return [
        veinLine(scene.near, 'the Well beside it'),
        veinLine(scene.star, `the QA Fresh Seams star, rank ${GuildUpgradeManager.getRanks()[T.STAR] || 0}`)
    ].filter(Boolean);
}

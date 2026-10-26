// the QA panel's skill loops check (brief 230 S1a, S1b): Grow Time, the 80 % floor, a fixed vein, stations and supports that never wear; a miner waiting for a resting vein, a furnace out of coal
// ⚠️ DEV BUILDS ONLY: reached from `SkillLoopsDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as TimedChanges from '../../systems/board/TimedChanges.js';
import * as FixedTokens from '../../systems/board/FixedTokens.js';
import * as Charges from '../../systems/board/Charges.js';
import * as Respawn from '../../systems/board/Respawn.js';
import * as BoardRunner from '../../systems/board/BoardRunner.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { flagStatusLine } from '../components/board/flagText.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes, tokenStartingUses, tokenName } from '../../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { MAX_SPEED_UP_CUT } from '../../config/loopConstants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test Tokens made in memory for this check only (never written to `data/`, gone on reload):
 * - a Grove: Grow Time −30 % to Oak Saplings within reach (two stand by one Sapling: 30 s → 12 s);
 * - a Minecart: Work Time −20 % to the Slow Vein within reach (five: −100 %, held at the floor);
 * - a Slow Vein: a 10 s Mining node that stays where it stands, needing no tool.
 */
export const QA_TYPES = Object.freeze({
    GROVE: 'qa_s1a_grove',
    MINECART: 'qa_s1a_minecart',
    VEIN: 'qa_s1a_slow_vein'
});
const SAPLING = 'token_oak_sapling';
const STATION = 'token_grandma_s_kitchen';
const SUPPORT = 'token_windmill';

const provides = (id, type, value, target) => ({
    id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: target },
    payload: { type, bucket: 'percentage', value }
});

function registerQaTypes() {
    registerTokenTypes({
        [QA_TYPES.GROVE]: {
            id: QA_TYPES.GROVE, name: 'QA Grove', tokenType: 'buff', rarity: 'common', theme: 'qa',
            uses: null, sprite: 't_forest_oak', requiresHero: false,
            statements: [provides(QA_TYPES.GROVE, EFFECT_TYPES.GROW_TIME, -0.3, SAPLING)]
        },
        [QA_TYPES.MINECART]: {
            id: QA_TYPES.MINECART, name: 'QA Minecart', tokenType: 'buff', rarity: 'common', theme: 'qa',
            uses: null, sprite: 't_minecart_copper', requiresHero: false,
            statements: [provides(QA_TYPES.MINECART, EFFECT_TYPES.WORK_TIME, -0.2, QA_TYPES.VEIN)]
        },
        [QA_TYPES.VEIN]: {
            id: QA_TYPES.VEIN, name: 'QA Slow Vein', tokenType: 'resource', rarity: 'common', theme: 'qa',
            uses: 500, sprite: 't_ore_vein_copper', requiresHero: true, staysPut: true,
            config: {
                skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [],
                outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }]
            }
        }
    });
}

/** The ring of `n` points `r` from a centre. */
const ring = (c, n, r) => Array.from({ length: n }, (_, i) => ({
    x: Math.round(c.x + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2)),
    y: Math.round(c.y + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2))
}));

/** Ids of what the scene laid, for the readout. */
let scene = null;

function put(typeId, point) {
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, point)?.success ? inst : null;
}

/**
 * Around the Guild Hall:
 * - left: an Oak Sapling between two QA Groves (Grow Time −30 % each: its authored time is cut
 *   to 40 %, 150 s to 60 s; its countdown bubble starts there);
 * - right: the QA Slow Vein (10 s, stays where it stands: dragging it is refused) ringed by five
 *   QA Minecarts (−20 % each), worked by a new Miner: the cycle runs at 2 s, the 80 % floor;
 * - below: Grandma's Kitchen and a Windmill, two stations that never wear out: no charge ring,
 *   unlimited, whatever Charges they author.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpSkillLoopsScene() {
    for (const id of [SAPLING, STATION, SUPPORT]) {
        if (!getTokenType(id)) return { ok: false, error: `No ${id} in the content` };
    }
    registerQaTypes();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };

    const left = { x: c.x - 480, y: c.y - 120 };
    const right = { x: c.x + 480, y: c.y - 120 };
    const sapling = put(SAPLING, left);
    const groves = [put(QA_TYPES.GROVE, { x: left.x - 150, y: left.y }), put(QA_TYPES.GROVE, { x: left.x + 150, y: left.y })];
    const vein = put(QA_TYPES.VEIN, right);
    const carts = ring(right, 5, 150).map(p => put(QA_TYPES.MINECART, p));
    const station = put(STATION, { x: c.x - 120, y: c.y + 280 });
    const support = put(SUPPORT, { x: c.x + 120, y: c.y + 280 });
    if (!sapling || !vein || !station || !support || groves.some(g => !g) || carts.some(m => !m)) {
        return { ok: false, error: 'No room around the Guild Hall for the scene' };
    }

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const miner = generateHero({ name: 'QA Miner' });
    for (const id of Object.keys(miner.skills || {})) miner.skills[id] = { ...miner.skills[id], level: 10, xp: xpForLevel(10) };
    if (HeroManager.addHero(miner)) Placement.plantFlagAt(miner.id, { x: vein.x, y: vein.y });

    scene = { sapling: sapling.id, vein: vein.id, station: station.id, support: support.id };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_skill_loops_scene' });
    return { ok: true };
}

/** One second, to one decimal. */
const secs = (ms) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/**
 * What the scene shows, read from the engine's own functions, refreshed while the panel is open.
 * @returns {string[]}
 */
export function skillLoopsReadout() {
    if (!scene) return [];
    const lines = [];
    const sapling = BoardState.getTokenById(scene.sapling);
    const growth = sapling ? TimedChanges.nextGrowth(sapling) : null;
    const authoredGrow = getTokenType(SAPLING)?.grows?.afterMs ?? 0;
    lines.push(growth
        ? `Oak Sapling grows in ${secs(growth.totalMs)} (${secs(authoredGrow)} authored, two Groves at −30 %), ${secs(growth.inMs)} left`
        : 'Oak Sapling has grown into a Tree');

    const vein = BoardState.getTokenById(scene.vein);
    if (vein) {
        const base = getTokenType(vein.typeId)?.config?.cycleTimeMs || 10000;
        const rules = TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.WORK_TIME, base, 'mining');
        const cycle = Math.max(1000, TileModifiers.floorSpeedUp(base, rules));
        lines.push(`QA Slow Vein works in ${secs(cycle)}: the rules alone say ${secs(Math.max(0, rules))}, held at ${Math.round(MAX_SPEED_UP_CUT * 100)} % off. ${FixedTokens.isFixed(vein) ? 'Stays where it stands' : 'Movable'}`);
    }
    for (const id of [scene.station, scene.support]) {
        const t = BoardState.getTokenById(id);
        if (!t) continue;
        const authored = getTokenType(t.typeId)?.uses;
        const note = authored == null ? 'no Charges authored' : `${authored} authored, ignored`;
        lines.push(`${tokenName(t.typeId)}: ${Charges.isUnlimited(t) ? 'unlimited' : `${t.usesRemaining} charges`} (${note})`);
    }
    return lines;
}

/**
 * Waiting test Tokens (brief 230 S1b), made in memory like the ones above:
 * - a QA Copper Vein: 2 charges, 2 s a cycle, then it rests 20 s and refills;
 * - a QA Coal Vein: the same, resting 60 s;
 * - a QA Furnace: one Coal in, one Copper Ingot out, 4 s a cycle.
 * None needs a tool.
 */
export const QA_WAIT_TYPES = Object.freeze({
    VEIN: 'qa_s1b_copper_vein',
    COAL: 'qa_s1b_coal_vein',
    FURNACE: 'qa_s1b_furnace'
});
const COAL = 'item_coal';

function registerWaitTypes() {
    const vein = (id, name, sprite, itemId, afterMs) => ({
        id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: 2, sprite,
        requiresHero: true, staysPut: true, respawn: { mode: 'refill', afterMs },
        config: {
            skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [],
            outputs: [{ itemId, chance: 100, minQty: 1, maxQty: 1 }]
        }
    });
    registerTokenTypes({
        [QA_WAIT_TYPES.VEIN]: vein(QA_WAIT_TYPES.VEIN, 'QA Copper Vein', 't_ore_vein_copper', 'item_copper_ore', 20000),
        [QA_WAIT_TYPES.COAL]: vein(QA_WAIT_TYPES.COAL, 'QA Coal Vein', 't_ore_vein_coal', COAL, 60000),
        [QA_WAIT_TYPES.FURNACE]: {
            id: QA_WAIT_TYPES.FURNACE, name: 'QA Furnace', tokenType: 'station', rarity: 'common', theme: 'qa',
            uses: null, sprite: 't_smelter', requiresHero: true,
            config: {
                skill: 'smithing', skillRequired: 1, cycleTimeMs: 4000, xp: 1,
                inputs: [{ itemId: COAL, quantity: 1 }],
                outputs: [{ itemId: 'item_copper_ingot', chance: 100, minQty: 1, maxQty: 1 }]
            }
        }
    });
}

/** A new hero holding only these skills at level 10, with room made in the roster. */
function qaHero(name, skillIds) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    hero.skills = Object.fromEntries(skillIds.map(id => [id, { ...(hero.skills?.[id] || {}), level: 10, xp: xpForLevel(10) }]));
    return HeroManager.addHero(hero) ? hero : null;
}

/** Ids of what the waiting scene laid, for the readout. */
let waitScene = null;

/** Where the waiting scene stands: the mat's lower left, clear of the Starter Camp and the scene above. */
const WAIT_SPOTS = Object.freeze({ vein: { x: 220, y: 760 }, furnace: { x: 620, y: 760 }, coal: { x: 790, y: 710 } });

/**
 * The mat's lower left, two heroes alone with their work:
 * - a QA Miner whose only work is the QA Copper Vein: two cycles, then it rests 20 s. They wait by
 *   their flag saying nothing, with no idle mark; the flag's hover and the Dock say "Waiting for
 *   QA Copper Vein"; they go back to it the moment it refills;
 * - a QA Smith at the QA Furnace with one Coal in the Bank (every other Coal is taken out): one
 *   ingot, then the Furnace stops, says "Needs Coal" every few seconds, and the Smith stays.
 * ⚠️ Changes the game, like Spawn Party: it empties the Bank's Coal.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpWaitingScene() {
    registerWaitTypes();
    const vein = put(QA_WAIT_TYPES.VEIN, WAIT_SPOTS.vein);
    const furnace = put(QA_WAIT_TYPES.FURNACE, WAIT_SPOTS.furnace);
    if (!vein || !furnace) return { ok: false, error: 'No room at the mat’s lower left for the scene' };

    const coal = InventoryManager.getItemCount(COAL);
    if (coal > 0) InventoryManager.removeItem(COAL, coal);
    InventoryManager.addItem(COAL, 1);

    const miner = qaHero('QA Miner', ['mining']);
    const smith = qaHero('QA Smith', ['mining', 'smithing']);
    if (!miner || !smith) return { ok: false, error: 'The roster would not take two more heroes' };
    Placement.plantFlagAt(miner.id, { x: vein.x, y: vein.y });
    Placement.plantFlagAt(smith.id, { x: furnace.x, y: furnace.y });

    waitScene = { vein: vein.id, furnace: furnace.id, miner: miner.id, smith: smith.id, coal: null };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_skill_loops_waiting' });
    return { ok: true };
}

/**
 * A QA Coal Vein in the QA Smith's reach: they leave the stopped Furnace to mine it, and once it
 * rests (two Coal) they go back and smelt.
 * @returns {{ok: boolean, error?: string}}
 */
export function addCoalVein() {
    if (!waitScene || !BoardState.getTokenById(waitScene.furnace)) return { ok: false, error: 'Lay out the waiting scene first' };
    if (waitScene.coal && BoardState.getTokenById(waitScene.coal)) return { ok: false, error: 'The Coal Vein is already there' };
    const vein = put(QA_WAIT_TYPES.COAL, WAIT_SPOTS.coal);
    if (!vein) return { ok: false, error: 'No room beside the QA Furnace' };
    waitScene.coal = vein.id;
    return { ok: true };
}

/**
 * What the waiting scene shows, read from the engine and the flag's own words.
 * @returns {string[]}
 */
export function waitingReadout() {
    if (!waitScene) return [];
    const lines = [];
    const heroLine = (heroId, label) => {
        if (!HeroManager.getHero(heroId)) return;
        lines.push(`${label}: ${flagStatusLine(heroId)}${BoardRunner.isHeroIdle(heroId) ? ' (counts as idle)' : ' (not idle)'}`);
    };
    const vein = BoardState.getTokenById(waitScene.vein);
    if (vein) {
        const resting = Respawn.isResting(vein);
        const left = resting ? Respawn.restMsOf(vein) - (Number(vein.clocks?.[Respawn.CLOCK]) || 0) : 0;
        lines.push(`QA Copper Vein: ${resting ? `resting, back in ${secs(Math.max(0, left))}` : `${vein.usesRemaining} charges`}`);
    }
    heroLine(waitScene.miner, 'QA Miner');
    const furnace = BoardState.getTokenById(waitScene.furnace);
    if (furnace) lines.push(`QA Furnace: ${furnace.alert === 'inputs' ? 'stopped, needs Coal' : 'running'}; Coal in the Bank: ${InventoryManager.getItemCount(COAL)}`);
    heroLine(waitScene.smith, 'QA Smith');
    return lines;
}

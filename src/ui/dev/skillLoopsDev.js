// the QA panel's skill loops check (brief 230 S1a): Grow Time, the 80 % floor, a fixed vein, stations and supports that never wear
// ⚠️ DEV BUILDS ONLY: reached from `SkillLoopsDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as TimedChanges from '../../systems/board/TimedChanges.js';
import * as FixedTokens from '../../systems/board/FixedTokens.js';
import * as Charges from '../../systems/board/Charges.js';
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
 * - left: an Oak Sapling between two QA Groves (Grow Time −30 % each: 30 s becomes 12 s; its
 *   countdown bubble starts at 0:12);
 * - right: the QA Slow Vein (10 s, stays where it stands: dragging it is refused) ringed by five
 *   QA Minecarts (−20 % each), worked by a new Miner: the cycle runs at 2 s, the 80 % floor;
 * - below: Grandma's Kitchen and a Windmill, a station and a support that once had 5000 and 1000
 *   charges: no charge ring, unlimited.
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
    lines.push(growth
        ? `Oak Sapling grows in ${secs(growth.totalMs)} (30.0 s authored, two Groves at −30 %), ${secs(growth.inMs)} left`
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
        lines.push(`${tokenName(t.typeId)}: ${Charges.isUnlimited(t) ? 'unlimited' : `${t.usesRemaining} charges`} (${authored ?? 'no'} authored, ignored)`);
    }
    return lines;
}

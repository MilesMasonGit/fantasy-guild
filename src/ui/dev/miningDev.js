// the QA panel's Mining check (brief 230 S3): a vein that rests and refills all at once, drawn as the shared empty rock while it rests; Mines doubling its ore (not its gem), a Minecart speeding it
// ⚠️ DEV BUILDS ONLY: reached from `MiningDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import { qaOrder } from './qaOrders.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Respawn from '../../systems/board/Respawn.js';
import * as FixedTokens from '../../systems/board/FixedTokens.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../../systems/board/SpriteLayer.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, tokenName, getTokenType } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test Tokens made in memory for this check only (never written to `data/`, gone on reload), with
 * the shapes the S8 content pack will give the real ones:
 * - a QA Copper Vein: 5 Copper Ore (and a 10 % Quartz, standing in for a gem), 2.5 s a cycle;
 *   at 0 it rests a minute, drawn as the shared empty rock, then refills all at once;
 * - a QA Iron Vein: the same rock while it rests (it starts empty);
 * - a QA Copper Mine: Double Item Chance 25 % on Copper Ore to QA Copper Veins in reach;
 * - a QA Minecart: Work Time −20 % to QA Copper Veins in reach.
 */
export const QA_MINING = Object.freeze({
    COPPER_VEIN: 'qa_s3_copper_vein',
    IRON_VEIN: 'qa_s3_iron_vein',
    MINE: 'qa_s3_copper_mine',
    MINECART: 'qa_s3_minecart'
});
const T = QA_MINING;
const ORE = 'item_copper_ore';
const GEM = 'item_quartz';
/** The shared empty rock, a stand-in until the owner draws it (`owner_art_list.md`). */
export const EMPTY_ROCK = 't_vein_stone';
const REST_MS = 60000;

const vein = (id, name, sprite, outputs) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: 5, sprite, tags: ['Ore'],
    requiresHero: true, staysPut: true,
    respawn: { mode: 'refill', afterMs: REST_MS, restingSprite: EMPTY_ROCK },
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2500, xp: 1, inputs: [], outputs }
});
const support = (id, name, sprite, payload) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: false,
    statements: [{ id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: T.COPPER_VEIN }, reach: 'nearby', payload }]
});

function registerQaTypes() {
    registerTokenTypes({
        [T.COPPER_VEIN]: vein(T.COPPER_VEIN, 'QA Copper Vein', 't_ore_vein_copper', [
            { itemId: ORE, chance: 100, minQty: 1, maxQty: 1 },
            { itemId: GEM, chance: 10, minQty: 1, maxQty: 1 }
        ]),
        [T.IRON_VEIN]: vein(T.IRON_VEIN, 'QA Iron Vein', 't_ore_vein_iron', [{ itemId: 'item_iron_ore', chance: 100, minQty: 1, maxQty: 1 }]),
        [T.MINE]: support(T.MINE, 'QA Copper Mine', 't_mineshaft_copper',
            { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 25, category: ORE }),
        [T.MINECART]: support(T.MINECART, 'QA Minecart', 't_minecart_copper',
            { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.2 })
    });
}

/**
 * Where the scene stands: the mat's lower right, clear of the Starter Camp's Copper Mine, the
 * Hall's scenes and the waiting and Forestry scenes. The Mines and the Minecart stand 150 from the
 * copper vein (within its reach, 164); the iron vein stands apart.
 */
export const MINING_SPOTS = Object.freeze({
    copper: { x: 1600, y: 780 },
    mines: [{ x: 1450, y: 780 }, { x: 1600, y: 930 }],
    minecart: { x: 1750, y: 780 },
    iron: { x: 1790, y: 950 }
});

function put(typeId, point, uses = tokenStartingUses(typeId)) {
    const inst = BoardState.createTokenInstance(typeId, uses);
    return Placement.placeTokenAt(inst, point)?.success ? inst : null;
}

/** What the scene laid, for the readout. */
let scene = null;

/**
 * The mat's lower right:
 * - a QA Copper Vein with two QA Copper Mines and a QA Minecart round it, and a QA Miner flagged
 *   on it: it works in 2 s (2.5 s, −20 %), about half its Copper Ore comes out doubled (two Mines,
 *   25 % each), its Quartz never; after five ore it rests a minute, drawn as the empty rock, its
 *   card saying "QA Copper Vein: resting, refills in 0:59", then refills all five at once;
 * - a QA Iron Vein, already empty: the same rock, its name saying it is iron.
 * Both stay where they stand (dragging is refused).
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpMiningScene() {
    if (!getItem(ORE)) return { ok: false, error: 'No Copper Ore in the content' };
    registerQaTypes();
    const s = MINING_SPOTS;
    const copper = put(T.COPPER_VEIN, s.copper);
    const mines = s.mines.map(p => put(T.MINE, p));
    const cart = put(T.MINECART, s.minecart);
    const iron = put(T.IRON_VEIN, s.iron, 0);
    if (!copper || mines.some(m => !m) || !cart || !iron) return { ok: false, error: 'No room at the mat’s lower right for the scene' };
    // The iron vein starts resting, as one emptied by a miner does.
    Respawn.restInstead(iron);
    TileModifiers.rebuildAll();

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const miner = generateHero({ name: 'QA Miner' });
    miner.skills = { mining: { ...(miner.skills?.mining || {}), level: 10, xp: xpForLevel(10) } };
    if (!HeroManager.addHero(miner)) return { ok: false, error: 'The roster would not take another hero' };
    qaOrder(miner.id, s.copper);

    scene = { copper: copper.id, iron: iron.id, ore: oreNow(), gem: gemNow() };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_mining_scene' });
    return { ok: true };
}

const oreNow = () => InventoryManager.getItemCount(ORE) + SpriteLayer.countOnBoard(ORE);
const gemNow = () => InventoryManager.getItemCount(GEM) + SpriteLayer.countOnBoard(GEM);

/** One second, to one decimal. */
const secs = (ms) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/** A vein's state as the readout says it. */
function veinText(t) {
    const name = tokenName(t.typeId);
    const rest = Respawn.nextRespawn(t);
    const fixed = FixedTokens.isFixed(t) ? 'stays where it stands' : 'movable';
    if (rest) return `${name}: resting, refills in ${secs(rest.inMs)}, drawn as ${Respawn.restingSpriteOf(t) || 'its own art, greyed'} (${fixed})`;
    return `${name}: ${t.usesRemaining} of ${getTokenType(t.typeId)?.uses} ore left (${fixed})`;
}

/**
 * What the scene shows, read from the engine.
 * @returns {string[]}
 */
export function miningReadout() {
    if (!scene) return [];
    const lines = [];
    const copper = BoardState.getTokenById(scene.copper);
    if (copper) {
        lines.push(veinText(copper));
        const base = getTokenType(copper.typeId)?.config?.cycleTimeMs || 2500;
        const cycle = Math.max(1000, TileModifiers.floorSpeedUp(base, TileModifiers.resolveAxis(copper.id, EFFECT_TYPES.WORK_TIME, base, 'mining')));
        const double = (itemId) => TileModifiers.resolveAxis(copper.id, EFFECT_TYPES.DOUBLE_DROP, 0, itemId);
        lines.push(`Works in ${secs(cycle)} (${secs(base)} authored, the Minecart −20 %); doubles Copper Ore ${double(ORE)} %, Quartz ${double(GEM)} %`);
        lines.push(`Since the scene: ${oreNow() - scene.ore} Copper Ore, ${gemNow() - scene.gem} Quartz`);
    }
    const iron = BoardState.getTokenById(scene.iron);
    if (iron) lines.push(veinText(iron));
    return lines;
}

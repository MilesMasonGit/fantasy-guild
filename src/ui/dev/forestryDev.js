// the QA panel's Forestry check (brief 230 S2a): a Forest that plants and regrows, a felled Oak becoming a Stump then a Sapling, a wild Stump with no Forest, a Stump stopped for want of its seedling
// ⚠️ DEV BUILDS ONLY: reached from `ForestryDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as TimedChanges from '../../systems/board/TimedChanges.js';
import * as SpawnerSystem from '../../systems/board/SpawnerSystem.js';
import * as BoardRunner from '../../systems/board/BoardRunner.js';
import * as Demolition from '../../systems/board/Demolition.js';
import * as FixedTokens from '../../systems/board/FixedTokens.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { flagStatusLine } from '../components/board/flagText.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test Tokens made in memory for this check only (never written to `data/`, gone on reload), with
 * the S2a fields the S8 content pack will give the real ones:
 * - a QA Oak Forest: plants QA Oak Saplings within its reach up to 3 (a seedling each), speeds
 *   its Oaks' regrowth 30 %, can be cleared where a map placed it;
 * - a QA Oak: 2 logs, then a QA Oak Stump, which needs the QA Oak Forest in reach and pays one Oak
 *   Seedling to become a QA Oak Sapling (20 s, 14 s with the Forest), which grows back (20 s);
 * - a QA Birch Forest and a QA Birch Stump that needs it and a Birch Seedling (8 s).
 */
export const QA_FOREST_TYPES = Object.freeze({
    OAK_FOREST: 'qa_s2a_oak_forest',
    OAK: 'qa_s2a_oak',
    OAK_STUMP: 'qa_s2a_oak_stump',
    OAK_SAPLING: 'qa_s2a_oak_sapling',
    BIRCH_FOREST: 'qa_s2a_birch_forest',
    BIRCH_STUMP: 'qa_s2a_birch_stump',
    BIRCH_SAPLING: 'qa_s2a_birch_sapling',
    BIRCH: 'qa_s2a_birch'
});
const T = QA_FOREST_TYPES;
const OAK_SEEDLING = 'item_oak_seedling';
const BIRCH_SEEDLING = 'item_birch_seedling';

const base = (id, name, sprite, extra) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: false, ...extra
});
const felling = (itemId) => ({
    skill: 'forestry', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [],
    outputs: [{ itemId, chance: 100, minQty: 1, maxQty: 1 }]
});

function registerQaTypes() {
    registerTokenTypes({
        [T.OAK_FOREST]: base(T.OAK_FOREST, 'QA Oak Forest', 't_forest_oak', {
            tokenType: 'spawner', clearable: true,
            spawner: {
                spawns: [{ typeId: T.OAK_SAPLING, weight: 1 }], allowance: 3, intervalMs: 15000,
                upkeep: [{ itemId: OAK_SEEDLING, quantity: 1 }], withinReach: true
            },
            statements: [{
                id: 'stm_qa_s2a_oak_forest', keyword: 'provides', to: { mode: 'tag', value: 'QaOak' },
                payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.3 }
            }]
        }),
        [T.OAK]: base(T.OAK, 'QA Oak', 't_tree_oak', {
            uses: 2, requiresHero: true, staysPut: true, tags: ['QaOak'], config: felling('item_oak_wood'),
            respawn: { mode: 'regrow', into: T.OAK_STUMP }
        }),
        [T.OAK_STUMP]: base(T.OAK_STUMP, 'QA Oak Stump', 't_stump_oak', {
            tags: ['QaOak'], clearable: true,
            grows: { into: T.OAK_SAPLING, afterMs: 20000, needsNearby: [T.OAK_FOREST], cost: [{ itemId: OAK_SEEDLING, quantity: 1 }] }
        }),
        [T.OAK_SAPLING]: base(T.OAK_SAPLING, 'QA Oak Sapling', 't_sapling_oak', {
            artSize: 'small', tags: ['QaOak'], grows: { into: T.OAK, afterMs: 20000 }
        }),
        [T.BIRCH_FOREST]: base(T.BIRCH_FOREST, 'QA Birch Forest', 't_forest_birch', { tokenType: 'buff', clearable: true }),
        [T.BIRCH_STUMP]: base(T.BIRCH_STUMP, 'QA Birch Stump', 't_stump_birch', {
            clearable: true,
            grows: { into: T.BIRCH_SAPLING, afterMs: 8000, needsNearby: [T.BIRCH_FOREST], cost: [{ itemId: BIRCH_SEEDLING, quantity: 1 }] }
        }),
        [T.BIRCH_SAPLING]: base(T.BIRCH_SAPLING, 'QA Birch Sapling', 't_sapling_birch', {
            artSize: 'small', grows: { into: T.BIRCH, afterMs: 20000 }
        }),
        [T.BIRCH]: base(T.BIRCH, 'QA Birch', 't_tree_birch', {
            uses: 2, requiresHero: true, staysPut: true, config: felling('item_birch_wood'),
            respawn: { mode: 'regrow', into: T.BIRCH_STUMP }
        })
    });
}

/**
 * Where the scene stands: the mat's upper right, clear of the Starter Camp, the Hall's scene and
 * the waiting scene. The Oaks and the Forest are within its reach (150 apart); the wild Stump and
 * the Birch pair are out of the forester's flag.
 */
export const FOREST_SPOTS = Object.freeze({
    oakForest: { x: 1400, y: 180 },
    oaks: [{ x: 1550, y: 180 }, { x: 1250, y: 180 }],
    wildStump: { x: 1820, y: 120 },
    birchForest: { x: 1820, y: 380 },
    birchStump: { x: 1670, y: 380 }
});

function put(typeId, point) {
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, point)?.success ? inst : null;
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

/** What the scene laid, for the readout. */
let scene = null;

/**
 * The mat's upper right:
 * - a QA Oak Forest with two QA Oaks in its reach and a QA Forester flagged on it: the Forest
 *   plants a QA Oak Sapling within its reach (its third tree, a seedling paid); the Forester fells
 *   an Oak, which becomes a QA Oak Stump, pays a seedling and becomes a Sapling, then an Oak; while
 *   nothing is ready the Forester waits silently ("Waiting for QA Oak Stump" on the flag's hover);
 * - top right, a wild QA Oak Stump a map placed, with no Forest in reach: it stays a Stump, its
 *   yellow mark says it needs a QA Oak Forest nearby, and its inspection offers Demolish;
 * - below it, a QA Birch Stump beside a QA Birch Forest with no Birch Seedling in the Bank: after
 *   8 s it stops and says "Needs Birch Seedling" ("Give a Birch Seedling" lets it grow).
 * ⚠️ Changes the game, like Spawn Party: it sets the Bank's Oak Seedlings to 10 and empties its
 * Birch Seedlings.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpForestryScene() {
    registerQaTypes();
    const s = FOREST_SPOTS;
    const forest = put(T.OAK_FOREST, s.oakForest);
    const oaks = s.oaks.map(p => put(T.OAK, p));
    const wild = put(T.OAK_STUMP, s.wildStump);
    const birchForest = put(T.BIRCH_FOREST, s.birchForest);
    const birchStump = put(T.BIRCH_STUMP, s.birchStump);
    if (!forest || oaks.some(o => !o) || !wild || !birchForest || !birchStump) {
        return { ok: false, error: 'No room at the mat’s upper right for the scene' };
    }
    // As a map writes its nodes: a fixture, which only a clearable type lets the player demolish.
    wild.fixture = BoardState.FIXTURE.MAP;

    const oakSeedlings = InventoryManager.getItemCount(OAK_SEEDLING);
    if (oakSeedlings < 10) InventoryManager.addItem(OAK_SEEDLING, 10 - oakSeedlings);
    else if (oakSeedlings > 10) InventoryManager.removeItem(OAK_SEEDLING, oakSeedlings - 10);
    const birch = InventoryManager.getItemCount(BIRCH_SEEDLING);
    if (birch > 0) InventoryManager.removeItem(BIRCH_SEEDLING, birch);

    const forester = qaHero('QA Forester', ['forestry']);
    if (!forester) return { ok: false, error: 'The roster would not take another hero' };
    Placement.plantFlagAt(forester.id, s.oakForest);

    scene = { forest: forest.id, wild: wild.id, forester: forester.id };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_forestry_scene' });
    return { ok: true };
}

/** One Birch Seedling into the Bank: the stopped QA Birch Stump grows on the next tick. */
export function giveBirchSeedling() {
    InventoryManager.addItem(BIRCH_SEEDLING, 1);
    return { ok: true };
}

/** One second, to one decimal. */
const secs = (ms) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/** A growing Token's state as the readout says it. */
function growthText(t) {
    const g = TimedChanges.nextGrowth(t);
    if (!g) return tokenName(t.typeId);
    const into = tokenName(g.into);
    if (g.paused) return `${tokenName(t.typeId)}: waiting for ${g.needsNearby.map(tokenName).join(' or ')} in reach (clock stands still)`;
    if (g.stopped) return `${tokenName(t.typeId)}: stopped, needs ${g.short.map(id => getItem(id)?.name || id).join(', ')}`;
    return `${tokenName(t.typeId)}: grows into ${into} in ${secs(g.inMs)} (${secs(g.totalMs)} in all)`;
}

/**
 * What the scene shows, read from the engine and the flag's own words.
 * @returns {string[]}
 */
export function forestryReadout() {
    if (!scene) return [];
    const lines = [];
    const forest = BoardState.getTokenById(scene.forest);
    if (forest) {
        const status = SpawnerSystem.spawnerStatus(forest.id);
        if (status) lines.push(`QA Oak Forest: ${status.count}/${status.cap} trees in its reach (${status.state})`);
    }
    for (const p of FOREST_SPOTS.oaks) {
        const t = BoardState.tokensAtPoint(p.x, p.y)[0];
        if (t) lines.push(t.typeId === T.OAK ? `QA Oak: ${t.usesRemaining} logs` : growthText(t));
    }
    if (HeroManager.getHero(scene.forester)) {
        lines.push(`QA Forester: ${flagStatusLine(scene.forester)}${BoardRunner.isHeroIdle(scene.forester) ? ' (counts as idle)' : ' (not idle)'}`);
    }
    const wild = BoardState.getTokenById(scene.wild);
    if (wild) {
        lines.push(`Wild ${growthText(wild)}; ${FixedTokens.isFixed(wild) ? 'fixed' : 'movable'}, ${Demolition.refusalOf(wild) ? 'cannot be cleared' : 'can be cleared'}`);
    }
    const birch = BoardState.tokensAtPoint(FOREST_SPOTS.birchStump.x, FOREST_SPOTS.birchStump.y)[0];
    if (birch) lines.push(growthText(birch));
    lines.push(`Bank: ${InventoryManager.getItemCount(OAK_SEEDLING)} Oak Seedling, ${InventoryManager.getItemCount(BIRCH_SEEDLING)} Birch Seedling`);
    return lines;
}

// the QA panel's Orchards check (brief 230 S2b): fruit trees picked bare that fruit again in place beside their Orchard, an Orchard planting within its reach, a Bare tree with no Orchard staying Bare
// ⚠️ DEV BUILDS ONLY: reached from `OrchardDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as TimedChanges from '../../systems/board/TimedChanges.js';
import * as SpawnerSystem from '../../systems/board/SpawnerSystem.js';
import * as BoardRunner from '../../systems/board/BoardRunner.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Respawn from '../../systems/board/Respawn.js';
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
 * the S2b shape the S8 content pack will give the real Apple Orchard, Sapling and Tree:
 * - a QA Apple Orchard: plants QA Apple Saplings within its reach up to 3 (an Apple Seed each) and
 *   speeds its trees' fruiting 40 %;
 * - a QA Apple Sapling: grows into a QA Apple Tree in 20 s;
 * - a QA Apple Tree: 3 picks, then Bare (drawn as its Bare picture) for 30 s (18 s with the
 *   Orchard), then fruiting again all at once, only with a QA Apple Orchard in reach. It stays
 *   where it stands.
 */
export const QA_ORCHARD = Object.freeze({
    ORCHARD: 'qa_s2b_apple_orchard',
    SAPLING: 'qa_s2b_apple_sapling',
    TREE: 'qa_s2b_apple_tree'
});
const T = QA_ORCHARD;
const SEED = 'item_apple_seed';
/** The Bare look, a stand-in until the owner draws it (`owner_art_list.md`): a tree with no fruit. */
export const BARE_SPRITE = 't_tree_oak';
const REST_MS = 30000;

const base = (id, name, sprite, extra) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: false, ...extra
});

function registerQaTypes() {
    registerTokenTypes({
        [T.ORCHARD]: base(T.ORCHARD, 'QA Apple Orchard', 't_orchard_red', {
            tokenType: 'spawner', clearable: true,
            spawner: {
                spawns: [{ typeId: T.SAPLING, weight: 1 }], allowance: 3, intervalMs: 15000,
                upkeep: [{ itemId: SEED, quantity: 1 }], withinReach: true
            },
            statements: [{
                id: 'stm_qa_s2b_orchard', keyword: 'provides', to: { mode: 'id', value: T.TREE }, reach: 'nearby',
                payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.4 }
            }]
        }),
        [T.SAPLING]: base(T.SAPLING, 'QA Apple Sapling', 't_sapling_maple', {
            artSize: 'small', grows: { into: T.TREE, afterMs: 20000 }
        }),
        [T.TREE]: base(T.TREE, 'QA Apple Tree', 't_tree_apple', {
            uses: 3, requiresHero: true, staysPut: true,
            respawn: { mode: 'refill', afterMs: REST_MS, restingSprite: BARE_SPRITE, needsNearby: [T.ORCHARD] },
            config: {
                skill: 'farming', skillRequired: 1, cycleTimeMs: 2500, xp: 1, inputs: [],
                outputs: [
                    { itemId: 'item_apple', chance: 100, minQty: 1, maxQty: 2 },
                    { itemId: SEED, chance: 30, minQty: 1, maxQty: 1 }
                ]
            }
        })
    });
}

/**
 * Where the scene stands: the top of the mat, between the Starter Camp's Oak Forest and the
 * Forestry scene (upper right), above the Guild Hall, clear of the waiting scene (lower left) and
 * Mining (lower right). Both trees stand 150 from the Orchard (within its reach, 164); the lone
 * tree stands out of the Orchard's reach and the picker's flag (240).
 */
export const ORCHARD_SPOTS = Object.freeze({
    orchard: { x: 880, y: 150 },
    fruiting: { x: 1030, y: 150 },
    bare: { x: 880, y: 300 },
    lone: { x: 620, y: 100 },
    loneOrchard: { x: 620, y: 250 }
});

function put(typeId, point, uses = tokenStartingUses(typeId)) {
    const inst = BoardState.createTokenInstance(typeId, uses);
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
 * The top of the mat:
 * - a QA Apple Orchard with a fruiting QA Apple Tree and a Bare one in its reach, and a QA Picker
 *   flagged on it: the Picker picks the fruiting tree bare (three picks), and it rests Bare for
 *   18 s (30 s, the Orchard −40 %) before fruiting again; the Bare one fruits again first; while
 *   both are Bare the Picker waits silently ("Waiting for QA Apple Tree" on the flag's hover); the
 *   Orchard plants a third tree within its reach (an Apple Seed paid);
 * - to the left, a lone Bare QA Apple Tree with no Orchard in reach: it stays Bare, its yellow
 *   mark saying it needs a QA Apple Orchard nearby to refill ("Put an Orchard beside the lone
 *   tree" starts it).
 * Every tree stays where it stands (dragging is refused).
 * ⚠️ Changes the game, like Spawn Party: it sets the Bank's Apple Seeds to 5.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpOrchardScene() {
    if (!getItem(SEED)) return { ok: false, error: 'No Apple Seed in the content' };
    registerQaTypes();
    const s = ORCHARD_SPOTS;
    const orchard = put(T.ORCHARD, s.orchard);
    const fruiting = put(T.TREE, s.fruiting);
    const bare = put(T.TREE, s.bare, 0);
    const lone = put(T.TREE, s.lone, 0);
    if (!orchard || !fruiting || !bare || !lone) return { ok: false, error: 'No room at the top of the mat for the scene' };
    // Both start Bare, as trees a picker emptied do.
    Respawn.restInstead(bare);
    Respawn.restInstead(lone);
    TileModifiers.rebuildAll();

    const seeds = InventoryManager.getItemCount(SEED);
    if (seeds < 5) InventoryManager.addItem(SEED, 5 - seeds);
    else if (seeds > 5) InventoryManager.removeItem(SEED, seeds - 5);

    const picker = qaHero('QA Picker', ['farming']);
    if (!picker) return { ok: false, error: 'The roster would not take another hero' };
    Placement.plantFlagAt(picker.id, s.orchard);

    scene = { orchard: orchard.id, fruiting: fruiting.id, bare: bare.id, lone: lone.id, picker: picker.id };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_orchard_scene' });
    return { ok: true };
}

/** A QA Apple Orchard beside the lone Bare tree: it starts fruiting again. */
export function putOrchardByLoneTree() {
    if (!scene) return { ok: false, error: 'Lay out the orchard first' };
    registerQaTypes();
    const placed = put(T.ORCHARD, ORCHARD_SPOTS.loneOrchard);
    if (!placed) return { ok: false, error: 'No room beside the lone tree' };
    TileModifiers.rebuildAll();
    return { ok: true };
}

/** One second, to one decimal. */
const secs = (ms) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/** A tree's state as the readout says it. */
function treeText(label, t) {
    const fixed = FixedTokens.isFixed(t) ? 'stays where it stands' : 'movable';
    const rest = Respawn.nextRespawn(t);
    if (rest?.paused) return `${label}: Bare, waiting for ${rest.needsNearby.map(tokenName).join(' or ')} in reach (clock stands still; ${fixed})`;
    if (rest) return `${label}: Bare, fruits again in ${secs(rest.inMs)} (${secs(rest.totalMs)} in all), drawn as ${Respawn.restingSpriteOf(t) || 'its own art, greyed'} (${fixed})`;
    return `${label}: fruiting, ${t.usesRemaining} picks left (${fixed})`;
}

/**
 * What the scene shows, read from the engine and the flag's own words.
 * @returns {string[]}
 */
export function orchardReadout() {
    if (!scene) return [];
    const lines = [];
    const orchard = BoardState.getTokenById(scene.orchard);
    if (orchard) {
        const status = SpawnerSystem.spawnerStatus(orchard.id);
        if (status) lines.push(`QA Apple Orchard: ${status.count}/${status.cap} trees in its reach (${status.state})`);
    }
    for (const [label, id] of [['Tree beside it', scene.fruiting], ['Second tree', scene.bare], ['Lone tree', scene.lone]]) {
        const t = BoardState.getTokenById(id);
        if (t) lines.push(treeText(label, t));
    }
    for (const t of BoardState.tokens()) {
        if (t.typeId !== T.SAPLING) continue;
        const g = TimedChanges.nextGrowth(t);
        if (g) lines.push(`Planted QA Apple Sapling: grows into a QA Apple Tree in ${secs(g.inMs)}`);
    }
    if (HeroManager.getHero(scene.picker)) {
        lines.push(`QA Picker: ${flagStatusLine(scene.picker)}${BoardRunner.isHeroIdle(scene.picker) ? ' (counts as idle)' : ' (not idle)'}`);
    }
    lines.push(`Bank: ${InventoryManager.getItemCount(SEED)} Apple Seed`);
    return lines;
}

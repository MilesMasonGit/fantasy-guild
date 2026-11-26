import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Placement from '../systems/board/Placement.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as FishingSpots from '../systems/board/FishingSpots.js';
import * as GroundRules from '../systems/board/GroundRules.js';
import { reachRadius } from '../systems/board/nearby.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { LESSON_TARGETS } from '../systems/quests/lessonPlan.js';
import { getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { isGatheringSkill } from '../config/registries/skillRegistry.js';
import { setStarterCampForTests, resetStarterCampForTests } from '../config/registries/starterCampRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The Starter Camp at the new spacing (owner, 2026-11-26, concept_token_spacing.md ruling 5):
 * around the Guild Hall, one clump per gathering skill (Copper and Stone veins; Oak trees; Berry
 * bushes and a Field; a Fishing Spot by water), every Token at legal spacing, and free places beside
 * each clump for the first buildings. The first block reads the camp a new game opens on
 * (`data/starterCamp.json`, written by the CMS's Sync), so it follows the owner's layout; the second
 * tries each check on a camp that breaks it, so a check cannot pass by finding nothing to look at.
 */

/** The Tokens each gathering clump holds, as the owner named them. */
const CLUMPS = Object.freeze({
    mining: Object.freeze(['token_copper_ore_vein', 'token_stone_outcrop']),
    forestry: Object.freeze(['token_oak_tree']),
    farming: Object.freeze(['token_redberry_bush', 'token_wheat_field'])
});
const FOREST = 'token_oak_forest';
const FISHING_SPOT = 'token_fishing_spot';
const FOUNDATION = 'token_wood_foundation';

/** How many free places each clump keeps for its first buildings, all taken at once. */
const FIRST_BUILDINGS = 3;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

/** Every pair of Tokens on the mat closer than the closest the two may stand, and every Token standing where it may not. */
function crowding() {
    const tokens = BoardState.tokens();
    const pairs = [];
    for (let i = 0; i < tokens.length; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
            const [a, b] = [tokens[i], tokens[j]];
            if (dist(a, b) < MatPlacement.minGap(a.typeId, b.typeId) - 1e-6) pairs.push(`${a.typeId} and ${b.typeId}, ${dist(a, b).toFixed(0)} u apart`);
        }
    }
    const misplaced = tokens.filter(t => !MatPlacement.isLegal(t.typeId, { x: t.x, y: t.y }, { excludeId: t.id })).map(t => t.typeId);
    return { pairs, misplaced };
}

/** The camp's gathering nodes by skill: Tokens a hero works for XP in a gathering skill. */
function gatheringNodes() {
    const bySkill = {};
    for (const t of BoardState.tokens()) {
        const config = getTokenType(t.typeId)?.config;
        if (!isGatheringSkill(config?.skill) || !(config.xp > 0)) continue;
        (bySkill[config.skill] ||= []).push(t);
    }
    return bySkill;
}

/** Tokens in groups: two are in one group when a chain of Tokens each within reach of the next joins them. */
function clumpsOf(tokens) {
    const groups = [];
    for (const t of tokens) {
        const joined = groups.filter(g => g.some(o => dist(o, t) <= reachRadius()));
        const merged = [t, ...joined.flat()];
        for (const g of joined) groups.splice(groups.indexOf(g), 1);
        groups.push(merged);
    }
    return groups;
}

/**
 * Put `count` Tokens of `typeId` down beside `anchors`, one after another, each where it may stand
 * and within reach of at least `minInReach` of them (the most it can reach first): the first
 * buildings of a clump. They stay on the mat, so a later clump cannot count the same places.
 *
 * @returns {{x: number, y: number}[]} where they went (fewer than `count` when room ran out)
 */
function buildBeside(anchors, typeId, count, minInReach = Math.min(2, anchors.length)) {
    const placed = [];
    for (let n = 0; n < count; n++) {
        let best = null;
        for (let x = 64; x <= matW() - 64; x += 8) {
            for (let y = 64; y <= matH() - 64; y += 8) {
                const p = { x, y };
                const inReach = anchors.filter(a => dist(a, p) <= reachRadius()).length;
                if (inReach < minInReach || !MatPlacement.isLegal(typeId, p)) continue;
                const score = inReach * 1e4 - Math.min(...anchors.map(a => dist(a, p)));
                if (!best || score > best.score) best = { p, score };
            }
        }
        if (!best) break;
        BoardState.addToken(BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)), best.p.x, best.p.y);
        placed.push(best.p);
    }
    return placed;
}

const ofType = (...typeIds) => BoardState.tokens().filter(t => typeIds.includes(t.typeId));

beforeEach(() => resetMatTuning());
afterEach(() => {
    resetStarterCampForTests();
    resetMatTuning();
});

describe('⭐ the Starter Camp a new game opens on', () => {
    beforeEach(() => newGame());

    it('⭐ every Token stands at least the closest spacing from every other, each where it may stand', () => {
        expect(BoardState.tokens().length).toBeGreaterThan(10);
        expect(crowding()).toEqual({ pairs: [], misplaced: [] });
    });

    it('⭐ one clump per gathering skill: Copper and Stone veins, Oak trees, Berry bushes and a Field', () => {
        const nodes = gatheringNodes();
        for (const [skill, typeIds] of Object.entries(CLUMPS)) {
            const clumps = clumpsOf(nodes[skill] || []);
            expect(clumps, skill).toHaveLength(1);
            for (const typeId of typeIds) expect(clumps[0].map(t => t.typeId), skill).toContain(typeId);
        }
        // The trees belong to their Forest: a felled tree's Stump regrows only beside it.
        const forests = ofType(FOREST);
        for (const tree of ofType(...CLUMPS.forestry)) {
            expect(forests.some(f => dist(f, tree) <= reachRadius()), `${tree.x},${tree.y}`).toBe(true);
        }
    });

    it('⭐ a Fishing Spot by water: the camp\'s pond, where Fishing Spots drift in by themselves', () => {
        // None is laid with the camp: one on dry ground would drift off; they arrive on the pond.
        expect(ofType(FISHING_SPOT)).toEqual([]);
        const landed = FishingSpots.landNow(FISHING_SPOT);
        expect(landed.success).toBe(true);
        expect(GroundRules.waterKindAt(landed.instance.x, landed.instance.y)).toBeTruthy();
    });

    it('⭐ room beside each clump for its first buildings, every clump\'s at once', () => {
        const nodes = gatheringNodes();
        // Mining's first building stands on the camp's Stone (an Excavation, a Stone Foundation's mine).
        const mining = nodes.mining;
        expect(buildBeside(mining, 'token_excavation', 1)).toHaveLength(1);
        expect(buildBeside(mining, FOUNDATION, FIRST_BUILDINGS - 1)).toHaveLength(FIRST_BUILDINGS - 1);
        expect(buildBeside(nodes.forestry, FOUNDATION, FIRST_BUILDINGS)).toHaveLength(FIRST_BUILDINGS);
        // Farming's own foundation stands on grass.
        expect(buildBeside(nodes.farming, 'token_farmland', 1)).toHaveLength(1);
        expect(buildBeside(nodes.farming, FOUNDATION, FIRST_BUILDINGS - 1)).toHaveLength(FIRST_BUILDINGS - 1);
        // Fishing's buildings stand on Docks, on the pond's shore, in reach of a spot on it.
        const spot = FishingSpots.landNow(FISHING_SPOT);
        expect(spot.success).toBe(true);
        expect(buildBeside([spot.instance], 'token_dock', 2)).toHaveLength(2);
        expect(crowding()).toEqual({ pairs: [], misplaced: [] });
    });

    it('the lessons\' Tokens stand in the camp, the scrap heap and the small slime by the Hall, and a bought Foundation lands beside it', () => {
        const hall = ofType(StarterCamp.GUILD_HALL_TYPE)[0];
        for (const key of ['berryBush', 'scrapHeap', 'tree', 'foe']) {
            expect(ofType(LESSON_TARGETS[key]).length, key).toBeGreaterThan(0);
        }
        for (const key of ['scrapHeap', 'foe']) {
            expect(ofType(LESSON_TARGETS[key]).some(t => dist(t, hall) <= reachRadius()), key).toBe(true);
        }
        // Lesson 6: the Foundation bought in the Shop lands by the Hall.
        const bought = Placement.placeArrivalNear(BoardState.createTokenInstance(FOUNDATION, 1), Placement.centreOfBoard());
        expect(bought.success).toBe(true);
        expect(dist(bought, hall)).toBeLessThanOrEqual(reachRadius());
    });
});

describe('the checks catch a camp that breaks them', () => {
    const MAT = { w: 1920, h: 1040 };
    const HALL = { x: 960, y: 520 };
    const camp = (tokens) => ({ mat: MAT, hall: HALL, tokens, bank: { item_oak_wood: 1 } });

    it('two Tokens closer than the spacing', () => {
        // The camp is laid as saved, with no rules: the check is what finds them.
        setStarterCampForTests(camp([{ typeId: 'token_oak_tree', x: 300, y: 300 }, { typeId: 'token_oak_tree', x: 400, y: 300 }]));
        newGame();
        expect(crowding().pairs).toEqual(['token_oak_tree and token_oak_tree, 100 u apart']);
    });

    it('one skill\'s nodes in two clumps', () => {
        setStarterCampForTests(camp([{ typeId: 'token_oak_tree', x: 300, y: 300 }, { typeId: 'token_oak_tree', x: 1600, y: 300 }]));
        newGame();
        expect(clumpsOf(gatheringNodes().forestry)).toHaveLength(2);
    });

    it('a clump hemmed in on every side', () => {
        const vein = { typeId: 'token_copper_ore_vein', x: 400, y: 300 };
        const outcrop = { typeId: 'token_stone_outcrop', x: 528, y: 300 };
        const hem = [];
        for (let row = -4; row <= 4; row++) {
            for (let col = -5; col <= 6; col++) {
                const p = { x: 400 + col * 128 + (row % 2 ? 64 : 0), y: 300 + row * 111 };
                if (p.x < 64 || p.y < 64 || [vein, outcrop].some(t => dist(t, p) < 1) || dist(HALL, p) < 128) continue;
                hem.push({ typeId: 'token_scrap_heap', ...p });
            }
        }
        setStarterCampForTests(camp([vein, outcrop, ...hem]));
        newGame();
        expect(crowding().pairs).toEqual([]);
        expect(buildBeside(gatheringNodes().mining, FOUNDATION, 1)).toEqual([]);
    });
});

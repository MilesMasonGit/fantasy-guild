// The Starter Camp: the Region a new game opens in

import { matW, matH, artRadiusOf } from '../../config/matGeometry.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import { authoredStarterCamp } from '../../config/registries/starterCampRegistry.js';
import { normaliseStarterCamp } from '../../config/starterCampShape.js';
import * as BoardState from '../board/BoardState.js';
import * as MatPlacement from '../board/MatPlacement.js';
import * as FixedTokens from '../board/FixedTokens.js';
import { isGuildHall } from '../board/MatCap.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import { TERRAIN, DEFAULT_TERRAIN, TERRAIN_CELL, terrainGrid, cellCentre, cellIndex, encodeTerrain } from './TerrainMap.js';
import { emptyWater, readWater, sampleWater, fieldAt, smallWater, SMALL_WATER } from './WaterShapes.js';
import { OUTCROP, outcropAt, stoneRecordOf, readStone, sampleStone } from './StoneShapes.js';
import { HALL_CLEARING } from './Layout.js';
import { mulberry32 } from './seededRandom.js';

/**
 * The Starter Camp is content: the owner lays it out in the game, saves it with the QA panel's
 * "Save this mat as the Starter Camp", reviews it on the CMS's Starter Camp page and syncs it into
 * `data/starterCamp.json` (`starterCampRegistry.js` loads it; the shape is `starterCampShape.js`).
 * Until there is one, a new game opens on the built-in camp ({@link builtInCamp}).
 *
 * The layout keeps its offset from the middle of the mat it was saved on: on a mat of another size
 * the whole camp moves so the two middles meet, and anything that would then stand off the edge is
 * pulled just inside it.
 */

export const GUILD_HALL_TYPE = 'token_guild_hall';

/** How far the built-in camp's Forest and Mine stand from the Hall: one flag between them reaches both. */
export const BUILT_IN_OFFSET = 320;

/**
 * The built-in camp's Bank: Oak Seeds so the Forest spawns trees at once (it pays one seed per
 * spawn), a little Oak Wood towards the first Shop purchase, and two Wheat Seeds for the first
 * Farmland.
 */
export const BUILT_IN_BANK = Object.freeze({ item_oak_seedling: 3, item_oak_wood: 10, item_wheat_seed: 2 });

const centreOf = (w, h) => ({ x: Math.round(w / 2), y: Math.round(h / 2) });

/**
 * The camp a new game opens on while no Starter Camp has been synced: the Guild Hall in the middle,
 * an Oak Forest to its left and a Copper Mine to its right.
 *
 * ⚠️ A function, not a constant: the mat's size is live (`matGeometry.js`).
 */
export function builtInCamp() {
    const { x, y } = centreOf(matW(), matH());
    return normaliseStarterCamp({
        mat: { w: matW(), h: matH() },
        hall: { x, y },
        tokens: [
            { typeId: 'token_oak_forest', x: x - BUILT_IN_OFFSET, y },
            { typeId: 'token_copper_mine', x: x + BUILT_IN_OFFSET, y }
        ],
        bank: BUILT_IN_BANK
    });
}

/** The camp a new game opens on: the synced one, else the built-in one. */
export function starterCamp() {
    return authoredStarterCamp() || builtInCamp();
}

/** Whether a new game would open on the built-in camp (no Starter Camp synced yet). */
export function isBuiltIn() {
    return !authoredStarterCamp();
}

/**
 * Where each of a camp's Tokens stands on the mat as it is now: the Guild Hall first, then the
 * Tokens in the camp's order. A Token whose type does not exist is listed all the same (the boot
 * audit names it); {@link layOnLiveBoard} leaves it off.
 *
 * @returns {{typeId: string, x: number, y: number}[]}
 */
export function placementsOf(camp = starterCamp()) {
    const here = centreOf(matW(), matH());
    const saved = camp?.mat ? centreOf(camp.mat.w, camp.mat.h) : here;
    const dx = here.x - saved.x;
    const dy = here.y - saved.y;
    const at = (typeId, p) => ({ typeId, ...MatPlacement.clampInside(typeId, { x: p.x + dx, y: p.y + dy }) });
    return [
        at(GUILD_HALL_TYPE, camp?.hall || saved),
        ...(camp?.tokens || []).map(t => at(t.typeId, t))
    ];
}

/**
 * Where the Starter Camp's pond is tried, in order: a step out from the Hall's clearing in eight
 * directions (left first), then further out.
 */
const POND_DIRECTIONS = Object.freeze([[-1, 0], [-0.7071, 0.7071], [0.7071, -0.7071], [1, 0], [0, -1], [0, 1], [-0.7071, -0.7071], [0.7071, 0.7071]]);
const POND_REACH = Object.freeze([460, 540, 620]);

/** How far the pond keeps inside the mat's edge, and off each Token's art, in mat units. */
const POND_MARGIN = 140;
const POND_CLEAR = 24;

/** The Starter Camp's Stone patch: its two radii in mat units. ⚠️ First values, for the owner's look. */
export const CAMP_STONE = Object.freeze({ rx: 120, ry: 92 });

/** The patch's own random stream, apart from the pond's, so the pond lies where it always did. */
const STONE_SALT = 0x53544f4e;

const standsOnStone = (def) => Array.isArray(def?.standsOn) && def.standsOn.includes(TERRAIN.STONE);
const mines = (def) => def?.config?.skill === 'mining';

function centroid(points) {
    const n = points.length;
    return { x: Math.round(points.reduce((a, p) => a + p.x, 0) / n), y: Math.round(points.reduce((a, p) => a + p.y, 0) / n) };
}

/**
 * The Starter Camp's ground: meadow, one small pond near the camp where nothing stands, and a small
 * patch of Stone, so a mine that stands only on Stone can be built and moved at home (owner).
 *
 * - The pond: the first spot of {@link POND_DIRECTIONS} where it keeps off the Hall's clearing, the
 *   mat's edge and every Token's art, stored like a settled Region's water so it is drawn and the
 *   Tokens keep off it.
 * - The Stone: one outcrop of {@link CAMP_STONE}'s size under the camp's Tokens that stand on Stone
 *   (its mines), else under its mining nodes, else at the first spot out from the Hall (right side
 *   first) where it keeps off every Token. Water wins over it; it never lies in the Hall's clearing
 *   or under a Token that neither mines nor stands on Stone.
 *
 * Null when neither fits: the camp is then all meadow, as before.
 *
 * @param {{typeId: string, x: number, y: number}[]} standing  the camp's Tokens as they stand
 * @param {{w: number, h: number}} mat
 * @param {number} seed  the Region's seed, for the shapes
 * @param {{typeOf?: (typeId: string) => object|null}} [lookups]  a Token type by id
 */
export function starterCampTerrain(standing, mat, seed, { typeOf = getTokenType } = {}) {
    const hall = standing.find(t => t.typeId === GUILD_HALL_TYPE) || centreOf(mat.w, mat.h);
    const clear = { x: hall.x, y: hall.y, r: HALL_CLEARING + 2 * TERRAIN_CELL };
    const grid = terrainGrid(mat);
    const inClearing = (i) => {
        const c = cellCentre(grid, i);
        return (c.x - clear.x) * (c.x - clear.x) + (c.y - clear.y) * (c.y - clear.y) < clear.r * clear.r;
    };
    const pond = pondOf(standing, mat, hall, clear, grid, inClearing, seed);
    const stone = stoneOf(standing, mat, hall, clear, grid, inClearing, seed, typeOf, pond?.cells);
    if (!pond && !stone) return null;
    const terrains = Array.from({ length: grid.cols * grid.rows }, (_, i) => (
        pond?.cells[i] ? TERRAIN.WATER : stone?.cells[i] ? TERRAIN.STONE : DEFAULT_TERRAIN
    ));
    return encodeTerrain(grid, terrains, pond?.record ?? null, stone?.record ?? null);
}

/** The pond: its record and the cells it covers, or null when no spot fits. */
function pondOf(standing, mat, hall, clear, grid, inClearing, seed) {
    const random = mulberry32((Number(seed) || 0) ^ 0x504f4e44);
    const record = emptyWater(random, mat, clear);
    const tokenCells = new Set(standing.map(t => cellIndex(grid, t.x, t.y)));
    const keepDry = (i) => tokenCells.has(i) || inClearing(i);
    for (const reach of POND_REACH) {
        for (const [dx, dy] of POND_DIRECTIONS) {
            const x = Math.round(hall.x + dx * reach);
            const y = Math.round(hall.y + dy * reach);
            if (x < POND_MARGIN || y < POND_MARGIN || x > mat.w - POND_MARGIN || y > mat.h - POND_MARGIN) continue;
            const shape = smallWater(SMALL_WATER.POND, x, y, random);
            const water = { ...record, shapes: [shape] };
            const { water: cells, sample } = sampleWater(readWater(water), grid, TERRAIN_CELL, keepDry);
            if (!cells.some(Boolean)) continue;
            if (!standing.every(t => fieldAt(sample, t.x, t.y) <= -(artRadiusOf(t.typeId) + POND_CLEAR))) continue;
            return { record: water, cells };
        }
    }
    return null;
}

/** The Stone patch: its record and the cells it covers, or null when it has nowhere to lie. */
function stoneOf(standing, mat, hall, clear, grid, inClearing, seed, typeOf, wet) {
    const random = mulberry32((Number(seed) || 0) ^ STONE_SALT);
    const onStone = standing.filter(t => standsOnStone(typeOf(t.typeId)));
    const mining = standing.filter(t => mines(typeOf(t.typeId)));
    let centre = onStone.length ? centroid(onStone) : mining.length ? centroid(mining) : null;
    if (!centre) {
        const reachOf = Math.max(CAMP_STONE.rx, CAMP_STONE.ry) * (1 + OUTCROP.noise);
        const clearOfAll = (p) => standing.every(t => Math.hypot(p.x - t.x, p.y - t.y) > reachOf + artRadiusOf(t.typeId));
        search:
        for (const reach of POND_REACH) {
            for (const [dx, dy] of POND_DIRECTIONS) {
                const p = { x: Math.round(hall.x - dx * reach), y: Math.round(hall.y - dy * reach) };
                if (p.x < POND_MARGIN || p.y < POND_MARGIN || p.x > mat.w - POND_MARGIN || p.y > mat.h - POND_MARGIN) continue;
                if (!clearOfAll(p)) continue;
                centre = p;
                break search;
            }
        }
    }
    if (!centre) return null;
    const record = stoneRecordOf(random, [outcropAt(random, centre.x, centre.y, CAMP_STONE)]);
    // Off the pond, out of the Hall's clearing, and from under any Token that is not for rock.
    const keptGreen = new Set(standing
        .filter(t => t.typeId !== GUILD_HALL_TYPE && !standsOnStone(typeOf(t.typeId)) && !mines(typeOf(t.typeId)))
        .map(t => cellIndex(grid, t.x, t.y)));
    const cells = sampleStone(readStone(record), grid, TERRAIN_CELL, (i) => wet?.[i] === 1 || inClearing(i) || keptGreen.has(i));
    return cells.some(Boolean) ? { record, cells } : null;
}

/** A camp's Bank as `[{ itemId, quantity }]`, in its order. */
export function openingBank(camp = starterCamp()) {
    return Object.entries(camp?.bank || {}).map(([itemId, quantity]) => ({ itemId, quantity }));
}

/**
 * Stand a camp's Tokens on the live board, fresh (starting charges, `placed`), with no rules: the
 * layout was legal on the mat it was saved from. A Token whose type no longer exists is left off.
 *
 * @returns {object[]} the instances now on the mat
 */
export function layOnLiveBoard(camp = starterCamp()) {
    const laid = [];
    for (const { typeId, x, y } of placementsOf(camp)) {
        if (!getTokenType(typeId)) {
            warnMissingContent('StarterCamp', 'Token', typeId, 'the Starter Camp opens without it');
            continue;
        }
        laid.push(BoardState.addToken(BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)), x, y));
    }
    FixedTokens.fixCampTokens(laid);
    return laid;
}

/**
 * The live mat as a Starter Camp, for the dev button: the Guild Hall's point, every Token the
 * player placed (in arrival order, at its point) and the Bank. Spawned Tokens are left out (the
 * camp's own spawners make them again), and so are quest Tokens (the tutorial's).
 *
 * @param {{savedAt?: string|null}} [options] when it was saved, as the caller reads the clock
 * @returns {{camp: object, skipped: {spawned: number, quests: number}}}
 */
export function campFromLiveMat({ savedAt = null } = {}) {
    let hall = null;
    const tokens = [];
    const skipped = { spawned: 0, quests: 0 };
    for (const t of BoardState.tokens()) {
        if (isGuildHall(t)) {
            if (!hall) hall = { x: t.x, y: t.y };
        } else if (t.typeId === QUEST_TOKEN_TYPE) {
            skipped.quests++;
        } else if (BoardState.originOf(t) === BoardState.ORIGIN.SPAWNED) {
            skipped.spawned++;
        } else {
            tokens.push({ typeId: t.typeId, x: t.x, y: t.y });
        }
    }
    const bank = {};
    for (const [itemId, entry] of Object.entries(InventoryManager.getAllItems() || {})) {
        bank[itemId] = entry?.quantity;
    }
    const camp = normaliseStarterCamp({ savedAt, mat: { w: matW(), h: matH() }, hall, tokens, bank });
    return { camp, skipped };
}

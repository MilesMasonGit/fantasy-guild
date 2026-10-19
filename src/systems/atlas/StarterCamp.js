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

/**
 * The Starter Camp's ground: meadow, and one small pond near the camp where nothing stands (the
 * first spot of {@link POND_DIRECTIONS} where the pond keeps off the Hall's clearing, the mat's
 * edge and every Token's art), stored like a settled Region's water so it is drawn and the Tokens
 * keep off it. Null when no spot fits: the camp is then all meadow, as before.
 *
 * @param {{typeId: string, x: number, y: number}[]} standing  the camp's Tokens as they stand
 * @param {{w: number, h: number}} mat
 * @param {number} seed  the Region's seed, for the pond's shape
 */
export function starterCampTerrain(standing, mat, seed) {
    const hall = standing.find(t => t.typeId === GUILD_HALL_TYPE) || centreOf(mat.w, mat.h);
    const clear = { x: hall.x, y: hall.y, r: HALL_CLEARING + 2 * TERRAIN_CELL };
    const random = mulberry32((Number(seed) || 0) ^ 0x504f4e44);
    const record = emptyWater(random, mat, clear);
    const grid = terrainGrid(mat);
    const tokenCells = new Set(standing.map(t => cellIndex(grid, t.x, t.y)));
    const keepDry = (i) => {
        const c = cellCentre(grid, i);
        return tokenCells.has(i) || (c.x - clear.x) * (c.x - clear.x) + (c.y - clear.y) * (c.y - clear.y) < clear.r * clear.r;
    };
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
            return encodeTerrain(grid, Array.from(cells, v => (v ? TERRAIN.WATER : DEFAULT_TERRAIN)), water);
        }
    }
    return null;
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

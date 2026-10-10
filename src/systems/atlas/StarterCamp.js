// The Starter Camp: the Region a new game opens in

import { matW, matH } from '../../config/matGeometry.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import { authoredStarterCamp } from '../../config/registries/starterCampRegistry.js';
import { normaliseStarterCamp } from '../../config/starterCampShape.js';
import * as BoardState from '../board/BoardState.js';
import * as MatPlacement from '../board/MatPlacement.js';
import { isGuildHall } from '../board/MatCap.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { warnMissingContent } from '../../utils/missingContent.js';

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
export const BUILT_IN_BANK = Object.freeze({ item_oak_seed: 3, item_oak_wood: 10, item_wheat_seed: 2 });

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
    return laid;
}

/**
 * The live mat as a Starter Camp, for the dev button: the Guild Hall's point, every Token the
 * player placed (in arrival order, at its point) and the Bank. Spawned Tokens are left out (the
 * camp's own spawners make them again), and so are quest Tokens (the tutorial's) and the bin.
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

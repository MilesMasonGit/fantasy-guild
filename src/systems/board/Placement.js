// Fantasy Guild — Placement on the free playmat (Free Playmat slice 1.6d)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { positionOf } from './nearby.js';
import * as Flags from './Flags.js';
import {
    TILE_PX, isPlaceable, isFootprintInBounds, footprintCentre
} from '../../config/boardGeometry.js';
import { clampToMat, MAT_W, MAT_H } from '../../config/matGeometry.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as MatPlacement from './MatPlacement.js';
import * as TokenBank from './TokenBank.js';
import * as StationRecipe from './StationRecipe.js';
import { QuestManager } from '../quests/QuestManager.js';
import { warnMissingContent } from '../../utils/missingContent.js';

/**
 * ⭐ **Putting things on the playmat** — where the rules live, on top of
 * `BoardState`'s storage and `MatPlacement`'s geometry.
 *
 * ## Free placement (slice 1.6d): a Token lands where it was let go
 * The owner's framing rule is that there are no Tiles, and from this slice
 * nothing snaps. {@link placeTokenAt} takes a **mat point**, asks
 * `MatPlacement.dropAt` what should happen there, and carries the answer out:
 *
 * * **placed** — exactly on the point.
 * * **nudged** — the nearest legal point within nudge reach, because the point
 *   itself was crowded or would have broken a `Cannot` rule (FP-88).
 * * **restocked** — the point was on a matching copy with room for charges
 *   (FP-50); any leftover charges stand beside it (FP-87).
 * * **full** — nowhere within reach, so the caller puts it back where it came
 *   from and says so (FP-46). Nothing is ever lost.
 *
 * ## ⚠️ Nothing displaces anything any more
 * The 2×2 cascade, the occupant push and the Guild Hall shove were all answers
 * to "two things cannot share a tile". There are no tiles, so a drop that does
 * not fit moves **itself** rather than shoving whatever was already there —
 * which is also the only version where the player's existing arrangement is
 * never rearranged behind their back. `TILE_PUSHED` went with them.
 *
 * ## ⚠️ STOPGAP — the index-taking functions (deleted in slice 1.6d-2)
 * {@link placeToken}, {@link moveToken}, {@link returnTokenToTray},
 * {@link returnTokenToVault}, {@link placeHero} and {@link moveFlag} still take
 * an old tile index. They are **thin adapters**: each turns its index into a mat
 * point and calls the point function beside it, so there is exactly one copy of
 * every rule. They exist only so the readers and tests written against the tile
 * API keep working until 1.6d-2 moves them off it, and they are deleted with the
 * rest of the grid there.
 */

/** Wipe in-flight cycle progress. The forfeit in D-54 / D-131, in one place. */
function forfeitCycle(instance) {
    if (instance) instance.cycleElapsedMs = 0;
}

/**
 * Tell the board that something changed at these **mat points**, so every Token
 * whose neighbourhood they touch rebuilds its modifiers.
 *
 * Both ends of a move are named — where the Token left and where it landed —
 * because the Tokens that gained or lost it are within Near of one or the other.
 * Naming only the destination is how a buff goes stale (slice 1.3's top risk).
 */
function markAdjacencyDirty(points) {
    const list = (Array.isArray(points) ? points : [points])
        .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!list.length) return;
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: list });
}

/** The payload for a point a Token has just left: no Token there to name. */
const vacated = (point) => ({ ...point, typeId: null });

/** Announce that a hero moved, by the Token they work and the point they are drawn at. */
function announceHeroMoved(heroId) {
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, Flags.heroMovedPayload(heroId));
}

/** Standard refusal shape, so callers can show the reason (UI §3). */
const refuse = (reason, extra = {}) => ({ success: false, reason, ...extra });

/** A Token's own point, or null if it is not on the mat. */
const pointOf = (instance) =>
    (instance && Number.isFinite(instance.x) && Number.isFinite(instance.y))
        ? { x: instance.x, y: instance.y }
        : null;

/**
 * Whether a Mythic of this type is already on the mat (D-177), ignoring `exceptId`.
 * By instance id since slice 1.6d — there is no tile to name.
 */
function mythicAlreadyPlaced(typeId, exceptId = null) {
    if (getTokenType(typeId)?.rarity !== 'mythic') return false;
    for (const instance of BoardState.tokens()) {
        if (instance.id !== exceptId && instance.typeId === typeId) return true;
    }
    return false;
}

/** Check if a token cannot be removed from the playmat once placed. */
export function isPermanentToken(typeId, instance) {
    if (typeId === 'token_guild_hall' || instance?.typeId === 'token_guild_hall') return true;
    const def = getTokenType(typeId || instance?.typeId);
    return !!(def?.cannotLeaveBoard || def?.isGuildHall);
}

/** Where a Map's 128 u box sits when its centre lands on `point`, kept on the mat. */
function mapBoxAt(point) {
    return {
        x: Math.max(0, Math.min(MAT_W - TILE_PX, Math.round(point.x - TILE_PX / 2))),
        y: Math.max(0, Math.min(MAT_H - TILE_PX, Math.round(point.y - TILE_PX / 2)))
    };
}

/** Flash the refused-drop mark at a point, and refuse (UI §3). */
function refuseWithAlert(point, typeId, decision) {
    const vName = tokenName(decision.violatingTypeId) || tokenName(typeId) || 'Token';
    EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
        ...point,
        severity: 'disallow',
        type: 'drop_rejected',
        name: vName,
        title: `Drop Rejected: ${vName}`,
        rulesText: decision.rulesText || decision.reason,
        message: `Drop Rejected: ${vName}`
    });
    return refuse(decision.reason, { full: true });
}

// ---------------------------------------------------------------------------
// Tokens — by mat point (Free Playmat slice 1.6d)
// ---------------------------------------------------------------------------

/**
 * ⭐ **Put a Token on the mat at a point.** The one route every drop takes.
 *
 * @param {object} instance the Token being placed (not yet on the mat, or being moved)
 * @param {{x: number, y: number}} point where the player let go, in mat units
 * @param {{excludeId?: string, keepCycle?: boolean}} [options]
 * @returns {{success: boolean, reason?: string, x?: number, y?: number,
 *            nudged?: boolean, restocked?: boolean, full?: boolean}}
 */
export function placeTokenAt(instance, point, options = {}) {
    if (!instance?.typeId) return refuse('Not a valid Token');
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return refuse('Nowhere to drop that');
    }

    const def = getTokenType(instance.typeId);

    // CR2-108c / CR2-044. Placement still goes ahead — warn-only, per the
    // owner's ruling — but a Token with no definition has no size, no rules and
    // no artwork, so it sits there doing nothing. That is exactly what a Token
    // whose id was renamed in the CMS looks like, and it is how four starting
    // Tokens went unnoticed.
    if (!def) {
        warnMissingContent('Placement', 'Token', instance.typeId,
            'the Token being placed has no rules, no artwork and will never do anything');
    }

    // A station arrives set to something (R-5) — the lowest-level recipe of its
    // pool. A Token that already carries a valid selection keeps it.
    StationRecipe.ensureSelection(instance, def);

    // Freely positioned Map Tokens lie overtop the playmat (D-155).
    if (def?.mapId) {
        const box = mapBoxAt(point);
        BoardState.addBoardMap(instance.typeId, box.x, box.y, instance.usesRemaining);
        EventBus.publish('state_changed');
        return { success: true, displacedToken: null };
    }

    const excludeId = options.excludeId || instance.id || null;
    const at = clampToMat(point);

    if (mythicAlreadyPlaced(instance.typeId, excludeId)) {
        return refuse(`Only one ${tokenName(instance.typeId)} can be on the board at a time`);
    }

    const decision = MatPlacement.dropAt(instance, at, {
        excludeId,
        plan: { id: instance.id }
    });

    if (decision.status === 'full') return refuseWithAlert(at, instance.typeId, decision);
    if (decision.status === 'restocked') return restock(instance, decision, options);

    const from = pointOf(BoardState.getTokenById(instance.id));
    if (!options.keepCycle) forfeitCycle(instance);

    BoardState.addToken(instance, decision.x, decision.y);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { instanceId: instance.id, typeId: instance.typeId });
    markAdjacencyDirty([from, { x: decision.x, y: decision.y }]);
    EventBus.publish('state_changed');

    return {
        success: true,
        x: decision.x,
        y: decision.y,
        nudged: decision.status === 'nudged',
        displacedToken: null
    };
}

/**
 * Carry out a restock-on-copy (FP-50): the charges move, and whatever is left
 * over stands beside the copy it just filled (FP-87).
 *
 * The Tray is the fallback when even that has nowhere to go, exactly as before;
 * only if the Tray is full too does the drop fly back, so nothing is lost.
 */
function restock(instance, decision, options = {}) {
    const target = BoardState.getTokenById(decision.targetId);
    if (!target) return refuse('No Token there');

    target.usesRemaining += decision.transferred;
    instance.usesRemaining = (instance.usesRemaining ?? decision.transferred) - decision.transferred;

    const tName = tokenName(instance.typeId) || 'Token';
    EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
        instanceId: target.id,
        severity: 'green',
        type: 'token_restocked',
        name: tName,
        title: `Restocked from ${tName}`,
        message: `Restocked from ${tName}`
    });
    EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
        instanceId: target.id,
        delta: decision.transferred,
        remaining: target.usesRemaining,
        typeId: target.typeId
    });
    EventBus.publish('token_restocked', {
        instanceId: target.id,
        typeId: instance.typeId,
        addedCharges: decision.transferred,
        currentCharges: target.usesRemaining
    });
    EventBus.publish('audio:play', { clip: 'quest_claim' });
    EventBus.publish('state_changed');

    if (decision.absorbed) {
        return { success: true, restocked: true, absorbed: true, addedCharges: decision.transferred };
    }

    // FP-87: the leftover stays on the mat, nudged beside the copy.
    if (decision.x != null) {
        const from = pointOf(BoardState.getTokenById(instance.id));
        forfeitCycle(instance);
        BoardState.addToken(instance, decision.x, decision.y);
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
        EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { instanceId: instance.id, typeId: instance.typeId });
        markAdjacencyDirty([from, { x: decision.x, y: decision.y }]);
        EventBus.publish('state_changed');
        return {
            success: true, restocked: true, nudgedLeftover: true,
            x: decision.x, y: decision.y, addedCharges: decision.transferred
        };
    }

    // Nowhere beside it either: the Tray, as before.
    if (!BoardState.hasTraySpace()) {
        return refuse('No room in the Tray for the leftover Token', { full: true });
    }
    const landedOn = pointOf(target) || { x: 0, y: 0 };
    forfeitCycle(instance);
    instance.isLanding = true;
    BoardState.removeToken(instance.id);
    BoardState.addToTray(instance);
    EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
        kind: 'token',
        refId: instance.typeId,
        quantity: 1,
        x: landedOn.x,
        y: landedOn.y,
        destination: 'tray',
        trayX: instance.x,
        trayY: instance.y,
        instanceId: instance.id
    });
    EventBus.publish('state_changed');
    return { success: true, restocked: true, trayLeftover: true, addedCharges: decision.transferred };
}

/**
 * ⭐ Move the Token with id `id` to a mat point.
 *
 * **A moved Token keeps its progress and carries its hero** (FP-68). The hero's
 * claim is keyed by the Token instance, so it follows on its own — even outside
 * their flag's radius — and this only has to stop the forfeit and say that the
 * hero moved.
 */
export function moveTokenTo(id, point) {
    const moving = BoardState.getTokenById(id);
    if (!moving) return refuse('No Token there');

    const from = pointOf(moving);
    const heroId = BoardState.workerOf(id);

    const result = placeTokenAt(moving, point, { excludeId: id, keepCycle: true });
    if (!result.success) return result;

    if (from) EventBus.publish(BOARD_EVENTS.TILE_CHANGED, vacated(from));
    announceHeroMoved(heroId);
    return result;
}

/** Lift the Token with id `id` off the mat and back into the Tray. */
export function returnTokenToTrayById(id, position = null) {
    const instance = BoardState.getTokenById(id);
    if (!instance) return refuse('No Token there');
    if (isPermanentToken(instance.typeId, instance)) return refusePermanent(instance);

    const at = pointOf(instance);
    forfeitCycle(instance);
    if (position == null) instance.isLanding = true;

    // Asked before the Token leaves: afterwards nobody works it.
    const heroId = BoardState.workerOf(id);

    if (!BoardState.addToTray(instance, undefined, position)) {
        return refuse('No room in the Tray');
    }
    BoardState.removeToken(id);

    if (position == null && at) {
        EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
            kind: 'token',
            refId: instance.typeId,
            quantity: 1,
            x: at.x,
            y: at.y,
            destination: 'tray',
            trayX: instance.x,
            trayY: instance.y,
            instanceId: instance.id
        });
    }

    if (at) EventBus.publish(BOARD_EVENTS.TILE_CHANGED, vacated(at));
    if (heroId && at) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...at });
    markAdjacencyDirty([at]);
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
}

/** Lift the Token with id `id` off the mat and deposit it straight into the Vault. */
export function returnTokenToVaultById(id) {
    const instance = BoardState.getTokenById(id);
    if (!instance) return refuse('No Token there');
    if (isPermanentToken(instance.typeId, instance)) return refusePermanent(instance);

    if (!QuestManager.isTokenVaultSendUnlocked()) {
        return refuse('Token Vault storage unlocks after completing "Place a Dropped Token".');
    }
    if (getTokenType(instance.typeId)?.mapId) return refuse('Maps cannot be stored — open it.');

    const at = pointOf(instance);

    // The Vault is where a station's recipe memory ends (concept §2.1).
    forfeitCycle(instance);
    StationRecipe.clearSelection(instance);
    if (!TokenBank.deposit(instance)) return refuse('No room in the Vault');

    const heroId = BoardState.workerOf(id);
    BoardState.removeToken(id);

    if (at) EventBus.publish(BOARD_EVENTS.TILE_CHANGED, vacated(at));
    if (heroId && at) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...at });
    markAdjacencyDirty([at]);
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
}

/** The Guild Hall's refusal, with the mark that says so. */
function refusePermanent(instance) {
    const tName = tokenName(instance?.typeId) || 'Guild Hall';
    EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
        instanceId: instance.id,
        severity: 'disallow',
        type: 'drop_rejected',
        name: tName,
        title: 'Guild Hall cannot be removed from the playmat.',
        rulesText: null,
        message: 'Guild Hall cannot be removed from the playmat.'
    });
    return refuse('Guild Hall cannot be removed from the playmat.');
}

// ---------------------------------------------------------------------------
// Heroes — the bridge to flags (Free Playmat slice 1.4b)
// ---------------------------------------------------------------------------

/**
 * ⭐ Plant `heroId`'s flag **exactly at a mat point** (FP-94) — the point the
 * player let go of it, clamped onto the mat. **The only route a flag moves by.**
 *
 * The flag chooses at once by the hero's rules (FP-71), so dropping on a Token
 * the hero can work works it unless a better-priority Token is runnable in
 * range; otherwise the hero works something else in range, or idles at the flag.
 *
 * ⚠️ **Nobody is displaced.** Two heroes can plant on one spot; only one works
 * the Token (FP-25). Flags never nudge each other or Tokens (FP-83).
 */
export function plantFlagAt(heroId, point) {
    if (!heroId) return refuse('No hero');
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return refuse('Nowhere to plant a flag');
    const at = clampToMat(point);

    // `Flags.plant` announces `hero_deployed` itself, for every route (1.5).
    const planted = Flags.plant(heroId, at);
    if (!planted.success) return planted;
    if (planted.unchanged) return { success: true, point: at, workedTile: BoardState.workTileOf(heroId) };

    EventBus.publish('heroes_updated', { source: 'board_placement' });
    EventBus.publish('state_changed');

    return { success: true, point: at, workedTile: BoardState.workTileOf(heroId) };
}

/**
 * Take a hero's flag down and bring them to the Dock, by id.
 */
export function recallHeroById(heroId) {
    if (!heroId) return refuse('No hero');
    const point = BoardState.displayPointOf(heroId);
    if (!Flags.furl(heroId, 'recall')) return { success: true, heroId };

    if (point) {
        EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
            kind: 'hero',
            refId: heroId,
            heroId,
            quantity: 1,
            x: point.x,
            y: point.y,
            destination: 'dock'
        });
    }

    EventBus.publish('heroes_updated', { source: 'board_recall' });
    EventBus.publish('state_changed');

    return { success: true, heroId };
}

// ---------------------------------------------------------------------------
// ⚠️ STOPGAP — the index-taking adapters. Deleted in slice 1.6d-2.
// ---------------------------------------------------------------------------
//
// Each one turns an old tile index into a mat point and calls the point
// function above it. No rule lives down here; these exist only so the readers
// and tests still written in tile indices keep working until 1.6d-2 moves them.

/** STOPGAP (deleted in 1.6d-2): place a Token by old tile index. */
export function placeToken(index, instance) {
    if (!instance?.typeId) return refuse('Not a valid Token');
    const size = getTokenType(instance.typeId)?.size || 1;
    if (!isPlaceable(index)) return refuse('Token does not fit on the board');
    if (!isFootprintInBounds(index, size)) return refuse('Token does not fit on the board');
    return placeTokenAt(instance, footprintCentre(index, size));
}

/** STOPGAP (deleted in 1.6d-2): move the Token covering one tile to another. */
export function moveToken(from, to) {
    if (from === to) return refuse('Already there');
    const occ = BoardState.getOccupyingToken(from);
    if (!occ) return refuse('No Token there');
    const size = getTokenType(occ.instance.typeId)?.size || 1;
    if (!isPlaceable(to) || !isFootprintInBounds(to, size)) {
        return refuse('Token does not fit on the board');
    }
    return moveTokenTo(occ.instance.id, footprintCentre(to, size));
}

/** STOPGAP (deleted in 1.6d-2): return the Token covering a tile to the Tray. */
export function returnTokenToTray(index, position = null) {
    const occ = BoardState.getOccupyingToken(index);
    if (!occ) return refuse('No Token there');
    return returnTokenToTrayById(occ.instance.id, position);
}

/** STOPGAP (deleted in 1.6d-2): deposit the Token covering a tile into the Vault. */
export function returnTokenToVault(index) {
    const occ = BoardState.getOccupyingToken(index);
    if (!occ) return refuse('No Token there');
    return returnTokenToVaultById(occ.instance.id);
}

/** STOPGAP (deleted in 1.6d-2): plant a hero's flag on a tile. */
export function placeHero(heroId, index) {
    if (!heroId) return refuse('No hero');
    if (!isPlaceable(index)) return refuse('Not a tile');
    return plantFlagAt(heroId, positionOf(index));
}

/** STOPGAP (deleted in 1.6d-2): move a planted flag to a tile. */
export function moveFlag(heroId, index) {
    if (!heroId) return refuse('No hero');
    if (!BoardState.flagOf(heroId)) return refuse('That hero has no flag planted');
    return placeHero(heroId, index);
}

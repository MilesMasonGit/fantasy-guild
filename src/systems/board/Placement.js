// placement on the free playmat

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as Flags from './Flags.js';
import { clampToMat, matW, matH } from '../../config/matGeometry.js';
import { getTokenType, tokenName, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as MatPlacement from './MatPlacement.js';
import * as MatCap from './MatCap.js';
import * as StationRecipe from './StationRecipe.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Putting things on the playmat: where the rules live, on top of `BoardState`'s storage and
 * `MatPlacement`'s geometry.
 *
 * A Token lands where it was let go; nothing snaps. {@link placeTokenAt} takes a mat point, asks
 * `MatPlacement.dropAt` what should happen there, and carries the answer out:
 * - placed: exactly on the point.
 * - nudged: the nearest legal point within nudge reach, because the point itself was crowded or
 * would have broken a `Cannot` rule.
 * - restocked: the point was on a matching copy with room for charges; any leftover charges stand
 * beside it.
 * - full: nowhere within reach, so the caller puts it back where it came from and says so. Nothing
 * is ever lost.
 *
 * ⚠️ Nothing displaces anything: a drop that does not fit moves itself rather than shoving whatever
 * was already there, so the player's existing arrangement is never rearranged behind their back.
 *
 * Nothing on the mat is addressed by anything but a mat point or an instance id.
 */

/** Wipe in-flight cycle progress: the forfeit of an interrupted cycle, in one place. */
function forfeitCycle(instance) {
    if (instance) instance.cycleElapsedMs = 0;
}

/**
 * Tell the board that something changed at these mat points, so every Token whose neighbourhood
 * they touch rebuilds its modifiers.
 *
 * Both ends of a move are named, where the Token left and where it landed, because the Tokens that
 * gained or lost it are within Near of one or the other. Naming only the destination is how a buff
 * goes stale.
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

/** Standard refusal shape, so callers can show the reason. */
const refuse = (reason, extra = {}) => ({ success: false, reason, ...extra });

/** A Token's own point, or null if it is not on the mat. */
const pointOf = (instance) =>
    (instance && Number.isFinite(instance.x) && Number.isFinite(instance.y))
        ? { x: instance.x, y: instance.y }
        : null;

/** Whether a Mythic of this type is already on the mat, ignoring `exceptId`. */
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

function isGuildHall(t) {
    return t.typeId === 'token_guild_hall' || !!getTokenType(t.typeId)?.isGuildHall;
}

/**
 * Where a bought or withdrawn Token is aimed: the Guild Hall's point, the one Token guaranteed to
 * be on the mat. With no Hall (a hand-built test board) it is the mat's centre, read live since the
 * mat can be resized.
 */
export function centreOfBoard() {
    const hall = BoardState.tokens().find(isGuildHall);
    if (hall && Number.isFinite(hall.x) && Number.isFinite(hall.y)) return { x: hall.x, y: hall.y };
    return { x: matW() / 2, y: matH() / 2 };
}

/** Flash the refused-drop mark at a point, and refuse. */
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

/**
 * Put a Token on the mat at a point. The one route every drop takes.
 *
 * @param {object} instance the Token being placed (not yet on the mat, or being moved)
 * @param {{x: number, y: number}} point where the player let go, in mat units
 * @param {{excludeId?: string, keepCycle?: boolean, noRestock?: boolean}} [options] `noRestock`
 * skips restock-on-copy: a Token a recipe makes always stands as a Token of its own, never tops up
 * a copy.
 * @returns {{success: boolean, reason?: string, x?: number, y?: number, nudged?: boolean,
 * restocked?: boolean, full?: boolean}}
 */
export function placeTokenAt(instance, point, options = {}) {
    if (!instance?.typeId) return refuse('Not a valid Token');
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return refuse('Nowhere to drop that');
    }

    const def = getTokenType(instance.typeId);

    // Placement still goes ahead (warn-only), but a Token with no definition has no size, no rules
    // and no artwork, so it sits there doing nothing: what a Token whose id was renamed in the CMS
    // looks like.
    if (!def) {
        warnMissingContent('Placement', 'Token', instance.typeId,
            'the Token being placed has no rules, no artwork and will never do anything');
    }

    // A station arrives with no recipe: the player picks one. A Token that already carries a valid
    // selection keeps it; a stale one is dropped.
    StationRecipe.validateSelection(instance, def);

    const excludeId = options.excludeId || instance.id || null;
    const at = clampToMat(point);

    if (mythicAlreadyPlaced(instance.typeId, excludeId)) {
        return refuse(`Only one ${tokenName(instance.typeId)} can be on the board at a time`);
    }

    const decision = MatPlacement.dropAt(instance, at, {
        excludeId,
        plan: { id: instance.id },
        noRestock: !!options.noRestock
    });

    if (decision.status === 'full') return refuseWithAlert(at, instance.typeId, decision);
    if (decision.status === 'restocked') return restock(instance, decision);

    const from = pointOf(BoardState.getTokenById(instance.id));
    if (!options.keepCycle) forfeitCycle(instance);

    BoardState.addToken(instance, decision.x, decision.y);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { instanceId: instance.id, typeId: instance.typeId });
    markAdjacencyDirty([from, { x: decision.x, y: decision.y }]);
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    return {
        success: true,
        x: decision.x,
        y: decision.y,
        nudged: decision.status === 'nudged',
        displacedToken: null
    };
}

/** Why an arrival with nowhere at all to go is refused. */
export const MAT_FULL = 'The mat is full';

/**
 * Put a new Token on the mat as near to `aim` as it will go, for arrivals that are nobody's drop: a
 * Shop purchase (aimed at the Hall) and a Token a recipe makes (aimed at its station).
 *
 * A player's drop that finds no room within nudge reach flies back to their hand. These have no
 * hand to fly back to, so instead of refusing they land on the nearest legal free spot anywhere on
 * the mat (`MatPlacement.findSpotAnywhere`): the nudge-reach search first, then the whole mat.
 * Nothing is pushed, and no spot breaking a `Cannot` rule is ever chosen. Refused only when the
 * whole mat has no legal spot ({@link MAT_FULL}). It never restocks a copy.
 *
 * @returns {{success: boolean, reason?: string, x?: number, y?: number, nudged?: boolean, full?: boolean}}
 */
export function placeArrivalNear(instance, aim) {
    if (!instance?.typeId) return refuse('Not a valid Token');
    if (!aim || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return refuse('Nowhere to put that');
    if (mythicAlreadyPlaced(instance.typeId, instance.id)) {
        return refuse(`Only one ${tokenName(instance.typeId)} can be on the board at a time`);
    }
    const at = clampToMat(aim);
    const spot = MatPlacement.findSpotAnywhere(instance.typeId, at, {
        excludeId: instance.id,
        plan: { id: instance.id }
    });
    if (!spot) return refuse(MAT_FULL, { full: true });
    const res = placeTokenAt(instance, { x: spot.x, y: spot.y }, { noRestock: true });
    return res?.success ? { ...res, nudged: spot.nudge > 0 } : res;
}

/**
 * Carry out a restock-on-copy: the charges move, and whatever is left over stands beside the copy
 * it just filled.
 *
 * When even that has nowhere to go, the leftover is refused and flies back to wherever it came
 * from: the charges it gave stay given, and nothing is lost.
 */
function restock(instance, decision) {
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
    EventBus.publish(ENGINE_EVENTS.TOKEN_RESTOCKED, {
        instanceId: target.id,
        typeId: instance.typeId,
        addedCharges: decision.transferred,
        currentCharges: target.usesRemaining
    });
    EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'quest_claim' });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    if (decision.absorbed) {
        return { success: true, restocked: true, absorbed: true, addedCharges: decision.transferred };
    }

    // The leftover stays on the mat, nudged beside the copy.
    if (decision.x != null) {
        const from = pointOf(BoardState.getTokenById(instance.id));
        forfeitCycle(instance);
        BoardState.addToken(instance, decision.x, decision.y);
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
        EventBus.publish(BOARD_EVENTS.TOKEN_PLACED, { instanceId: instance.id, typeId: instance.typeId });
        markAdjacencyDirty([from, { x: decision.x, y: decision.y }]);
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
        return {
            success: true, restocked: true, nudgedLeftover: true,
            x: decision.x, y: decision.y, addedCharges: decision.transferred
        };
    }

    // Nowhere beside it either: the leftover flies back to its source.
    return refuse('Restocked, but there is no room beside it — the leftover went back', {
        full: true, restocked: true, addedCharges: decision.transferred
    });
}

/**
 * Move the Token with id `id` to a mat point.
 *
 * A moved Token keeps its progress and carries its hero. The hero's claim is keyed by the Token
 * instance, so it follows on its own, even outside their flag's radius; this only has to stop the
 * forfeit and say that the hero moved.
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

/**
 * Whether `count` copies of `typeId`, made by the Token `stationId`, can land on the mat beside it
 * right now. Pure: asked BEFORE the cycle pays, so a full mat holds the cycle rather than spending
 * its inputs on a Token with nowhere to go.
 *
 * Three things must hold: the mat's Token cap has room for every copy; a Mythic of that
 * type is not already on the mat; and there is a legal spot somewhere on the mat, nearest the
 * station first, by the same search {@link placeArrivalNear} makes.
 *
 * ⚠️ The spot is checked for the first copy only. Every shipped recipe that makes a Token makes
 * exactly one; a recipe making several could, on a very crowded mat, find room for the first and
 * not a later one.
 */
export function hasRoomForProduct(stationId, typeId, count = 1) {
    if (!typeId || count <= 0) return true;
    const station = BoardState.getTokenById(stationId);
    const from = pointOf(station);
    if (!from) return false;
    if (!MatCap.canPlaceMore(count)) return false;
    if (mythicAlreadyPlaced(typeId)) return false;
    return !!MatPlacement.findSpotAnywhere(typeId, from);
}

/**
 * Put one Token a recipe made on the mat beside the station that made it: a fresh `placed` instance
 * at its starting charges, through {@link placeArrivalNear} aimed at the station's own point, so it
 * lands on the nearest legal spot around it or, when that area is crowded, the nearest one anywhere
 * on the mat. It never restocks a copy.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function placeProduct(stationId, typeId) {
    const station = BoardState.getTokenById(stationId);
    const from = pointOf(station);
    if (!from) return refuse('The station has left the mat');
    const instance = BoardState.createTokenInstance(
        typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED
    );
    instance.bornAt = Date.now();
    const res = placeArrivalNear(instance, from);
    return res?.success ? { ...res, instance } : res;
}

/**
 * Remove a placed Token for good: no refund and no `TOKEN_DEPLETED`, so when-depleted rules do not
 * fire. Spawned Tokens it left behind stay where they are. A hero working it lets go: its claim
 * names an instance that no longer exists, so `Flags` releases it on its next assignment. Only
 * placed Tokens; the Guild Hall never leaves the mat.
 *
 * ⚠️ The game does not call this: the discard bin (`DiscardBin.binToken`) is the player's route.
 * Tests exercise it.
 *
 * @returns {{success: boolean, reason?: string, idledHeroId?: string|null}}
 */
export function removePlacedToken(id) {
    const instance = BoardState.getTokenById(id);
    if (!instance) return refuse('No Token there');
    if (isPermanentToken(instance.typeId, instance)) return refuse('Guild Hall cannot be removed from the playmat.');
    if (BoardState.originOf(instance) !== BoardState.ORIGIN.PLACED) {
        return refuse('Spawned Tokens are worked out, not removed.');
    }

    const at = pointOf(instance);
    const heroId = BoardState.workerOf(id);

    forfeitCycle(instance);
    StationRecipe.clearSelection(instance);
    BoardState.removeToken(id);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: id, ...(at || {}), typeId: null });
    if (heroId && at) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...at });
    markAdjacencyDirty([at]);
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    return { success: true, idledHeroId: heroId };
}

/**
 * Plant `heroId`'s flag exactly at a mat point: the point the player let go of it, clamped onto the
 * mat. The only route a flag moves by.
 *
 * The flag chooses at once by the hero's rules, so dropping on a Token the hero can work works it
 * unless a better-priority Token is runnable in range; otherwise the hero works something else in
 * range, or idles at the flag.
 *
 * ⚠️ Nobody is displaced. Two heroes can plant on one spot; only one works the Token. Flags never
 * nudge each other or Tokens, and have no footprint at all: nothing in placement ever reads a flag.
 *
 * `{ pin: true }` is the player's drop (`dropOnMat`): a drop on a Token the hero can work pins the
 * flag to it (see `Flags.plant`), and the result names it (`pinnedTo`) or why it was refused
 * (`pinRefused`). Off by default, so callers that plant on a Token to set a scene keep the
 * area-flag behaviour.
 */
export function plantFlagAt(heroId, point, { pin = false } = {}) {
    if (!heroId) return refuse('No hero');
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return refuse('Nowhere to plant a flag');
    const at = clampToMat(point);

    // `Flags.plant` announces `hero_deployed` itself, for every route.
    const planted = Flags.plant(heroId, at, { pin });
    if (!planted.success) return planted;
    const pinInfo = { pinnedTo: planted.pinnedTo ?? null, pinRefused: planted.pinRefused ?? null };
    if (planted.unchanged) return { success: true, point: at, workedToken: BoardState.workTokenOf(heroId), ...pinInfo };

    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'board_placement' });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    return { success: true, point: at, workedToken: BoardState.workTokenOf(heroId), ...pinInfo };
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

    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'board_recall' });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    return { success: true, heroId };
}

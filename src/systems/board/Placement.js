// Fantasy Guild — Placement on the free playmat (Free Playmat slice 1.6d)

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
 * ## ⭐ Every route takes a mat point (slice 1.6d-2)
 * The six index-taking adapters that stood at the bottom of this file —
 * `placeToken`, `moveToken`, `returnTokenToTray`, `returnTokenToVault`
 * (its by-id successor went with the Vault, Token Lifecycle 9.3),
 * `placeHero` and `moveFlag` — were deleted with the grid. Nothing on the mat is
 * addressed by anything but a point or an instance id.
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

function isGuildHall(t) {
    return t.typeId === 'token_guild_hall' || !!getTokenType(t.typeId)?.isGuildHall;
}

/**
 * Where a bought or withdrawn Token is aimed: the **Guild Hall's point**, the
 * one Token guaranteed to be on the mat. With no Hall (a hand-built test board)
 * it is the mat's centre, read live since the mat can be resized.
 *
 * Moved here from `Cartographer.js` when the Map bursts retired (Token
 * Lifecycle 9.1); the Shop lands what it sells beside the Hall.
 */
export function centreOfBoard() {
    const hall = BoardState.tokens().find(isGuildHall);
    if (hall && Number.isFinite(hall.x) && Number.isFinite(hall.y)) return { x: hall.x, y: hall.y };
    return { x: matW() / 2, y: matH() / 2 };
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
 * @param {{excludeId?: string, keepCycle?: boolean, noRestock?: boolean}} [options]
 *        `noRestock` skips restock-on-copy (FP-50): a Token a recipe makes
 *        always stands as a Token of its own (TL-8), never tops up a copy.
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
 * When even that has nowhere to go, the leftover is refused and flies back to
 * wherever it came from (FP-46) — the charges it gave stay given, and nothing
 * is lost. It used to fall back to the Tray, which slice 1.9 retired.
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

    // Nowhere beside it either: the leftover flies back to its source (FP-46).
    return refuse('Restocked, but there is no room beside it — the leftover went back', {
        full: true, restocked: true, addedCharges: decision.transferred
    });
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

// ---------------------------------------------------------------------------
// A Token a recipe makes (Token Lifecycle 9.3, TL-8)
// ---------------------------------------------------------------------------

/**
 * Whether `count` copies of `typeId`, made by the Token `stationId`, can land
 * on the mat beside it right now. Pure: asked BEFORE the cycle pays, so a full
 * mat holds the cycle rather than spending its inputs on a Token with nowhere
 * to go (TL-8, "if the mat is full the cycle waits").
 *
 * Three things must hold: the mat cap has room for every copy (they are
 * `placed`, SP-67); a Mythic of that type is not already on the mat (D-177);
 * and there is a legal spot within nudge reach of the station, the same
 * search a drop there would make.
 *
 * ⚠️ The spot is checked for the first copy only. Every shipped recipe that
 * makes a Token makes exactly one; a recipe making several could, on a very
 * crowded mat, find room for the first and not a later one.
 */
export function hasRoomForProduct(stationId, typeId, count = 1) {
    if (!typeId || count <= 0) return true;
    const station = BoardState.getTokenById(stationId);
    const from = pointOf(station);
    if (!from) return false;
    if (!MatCap.canPlaceMore(count)) return false;
    if (mythicAlreadyPlaced(typeId)) return false;
    return !!MatPlacement.findSpot(typeId, from);
}

/**
 * ⭐ Put one Token a recipe made on the mat beside the station that made it
 * (TL-8): a fresh `placed` instance at its starting charges, through
 * {@link placeTokenAt} aimed at the station's own point, so it lands on the
 * nearest legal spot around it, as a Shop purchase lands beside the Hall.
 * It never restocks a copy. No Token loot sprite is made any more.
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
    const res = placeTokenAt(instance, from, { noRestock: true });
    return res?.success ? { ...res, instance } : res;
}

/**
 * ⭐ **Remove** a placed Token for good (Token Lifecycle slice 5.2).
 *
 * * **TL-1, no refunds.** Nothing is credited — the Token is simply gone.
 *   That is why this is not `Charges.destroyToken`: that path is *depletion*,
 *   which publishes `TOKEN_DEPLETED` (so "when depleted" rules would fire and could
 *   pay out or spawn).
 * * **SP-6.** Spawned Tokens it leaves behind stay where they are; only this
 *   instance leaves the mat.
 * * **SP-52.** A hero working it lets go: its claim names an instance that no
 *   longer exists, so `Flags` releases it and finds other work on its next
 *   assignment (`TILE_CHANGED` marks the flags dirty).
 * * Only **placed** Tokens (DP-3). A spawned Token is worked out, not removed,
 *   and the Guild Hall never leaves the mat.
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
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
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
    if (planted.unchanged) return { success: true, point: at, workedToken: BoardState.workTokenOf(heroId) };

    EventBus.publish('heroes_updated', { source: 'board_placement' });
    EventBus.publish('state_changed');

    return { success: true, point: at, workedToken: BoardState.workTokenOf(heroId) };
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

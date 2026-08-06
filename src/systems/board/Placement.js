// Fantasy Guild — Placement and displacement (7×7 Playmat rework, Phase 2)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { neighboursOf } from './adjacency.js';
import { isPlaceable, isTileIndex, GUILD_HALL_TILE } from '../../ui/components/board/boardConstants.js';
import * as BoardState from './BoardState.js';

/**
 * Placement — every rule about what may go where, and what gets shoved out.
 *
 * All of it lives in one module deliberately. The rules interlock (a Token
 * landing on a staffed tile has to deal with the Token *and* the hero *and*
 * both of their in-flight cycles), and splitting them across the call sites
 * that trigger them is how the "incoming wins" behaviour ends up meaning three
 * different things in three places.
 *
 * ## The one rule underneath all of it
 * **The incoming thing wins; the displaced thing goes somewhere safe** (D-134).
 * Displaced Tokens go to the Tray. Displaced heroes go to the Dock. Nothing is
 * ever destroyed by being displaced, and nothing needs clearing first — which
 * matters on a 48-tile board with no spare space to shuffle through.
 *
 * ## Interruption always forfeits the cycle (D-54, D-131)
 * One rule for Tokens and heroes alike: anything part-way through a cycle loses
 * that cycle when it is disturbed. It applies the same gentle friction to
 * shuffling the workforce that it applies to shuffling Tokens — which matters,
 * because reassigning a scarce workforce is the thing the player does most.
 *
 * ## Displacement is physical, not a silent state change
 * A displaced hero goes to the **Dock**, never auto-assigned to whatever
 * arrived. The player is never left with someone quietly working a Token they
 * did not choose for them (grid concept §3.6).
 */

/** Wipe in-flight cycle progress. The forfeit in D-54 / D-131, in one place. */
function forfeitCycle(instance) {
    if (instance) instance.cycleElapsedMs = 0;
}

/**
 * Tell a tile and its 8 neighbours that the neighbourhood changed.
 *
 * Placing or removing a Token can change what its neighbours *produce* — a
 * Forge with a schematic beside it makes helmets; without one it makes nothing
 * (D-18). So a change at one tile dirties nine.
 *
 * Nothing consumes this until Phase 5 builds recipe resolution. Publishing it
 * now means placement never has to be revisited to add it.
 */
function markAdjacencyDirty(index) {
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: index });
    for (const n of neighboursOf(index)) {
        EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { tile: n });
    }
}

/** Standard refusal shape, so callers can show the reason (UI §3). */
const refuse = (reason) => ({ success: false, reason });

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Place a Token instance on a tile.
 *
 * **Dropping onto an occupied tile shoves the old Token out to the Tray**, and
 * **knocks any hero working it back to the Dock** (D-134, D-143). The hero is
 * not inherited by the arriving Token: the player chose where that person
 * should work, and silently reassigning them would take that choice away.
 *
 * @returns {{success: boolean, reason?: string, displacedToken?: object, displacedHeroId?: string}}
 */
export function placeToken(index, instance) {
    if (!instance?.typeId) return refuse('Nothing to place');
    if (!isTileIndex(index)) return refuse('Not a tile');
    if (index === GUILD_HALL_TILE) {
        // The centre is a permanent Guild Hall — not placeable, not removable
        // (D-106). Refused as a real rule, not just hidden in the UI.
        return refuse('The Guild Hall cannot be built on');
    }

    const existing = BoardState.getToken(index);
    let displacedToken = null;
    let displacedHeroId = null;

    if (existing) {
        displacedHeroId = existing.heroId || null;
        existing.heroId = null;
        forfeitCycle(existing);

        // Shoved out, not destroyed. If the Tray is full the placement is
        // refused rather than losing the Token — nothing on this board is ever
        // lost to a full container (the spirit of D-138).
        if (!BoardState.addToTray(existing)) {
            existing.heroId = displacedHeroId;   // put it back exactly as it was
            return refuse('No room in the Tray for the displaced Token');
        }
        displacedToken = existing;
    }

    forfeitCycle(instance);
    instance.heroId = null;
    BoardState.setToken(index, instance);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: instance.typeId });
    if (displacedHeroId) {
        EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: displacedHeroId });
    }
    markAdjacencyDirty(index);
    EventBus.publish('state_changed');

    return { success: true, displacedToken, displacedHeroId };
}

/**
 * Move a Token from one tile to another.
 *
 * Free and unrestricted (D-54) — only the in-flight cycle is lost, on both the
 * moving Token and anything it displaces. The hero does **not** travel with it:
 * heroes are placed on tiles, and a player moving a Token has not said anything
 * about where its worker should be.
 */
export function moveToken(from, to) {
    if (from === to) return refuse('Already there');
    const moving = BoardState.getToken(from);
    if (!moving) return refuse('No Token there');
    if (from === GUILD_HALL_TILE) return refuse('The Guild Hall cannot be moved');

    const heroLeftBehind = moving.heroId || null;
    moving.heroId = null;
    BoardState.setToken(from, null);

    const result = placeToken(to, moving);
    if (!result.success) {
        // Roll back completely rather than leaving the Token in limbo.
        moving.heroId = heroLeftBehind;
        BoardState.setToken(from, moving);
        return result;
    }

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: from, typeId: null });
    if (heroLeftBehind) {
        EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: heroLeftBehind });
    }
    markAdjacencyDirty(from);
    return { ...result, heroLeftBehind };
}

/** Lift a Token off the board and back into the Tray. Any hero returns to the Dock. */
export function returnTokenToTray(index) {
    const instance = BoardState.getToken(index);
    if (!instance) return refuse('No Token there');
    if (index === GUILD_HALL_TILE) return refuse('The Guild Hall cannot be removed');

    const heroId = instance.heroId || null;
    instance.heroId = null;
    forfeitCycle(instance);

    if (!BoardState.addToTray(instance)) {
        instance.heroId = heroId;
        return refuse('No room in the Tray');
    }

    BoardState.setToken(index, null);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: null });
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId });
    markAdjacencyDirty(index);
    EventBus.publish('state_changed');

    return { success: true, displacedHeroId: heroId };
}

// ---------------------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------------------

/**
 * Place a hero on a tile.
 *
 * * **One hero per Token, always** (D-111). Dropping onto a tile another hero
 *   works **knocks the occupant to the Dock** (D-147), where they sit idle until
 *   re-placed.
 * * **Heroes move tile-to-tile directly**, without a trip through the Dock
 *   (D-134). Reassigning the workforce is the game's most frequent action and
 *   must cost one drag, not two — so this handles "already placed elsewhere" by
 *   clearing the old tile itself rather than making the caller do it.
 * * A hero may stand on an **empty tile**; they simply do nothing (D-57). It is
 *   pointless rather than illegal, and refusing it would be a rule the player
 *   has to learn for no benefit.
 * * Leaving a tile forfeits that tile's cycle (D-131).
 */
export function placeHero(heroId, index) {
    if (!heroId) return refuse('No hero');
    if (!isPlaceable(index)) {
        return index === GUILD_HALL_TILE
            ? refuse('Nobody works the Guild Hall')
            : refuse('Not a tile');
    }

    const previous = BoardState.tileOfHero(heroId);
    if (previous === index) return { success: true, displacedHeroId: null };

    // Vacate wherever they were, forfeiting that cycle.
    if (previous != null) {
        const old = BoardState.getToken(previous);
        if (old) {
            old.heroId = null;
            forfeitCycle(old);
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: previous, typeId: old.typeId });
        }
    }

    const target = BoardState.getToken(index);
    let displacedHeroId = null;

    if (target) {
        displacedHeroId = target.heroId || null;
        if (displacedHeroId) forfeitCycle(target);
        target.heroId = heroId;
        forfeitCycle(target);
    }
    // An empty tile records nothing: with no Token there is nothing to work, and
    // inventing a "hero standing on grass" entry would be state with no owner.

    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: target ? index : null, heroId });
    if (displacedHeroId) {
        EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: displacedHeroId });
    }
    EventBus.publish('heroes_updated', { source: 'board_placement' });
    EventBus.publish('state_changed');

    return { success: true, displacedHeroId, workedTile: target ? index : null };
}

/** Take the hero off a tile and back to the Dock. Forfeits the cycle (D-131). */
export function recallHero(index) {
    const instance = BoardState.getToken(index);
    const heroId = instance?.heroId || null;
    if (!heroId) return refuse('Nobody is working that tile');

    instance.heroId = null;
    forfeitCycle(instance);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: instance.typeId });
    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId });
    EventBus.publish('heroes_updated', { source: 'board_recall' });
    EventBus.publish('state_changed');

    return { success: true, heroId };
}

/**
 * Take a hero off the board wherever they are, by id.
 *
 * The safety net for anything that removes a hero from the game — retirement,
 * defeat — where the caller knows the person but not the tile. Leaving a stale
 * `heroId` on a tile would point at a hero object that no longer exists.
 */
export function recallHeroById(heroId) {
    const index = BoardState.tileOfHero(heroId);
    if (index == null) return { success: true, heroId };   // already in the Dock
    return recallHero(index);
}

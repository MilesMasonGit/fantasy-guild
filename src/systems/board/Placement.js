// Fantasy Guild — Placement and displacement (7×7 Playmat rework, Phase 2)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { neighboursOf } from './adjacency.js';
import { isPlaceable, isTileIndex, GUILD_HALL_TILE, TILE_PX, colOf, rowOf } from '../../ui/components/board/boardConstants.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import * as TokenBank from './TokenBank.js';
import * as SpriteLayer from './SpriteLayer.js';

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
 *
 * ## Heroes and Tokens are independent occupants of a tile (Phase 7)
 * A hero's position lives in `board.heroTiles`, not on the Token. A tile can
 * therefore hold a Token, a hero, both or neither, and **the four cases are
 * genuinely distinct**: a hero on an empty tile is D-57's "standing there doing
 * nothing", and is what lets D-60's idling hero and D-151's restock-underneath
 * both work. Rules here move one occupant without touching the other unless a
 * decision says otherwise.
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

/**
 * The tile already holding a Mythic of this type, or null (D-177).
 *
 * **Mythics are unique on the board, not unique to own.** A player may
 * accumulate several copies and they are spares rather than waste; the rule is
 * only that one may be *placed* at a time. `exceptTile` is the tile being
 * placed onto, so moving a Mythic one square never trips over itself.
 */
function mythicAlreadyPlaced(typeId, exceptTile) {
    if (getTokenType(typeId)?.rarity !== 'mythic') return null;
    for (const [index, instance] of BoardState.occupiedTiles()) {
        if (index !== exceptTile && instance.typeId === typeId) return index;
    }
    return null;
}

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
 * ⚠️ Maps sit freely overtop of the playmat rather than occupying a grid cell.
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

    // Maps freely sit overtop of the playmat instead of occupying a grid cell.
    const isMap = !!getTokenType(instance.typeId)?.mapId;
    if (isMap) {
        const x = colOf(index) * TILE_PX;
        const y = rowOf(index) * TILE_PX;
        BoardState.addBoardMap(instance.typeId, x, y, instance.usesRemaining);
        EventBus.publish('state_changed');
        return { success: true, displacedToken: null, displacedHeroId: null };
    }

    // **One Mythic on the board at a time** (D-177). Duplicates are spares, not
    // waste — a player may own several — but only one may be placed. Enforced
    // here rather than in the UI because it is a rule, so every placement path
    // (Tray, sprite, tile-to-tile, Manager restock) obeys it for free.
    if (mythicAlreadyPlaced(instance.typeId, index) != null) {
        return refuse(`Only one ${tokenName(instance.typeId)} can be on the board at a time`);
    }

    const existing = BoardState.getToken(index);
    let displacedToken = null;
    const displacedHeroId = BoardState.heroOnTile(index);

    if (existing) {
        forfeitCycle(existing);

        // Shoved out, not destroyed. If the Tray is full the placement is
        // refused rather than losing the Token — nothing on this board is ever
        // lost to a full container (the spirit of D-138).
        if (!BoardState.addToTray(existing)) {
            return refuse('No room in the Tray for the displaced Token');
        }
        displacedToken = existing;
    }

    // The arriving Token does not inherit the hero: the player chose where that
    // person should work, and silently reassigning them would take that choice
    // away (D-143). Only an *occupied* tile displaces — a hero standing on bare
    // ground has nothing to be knocked off, so a Token simply arrives under them
    // and they start working it, which is the same courtesy D-151 extends.
    if (displacedHeroId && existing) BoardState.setHeroTile(displacedHeroId, null);

    forfeitCycle(instance);
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
 * moving Token and anything it displaces.
 *
 * **The hero does not travel with it, and does not leave either.** They stay
 * standing on the tile they were put on, now bare, idling (D-57, D-60). Moving
 * a Token is a statement about the Token; the player has said nothing about
 * where its worker should be, and scattering the workforce back to the Dock
 * every time a tile is rearranged would make reorganising the board expensive
 * in exactly the way D-54 says it must not be.
 */
export function moveToken(from, to) {
    if (from === to) return refuse('Already there');
    const moving = BoardState.getToken(from);
    if (!moving) return refuse('No Token there');
    if (from === GUILD_HALL_TILE) return refuse('The Guild Hall cannot be moved');

    BoardState.setToken(from, null);

    const result = placeToken(to, moving);
    if (!result.success) {
        // Roll back completely rather than leaving the Token in limbo.
        BoardState.setToken(from, moving);
        return result;
    }

    const heroLeftBehind = BoardState.heroOnTile(from);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: from, typeId: null });
    if (heroLeftBehind) {
        // They are still on `from` — this only tells the UI that what they are
        // standing on changed.
        EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: from, heroId: heroLeftBehind });
    }
    markAdjacencyDirty(from);
    return { ...result, heroLeftBehind };
}

/**
 * Lift a Token off the board and back into the Tray.
 *
 * Any hero **stays where they stand**, idling on the bare tile (D-60), for the
 * same reason as `moveToken`. `recallHero` is how a hero goes to the Dock.
 *
 * `position` is `{ x, y }` in Tray fractions, passed when the player **dropped**
 * the Token somewhere specific: a drop lands where it was dropped (D-227).
 * Omitted, the Token is scattered into open space like any other arrival — which
 * is the right behaviour for a lift that did not come from a deliberate drag.
 */
export function returnTokenToTray(index, position = null) {
    const instance = BoardState.getToken(index);
    if (!instance) return refuse('No Token there');
    if (index === GUILD_HALL_TILE) return refuse('The Guild Hall cannot be removed');

    forfeitCycle(instance);
    if (!BoardState.addToTray(instance, undefined, position)) {
        return refuse('No room in the Tray');
    }

    BoardState.setToken(index, null);
    const heroId = BoardState.heroOnTile(index);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: null });
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: index, heroId });
    markAdjacencyDirty(index);
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
}

/**
 * Lift a Token off the board and deposit it straight into the Vault.
 */
export function returnTokenToVault(index) {
    const instance = BoardState.getToken(index);
    if (!instance) return refuse('No Token there');
    if (index === GUILD_HALL_TILE) return refuse('The Guild Hall cannot be removed');

    if (getTokenType(instance.typeId)?.mapId) {
        return refuse('Maps cannot be stored — open it.');
    }

    forfeitCycle(instance);
    if (!TokenBank.deposit(instance)) {
        return refuse('No room in the Vault');
    }

    BoardState.setToken(index, null);
    const heroId = BoardState.heroOnTile(index);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: null });
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: index, heroId });
    markAdjacencyDirty(index);
    EventBus.publish('state_changed');

    return { success: true, idledHeroId: heroId };
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
            forfeitCycle(old);
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: previous, typeId: old.typeId });
        }
    }

    // Whoever was standing here is knocked to the Dock (D-147) — one hero per
    // tile, and the incoming one wins. This applies on a bare tile too: two
    // people cannot occupy one square just because there is nothing to work.
    const displacedHeroId = BoardState.heroOnTile(index);
    if (displacedHeroId) BoardState.setHeroTile(displacedHeroId, null);

    const target = BoardState.getToken(index);
    if (target) forfeitCycle(target);
    BoardState.setHeroTile(heroId, index);

    EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: index, heroId });
    if (displacedHeroId) {
        EventBus.publish(BOARD_EVENTS.HERO_MOVED, { tile: null, heroId: displacedHeroId });
    }
    EventBus.publish('heroes_updated', { source: 'board_placement' });
    EventBus.publish('state_changed');

    return { success: true, displacedHeroId, workedTile: target ? index : null };
}

/** Take the hero off a tile and back to the Dock. Forfeits the cycle (D-131). */
export function recallHero(index) {
    const heroId = BoardState.heroOnTile(index);
    if (!heroId) return refuse('Nobody is standing on that tile');

    BoardState.setHeroTile(heroId, null);
    const instance = BoardState.getToken(index);
    if (instance) {
        forfeitCycle(instance);
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: index, typeId: instance.typeId });
    }

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

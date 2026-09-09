// Fantasy Guild — the verbs that act on somebody (Effects Grammar v2, V8)

import { ROLE } from '../../config/registries/roleRegistry.js';
import { resolveMagnitude, usesCountedSelector } from '../../config/registries/magnitudeRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import * as BoardState from './BoardState.js';
import * as TileModifiers from './TileModifiers.js';
import * as Charges from './Charges.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { TILE_COUNT, BOARD_SIZE } from '../../config/boardGeometry.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { resolvePlacement, placementOf } from '../../config/registries/placementRegistry.js';

/**
 * `Heals`, `Restores` and `Removes` — the rest of the action set (G-11).
 *
 * ## Why these three and not more
 * Each ships **with a reader that already exists**, which is the rule
 * `modifierPalette.js` states in its own header and the rule the deleted
 * 56-entry library needed:
 *
 * | Verb       | Reader                                                    |
 * | ---------- | --------------------------------------------------------- |
 * | `Heals`    | `HeroManager.modifyHeroHp`, the same one damage uses       |
 * | `Restores` | `Charges.applyDelta` — and `CHARGE_EXTEND` finally lands   |
 * | `Removes`  | `LiveEffects.removeFromHero` — and `purge()`'s job at last |
 *
 * ⚠️ `Moves`/displace is deliberately **not** here (G-11). "Where to" and "what
 * if that tile is occupied" have no answers yet, and a verb with undecided
 * targeting is how one slice becomes three.
 *
 * ## ⚠️ Magnitudes resolve the same way they do for damage
 * A heal may be *"20% of the target's max HP"* exactly as a thorn may be. The
 * resolution goes through `magnitudeRegistry` rather than being re-derived here,
 * so a computed magnitude cannot come to mean two things depending on the verb.
 */

/** How many things a statement's `counted` selector matched (G-14). */
export function countMatches(statement, roles) {
    if (!usesCountedSelector(statement?.payload)) return 0;
    if (roles?.self == null) return 0;
    return TileModifiers.filterTargetTiles(roles.self, {
        to: statement.counted, reach: statement.counted?.reach
    }).length;
}

/** The number a statement means right now, computed or flat. */
export function amountOf(statement, roles) {
    return resolveMagnitude(statement?.payload, {
        actorHero: roles?.actor ? HeroManager.getHero(roles.actor) : null,
        selfInstance: roles?.self != null ? BoardState.getToken(roles.self) : null
    }, countMatches(statement, roles));
}

/**
 * The **hero** a role points at, or null.
 *
 * ⚠️ `self` may be a person rather than a tile — a live effect instance sits on
 * somebody, so "this entity" on a Poison means the person carrying it.
 */
export function heroFor(role, roles) {
    if (role === ROLE.ACTOR) return roles?.actor || null;
    if (role === ROLE.SELF && roles?.selfHeroId) return roles.selfHeroId;
    const tile = role === ROLE.SOURCE ? roles?.source : roles?.self;
    return tile != null ? BoardState.heroOnTile(tile) : null;
}

/** The **tile** a role points at, or null. Only `self` and `source` have one. */
export function tileFor(role, roles) {
    if (role === ROLE.ACTOR) {
        // The actor is a person; the tile they are standing on is the honest
        // reading of "where the actor is".
        const heroId = roles?.actor;
        return heroId ? BoardState.tileOfHero(heroId) : null;
    }
    return role === ROLE.SOURCE ? (roles?.source ?? null) : (roles?.self ?? null);
}

/**
 * `Heals` — put health back on somebody.
 *
 * ⚠️ Never overheals: `modifyHeroHp` clamps to max, so a heal that would go past
 * full simply tops them up. That is the same behaviour every other heal in the
 * game has, and inventing an overheal here would be a mechanic nobody asked for
 * arriving through a verb.
 */
export function heal(statement, roles) {
    const amount = Math.round(amountOf(statement, roles));
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const heroId = heroFor(statement?.target?.role || ROLE.ACTOR, roles);
    if (!heroId) return 0;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return 0;

    const before = hero.hp.current;
    HeroManager.modifyHeroHp(heroId, amount);
    return HeroManager.getHero(heroId).hp.current - before;
}

/**
 * `Restores` — give a Token charges back.
 *
 * ⚠️ **An unlimited Token ignores this**, exactly as it ignores every other
 * charge delta (R-4). `Charges.applyDelta` owns that rule and the ceiling at the
 * Token's starting charges, so restoring is not a way to push a Token past what
 * it was authored to hold.
 */
export function restore(statement, roles) {
    const amount = Math.round(amountOf(statement, roles));
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const tile = tileFor(statement?.target?.role || ROLE.SELF, roles);
    if (tile == null) return 0;

    const instance = BoardState.getToken(tile);
    if (!instance) return 0;

    Charges.applyDelta(tile, instance, amount);
    return amount;
}

/**
 * The board, as the placement vocabulary needs to see it.
 *
 * Built here rather than imported into the registry, so the registry stays a
 * pure declaration with no board dependency — the same split every other
 * vocabulary in this project uses.
 */
function boardView() {
    return {
        allTiles: Array.from({ length: TILE_COUNT }, (_, i) => i),
        isFree: (tile) => !BoardState.getToken(tile),
        distance: (a, b) => {
            const ax = a % BOARD_SIZE, ay = Math.floor(a / BOARD_SIZE);
            const bx = b % BOARD_SIZE, by = Math.floor(b / BOARD_SIZE);
            // Chebyshev, because adjacency here is the 8 surrounding tiles —
            // a diagonal neighbour is as near as an orthogonal one.
            return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
        }
    };
}

/**
 * `Spawns` — put a Token on the board.
 *
 * ⚠️ **Never onto an occupied tile.** `here` replaces the bearer, which is what
 * "leave a Stump behind" means and is the only case where destroying something
 * is the intent. Every other placement looks for a free tile and does nothing
 * when there is none — a full board is an ordinary state, and shoving a Token
 * onto an occupied one would silently destroy whatever was there.
 */
export function spawn(statement, roles, random = Math.random) {
    const typeId = statement?.payload?.typeId;
    if (!typeId || !getTokenType(typeId)) return null;

    const bearer = roles?.self;
    if (bearer == null) return null;

    const where = resolvePlacement(placementOf(statement.payload), bearer, boardView(), random);
    if (where == null) return null;
    if (where !== bearer && BoardState.getToken(where)) return null;

    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    BoardState.setToken(where, instance);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile: where, typeId });
    TileModifiers.rebuildAround(where);
    logger.debug('EffectActions', `Spawned ${typeId} on tile ${where}`);
    return where;
}

/**
 * `Transforms` — this Token becomes another.
 *
 * ⚠️ **A fresh instance, not a renamed one.** Charges, cooldowns and upkeep
 * state all belong to what the Token WAS; carrying them across would give the
 * new Token a worn-down history it never had, and the two may not even have the
 * same number of charges. A Sapling becoming an Oak is a new thing standing
 * where the old one stood.
 *
 * ⚠️ **The hero stays put.** Somebody working a Sapling is still standing there
 * when it becomes an Oak; moving them would be a displacement nobody authored.
 */
export function transform(statement, roles) {
    const typeId = statement?.payload?.typeId;
    if (!typeId || !getTokenType(typeId)) return false;

    const tile = tileFor(statement?.target?.role || ROLE.SELF, roles);
    if (tile == null || !BoardState.getToken(tile)) return false;

    BoardState.setToken(tile, BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)));
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { tile, typeId });
    TileModifiers.rebuildAround(tile);
    logger.debug('EffectActions', `Transformed tile ${tile} into ${typeId}`);
    return true;
}

/**
 * `Removes` — take a live effect off somebody.
 *
 * ⭐ The cleanse this project has been missing. `StatusEffectSystem.purge` has
 * existed, complete and correct, since the status engine was built and has been
 * **called by nothing** — the v1 sweep named it as one of four
 * written-but-unreachable features. This is the caller.
 *
 * An empty `effectId` removes everything, which is the "cure all ills" case.
 */
export function remove(statement, roles) {
    const heroId = heroFor(statement?.target?.role || ROLE.ACTOR, roles);
    if (!heroId) return 0;

    const effectId = statement?.payload?.effectId || null;
    const removed = LiveEffects.removeFromHero(heroId, effectId);
    if (removed) {
        logger.debug('EffectActions', `Removed ${removed} effect(s) from ${heroId}`);
    }
    return removed;
}

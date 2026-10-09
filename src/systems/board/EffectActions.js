// the verbs that act on somebody

import { ROLE } from '../../config/registries/roleRegistry.js';
import { resolveMagnitude, usesCountedSelector } from '../../config/registries/magnitudeRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import * as BoardState from './BoardState.js';
import * as TileModifiers from './TileModifiers.js';
import * as Charges from './Charges.js';
import * as BoardCombat from './BoardCombat.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { centreOf, distanceSq } from './nearby.js';
import { artRadiusOf, matW, matH } from '../../config/matGeometry.js';
import * as MatPlacement from './MatPlacement.js';
import * as TokenGlows from './TokenGlows.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { PLACEMENT, RANDOM_FREE_DARTS, placementOf } from '../../config/registries/placementRegistry.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * `Heals`, `Restores` and `Removes`, the rest of the action set. Each ships with a reader that
 * already exists, as `modifierPalette.js` states in its own header:
 * - `Heals`: `HeroManager.modifyHeroHp`, the same one damage uses
 * - `Restores`: `Charges.applyDelta`
 * - `Removes`: `LiveEffects.removeFromHero`
 *
 * ⚠️ `Moves`/displace is deliberately not here: where to, and what if that spot is taken, have no
 * answers yet, and a verb with undecided targeting is how one slice becomes three.
 *
 * The roles `self` and `source` are Token instance ids; `selfPoint` is where the bearer stands (or
 * stood, if it has already left the mat). There are no tiles.
 *
 * ⚠️ Magnitudes resolve the same way they do for damage: a heal may be 20% of the target's max HP
 * exactly as a thorn may be. Resolution goes through `magnitudeRegistry` rather than being
 * re-derived here, so a computed magnitude cannot come to mean two things depending on the verb.
 */

/** How many things a statement's `counted` selector matched. */
export function countMatches(statement, roles) {
    if (!usesCountedSelector(statement?.payload)) return 0;
    if (roles?.self == null) return 0;
    return TileModifiers.filterTargets(roles.self, {
        to: statement.counted, reach: statement.counted?.reach
    }, roles.selfPoint || null).length;
}

/** The number a statement means right now, computed or flat. */
export function amountOf(statement, roles) {
    return resolveMagnitude(statement?.payload, {
        actorHero: roles?.actor ? HeroManager.getHero(roles.actor) : null,
        selfInstance: roles?.self != null ? BoardState.getTokenById(roles.self) : null
    }, countMatches(statement, roles));
}

/**
 * The hero a role points at, or null.
 *
 * ⚠️ `self` may be a person rather than a Token: a live effect instance sits on somebody, so this
 * entity on a Poison means the person carrying it.
 */
export function heroFor(role, roles) {
    // ⚠️ `the enemy` is never a hero: without this it would fall through to the worker of `self`
    // and heal or cleanse the hero.
    if (role === ROLE.OPPONENT) return null;
    if (role === ROLE.ACTOR) return roles?.actor || null;
    if (role === ROLE.SELF && roles?.selfHeroId) return roles.selfHeroId;
    const id = role === ROLE.SOURCE ? roles?.source : roles?.self;
    return id != null ? BoardState.workerOf(id) : null;
}

/** The **Token** a role points at, as an instance id, or null. Only `self`, `source` and the actor's work have one. */
export function tokenFor(role, roles) {
    // Restores and Transforms cannot aim at the enemy, and a creature is found by hero, never by
    // the Token it is.
    if (role === ROLE.OPPONENT) return null;
    if (role === ROLE.ACTOR) {
        // The actor is a person; the Token they work is the honest reading of
        // "where the actor is".
        const heroId = roles?.actor;
        return heroId ? BoardState.workTokenOf(heroId) : null;
    }
    return role === ROLE.SOURCE ? (roles?.source ?? null) : (roles?.self ?? null);
}

/**
 * `Heals`: put health back on somebody.
 *
 * ⚠️ Never overheals: `modifyHeroHp` clamps to max, so a heal that would go past full simply tops
 * them up, as every other heal in the game does.
 */
export function heal(statement, roles) {
    const amount = Math.round(amountOf(statement, roles));
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const role = statement?.target?.role || ROLE.ACTOR;

    // Healing `the enemy`: its fight's HP, capped at its max, the same no-overheal rule the hero
    // side has. Found by hero.
    if (role === ROLE.OPPONENT) {
        const hp = BoardCombat.opponentFightOf(statement, roles)?.combat?.enemyHp;
        if (!hp) return 0;
        const before = hp.current;
        hp.current = Math.min(hp.max, hp.current + amount);
        return hp.current - before;
    }

    const heroId = heroFor(role, roles);
    if (!heroId) return 0;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return 0;

    const before = hero.hp.current;
    HeroManager.modifyHeroHp(heroId, amount);
    return HeroManager.getHero(heroId).hp.current - before;
}

/**
 * `Restores`: give a Token charges back.
 *
 * ⚠️ An unlimited Token ignores this, as it ignores every other charge delta. `Charges.applyDelta`
 * owns that rule and the ceiling at the Token's starting charges, so restoring is not a way to push
 * a Token past what it was authored to hold.
 */
export function restore(statement, roles) {
    const amount = Math.round(amountOf(statement, roles));
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const instance = BoardState.getTokenById(tokenFor(statement?.target?.role || ROLE.SELF, roles));
    if (!instance) return 0;

    Charges.applyDelta(instance, amount);
    return amount;
}

/**
 * The smallest centre-to-centre gap a spawned Token keeps from every other Token: the same rule a
 * hand-placed Token obeys.
 *
 * Not a second definition: `MatPlacement.minGap` is the one place the hitbox and overlap
 * percentages are turned into a distance, and a spawn crowding differently from a drop would be
 * drift.
 */
export function minCentreGap(typeA, typeB) {
    return MatPlacement.minGap(typeA, typeB);
}

/**
 * Where a spawned Token of `typeId` lands, or null when there is nowhere (the spawn is simply
 * skipped).
 * - `here`: the bearer's own point, exactly.
 * - `nearest_free`: the nearest legal point to the bearer (`findSpot`), within the same nudge reach
 * a hand-placed Token gets: a spawn that travels further than a player's own drop would is not
 * nearest in any way the player could predict. Only when that finds nothing does the spawn push,
 * from just beside the bearer; the bearer itself is never shoved off its own spot by what it made.
 * - `random_free`: up to `RANDOM_FREE_DARTS` random darts across the mat, the roomiest legal one
 * kept, so a spawn spreads out rather than crowding. If no dart is legal, the roomiest one pushes.
 *
 * Returns `{ x, y, pushed }`; `pushed` is for `BoardState.applyPushes`.
 */
function spawnPoint(typeId, placement, from, random, bearerId) {
    // A spawn pushes only other spawned Tokens. Everything the player placed holds its ground; a
    // push that would need to move one fails, and `forceSpot` falls back to free space, or to null
    // (the spawn waits).
    const fixedIds = BoardState.placedTokenIds();

    if (placement === PLACEMENT.NEAREST_FREE) {
        const spot = MatPlacement.findSpot(typeId, from);
        if (spot) return { x: spot.x, y: spot.y, pushed: [] };
        const bearer = BoardState.getTokenById(bearerId);
        const beside = bearer ? besideBearer(typeId, bearer) : from;
        // The bearer itself is never shoved off its own spot, whatever its origin.
        return MatPlacement.forceSpot(typeId, beside, { fixedIds: bearer ? [...fixedIds, bearer.id] : fixedIds });
    }

    if (placement === PLACEMENT.RANDOM_FREE) {
        const r = artRadiusOf(typeId);
        let best = null;
        let bestScore = -Infinity;
        for (let i = 0; i < RANDOM_FREE_DARTS; i++) {
            const dart = {
                x: r + random() * Math.max(0, matW() - 2 * r),
                y: r + random() * Math.max(0, matH() - 2 * r)
            };
            const legal = MatPlacement.isLegal(typeId, dart);
            // A legal dart always beats an illegal one; among equals, the roomiest.
            const score = openness(dart) + (legal ? LEGAL_BONUS : 0);
            if (score > bestScore) {
                best = { ...dart, legal };
                bestScore = score;
            }
        }
        if (!best) return null;
        if (best.legal) return { x: best.x, y: best.y, pushed: [] };
        return MatPlacement.forceSpot(typeId, best, { fixedIds });
    }

    // `here` replaces the bearer: nothing is pushed.
    return from ? { x: from.x, y: from.y, pushed: [] } : null;
}

/** Outranks any squared distance on the mat, so a legal dart always wins. */
const LEGAL_BONUS = 1e12;

/**
 * How far past the minimum gap `besideBearer` aims, in mat units. `clampInside` rounds the point to
 * whole units, which moves it by up to √0.5 ≈ 0.71 u; without this margin that rounding could land
 * the newcomer a fraction INSIDE the bearer's gap. Both are fixed in the push, so the overlap could
 * never be solved and every crowded `nearest_free` spawn would fall back to free space far away
 * instead of pushing.
 */
const BESIDE_MARGIN = 1;

/**
 * The point one gap from the bearer in its roomiest direction (of eight) — where
 * a crowded `nearest_free` spawn starts its push.
 */
function besideBearer(typeId, bearer) {
    const gap = MatPlacement.minGap(typeId, bearer.typeId) + BESIDE_MARGIN;
    let best = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 8; k++) {
        const angle = (k / 8) * Math.PI * 2;
        const point = MatPlacement.clampInside(typeId, {
            x: bearer.x + Math.cos(angle) * gap,
            y: bearer.y + Math.sin(angle) * gap
        });
        const score = openness(point, bearer.id);
        if (score > bestScore) {
            best = point;
            bestScore = score;
        }
    }
    return best;
}

/** How open a spot is: the squared distance to the nearest Token (bigger is roomier). */
function openness(point, ignoreId = null) {
    let nearest = Infinity;
    for (const other of BoardState.tokens()) {
        if (other.id === ignoreId) continue;
        const centre = centreOf(other);
        if (centre) nearest = Math.min(nearest, distanceSq(point, centre));
    }
    return nearest;
}

/**
 * `Spawns`: put a Token on the mat.
 *
 * ⚠️ Never onto another Token. `here` replaces the bearer, which is what leaving a Stump behind
 * means and the only case where destroying something is the intent. Every other placement looks for
 * a free spot, pushes when there is none nearby, and does nothing when the mat is full: a full mat
 * is an ordinary state, and stacking a Token onto another would silently destroy whatever was
 * there.
 *
 * Where: `here` is the bearer's point (a death drop, the bearer already left, lands where it
 * stood); `nearest_free` is the free spot nearest the bearer's point, else a push; `random_free` is
 * the roomiest of up to `RANDOM_FREE_DARTS` random free spots, else a push. A push never breaks a
 * `Cannot` rule (`MatPlacement.forceSpot`).
 *
 * @returns {{instanceId: string, x: number, y: number, replacedBearer: boolean}|null}
 */
export function spawn(statement, roles, random = Math.random) {
    const typeId = statement?.payload?.typeId;
    if (!typeId || !getTokenType(typeId)) return null;

    const bearerId = roles?.self;
    if (bearerId == null) return null;

    const bearer = BoardState.getTokenById(bearerId);
    const from = centreOf(bearer) || roles?.selfPoint || null;
    if (!from) return null;

    const placement = placementOf(statement.payload);
    const replacesBearer = placement === PLACEMENT.HERE;
    const where = spawnPoint(typeId, placement, from, random, bearerId);
    if (!where) return null; // the mat is full, so the spawn is skipped

    if (replacesBearer) {
        // The bearer (if it is still there) and anything else standing on the
        // very point are replaced.
        if (bearer) BoardState.removeToken(bearer.id);
        for (const other of BoardState.tokensAtPoint(where.x, where.y)) BoardState.removeToken(other.id);
    }

    const touched = BoardState.applyPushes(where.pushed);

    // Whatever a spawn makes is `spawned`: it counts toward the Token cap like any Token, and a later spawn
    // may push it.
    const instance = BoardState.createTokenInstance(
        typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.SPAWNED
    );
    BoardState.addToken(instance, where.x, where.y);
    // A Token that takes its bearer's place (a Stump left behind) glows like a transform, under its
    // new id: also where a bearer that has already left stood. Ordinary spawns elsewhere get the
    // green notice instead (`SpawnerSystem`).
    if (replacesBearer) TokenGlows.raiseGlow(instance.id, { fromTypeId: bearer?.typeId ?? null, typeId });
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId });
    TileModifiers.rebuildAround([from, { x: where.x, y: where.y }, ...touched]);
    if (touched.length) EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    logger.debug('EffectActions', `Spawned ${typeId} at (${where.x}, ${where.y})`);
    return { instanceId: instance.id, x: where.x, y: where.y, replacedBearer: replacesBearer };
}

/**
 * `Transforms`: this Token becomes another.
 *
 * ⚠️ A fresh instance, not a renamed one. Charges, cooldowns and upkeep state all belong to what
 * the Token WAS; carrying them across would give the new Token a worn-down history it never had,
 * and the two may not even have the same number of charges. It stands at the same point.
 *
 * ⚠️ The hero chooses again. A hero's claim is on the old instance, so whoever worked the Sapling
 * picks their next job on the next tick, usually the Oak.
 */
export function transform(statement, roles) {
    const typeId = statement?.payload?.typeId;
    const old = BoardState.getTokenById(tokenFor(statement?.target?.role || ROLE.SELF, roles));
    return transformInstance(old, typeId) != null;
}

/**
 * The body of a transform, for callers that already hold the instance: the `Transforms` statement
 * above and the timed changes (`TimedChanges.js`: `grows`, `turns`).
 *
 * ⚠️ `origin` is the one thing carried across: a placed Coast that turns into a Shrimp Coast is
 * still something the player placed, and a spawned Sapling that grows is still spawned. Everything
 * else starts fresh.
 *
 * @param {object} old the instance on the mat that becomes something else
 * @param {string} typeId what it becomes
 * @param {object} [options]
 * @param {boolean} [options.fixPlaced] placed Tokens may not be pushed out of the way. Default
 * false: a `Transforms` statement pushes as it always has.
 * @param {object} [options.extra] fields to set on the new instance (`turnedFrom`, `clocks`)
 * @returns {object|null} the new instance, or null when it did not happen
 */
export function transformInstance(old, typeId, options = {}) {
    if (!typeId || !getTokenType(typeId)) return null;
    if (!old || !BoardState.getTokenById(old.id)) return null;

    const from = centreOf(old);

    // The new Token may be bigger, or carry a `Cannot` the old one did not: it pushes like any
    // arrival, and a transform with nowhere legal to stand does not happen.
    const fixedIds = options.fixPlaced ? BoardState.placedTokenIds().filter(id => id !== old.id) : [];
    const where = MatPlacement.forceSpot(typeId, from, { excludeId: old.id, fixedIds });
    if (!where) return null;

    const at = { x: where.x, y: where.y };
    BoardState.removeToken(old.id);
    const touched = BoardState.applyPushes(where.pushed);

    const instance = BoardState.createTokenInstance(
        typeId, tokenStartingUses(typeId), null, BoardState.originOf(old)
    );
    if (options.extra) Object.assign(instance, options.extra);
    // An enemy's tether to its spawner is a fact about where it belongs, not about what it was, so
    // it is carried across like `origin`.
    if (typeof old.tether === 'string') instance.tether = old.tether;
    BoardState.addToken(instance, at.x, at.y);
    // The new Token glows as it appears, kept under its NEW id, which is what the mat draws it by.
    TokenGlows.raiseGlow(instance.id, { fromTypeId: old.typeId, typeId });
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId });
    TileModifiers.rebuildAround([from, at, ...touched]);
    if (touched.length) EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    logger.debug('EffectActions', `Transformed ${old.id} into ${typeId} at (${at.x}, ${at.y})`);
    return instance;
}

/**
 * `Removes`: take a live effect off somebody. An empty `effectId` removes everything, the cure-all
 * case.
 */
export function remove(statement, roles) {
    const role = statement?.target?.role || ROLE.ACTOR;
    const effectId = statement?.payload?.effectId || null;

    // Cleansing `the enemy`: off the fight's own effect list.
    if (role === ROLE.OPPONENT) {
        const bearer = BoardCombat.opponentBearerOf(statement, roles);
        return bearer ? LiveEffects.removeFrom(bearer, effectId) : 0;
    }

    const heroId = heroFor(role, roles);
    if (!heroId) return 0;

    const removed = LiveEffects.removeFromHero(heroId, effectId);
    if (removed) {
        logger.debug('EffectActions', `Removed ${removed} effect(s) from ${heroId}`);
    }
    return removed;
}

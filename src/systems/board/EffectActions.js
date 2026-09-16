// Fantasy Guild — the verbs that act on somebody (Effects Grammar v2, V8)

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
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { PLACEMENT, RANDOM_FREE_DARTS, placementOf } from '../../config/registries/placementRegistry.js';

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
 * if that spot is taken" have no answers yet, and a verb with undecided
 * targeting is how one slice becomes three.
 *
 * ## By instance id (Free Playmat slice 1.6b)
 * The roles `self` and `source` are Token **instance ids**; `selfPoint` is where
 * the bearer stands (or stood, if it has already left the mat). There are no
 * tiles.
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
 * The **hero** a role points at, or null.
 *
 * ⚠️ `self` may be a person rather than a Token — a live effect instance sits on
 * somebody, so "this entity" on a Poison means the person carrying it.
 */
export function heroFor(role, roles) {
    // ⚠️ `the enemy` is never a hero — without this it fell through to the
    // worker of `self` and would have healed or cleansed the hero (G-43).
    if (role === ROLE.OPPONENT) return null;
    if (role === ROLE.ACTOR) return roles?.actor || null;
    if (role === ROLE.SELF && roles?.selfHeroId) return roles.selfHeroId;
    const id = role === ROLE.SOURCE ? roles?.source : roles?.self;
    return id != null ? BoardState.workerOf(id) : null;
}

/** The **Token** a role points at, as an instance id, or null. Only `self`, `source` and the actor's work have one. */
export function tokenFor(role, roles) {
    // G-42: Restores and Transforms cannot aim at the enemy, and a creature is
    // found by hero, never by the Token it is.
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

    const role = statement?.target?.role || ROLE.ACTOR;

    /**
     * ⭐ Healing `the enemy` (G-42): its fight's HP, capped at its max — the
     * same no-overheal rule the hero side has. Found by hero (G-43).
     */
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

    const instance = BoardState.getTokenById(tokenFor(statement?.target?.role || ROLE.SELF, roles));
    if (!instance) return 0;

    Charges.applyDelta(instance, amount);
    return amount;
}

// ---------------------------------------------------------------------------
// Where a spawned or transformed Token lands (Free Playmat slice 1.6b)
// ---------------------------------------------------------------------------

/**
 * The smallest centre-to-centre gap a spawned Token keeps from every other
 * Token — **the same rule a hand-placed Token obeys** (FP-63).
 *
 * Kept as a named export because it is the sentence a spawn's spacing is
 * described by, but it is not a second definition: `MatPlacement.minGap` is the
 * one place the hitbox and overlap percentages are turned into a distance, and
 * a spawn crowding differently from a drop would be exactly the kind of drift
 * the free-placement rework exists to remove.
 */
export function minCentreGap(typeA, typeB) {
    return MatPlacement.minGap(typeA, typeB);
}

/**
 * Where a spawned Token of `typeId` lands, or null when there is nowhere
 * (FP-46 — the spawn is simply skipped).
 *
 * * `here` — the bearer's own point, exactly.
 * * `nearest_free` — the nearest legal point to the bearer (`findSpot`), within
 *   the **same nudge reach a hand-placed Token gets**. One reach number for the
 *   whole game rather than a second one invented for spawns: a spawn that has to
 *   travel further than a player's own drop would is not "nearest" in any sense
 *   the player could predict. (Spawn behaviour on a crowded mat is slice 1.8's.)
 * * `random_free` — up to 40 random darts across the mat, the roomiest legal
 *   one kept, so a spawn spreads out rather than crowding.
 */
function spawnPoint(typeId, placement, from, random) {
    if (placement === PLACEMENT.NEAREST_FREE) {
        const spot = MatPlacement.findSpot(typeId, from);
        return spot ? { x: spot.x, y: spot.y } : null;
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
            if (!MatPlacement.isLegal(typeId, dart)) continue;
            const score = openness(dart);
            if (score > bestScore) {
                best = dart;
                bestScore = score;
            }
        }
        return best;
    }

    return from ? { x: from.x, y: from.y } : null;
}

/** How open a spot is: the squared distance to the nearest Token (bigger is roomier). */
function openness(point) {
    let nearest = Infinity;
    for (const other of BoardState.tokens()) {
        const centre = centreOf(other);
        if (centre) nearest = Math.min(nearest, distanceSq(point, centre));
    }
    return nearest;
}

/**
 * `Spawns` — put a Token on the mat.
 *
 * ⚠️ **Never onto another Token.** `here` replaces the bearer, which is what
 * "leave a Stump behind" means and is the only case where destroying something
 * is the intent. Every other placement looks for a free spot and does nothing
 * when there is none (FP-46) — a full mat is an ordinary state, and shoving a
 * Token onto another would silently destroy whatever was there.
 *
 * ## Where (Free Playmat slice 1.6b; stopgaps owned by slice 1.8)
 * * `here` — the bearer's point. A death drop (the bearer already left) lands
 *   where it stood.
 * * `nearest_free` — the free spot nearest the bearer's point.
 * * `random_free` — the roomiest of up to 40 random free spots.
 *
 * No pushing and no `Cannot` check, as before.
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
    const where = spawnPoint(typeId, placement, from, random);
    if (!where) return null;

    if (replacesBearer) {
        // The bearer (if it is still there) and anything else standing on the
        // very point are replaced.
        if (bearer) BoardState.removeToken(bearer.id);
        for (const other of BoardState.tokensAtPoint(where.x, where.y)) BoardState.removeToken(other.id);
    }

    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    BoardState.addToken(instance, where.x, where.y);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId });
    TileModifiers.rebuildAround([from, where]);
    logger.debug('EffectActions', `Spawned ${typeId} at (${where.x}, ${where.y})`);
    return { instanceId: instance.id, x: where.x, y: where.y, replacedBearer: replacesBearer };
}

/**
 * `Transforms` — this Token becomes another.
 *
 * ⚠️ **A fresh instance, not a renamed one.** Charges, cooldowns and upkeep
 * state all belong to what the Token WAS; carrying them across would give the
 * new Token a worn-down history it never had, and the two may not even have the
 * same number of charges. A Sapling becoming an Oak is a new thing standing
 * where the old one stood — at the same point (slice 1.6b).
 *
 * ⚠️ **The hero chooses again.** A hero's claim is on the old instance, so
 * whoever worked the Sapling picks their next job on the next tick — usually
 * the Oak (stopgap owned by slice 1.8).
 */
export function transform(statement, roles) {
    const typeId = statement?.payload?.typeId;
    if (!typeId || !getTokenType(typeId)) return false;

    const old = BoardState.getTokenById(tokenFor(statement?.target?.role || ROLE.SELF, roles));
    if (!old) return false;

    // A Sapling becoming an Oak stands exactly where the Sapling stood, whatever
    // the two sizes are — there is no tile to re-anchor to (slice 1.6d).
    const from = centreOf(old);
    const at = { x: from.x, y: from.y };
    BoardState.removeToken(old.id);
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    BoardState.addToken(instance, at.x, at.y);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId });
    TileModifiers.rebuildAround([from, at]);
    logger.debug('EffectActions', `Transformed ${old.id} into ${typeId}`);
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
    const role = statement?.target?.role || ROLE.ACTOR;
    const effectId = statement?.payload?.effectId || null;

    // ⭐ Cleansing `the enemy` (G-42): off the fight's own effect list.
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

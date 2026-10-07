// the `Deals` verb

import { EventBus } from '../core/EventBus.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { mitigateFlatDamage, enemyFlatArmor } from '../../utils/CombatFormulas.js';
import { resolveMagnitude, usesCountedSelector } from '../../config/registries/magnitudeRegistry.js';
import * as TileModifiers from './TileModifiers.js';
import { logger } from '../../utils/Logger.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Deals damage to a person.
 *
 * One Thorns works on a berry bush and on a monster: `BoardRunner` (a hero finishes harvesting) and
 * `BoardCombat` (a hero wins a fight) publish the same event with the same payload, so `actor`
 * resolves to the hero either way and this module cannot tell the difference.
 *
 * ⚠️ Damage respects armour, and can be fully stopped by it. `mitigateFlatDamage` floors at zero
 * where a combat hit floors at one (reasoning in `CombatFormulas`): a fight must always progress, a
 * thorn need not. An author who wants a thorn that pierces plate sets `ignoresArmor` on the
 * statement.
 *
 * ⚠️ Killing a hero announces; it never resolves the death itself. Dying has exactly ONE
 * implementation, `BoardCombat.resolveDefeat`; a lethal blow here publishes `hero_downed` and
 * `BoardCombat` owns the response. There must never be a second subscriber that also kills: that
 * branch was once a no-op and a poisoned hero worked on at 0 HP. This module imports `BoardCombat`
 * (for `isEnemyToken`/`getFight`); that is not a cycle as long as `BoardCombat` does not import
 * back.
 */

/**
 * How many things the statement's second, `counted` selector matched.
 *
 * ⚠️ Counted from the bearer, not the target: 1 damage per nearby Coast Token on a monster means
 * the Tokens beside the monster.
 *
 * By instance id, measured from the bearer's point if it has left. Zero when the rule does not use
 * a count, so the multiply is harmless.
 */
function countMatches(statement, roles) {
    if (!usesCountedSelector(statement?.payload)) return 0;
    if (roles?.self == null) return 0;
    // The counted selector carries its own reach, so "per Coast Token on the
    // board" is as sayable as "per nearby Coast Token".
    return TileModifiers.filterTargets(roles.self, {
        to: statement.counted, reach: statement.counted?.reach
    }, roles.selfPoint || null).length;
}

/** The entity a role points at, as something damage can be applied to. */
function targetOf(role, roles, statement) {
    // `the enemy` is found by hero, never by tile. No fight, or a moment that does not supply the
    // role, reaches nobody; it never falls through to the occupant rule below, which would hit the
    // hero.
    if (role === ROLE.OPPONENT) {
        const fight = BoardCombat.opponentFightOf(statement, roles);
        return fight?.combat?.enemyHp ? enemyTarget(fight) : null;
    }

    if (role === ROLE.ACTOR) {
        const heroId = roles?.actor;
        return heroId ? heroTarget(heroId) : null;
    }

    // ⚠️ `self` may be a HERO rather than a Token: a live effect sits on a person, so a Poison
    // saying deal 2 damage to this entity means the person carrying it.
    if (role === ROLE.SELF && roles?.selfHeroId) return heroTarget(roles.selfHeroId);

    // ⚠️ ...and `self` may be a live ENEMY, for the same reason: a Poison on a monster must mean
    // the monster, not the hero fighting it, which the occupant rule below would otherwise resolve
    // it to.
    if (role === ROLE.SELF && roles?.selfFightId != null) {
        const fight = BoardCombat.getFight(roles.selfFightId);
        return fight?.combat?.enemyHp ? enemyTarget(fight) : null;
    }

    // Otherwise both are Tokens, by instance id. Whoever works it takes it: the hero if one is
    // present, otherwise the live enemy, the same occupant rule `StatusApplication` resolves by.
    const id = role === ROLE.SOURCE ? roles?.source : roles?.self;
    if (id == null) return null;

    const heroId = BoardState.workerOf(id);
    if (heroId) return heroTarget(heroId);

    const instance = BoardState.getTokenById(id);
    if (!instance || !BoardCombat.isEnemyToken(instance)) return null;
    const fight = BoardCombat.getFight(id);
    // Only a fight in progress: an enemy nobody has engaged has no HP bar to
    // take damage off, and inventing one would make a hit that lands on nothing.
    if (!fight?.combat?.enemyHp) return null;
    return enemyTarget(fight);
}

/**
 * A non-combat hit on an enemy, mitigated. Mirrors `mitigateFlatDamage`: floor at zero, not at one,
 * because a thorn is not a fight.
 */
function mitigateEnemyDamage(fight, rawDamage) {
    const armor = enemyFlatArmor(fight?.enemy, fight?.combat?.enemyStatuses);
    return Math.max(0, Math.round(rawDamage - armor));
}

function heroTarget(heroId) {
    return {
        kind: 'hero',
        apply(amount, ignoresArmor) {
            const hero = HeroManager.getHero(heroId);
            if (!hero) return 0;

            const dealt = ignoresArmor ? Math.max(0, Math.round(amount)) : mitigateFlatDamage(hero, amount);
            if (dealt <= 0) return 0;

            HeroManager.modifyHeroHp(heroId, -dealt);

            if (hero.hp.current <= 0) {
                // Announced, never resolved here — see the note at the top.
                logger.info('DealDamage', `${hero.name} was downed by an effect`);
                EventBus.publish(ENGINE_EVENTS.HERO_DOWNED, { heroId, cause: 'effect' });
            }
            return dealt;
        }
    };
}

function enemyTarget(fight) {
    return {
        kind: 'enemy',
        apply(amount, ignoresArmor) {
            // Armour on this side means the same as on the other: `mitigateFlatDamage` floors at
            // zero, so heavy armour can stop a thorn outright, and `ignoresArmor` is the author's
            // way past it.
            const dealt = ignoresArmor
                ? Math.max(0, Math.round(amount))
                : mitigateEnemyDamage(fight, amount);
            if (dealt <= 0) return 0;
            const hp = fight.combat.enemyHp;
            hp.current = Math.max(0, hp.current - dealt);
            return dealt;
        }
    };
}

/**
 * Run one `Deals` statement.
 *
 * @param {object} statement the expanded statement
 * @param {{self: string, actor: string|null, source: string|null}} roles instance ids
 * @returns {number} damage actually dealt, after mitigation
 */
export function deal(statement, roles) {
    const payload = statement?.payload || {};

    // The magnitude may be computed: a flat number, a percentage of a named stat, or a count of
    // whatever the second selector matched. Resolved here so every entity a stat could name is
    // already in hand.
    const amount = resolveMagnitude(payload, {
        actorHero: roles?.actor ? HeroManager.getHero(roles.actor) : null,
        selfInstance: roles?.self != null ? BoardState.getTokenById(roles.self) : null
    }, countMatches(statement, roles));

    if (!Number.isFinite(amount) || amount <= 0) return 0;

    // ⚠️ A role the moment did not supply reaches nobody: an unstaffed passive generator completes
    // cycles with no hero, so a Thorns on one hurts nothing. That is the same honest nothing an
    // unmatched filter returns, not a failure.
    const target = targetOf(statement?.target?.role || ROLE.ACTOR, roles, statement);
    if (!target) return 0;

    return target.apply(amount, !!payload.ignoresArmor);
}

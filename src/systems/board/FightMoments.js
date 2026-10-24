// a fighter's swing, landed hit and falling health running the rules that wait on them

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { FIGHT_MOMENT, everyOf, healthBelowOf } from '../../config/registries/triggerRegistry.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { getEnemyKind } from '../../config/registries/enemyKinds.js';
import { KEYWORD, statementsOf } from '../effects/statements.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as BoardCombat from './BoardCombat.js';
import * as StatusApplication from './StatusApplication.js';
import * as DealDamage from './DealDamage.js';
import * as EffectActions from './EffectActions.js';
import * as EffectFeedback from './EffectFeedback.js';
import { SIDE, setFightMomentRunner, talliesOf } from '../combat/FightHooks.js';

/**
 * The fight moments (`FIGHT_MOMENT`: On Swing, On Hit, On Health Below), run for one side of a
 * fight when the combat engine says so (`combat/FightHooks.js`).
 *
 * A side's rules: an enemy's are its Token's own rules, any lingering effect on it and its kinds'
 * (Venomous: "On Hit: applies Poison to the hero"); a hero's are their items' and their lingering
 * effects'. In that order, each in authored order, so the random numbers a chance draws come out
 * the same in a catch-up as live.
 *
 * Not routed through `TriggerSystem`: a fight moment spends no Token charge and has no cooldown
 * (its own count is its rhythm), and its roles are the two fighters: `itself` is the side carrying
 * the rule, `the hero` the hero, `the enemy` the creature.
 *
 * Four verbs act here: Applies, Deals, Heals and Removes. Anything else on a fight moment is inert.
 */

/** A kind's built-in rules, as statements (Venomous's poison on a hit). */
function kindStatements(fight) {
    const out = [];
    for (const kindId of fight.enemy?.kinds || []) {
        const onHit = getEnemyKind(kindId)?.onHit;
        if (!onHit?.effectId) continue;
        out.push({
            id: `kind_${kindId}_on_hit`,
            keyword: KEYWORD.APPLIES,
            when: { event: FIGHT_MOMENT.HIT, scope: 'self' },
            target: { role: ROLE.ACTOR },
            payload: { effectId: onHit.effectId, chance: 100 }
        });
    }
    return out;
}

/** Every rule one side of a fight carries, in the order they run. */
function rulesOf(fight, side) {
    if (side === SIDE.ENEMY) {
        return [
            ...statementsOf(getTokenType(fight.enemyId)),
            ...LiveEffects.liveStatements(fight),
            ...kindStatements(fight)
        ];
    }
    const hero = HeroManager.getHero(fight.assignedHeroId);
    if (!hero) return [];
    return [...HeroEffects.loadoutStatements(hero), ...LiveEffects.liveStatements(hero)];
}

/** Who a side's rules name. */
function rolesOf(fight, side) {
    const heroId = fight.assignedHeroId;
    return side === SIDE.ENEMY
        ? { self: fight.instanceId, selfFightId: fight.instanceId, selfHeroId: null, actor: heroId, source: null }
        : { self: fight.instanceId, selfHeroId: heroId, actor: heroId, source: null };
}

/** A side's health as a percentage of its most, or 100 when it has none to read. */
function healthShare(fight, side) {
    if (side === SIDE.ENEMY) {
        const hp = fight.combat?.enemyHp;
        return hp?.max ? (hp.current / hp.max) * 100 : 100;
    }
    const hp = HeroManager.getHero(fight.assignedHeroId)?.hp;
    return hp?.max ? (hp.current / hp.max) * 100 : 100;
}

/**
 * Whether a rule waiting on this moment fires now: every Nth swing or hit, or the first time this
 * fight that its side's health (`share`, read once for the whole moment) is below its share.
 * ⚠️ A health rule is marked as fired the moment its share is crossed, whatever it then does: once
 * per fight is once.
 */
function fires(statement, fight, side, momentId, count, share) {
    const when = statement.when;
    if (momentId === FIGHT_MOMENT.HP_BELOW) {
        if (!(share < healthBelowOf(when))) return false;
        const fired = talliesOf(fight).healthFired;
        const key = `${side}:${statement.sourceEffectId || ''}:${statement.id}`;
        if (fired[key]) return false;
        fired[key] = true;
        return true;
    }
    return count > 0 && count % everyOf(when) === 0;
}

/** Run one rule. @returns {boolean} whether it did anything */
function act(statement, roles, fight) {
    switch (statement.keyword) {
        case KEYWORD.APPLIES:
            // No role: the filter and reach, measured from the enemy Token (a boss's howl).
            return statement.target?.role
                ? StatusApplication.applyToRole(statement, roles) > 0
                : StatusApplication.applyToNeighbours(fight.instanceId, statement) > 0;
        case KEYWORD.DEALS:
            return DealDamage.deal(statement, roles) > 0;
        case KEYWORD.HEALS:
            return EffectActions.heal(statement, roles) > 0;
        case KEYWORD.REMOVES:
            return EffectActions.remove(statement, roles) > 0;
        default:
            return false;
    }
}

/**
 * Run the rules waiting on `momentId` for `side` of `fight`.
 * @param {number} count the swing or hit's number in this fight (0 for health)
 * @returns {number} how many rules did something
 */
export function run(fight, side, momentId, count = 0) {
    if (!fight?.combat) return 0;
    const roles = rolesOf(fight, side);
    // ⚠️ Read once: every rule on this moment sees the health that set it off, so a heal earlier in
    // the list cannot lift the boss back over the share before its armour rule is read.
    const share = momentId === FIGHT_MOMENT.HP_BELOW ? healthShare(fight, side) : 100;
    let acted = 0;
    for (const statement of rulesOf(fight, side)) {
        if (statement?.when?.event !== momentId) continue;
        if (!fires(statement, fight, side, momentId, count, share)) continue;
        if (!act(statement, roles, fight)) continue;
        // The creature's name for its move, or the item's, over the enemy Token.
        EffectFeedback.announce(fight.instanceId, statement);
        acted += 1;
    }
    return acted;
}

/**
 * Wire the combat engine's fight moments to this module, and tell the effect clock who is fighting
 * (a status lands only on a fighter). Idempotent; `TriggerSystem.init` calls it.
 */
export function init() {
    setFightMomentRunner(run);
    LiveEffects.setFightCheck((heroId) => !!BoardCombat.fightOfHero(heroId));
}

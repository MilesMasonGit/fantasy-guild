import * as HeroManager from '../hero/HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from './CombatFormulas.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import { handleHeroWounded } from './CombatResolutionProcessor.js';
import * as ConsumptionSystem from '../hero/ConsumptionSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { FIGHT_MOMENT } from '../../config/registries/triggerRegistry.js';
import { SIDE, MOVE_LANDS, fightMoment, talliesOf } from './FightHooks.js';
import * as Ammo from './Ammo.js';
import * as CombatTricks from './CombatTricks.js';
import { pickMove } from '../../config/registries/enemyMoves.js';

/**
 * HP and food are combat's attrition currency.
 *
 * `combat_hero_attack` names the enemy Token (`instanceId`) so the mat can
 * route a landed hit's knockback to it. Every swing publishes `hit` and `crit`, so a miss and a
 * crit can be shown.
 *
 * Each swing runs the fight moments in a fixed order, so a catch-up draws the same random numbers
 * as live play: the swinger's On Swing rules (before the roll, so they can shape it), the ammo the
 * hero's weapon spends (an arrow, a Mote, a Kunai: hit or miss; where a Preservation rule reaches,
 * one draw says it is kept; `Ammo.js`), the miss and crit roll, the damage and its fraction sub-roll,
 * then, on a hit that leaves the other side standing, the swinger's On Hit rules and, if both still
 * stand, the struck side's When Struck rules. Whatever was carried "for the swing" comes off, and On
 * Health Below is checked.
 *
 * A landed hit's event names its damage types (`types`) and whether they helped or hurt it
 * (`verdict`: `weak`, `resisted` or null), for the floats and the log.
 *
 * An enemy with moves (`enemyMoves.js`) makes one each swing, picked by weight before its On Swing
 * rules (one draw, only when it has a choice): a hit in the move's type, or no hit at all. A move that
 * does not hit rolls nothing when its effect is on itself (`effectOnly`), and only its accuracy when
 * aimed at the hero (one draw: a miss reads as a miss, a landing as `effectOnly`); the event names it
 * (`move`). The move's effect lands through the fight moments: on the hero only if the attack hits.
 * An enemy without moves draws and says exactly what it did before moves.
 *
 * The hero's combat tricks act here (`CombatTricks.js`): Twin Strike after the attack's own rules,
 * Last Stand on an enemy's landed blow before it can defeat, Crit After Dodge on an enemy's miss and
 * the hero's next landed hit. Each draws only where it can act, so a hero with none draws as before.
 */

/** Whether a hero is out of the fight: knocked out, or at 0 HP. */
function isDown(hero) {
    return !hero || hero.status === 'wounded' || (hero.hp?.current ?? 0) <= 0;
}

/**
 * The swing is over: whatever either fighter carried "for the swing" comes off, and what the one
 * swung at (`attacked`, swing number `attack` at it this fight) carried until it was next attacked.
 */
function endSwing(fight, hero, attacked, attack) {
    LiveEffects.endSwingEffects(fight);
    LiveEffects.endSwingEffects(hero);
    LiveEffects.endAttackEffects(attacked, attack);
}

/**
 * Run "On Health Below" for each side whose health has fallen since it was last seen (or that has
 * not been seen yet this fight). A side at 0 is out of the fight and runs nothing.
 */
export function checkHealth(fight, hero) {
    const tallies = talliesOf(fight);
    const seen = tallies.seenHp;

    const enemyHp = fight.combat?.enemyHp?.current ?? 0;
    if (enemyHp > 0 && (seen.enemy == null || enemyHp < seen.enemy)) {
        seen.enemy = enemyHp;
        fightMoment(fight, SIDE.ENEMY, FIGHT_MOMENT.HP_BELOW);
    } else {
        seen.enemy = enemyHp;
    }

    const heroHp = hero?.hp?.current ?? 0;
    if (!isDown(hero) && (seen.hero == null || heroHp < seen.hero)) {
        seen.hero = heroHp;
        fightMoment(fight, SIDE.HERO, FIGHT_MOMENT.HP_BELOW);
    } else {
        seen.hero = heroHp;
    }
}

/**
 * One strike of the hero's attack: the miss and crit roll, the damage and its fraction sub-roll, the
 * event, then on a hit that leaves both standing the hero's On Hit rules and the enemy's When Struck.
 * `shot` is what the attack spent (`Ammo.spendAmmo`); a second strike (`twin`, Twin Strike) lands
 * the same parts and spends nothing, so its event names the arrow but no ammo. A sure crit waiting
 * from a dodge (`CombatTricks`) makes a hit a crit; the roll draws as it always does.
 */
function strike(fight, hero, enemy, shot, { twin = false } = {}) {
    const tallies = talliesOf(fight);
    const arrowId = shot?.kind === Ammo.AMMO.ARROW ? shot.itemId : null;
    const short = !!shot?.short;
    // What the attack spent, for the time-away tally: the item, and whether Preservation kept it. A
    // second strike spent nothing.
    const spent = {
        ...(!twin && shot?.itemId ? { ammoId: shot.itemId } : {}), ...(!twin && shot?.kept ? { ammoKept: true } : {}),
        ...(short ? { short: true } : {}), ...(twin ? { twin: true } : {})
    };
    const sure = CombatTricks.sureCritWaits(fight, hero);
    const swing = CombatFormulas.rollSwing(
        CombatFormulas.heroMissChance(hero, enemy),
        sure ? CombatFormulas.SURE_CRIT_CHANCE : CombatFormulas.heroCritChance(hero)
    );

    if (!swing.hit) {
        EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, crit: false, arrowId, ...spent, enemyHpRemaining: fight.combat.enemyHp.current });
        return;
    }
    if (sure) CombatTricks.spendSureCrit(fight, hero);
    const blow = CombatFormulas.heroBlow(hero, enemy, { crit: swing.crit, arrow: shot?.arrow ?? null, short });
    const damage = CombatFormulas.rollFraction(blow.exact);
    const types = blow.parts.map(p => p.type);
    const verdict = CombatFormulas.blowVerdict(blow.parts);
    fight.combat.enemyHp.current = Math.max(0, fight.combat.enemyHp.current - damage);

    EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage, hit: true, crit: swing.crit, types, verdict, arrowId, ...spent, ...(sure ? { sureCrit: true } : {}), enemyHpRemaining: fight.combat.enemyHp.current });

    if (fight.combat.enemyHp.current > 0 && !isDown(hero)) {
        tallies.hits.hero += 1;
        fightMoment(fight, SIDE.HERO, FIGHT_MOMENT.HIT, tallies.hits.hero);
        // The enemy's thorns: after the hit's own rules, which may have ended the fight.
        if (fight.combat.enemyHp.current > 0 && !isDown(hero)) {
            fightMoment(fight, SIDE.ENEMY, FIGHT_MOMENT.STRUCK, tallies.hits.hero);
        }
    }
}

/** Whether both sides still stand. */
const bothStand = (fight, hero) => !isDown(hero) && fight.combat.enemyHp.current > 0;

/**
 * One attack by the hero, or none: a bow with no arrow left does not shoot, and its hero leaves the
 * fight at the next look (`Flags`, `WorkCheck.carriedStop`); the swing's time is not spent.
 * @returns {boolean} whether the hero's turn was taken (an attack, or a meal in its place)
 */
export function handleHeroAttack(fight, hero, enemy, attackSpeed) {
    if (Ammo.leavesWithout(hero)) return false;

    // Eating mid-fight: the hero skips this attack while the enemy's timer keeps
    // running, so the enemy gets a free swing. That price keeps HP management
    // tense. Uncapped on purpose: a hero who can't out-heal the damage should lose. Only food
    // heals; an equipped drink is left alone.
    // Read where the fight is: the enemy Token (`fight.instanceId`), as its kill's loot rules are.
    const meals = ConsumptionSystem.tryEat(hero.id, { instanceId: fight.instanceId ?? null });
    if (meals.length) {
        for (const meal of meals) {
            EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATE, {
                cardId: fight.id, heroId: hero.id, itemId: meal.itemId, healed: meal.amount
            });
        }
        fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return true;
    }

    const tallies = talliesOf(fight);
    tallies.swings.hero += 1;
    // The arrow this swing shoots: its own rules join the hero's for this swing only.
    tallies.arrowId = Ammo.nextArrowOf(hero);
    fightMoment(fight, SIDE.HERO, FIGHT_MOMENT.SWING, tallies.swings.hero);

    // A rule on the swing may have ended the fight before the blow: either side may have fallen.
    const shot = bothStand(fight, hero) ? Ammo.spendAmmo(hero, fight.instanceId ?? null) : null;
    // ⚠️ A bow whose last arrow went in the swing's own rules shoots nothing, as one out of arrows.
    const noShot = shot?.kind === Ammo.AMMO.ARROW && !shot.itemId;
    if (bothStand(fight, hero) && !noShot) {
        tallies.arrowId = shot?.kind === Ammo.AMMO.ARROW ? shot.itemId : null;
        if (shot?.short) Ammo.sayShortOnce(fight, hero);
        strike(fight, hero, enemy, shot);
        // Twin Strike: the same attack again at once, once its own rules have run and both stand.
        if (bothStand(fight, hero) && CombatTricks.strikesAgain(fight, hero)) strike(fight, hero, enemy, shot, { twin: true });

        // A poison counts every attack, hit or miss; one that runs out leaves the fight unpoisoned.
        for (const itemId of ConsumptionSystem.countPoisonAttack(hero, fight.instanceId)) {
            LiveEffects.endPoisonEffects(hero, itemId);
            LiveEffects.endPoisonEffects(fight, itemId);
        }
    }

    tallies.arrowId = null;
    endSwing(fight, hero, fight, tallies.swings.hero);
    if (!isDown(hero)) checkHealth(fight, hero);

    // Carry the overshoot instead of resetting; a reset would quantize every
    // attack up to a whole engine tick.
    fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
    return true;
}

/** One enemy swing at a hero who is still standing. */
function enemySwing(fight, enemy, hero) {
    const tallies = talliesOf(fight);
    tallies.swings.enemy += 1;
    // ⚠️ Drawn here and nowhere else, and only for an enemy with a choice of moves.
    const move = pickMove(enemy.moves);
    tallies.move = move;
    fightMoment(fight, SIDE.ENEMY, FIGHT_MOMENT.SWING, tallies.swings.enemy);
    const named = move ? { move: move.name } : null;

    if (!isDown(hero) && fight.combat.enemyHp.current > 0) {
        if (move && !move.hits) {
            // ⚠️ One draw, and only for a move aiming its effect at the hero: a move on itself rolls nothing.
            const atHero = !!move.effectId && move.target !== 'self';
            const lands = !atHero || CombatFormulas.rollLands(CombatFormulas.enemyMissChance(enemy, hero));
            if (atHero && lands) fightMoment(fight, SIDE.ENEMY, MOVE_LANDS, 1);
            if (atHero && !lands) CombatTricks.noteDodge(fight, hero);
            // A miss reads as any miss does; a move that lands, as the move alone.
            EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, {
                cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, crit: false,
                ...named, ...(lands ? { effectOnly: true } : {}), heroHpRemaining: hero.hp.current
            });
        } else {
            const swing = CombatFormulas.rollSwing(
                CombatFormulas.enemyMissChance(enemy, hero),
                CombatFormulas.enemyCritChance(enemy)
            );

            if (swing.hit) {
                const blow = CombatFormulas.enemyBlow(enemy, hero, { crit: swing.crit, type: move?.type });
                let dmg = CombatFormulas.rollFraction(blow.exact);
                // ⚠️ Last Stand comes before any defeat: a blow that would take the hero to 0 leaves
                // them at 1 instead, so nothing that reads a defeat (the wound, a flee) ever sees it.
                const heldOn = dmg > 0 && CombatTricks.holdsOn(fight, hero, dmg);
                if (heldOn) dmg = Math.max(0, hero.hp.current - 1);
                if (dmg > 0) HeroManager.modifyHeroHp(hero.id, -dmg);

                EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, {
                    cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage: dmg, hit: true, crit: swing.crit,
                    types: blow.parts.map(p => p.type), verdict: CombatFormulas.blowVerdict(blow.parts), ...named,
                    ...(heldOn ? { lastStand: true } : {}), heroHpRemaining: hero.hp.current
                });
                if (heldOn) CombatTricks.sayHeldOn(fight, hero);

                if (hero.hp.current <= 0) {
                    handleHeroWounded(fight, hero.id);
                } else {
                    // Where a move's effect on the hero lands.
                    tallies.hits.enemy += 1;
                    fightMoment(fight, SIDE.ENEMY, FIGHT_MOMENT.HIT, tallies.hits.enemy);
                    // The hero's armour striking back, once the hit's own rules have run.
                    if (!isDown(hero) && fight.combat.enemyHp.current > 0) {
                        fightMoment(fight, SIDE.HERO, FIGHT_MOMENT.STRUCK, tallies.hits.enemy);
                    }
                }
            } else {
                EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, crit: false, ...named, heroHpRemaining: hero.hp.current });
                CombatTricks.noteDodge(fight, hero);
            }
        }
    }

    tallies.move = null;
    endSwing(fight, hero, hero, tallies.swings.enemy);
    if (!isDown(hero)) checkHealth(fight, hero);
}

export function processEnemyAttack(fight, enemy, assignedHeroIds, deltaTime) {
    if (!fight.combat) return;
    fight.combat.enemyTickProgress += deltaTime;
    const enemyAttackSpeed = CombatFormulas.enemyAttackSpeedMs(enemy);

    const repeats = CombatFormulas.swingRepeatsInStep(enemyAttackSpeed);
    while (fight.combat.enemyTickProgress >= enemyAttackSpeed) {
        const targetHeroId = assignedHeroIds[Math.floor(Math.random() * assignedHeroIds.length)];
        const targetHero = HeroManager.getHero(targetHeroId);

        if (targetHero && targetHero.status !== 'wounded') enemySwing(fight, enemy, targetHero);

        // Carry the overshoot instead of resetting.
        fight.combat.enemyTickProgress -= enemyAttackSpeed;
        if (!repeats || isDown(targetHero) || fight.combat.enemyHp.current <= 0) break;
    }
}

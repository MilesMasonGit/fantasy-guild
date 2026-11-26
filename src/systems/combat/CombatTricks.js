// a hero's combat tricks: a heal on each kill, a defeating blow held at 1 health, an attack that strikes twice, a sure crit after a dodge

import * as HeroManager from '../hero/HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { sureOrRolled } from '../board/CycleSavings.js';
import * as CombatFormulas from './CombatFormulas.js';

/**
 * Four effects (`EFFECT_TYPES.KILL_HEAL`, `LAST_STAND`, `TWIN_STRIKE`, `DODGE_CRIT`), read off the hero
 * for the style they fight in (`CombatFormulas`), from their gear, perks, lingering effects and the
 * guild's stars. Each says what it did with `ENGINE_EVENTS.COMBAT_TRICK`, for the fight log.
 *
 * What lasts a fight (Last Stand spent, a sure crit waiting) is noted on the hero, `hero.fightTricks
 * = { at, lastStand?, sureCrit? }`, `at` the enemy Token: saved with them, so a game saved and loaded
 * mid-fight goes on with it, and forgotten when the fight ends (`BoardCombat.endFight`). A note for
 * another Token is a fight gone and reads as none. Nothing is written for a hero whose tricks never act.
 *
 * ⚠️ The draw order is part of the game's work. A chance draws through `sureOrRolled`: nothing with no
 * rule, nothing at 100 or more, one draw between, and each is asked only where it can act (a blow
 * that would defeat, a dodge with no sure crit waiting, an attack both sides stand after), so a hero
 * with no trick draws exactly what they drew before.
 */

/** The tricks, as `COMBAT_TRICK` names them. */
export const TRICK = Object.freeze({
    KILL_HEAL: 'killHeal',
    LAST_STAND: 'lastStand',
    TWIN_STRIKE: 'twinStrike',
    DODGE_CRIT: 'dodgeCrit'
});

/** The key a fight's notes are kept under: its enemy Token (a bare fight in a test: its own id). */
const fightKey = (fight) => fight?.instanceId ?? fight?.id ?? null;

/** The hero's notes for this fight, or null. */
function notesFor(hero, fight) {
    const notes = hero?.fightTricks;
    return notes && notes.at === fightKey(fight) ? notes : null;
}

/** Note `key` on the hero for this fight; any note for another fight is dropped. */
function note(hero, fight, key) {
    const notes = notesFor(hero, fight);
    if (notes) notes[key] = true;
    else hero.fightTricks = { at: fightKey(fight), [key]: true };
}

/** Take `key` off the hero's notes for this fight; none left, the notes go. */
function unnote(hero, fight, key) {
    const notes = notesFor(hero, fight);
    if (!notes) return;
    delete notes[key];
    if (!notes.lastStand && !notes.sureCrit) delete hero.fightTricks;
}

/** The hero's fight is over: whatever it noted goes. */
export function forgetFight(heroOrId) {
    const hero = typeof heroOrId === 'object' ? heroOrId : HeroManager.getHero(heroOrId);
    if (hero?.fightTricks) delete hero.fightTricks;
}

function announce(fight, hero, trick, extra = null) {
    EventBus.publish(ENGINE_EVENTS.COMBAT_TRICK, {
        cardId: fight?.id ?? null, instanceId: fight?.instanceId ?? null, heroId: hero.id, trick, ...(extra || {})
    });
}

/**
 * Heal on Kill: the hero has won a kill, and heals what they hold of it, never past their most.
 * Said only when it healed something.
 * @returns {number} the health healed
 */
export function healOnKill(fight, hero) {
    const amount = CombatFormulas.heroKillHeal(hero);
    if (!(amount > 0) || !hero?.hp) return 0;
    const before = hero.hp.current;
    HeroManager.modifyHeroHp(hero.id, amount);
    const healed = hero.hp.current - before;
    if (healed > 0) announce(fight, hero, TRICK.KILL_HEAL, { amount: healed });
    return healed;
}

/**
 * Last Stand: an enemy's blow of `damage` is about to land. When it would defeat the hero and they
 * have not held on yet this fight, the chance is rolled; on a hit they hold on (the caller leaves them
 * at 1) and it is spent for the fight. Said by the caller, after the blow's own event.
 * @returns {boolean} whether the hero holds on
 */
export function holdsOn(fight, hero, damage) {
    const hp = hero?.hp?.current ?? 0;
    if (!(damage >= hp) || hp <= 0) return false;
    if (notesFor(hero, fight)?.lastStand) return false;
    if (!sureOrRolled(CombatFormulas.heroLastStandChance(hero))) return false;
    note(hero, fight, 'lastStand');
    return true;
}

/** Say that the hero held on at 1 health. */
export function sayHeldOn(fight, hero) {
    announce(fight, hero, TRICK.LAST_STAND);
}

/**
 * Twin Strike: the hero's attack is done and both still stand; whether it strikes again at once.
 * Said here when it does, before the second strike's own event.
 */
export function strikesAgain(fight, hero) {
    if (!sureOrRolled(CombatFormulas.heroTwinStrikeChance(hero))) return false;
    announce(fight, hero, TRICK.TWIN_STRIKE);
    return true;
}

/**
 * Crit After Dodge: an enemy's attack at the hero has missed. Unless a sure crit is already waiting,
 * the chance is rolled; on a hit the hero's next landed hit this fight crits.
 */
export function noteDodge(fight, hero) {
    if (!hero || notesFor(hero, fight)?.sureCrit) return;
    if (!sureOrRolled(CombatFormulas.heroDodgeCritChance(hero))) return;
    note(hero, fight, 'sureCrit');
}

/** Whether a sure crit waits for the hero's next landed hit this fight. Draws nothing. */
export function sureCritWaits(fight, hero) {
    return !!notesFor(hero, fight)?.sureCrit;
}

/** The hero's waiting sure crit has landed: it is spent, and said before the hit's own event. */
export function spendSureCrit(fight, hero) {
    unnote(hero, fight, 'sureCrit');
    announce(fight, hero, TRICK.DODGE_CRIT);
}

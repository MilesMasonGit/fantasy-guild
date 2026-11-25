import { EFFECTS } from '../../config/registries/effectRegistry.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { isFightMoment } from '../../config/registries/triggerRegistry.js';
import { statementsFromEntry, statusBlockOf } from './effectLibrary.js';
import { ModifierAggregator } from './ModifierAggregator.js';
import { KEYWORD, statementsOf } from './statements.js';
import { registerProvides } from './providesModifiers.js';
import { enemyProfileOf } from '../../config/registries/enemyProfile.js';
import { enemyNumbers } from '../combat/CombatFormulas.js';

/**
 * An enemy's kinds that are library effects (`enemyProfile.kindEffects`, `enemyKinds.js`), carried
 * into every fight by the one road every effect's numbers take: their combat `Provides` go on the
 * fight's aggregator under {@link KINDS_SOURCE}, so Armoured's Crush 50 adds to the enemy's own
 * Crush line, Brute's Damage +33 % to a heavy strike's, and Swift's Attack Speed to an enrage's,
 * exactly as two effects on it would. Their fight-moment rules run as the enemy's passives
 * (`FightMoments`).
 *
 * Unlike the effects a Token's own rules name, which lend the hero fighting it their numbers
 * (`BoardCombat.applyEnemyCombatModifiers`), a kind is the enemy's own: it moves the enemy.
 */

/** The aggregator source an enemy's kinds are registered under: one per fight, replaced whole. */
export const KINDS_SOURCE = 'enemy:kinds';

/** Every statement an enemy's kind effects carry, stamped with the effect each comes from. */
export function kindStatements(effectIds, library = EFFECTS) {
    const out = [];
    for (const effectId of effectIds || []) {
        const entry = library?.[effectId];
        if (entry) out.push(...statementsFromEntry(entry, { effectId, scale: 1 }));
    }
    return out;
}

/** The rules an enemy's kinds wait on a fight moment with (its passives). */
export function kindRules(effectIds, library = EFFECTS) {
    return kindStatements(effectIds, library).filter(s => isFightMoment(s?.when?.event));
}

/** Put an enemy's kinds on an aggregator (a fight's), replacing whatever its kinds put there before. */
export function registerKinds(aggregator, effectIds, library = EFFECTS) {
    registerProvides(aggregator, KINDS_SOURCE, kindStatements(effectIds, library));
}

/**
 * An enemy as it stands out of a fight: its stat block with an aggregator holding its kinds alone,
 * so the card, the fight window before a fight and the CMS read the numbers a fight starts from
 * through the same formulas (`CombatFormulas.enemyTypeResistance`, `enemyAttackSpeedMs`, …).
 */
export function enemyAtRest(profile, library = EFFECTS) {
    if (!profile) return profile;
    const aggregator = new ModifierAggregator(`enemy_rest_${profile.id ?? ''}`);
    registerKinds(aggregator, profile.kindEffects, library);
    return { ...profile, aggregator };
}

/**
 * Whether a library effect can be an enemy's kind, for the CMS's kind boxes: not a status (a status
 * stacks and ends with its fight), with at least one rule, every rule a combat number the fight
 * reads (`heroOnly` in the palette) or a rule on a fight moment.
 */
export function isKindCandidate(entry) {
    if (!entry || statusBlockOf(entry)) return false;
    const statements = statementsOf(entry);
    if (!statements.length) return false;
    return statements.every(s => (s?.keyword === KEYWORD.PROVIDES && !s?.when?.event && !!getPaletteEntry(s?.payload?.type)?.heroOnly)
        || isFightMoment(s?.when?.event));
}

/**
 * An enemy Token's stat block with the numbers a fight starts from, its kinds' added
 * (`CombatFormulas.enemyNumbers` on {@link enemyAtRest}): the CMS's "what the fight uses".
 */
export function enemyFightNumbers(def, library = EFFECTS) {
    const profile = enemyProfileOf(def, library);
    if (!profile) return null;
    const n = enemyNumbers(enemyAtRest(profile, library));
    return {
        ...profile,
        hit: n.hit, attackSpeed: n.attackSpeedMs, dodge: n.dodge, accuracy: n.accuracy, critChance: n.critChance,
        resistances: n.resistances
    };
}

/** What an enemy's kind effects add to its resistances, by type (a weakness negative): for the CMS's rows. */
export function kindResistances(effectIds, library = EFFECTS) {
    return enemyNumbers(enemyAtRest({ kindEffects: effectIds, resistances: {} }, library)).resistances;
}

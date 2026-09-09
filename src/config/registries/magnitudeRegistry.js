// Fantasy Guild — where a number comes from (Effects Grammar v2, V5)

import { ROLE, getRole } from './roleRegistry.js';

/**
 * A magnitude that is **computed** rather than typed (G-13).
 *
 * ## Why this is a closed list and not arithmetic
 * The owner asked for scaling effects — *"damage equal to 10% of the target's
 * max HP"*, *"+1% per adjacent Coast Token"* — and explicitly declined a formula
 * box. The difference matters: a closed list still **renders as one honest
 * sentence** and still audits, where an expression tree does neither. So a
 * magnitude is one of exactly three shapes, and adding a fourth is a row here
 * with a reader, never a parser.
 *
 * ```
 * flat      5                          a number, typed
 * stat      10% of the target's max HP  a percentage of one named stat on one role
 * count     1% per adjacent Coast Token a per-match amount over a counted selector
 * ```
 *
 * ## ⚠️ `count` reads a SECOND selector, and that is the whole point (G-14)
 * *"+1% yield to every adjacent Token, per adjacent Coast Token"* counts one set
 * and affects another. They are genuinely different sets, and conflating them
 * would make the commonest shape of this effect unsayable — so a statement
 * carries a separate `counted` selector used only to produce the number.
 *
 * ## ⚠️ A stat says whose it is, and means it
 * These read the **actor** — the hero who caused the moment — and are named for
 * them. They were labelled *"the target's max HP"* and read the actor anyway,
 * which is only the same entity when the rule happens to aim at the actor too.
 * A rule dealing *"50% of the target's max HP"* **to the entity that caused
 * this** took its number off one hero and its damage to another, and the
 * sentence described neither.
 *
 * ⚠️ A live effect ticks with no actor at all, so an actor stat resolves to
 * nothing there. `statsForRoles` is what keeps it off that moment's picker.
 *
 * ## ⚠️ A stat row ships with a reader or not at all
 * Same discipline as every other vocabulary here. A stat that cannot be read off
 * the role it names is not offered, because a magnitude that silently resolves
 * to zero is the "authored but inert" failure wearing a number's clothes.
 */

export const MAGNITUDE_KIND = Object.freeze({
    FLAT: 'flat',
    STAT: 'stat',
    COUNT: 'count'
});

/**
 * The stats a magnitude may take a percentage of, and how to read each.
 *
 * `role` says whose stat it is, so the editor can refuse a stat whose role the
 * moment does not supply — the same G-2 rule the target vocabulary runs on.
 *
 * @type {ReadonlyArray<{id: string, label: string, role: string, hint: string,
 *   read: (entities: object) => number|null}>}
 */
export const MAGNITUDE_STATS = Object.freeze([
    {
        id: 'actor_max_hp',
        label: "the actor's max HP",
        role: ROLE.ACTOR,
        hint: 'Scales with how tough they are, so it stays relevant as heroes grow.',
        read: ({ actorHero }) => actorHero?.hp?.max ?? null
    },
    {
        id: 'actor_current_hp',
        label: "the actor's current HP",
        role: ROLE.ACTOR,
        hint: 'What they have left right now — an execute, or a mercy.',
        read: ({ actorHero }) => actorHero?.hp?.current ?? null
    },
    {
        id: 'actor_level',
        label: "the actor's level",
        role: ROLE.ACTOR,
        hint: 'Their overall level, averaged from their combat skills.',
        read: ({ actorHero }) => actorHero?.level ?? null
    },
    {
        id: 'self_charges',
        label: "this Token's remaining charges",
        role: ROLE.SELF,
        hint: 'How much it has left. A Token with unlimited charges reads as nothing.',
        // ⚠️ `null` is UNLIMITED (R-4), and an unlimited Token has no "amount
        // remaining" to be a percentage of. Reading it as a big number would
        // make an unlimited Token the strongest possible version of the effect.
        read: ({ selfInstance }) => selfInstance?.usesRemaining ?? null
    }
]);

/** One stat row, or null. */
export function getMagnitudeStat(id) {
    return MAGNITUDE_STATS.find(s => s.id === id) || null;
}

/** The stats whose role a given moment actually supplies (G-2). */
export function statsForRoles(availableRoles) {
    return MAGNITUDE_STATS.filter(s => availableRoles.includes(s.role));
}

/**
 * The magnitude a payload describes, resolved against the live world.
 *
 * @param {object} payload   the statement payload; `amount` is the base number
 * @param {object} entities  `{ actorHero, selfInstance }`
 * @param {number} matches   how many things the `counted` selector matched
 * @returns {number}
 */
export function resolveMagnitude(payload, entities = {}, matches = 0) {
    const base = Number(payload?.amount);
    if (!Number.isFinite(base)) return 0;

    switch (payload?.magnitude) {
        case MAGNITUDE_KIND.STAT: {
            const stat = getMagnitudeStat(payload.stat);
            const value = stat?.read(entities);
            /**
             * ⚠️ An unreadable stat is **zero**, never the base number.
             *
             * A rule saying "10% of the target's max HP" against nobody should
             * do nothing, not fall back to doing 10 damage. Silently swapping a
             * percentage for a flat amount is how a rule comes to mean something
             * nobody authored.
             */
            if (value == null) return 0;
            return (base / 100) * value;
        }
        case MAGNITUDE_KIND.COUNT:
            return base * matches;
        case MAGNITUDE_KIND.FLAT:
        default:
            return base;
    }
}

/**
 * "10% of the target's max HP" — the magnitude in words, or null for a flat one.
 *
 * Returns null rather than a number so the caller keeps its own formatting for
 * the ordinary case: a flat magnitude is rendered by whichever phrase already
 * knows whether it is a percentage, a multiplier or a count of damage.
 */
export function magnitudePhrase(payload, countedPhrase = '') {
    switch (payload?.magnitude) {
        case MAGNITUDE_KIND.STAT: {
            const stat = getMagnitudeStat(payload.stat);
            const amount = Number(payload.amount) || 0;
            return `${amount}% of ${stat ? stat.label : '…'}`;
        }
        case MAGNITUDE_KIND.COUNT:
            return countedPhrase ? `per ${countedPhrase}` : 'per …';
        default:
            return null;
    }
}

/** Whether a payload's magnitude needs the second, counted selector (G-14). */
export function usesCountedSelector(payload) {
    return payload?.magnitude === MAGNITUDE_KIND.COUNT;
}

/** Named for the CMS boundary check. */
export const MAGNITUDE_ROLES = Object.freeze({ getRole });

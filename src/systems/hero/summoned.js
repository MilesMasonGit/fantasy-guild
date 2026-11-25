// which records on the roster are Summoned workers, and which are the guild's heroes

/**
 * A Summoned worker is a record in `state.heroes` carrying a `summon` block (`board/Summons.js`):
 * ordered like a hero (the flag, the hero bar, the order rules), but holding only its own skills at
 * fixed levels, never gaining XP, wearing nothing, never fighting, and with no hero sheet. Every
 * hero-only path asks one of these, once. Pure: reads only the record it is handed.
 */

/** Whether a roster record is a Summoned worker. */
export function isSummoned(hero) {
    return !!hero && !!hero.summon && typeof hero.summon === 'object';
}

/**
 * Whether a record's skills never move: a Summoned worker, or a villager (an older record kind).
 * Such a record gains no XP, holds no perks and keeps the skill sheet it has.
 */
export function hasFixedSkills(hero) {
    return !!hero && (!!hero.isVillager || isSummoned(hero));
}

/** The guild's heroes among `records`: every one that is not a Summoned worker. */
export function guildHeroes(records) {
    return Array.isArray(records) ? records.filter(h => h && !isSummoned(h)) : [];
}

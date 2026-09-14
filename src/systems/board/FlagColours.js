// Fantasy Guild — each hero's lasting flag colour (Free Playmat slice 1.5b-ii, FP-82)

import { GameState } from '../../state/GameState.js';

/**
 * FlagColours — **a hero keeps one flag colour** (FP-82).
 *
 * * Saved on the hero as `hero.flagColour` (not stripped by `GameState.serialize`),
 *   so it survives a recall, a defeat and a save.
 * * **Given automatically at the first plant** (`Flags.plant` calls
 *   {@link ensureFlagColour}): the first colour of {@link FLAG_COLOURS} no other
 *   hero uses; once all eight are taken, the ninth hero onward reuses them in
 *   order.
 * * **Not tied to roster position**: reordering the Dock repaints nothing.
 * * Changeable in the Edit Hero modal (`HeroManager.updateHeroProfile`).
 * * A hero with no colour, or an unknown one, draws the plain base flag.
 *
 * ⚠️ The order below is a pick, not a ruling: the eight sprites are ordered so
 * the first heroes get clearly different hues (dark red, light blue, light
 * green, orange…) rather than two reds in a row.
 */
export const FLAG_COLOURS = Object.freeze([
    'reddark',
    'bluelite',
    'greenlite',
    'orange',
    'purplite',
    'yelpur',
    'greendark',
    'redlite'
]);

/** The plain flag, drawn for a hero with no (valid) colour. */
export const FLAG_BASE = 'base';

const FLAG_DIR = '/assets/ui/flag';

/** Whether a value is one of the eight flag colours. */
export function isFlagColour(value) {
    return typeof value === 'string' && FLAG_COLOURS.includes(value);
}

/** The sprite path for a colour; the base flag for anything else. */
export function flagSpritePath(colour) {
    return `${FLAG_DIR}/hero_flag_${isFlagColour(colour) ? colour : FLAG_BASE}.png`;
}

function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/** A hero's flag colour, or null if they have none yet. */
export function flagColourOf(heroId) {
    const colour = heroRecord(heroId)?.flagColour;
    return isFlagColour(colour) ? colour : null;
}

/**
 * The colour a new hero would be given: the first no other hero uses, else
 * reuse in order by how many heroes already hold one.
 */
export function nextFlagColour(exceptHeroId = null) {
    const others = (GameState.state?.heroes || [])
        .filter(h => h && h.id !== exceptHeroId && isFlagColour(h.flagColour));
    const used = new Set(others.map(h => h.flagColour));
    const free = FLAG_COLOURS.find(c => !used.has(c));
    return free || FLAG_COLOURS[others.length % FLAG_COLOURS.length];
}

/**
 * Give the hero a colour if they have none (the first plant). A hero who
 * already has one keeps it.
 *
 * @returns {string|null} the hero's colour, or null for no such hero
 */
export function ensureFlagColour(heroId) {
    const hero = heroRecord(heroId);
    if (!hero) return null;
    if (!isFlagColour(hero.flagColour)) hero.flagColour = nextFlagColour(heroId);
    return hero.flagColour;
}

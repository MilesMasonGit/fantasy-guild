// each hero's lasting flag colour

import { GameState } from '../../state/GameState.js';

/**
 * A hero keeps one flag colour, saved as `hero.flagColour` (survives a recall, a defeat and a
 * save), and their job flag is filled with it everywhere it is drawn (`FlagMark`).
 *
 * Given automatically ({@link ensureFlagColour}) when the hero joins the roster, to every hero of
 * an older save on load ({@link assignFlagColours}, in roster order), and at a plant as a last
 * resort: the first of {@link FLAG_COLOURS} no other hero uses; once all eight are taken, reused in
 * order. A hero with no colour, or an unknown one, draws the pale base flag.
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

/**
 * Each colour's fill, taken from the cloth of its old flag sprite and checked against every mat
 * ground (grass, dark grass, dirt, sand, gravel, stone, water): the near-black edge carries the
 * shape, the fill only has to read as itself.
 * ⚠️ `greendark` is drawn pink (owner, 2026-10-29): a green flag all but vanished on grass. The
 * saved name stays, so saves keep their colour.
 */
export const FLAG_FILLS = Object.freeze({
    reddark: '#b3202a',
    bluelite: '#98d5e7',
    greenlite: '#a6e36b',
    orange: '#ff943a',
    purplite: '#b05be0',
    yelpur: '#fac900',
    greendark: '#ff7ad9',
    redlite: '#fd3c35',
    [FLAG_BASE]: '#e9dfc4'
});

/** The fill a flag of this colour is drawn with; the base flag's pale bone for anything else. */
export function flagFill(colour) {
    return FLAG_FILLS[isFlagColour(colour) ? colour : FLAG_BASE];
}

/** A readable name for each colour, for the Edit Hero swatches' labels. */
export const FLAG_COLOUR_LABELS = Object.freeze({
    reddark: 'Dark red',
    bluelite: 'Light blue',
    greenlite: 'Light green',
    orange: 'Orange',
    purplite: 'Purple',
    yelpur: 'Yellow',
    greendark: 'Pink',
    redlite: 'Red'
});

/** Whether a value is one of the eight flag colours. */
export function isFlagColour(value) {
    return typeof value === 'string' && FLAG_COLOURS.includes(value);
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

/** Give every hero without a colour one, in roster order (an older save, loaded). */
export function assignFlagColours() {
    for (const hero of GameState.state?.heroes || []) {
        if (hero?.id) ensureFlagColour(hero.id);
    }
}

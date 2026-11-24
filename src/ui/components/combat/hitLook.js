import { FX_FRAME_MS } from '../board/fx/pixelSteps.js';
import { STRIKE_DELAY_MS } from '../board/hitAnimations.js';
import { CALLOUT_MS } from '../board/callouts.js';
import { GLYPH_COLOUR } from './combatGlyphs.js';
import { MOMENT, statusIcon } from './fightWatch.js';

/**
 * How a hit looks and how long it shows, the one set the fight window (`FightPanel`'s battle) and
 * the mat (`fightFloats.js`, `CalloutLayer`) both draw from: what landed, an enemy's move by name,
 * and a Venom or Burn tick with its drop or flame.
 */

/**
 * Whether a hero's blow on the enemy shows on the strike frame of their swing (true), when the
 * blade lands, or the moment the engine says it landed (false). Enemies' blows and ticks always
 * show at once.
 */
export const HIT_ON_STRIKE_FRAME = true;

/** How long what landed shows over its fighter, in ms. */
export const LANDED_MS = 8 * FX_FRAME_MS;

/** How long an enemy's move by name shows in its bubble: as long as every bubble the mat says. */
export const MOVE_MS = CALLOUT_MS;

/** How long after the moment arrives what landed first shows, in ms. */
export function landedDelayMs(m) {
    return HIT_ON_STRIKE_FRAME && m?.by === 'hero' && m?.on === 'enemy' ? STRIKE_DELAY_MS : 0;
}

/** Each tone as a CSS colour, a glyph colour and the mat float's class. */
export const LANDED_TONE = Object.freeze({
    white: Object.freeze({ css: 'var(--color-ui-white)', glyph: GLYPH_COLOUR.white, cls: 'gi-ff-white' }),
    red: Object.freeze({ css: 'var(--color-ui-red)', glyph: GLYPH_COLOUR.red, cls: 'gi-ff-red' }),
    green: Object.freeze({ css: 'var(--color-ui-green)', glyph: GLYPH_COLOUR.green, cls: 'gi-ff-green' })
});

/** A moment's tone: a heal green, a tick red on anyone, a blow red on the hero and white on the enemy. */
export function landedToneName(m) {
    if (m?.kind === MOMENT.HEAL) return 'green';
    if (m?.kind === MOMENT.TICK) return 'red';
    return m?.on === 'hero' ? 'red' : 'white';
}

/** The glyph beside a moment's number: a tick's drop or flame (`statusIcon`), else none. */
export function landedIcon(m) {
    return m?.kind === MOMENT.TICK ? statusIcon(m.statusId) : null;
}

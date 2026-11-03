import { FX_FRAME_MS } from './pixelSteps.js';
import { fxInt, seedOf } from './fxRandom.js';
import { spriteOf } from './spriteCopy.js';
import { poseTransform } from './clockPoses.js';
import { onDue } from '../frameClock.js';

/**
 * Strike chips: on every strike of a worked Token, a few single pixels in a colour of what is
 * being worked pop off the side the blow lands on and fall, gone in four frames. The code-only
 * stand-in for the owner's strike art (leaves, rock chips, sparks).
 * The chips are made when the work starts and taken away when it stops; between strikes they are
 * hidden and nothing plays. A strike's frames are written on the mat's shared clock
 * (`frameClock.onDue`); not an animation, for the reason in `clockPoses.js`.
 */

/** The chips' colour, per skill: bark, ore, water, straw, sparks, shavings, steam, dust. */
export const CHIP_COLOURS = Object.freeze({
    forestry: '#8b5a2b',
    mining: '#9ca3af',
    fishing: '#60a5fa',
    farming: '#d6b656',
    smithing: '#fbbf24',
    crafting: '#c08a5a',
    cooking: '#e5e7eb',
    construction: '#a8a29e'
});

/** Each chip's path, art pixels from where the blow lands, `x` away from the hero; one pose a frame. */
const PATHS = Object.freeze([
    [[0, 0], [2, -3], [3, -2], [4, 1]],
    [[0, 0], [1, -4], [2, -4], [2, -1]],
    [[0, 0], [3, -1], [5, 0], [6, 2]]
]);
export const CHIP_COUNT = PATHS.length;
const PATH_FRAMES = PATHS[0].length;
export const CHIP_MS = PATH_FRAMES * FX_FRAME_MS;

/**
 * Start the chips on a worked Token's hit wrapper.
 * @param {HTMLElement} wrapper the Token's hit wrapper (`TokenHitArt`)
 * @param {object} options
 * @param {string} options.skill the skill worked (its colour)
 * @param {number} options.firstStrike `performance.now()` time of a strike (the loop's start)
 * @param {number} options.periodMs time between strikes
 * @param {() => number} options.dir +1 when the hero stands left of the Token, -1 when right
 * @param {number} options.unit mat units per art pixel
 * @param {string} options.seed what the scatter is fixed by (the Token's id)
 * @returns {(() => void) & {strike: () => void}} stop: the chips are taken away; `strike` plays
 *          one strike's chips now
 */
export function startStrikeChips(wrapper, { skill, firstStrike, periodMs, dir, unit = 1, seed = '' }) {
    const colour = CHIP_COLOURS[String(skill || '').toLowerCase()];
    const sprite = spriteOf(wrapper);
    if (!colour || !sprite || typeof document === 'undefined') return () => {};
    const chips = PATHS.map(() => {
        const el = document.createElement('span');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('data-fx-chip', skill);
        Object.assign(el.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${unit}px`,
            height: `${unit}px`,
            background: colour,
            pointerEvents: 'none',
            visibility: 'hidden'
        });
        wrapper.appendChild(el);
        return el;
    });
    const base = seedOf(seed);
    let strike = 0;
    /** The strike playing: per chip, its transform in each frame. */
    let frames = null;
    let startedAt = 0;
    let drawn = -1;
    const start = (now) => {
        const d = dir() < 0 ? -1 : 1;
        // Where the blow lands: a quarter of the art across, towards the hero, a little above the middle.
        const fromX = Math.round(-d * sprite.size / 4 / unit);
        const fromY = -Math.round(sprite.size / 8 / unit);
        frames = PATHS.map((path, i) => {
            const jx = fxInt(base, strike * CHIP_COUNT + i, -1, 1);
            return path.map(([x, y], k) => poseTransform(fromX + d * (x + (k ? jx : 0)), fromY + y, unit));
        });
        startedAt = now;
        drawn = -1;
        strike += 1;
    };
    /** The strike's frame at `now`, written if it changed. Returns when the next one is due. */
    const drawStrike = (now) => {
        if (!frames) return Infinity;
        const k = Math.floor((now - startedAt) / FX_FRAME_MS);
        if (k >= PATH_FRAMES) {
            for (const el of chips) el.style.visibility = 'hidden';
            frames = null;
            return Infinity;
        }
        if (k !== drawn) {
            drawn = k;
            chips.forEach((el, i) => {
                el.style.transform = frames[i][k];
                el.style.visibility = 'visible';
            });
        }
        return startedAt + (k + 1) * FX_FRAME_MS;
    };
    const next = (now) => firstStrike + Math.ceil((now - firstStrike) / periodMs) * periodMs;
    let nextStrike = next(performance.now());
    const step = (now) => {
        if (now >= nextStrike) {
            start(now);
            nextStrike = next(now + 1);
        }
        return Math.min(drawStrike(now), nextStrike);
    };
    const off = onDue(step, nextStrike);
    const stop = () => {
        off();
        for (const el of chips) el.remove();
    };
    /** One strike's chips now, off the beat. */
    const play = () => {
        const now = performance.now();
        start(now);
        onDue(step, Math.min(drawStrike(now), nextStrike));
    };
    stop.strike = play;
    return stop;
}

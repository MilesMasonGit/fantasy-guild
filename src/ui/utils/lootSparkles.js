/**
 * Collected loot's sparkles (`ParticleOverlay`): a light sprinkle left behind the flying item, and a
 * shower spilling out of the item notice it lands on, longer and denser for a bigger stack.
 * Nothing random: where every sparkle is comes from the flight's own seed and the time, so the same
 * flight draws the same pixels at any frame rate. A sparkle steps through three looks and is gone:
 * a plus of five art pixels with a lighter heart, then one pixel, then one dimmer pixel.
 */

/** A sparkle's pixel, in screen px: the game's art pixel at its natural 2x. */
export const SPARKLE_ART_PX = 2;

/** Sparkles are given out on this beat, so how many there are does not follow the frame rate. */
export const SPARKLE_EMIT_STEP_MS = 16;

/** How long one shower sparkle lives. */
export const SHOWER_SPARKLE_LIFE_MS = 420;

/**
 * The landing shower, per stack step (index 0: a stack of 1 to 9, one shadow; index 6: 1,000,000 and
 * more, seven): how long the notice keeps spilling sparkles, in ms...
 */
export const LANDING_SHOWER_MS = Object.freeze([240, 320, 420, 540, 680, 840, 1000]);
/** ...and how many it spills on each beat ({@link SPARKLE_EMIT_STEP_MS}). */
export const LANDING_SHOWER_PER_BEAT = Object.freeze([1, 1, 2, 2, 3, 4, 5]);

/** The flight's sprinkle: one sparkle every this many ms of flight, whatever the stack. */
export const FLIGHT_SPARKLE_EVERY_MS = 48;
/** How long a flight sparkle lives; it starts as one pixel (no plus), so it reads fainter. */
export const FLIGHT_SPARKLE_LIFE_MS = 300;

/** Shower sparkles fall: px per ms per ms. */
const GRAVITY = 0.0004;
/** Shower sparkles leave from under the notice's sprite, across this width (the sprite's). */
const SHOWER_SPAN_PX = 32;
/** A shower sparkle's speed as it leaves, px per ms: mostly out over the mat (left), and down. */
const SHOWER_VX = { min: -0.15, max: 0.03 };
const SHOWER_VY = { min: 0.02, max: 0.1 };
/** Flight sparkles: scattered over this share of the item's size round its centre, sinking slowly. */
const FLIGHT_SCATTER = 0.5;
const FLIGHT_SINK = 0.04;

/**
 * How far a shower reaches from where it starts, in px (a sparkle's own half-size added): the canvas
 * must cover it. ⚠️ Follows the numbers above: `ParticleCanvasBounds.test.js` fails when a sparkle is
 * drawn outside the canvas.
 */
export const SHOWER_REACH = Object.freeze({
    left: Math.ceil(SHOWER_SPAN_PX / 2 - SHOWER_VX.min * SHOWER_SPARKLE_LIFE_MS) + 2 * SPARKLE_ART_PX,
    right: Math.ceil(SHOWER_SPAN_PX / 2 + SHOWER_VX.max * SHOWER_SPARKLE_LIFE_MS) + 2 * SPARKLE_ART_PX,
    down: Math.ceil(SHOWER_VY.max * SHOWER_SPARKLE_LIFE_MS + GRAVITY * SHOWER_SPARKLE_LIFE_MS ** 2 / 2) + 3 * SPARKLE_ART_PX
});
/** How far below its path a flight sparkle can sink, its half-size added. */
export const FLIGHT_SPARKLE_SINK_PX = Math.ceil(FLIGHT_SINK * FLIGHT_SPARKLE_LIFE_MS) + 2 * SPARKLE_ART_PX;

/** A step 1 to 7, as the shadow count gives it, clamped. */
const stepIndex = (step) => Math.max(0, Math.min(LANDING_SHOWER_MS.length - 1, (step | 0) - 1));

/** How many beats a shower spills on. */
const showerBeats = (step) => Math.ceil(LANDING_SHOWER_MS[stepIndex(step)] / SPARKLE_EMIT_STEP_MS);

/** From the landing to the shower's last sparkle gone, in ms: its last beat, and a life. */
export const showerLengthMs = (step) => (showerBeats(step) - 1) * SPARKLE_EMIT_STEP_MS + SHOWER_SPARKLE_LIFE_MS;

/** How many sparkles a whole shower spills. */
export function showerSparkleCount(step) {
    return showerBeats(step) * LANDING_SHOWER_PER_BEAT[stepIndex(step)];
}

/** How many sparkles a flight of `durationMs` sprinkles. */
export const flightSparkleCount = (durationMs) => Math.ceil(durationMs / FLIGHT_SPARKLE_EVERY_MS);

/** A fixed hash to [0, 1). */
function hash(n) {
    let x = Math.imul(n | 0, 374761393) + 668265263;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
}
const between = (r, { min, max }) => min + r * (max - min);

/** A sparkle's look at `age` of `life`: 0 the plus, 1 one pixel, 2 one dimmer pixel. */
export function sparkleStage(age, life) {
    const p = age / life;
    return p < 0.4 ? 0 : p < 0.75 ? 1 : 2;
}

/**
 * Every shower sparkle alive `sinceLandMs` after the landing, relative to where the shower starts
 * (the middle of the notice's bottom edge under its sprite): `fn(dx, dy, stage)`. `dy` is never
 * negative, so no sparkle rises into the notice or over its count.
 */
export function forEachShowerSparkle(sinceLandMs, step, seed, fn) {
    if (!(sinceLandMs >= 0)) return;
    const i = stepIndex(step);
    const dur = LANDING_SHOWER_MS[i];
    const per = LANDING_SHOWER_PER_BEAT[i];
    const first = Math.max(0, Math.floor((sinceLandMs - SHOWER_SPARKLE_LIFE_MS) / SPARKLE_EMIT_STEP_MS));
    for (let k = first; k * SPARKLE_EMIT_STEP_MS < dur && k * SPARKLE_EMIT_STEP_MS <= sinceLandMs; k++) {
        const age = sinceLandMs - k * SPARKLE_EMIT_STEP_MS;
        if (age >= SHOWER_SPARKLE_LIFE_MS) continue;
        for (let m = 0; m < per; m++) {
            const j = (seed * 4099 + k * 8 + m) * 3;
            const x0 = (hash(j) - 0.5) * SHOWER_SPAN_PX;
            const vx = between(hash(j + 1), SHOWER_VX);
            const vy = between(hash(j + 2), SHOWER_VY);
            fn(x0 + vx * age, vy * age + (GRAVITY * age * age) / 2, sparkleStage(age, SHOWER_SPARKLE_LIFE_MS));
        }
    }
}

/**
 * Every flight sparkle alive `flightMs` into a flight of `durationMs` (it keeps counting past the
 * landing, while the last ones fade): `fn(x, y, stage)` in screen px. `pointAt(k)` is the flight's
 * point at `k` (0 to 1); `size` the item's size.
 */
export function forEachFlightSparkle(flightMs, durationMs, size, seed, pointAt, fn) {
    if (!(flightMs >= 0)) return;
    const first = Math.max(0, Math.floor((flightMs - FLIGHT_SPARKLE_LIFE_MS) / FLIGHT_SPARKLE_EVERY_MS));
    for (let k = first; k * FLIGHT_SPARKLE_EVERY_MS < durationMs && k * FLIGHT_SPARKLE_EVERY_MS <= flightMs; k++) {
        const born = k * FLIGHT_SPARKLE_EVERY_MS;
        const age = flightMs - born;
        if (age >= FLIGHT_SPARKLE_LIFE_MS) continue;
        const j = (seed * 4099 + k) * 3 + 1;
        const at = pointAt(born / durationMs);
        const reach = size * FLIGHT_SCATTER / 2;
        fn(at.x + (hash(j) * 2 - 1) * reach, at.y + (hash(j + 1) * 2 - 1) * reach + FLIGHT_SINK * age,
            age / FLIGHT_SPARKLE_LIFE_MS < 0.5 ? 1 : 2);
    }
}

const mix = (rgb, to, f) => rgb.map((v, i) => Math.round(v + (to[i] - v) * f));
const hex = (rgb) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const WHITE = [255, 255, 255];

/**
 * A sparkle's colours from one base colour, worked out once: the plus's heart (nearly white), the
 * plus and the pixel (the colour lightened toward white), the dimmer pixel (the colour itself).
 * @returns {{ heart: string, light: string, dim: string }}
 */
export function sparkleColours(rgb) {
    return { heart: hex(mix(rgb, WHITE, 0.8)), light: hex(mix(rgb, WHITE, 0.45)), dim: hex(rgb) };
}

/**
 * Which colour the sparkles take: `'item'`, the item's primary colour lightened (the default), or
 * `'stack'`, the stack's colour from {@link STACK_SPARKLE_COLOURS} (the comparison page's look).
 */
export const SPARKLE_COLOUR_SOURCE = 'item';

/**
 * The stack colours (concept §2), per step: grey, blue, green, gold, then red for 10,000 and more.
 * Worked out once, here.
 */
export const STACK_SPARKLE_COLOURS = Object.freeze(
    [[160, 160, 160], [59, 158, 255], [9, 181, 84], [251, 191, 36], [255, 45, 85], [255, 45, 85], [255, 45, 85]]
        .map(sparkleColours)
);

/** The stack colours for a step 1 to 7. */
export const stackSparkleColours = (step) => STACK_SPARKLE_COLOURS[stepIndex(step)];

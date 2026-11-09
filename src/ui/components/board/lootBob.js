import { onDue } from './frameClock.js';

/**
 * Floor loot's bob: items hover, Tokens rest (`tailwind.css`, "Items hover"). The art rises and
 * sinks through fourteen stops, each pile on its own phase from when it landed; its hard shadow
 * stays on the ground (`TokenSprite`'s layered art), so only the art moves.
 * ⚠️ Every stop is a whole ART pixel at the mat's live fit (`unit` mat units each, the board's
 * `boardScaleAt(fit)`), so it moves the art a whole number of screen pixels. A whole mat unit is
 * a fraction of a screen pixel: art moved by one is resampled, and some stops drew it a row
 * short (it pinched).
 * ⚠️ Written on the shared sprite clock, never a CSS animation. A keyframed transform gets a
 * composited layer per pile, and everything drawn after it (the next pile, its quantity badge, the
 * work plates) another for overlap: 39 piles were 98 more layers, which every frame pays for
 * whatever else is moving. Written here, a pile is plain paint, and only in the frames where its
 * stop changes.
 */

/** How high a pile floats at each stop, in art pixels above its rest. Each is held for {@link BOB_STOP_MS}. */
export const BOB_STOPS = Object.freeze([1, 1, 2, 2, 3, 3, 4, 4, 4, 3, 3, 2, 2, 1]);
export const BOB_STOP_MS = 140;
export const BOB_PERIOD_MS = BOB_STOPS.length * BOB_STOP_MS;
/** With reduced motion a pile is held this high, in art pixels: it still floats, it does not bob. */
export const BOB_HOLD = 3;
/**
 * A pile's phase starts on this grid, a quarter of a stop: too fine to see, and every pile's stops
 * then fall on the same few frames. A frame that writes costs a full pass of Chrome's pipeline however
 * little it wrote, so forty piles writing whenever they please would cost it nearly every frame.
 */
export const BOB_PHASE_GRID_MS = 35;

/** The height, in art pixels, `elapsedMs` after a pile landed. */
export function bobAt(elapsedMs) {
    const into = ((elapsedMs % BOB_PERIOD_MS) + BOB_PERIOD_MS) % BOB_PERIOD_MS;
    return BOB_STOPS[Math.floor(into / BOB_STOP_MS)];
}

/** The transform raising the art `artPx` art pixels, at `unit` mat units an art pixel. */
export const bobTransform = (artPx, unit) => `translateY(${-artPx * unit}px)`;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Bob `el` from now on. With reduced motion it is held {@link BOB_HOLD} art pixels up instead, and
 * nothing more is written.
 * @param {HTMLElement} el the box holding the art (not its shadow)
 * @param {number} unit mat units per art pixel: `boardScaleAt(fit)`
 * @returns {() => void} stop
 */
export function startBob(el, unit) {
    if (!el) return () => {};
    if (reducedMotion()) {
        el.style.transform = bobTransform(BOB_HOLD, unit);
        return () => {};
    }
    const landed = performance.now();
    const bornAt = Math.floor(landed / BOB_PHASE_GRID_MS) * BOB_PHASE_GRID_MS;
    let shown = null;
    const draw = (now) => {
        const height = bobAt(now - bornAt);
        if (height !== shown) {
            shown = height;
            el.style.transform = bobTransform(height, unit);
        }
        return bornAt + (Math.floor((now - bornAt) / BOB_STOP_MS) + 1) * BOB_STOP_MS;
    };
    return onDue(draw, draw(landed));
}

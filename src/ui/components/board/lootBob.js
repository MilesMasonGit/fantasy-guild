import { onDue } from './frameClock.js';

/**
 * Floor loot's bob: items hover, Tokens rest (`tailwind.css`, "Items hover"). The art and its shadow
 * rise and sink through fourteen whole-pixel stops, each pile on its own phase from when it landed.
 * ⚠️ Written on the shared sprite clock, never a CSS animation. A keyframed transform gets a
 * composited layer per pile, and everything drawn after it (the next pile, its quantity badge, the
 * work plates) another for overlap: 39 piles were 98 more layers, which every frame pays for
 * whatever else is moving. Written here, a pile is plain paint, and only in the frames where its
 * stop changes.
 */

/** One pile's offsets, in the pile's own pixels. Each is held for {@link BOB_STOP_MS}. */
export const BOB_STOPS = Object.freeze([-3, -4, -5, -6, -7, -8, -9, -9, -8, -7, -6, -5, -4, -3]);
export const BOB_STOP_MS = 140;
export const BOB_PERIOD_MS = BOB_STOPS.length * BOB_STOP_MS;
/**
 * A pile's phase starts on this grid, a quarter of a stop: too fine to see, and every pile's stops
 * then fall on the same few frames. A frame that writes costs a full pass of Chrome's pipeline however
 * little it wrote, so forty piles writing whenever they please would cost it nearly every frame.
 */
export const BOB_PHASE_GRID_MS = 35;

/** The offset `elapsedMs` after a pile landed. */
export function bobAt(elapsedMs) {
    const into = ((elapsedMs % BOB_PERIOD_MS) + BOB_PERIOD_MS) % BOB_PERIOD_MS;
    return BOB_STOPS[Math.floor(into / BOB_STOP_MS)];
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Bob `el` from now on. With reduced motion it writes nothing: the CSS rule holds the pile raised.
 * @param {HTMLElement} el the box holding the art and its shadow
 * @returns {() => void} stop
 */
export function startBob(el) {
    if (!el || reducedMotion()) return () => {};
    const landed = performance.now();
    const bornAt = Math.floor(landed / BOB_PHASE_GRID_MS) * BOB_PHASE_GRID_MS;
    let shown = null;
    const draw = (now) => {
        const offset = bobAt(now - bornAt);
        if (offset !== shown) {
            shown = offset;
            el.style.transform = `translateY(${offset}px)`;
        }
        return bornAt + (Math.floor((now - bornAt) / BOB_STOP_MS) + 1) * BOB_STOP_MS;
    };
    return onDue(draw, draw(landed));
}

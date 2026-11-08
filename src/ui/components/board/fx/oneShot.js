import { isDrawingPaused } from '../frameClock.js';

/** How long past its end a one-shot effect waits for its animation to report done before it ends itself. */
export const ONE_SHOT_SPARE_MS = 1000;

/**
 * `el.animate(keyframes, timing)`, or null with nothing made: while drawing is paused (a hidden
 * or minimised window), or where the element cannot animate. Every one-shot animation in the game
 * starts here, and each caller takes null as "draw nothing".
 * ⚠️ Chrome keeps every animation started in a hidden page, and the element it plays on, until the
 * page draws a frame again, even once that element is taken away: a hidden page that kept starting
 * them (the loot hopping out of its Tokens) piled up thousands of detached elements.
 * @param {Element|null} el
 * @param {Keyframe[]} keyframes
 * @param {KeyframeAnimationOptions} timing
 * @returns {Animation|null}
 */
export function animateFx(el, keyframes, timing) {
    if (!el || typeof el.animate !== 'function' || isDrawingPaused()) return null;
    return el.animate(keyframes, timing);
}

/**
 * Call `done` once, when `anim` finishes or is cancelled, or at the latest `endsInMs` plus
 * {@link ONE_SHOT_SPARE_MS} from now (then the animation is cancelled too).
 * ⚠️ A window hidden while an effect plays draws no frames, so that animation never finishes and an
 * element taken away only on `onfinish` would stay on the page: a timer still runs hidden
 * (throttled), so it takes it away.
 * @param {Animation} anim
 * @param {number} endsInMs the animation's delay plus its duration
 * @param {() => void} done
 */
export function whenOver(anim, endsInMs, done) {
    let timer = null;
    let over = false;
    const end = () => {
        if (over) return;
        over = true;
        if (timer !== null) clearTimeout(timer);
        done();
    };
    anim.onfinish = end;
    anim.oncancel = end;
    if (Number.isFinite(endsInMs)) {
        timer = setTimeout(() => {
            timer = null;
            end();
            anim.cancel?.();
        }, Math.max(0, endsInMs) + ONE_SHOT_SPARE_MS);
    }
}

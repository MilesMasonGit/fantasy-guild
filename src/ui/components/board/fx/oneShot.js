/** How long past its end a one-shot effect waits for its animation to report done before it ends itself. */
export const ONE_SHOT_SPARE_MS = 1000;

/**
 * Call `done` once, when `anim` finishes or is cancelled, or at the latest `endsInMs` plus
 * {@link ONE_SHOT_SPARE_MS} from now (then the animation is cancelled too).
 * ⚠️ A hidden window draws no frames, so its animations never finish and an element taken away only
 * on `onfinish` stays on the page: a timer still runs hidden (throttled), so it takes it away.
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

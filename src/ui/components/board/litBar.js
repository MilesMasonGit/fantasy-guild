import { onStep } from './frameClock.js';
import { filledSteps } from './workBar.js';
import { countdownText } from '../../../utils/Formatters.js';

/**
 * A shrine's lit bar: how much of its most lit time is left, draining as it burns down, beside the
 * time left (`countdownText`, the card's words). Told the lit time when the engine says one
 * (`SHRINE_LIT`, a load) and run on from there by the clock between engine events, as the work bar
 * runs a cycle on: a shrine burns at game speed, which is the clock's.
 * ⚠️ Written on the shared step clock (`frameClock.onStep`), and only when the filled length or the
 * second shown changes; nothing runs while it is out or has no element.
 */
export function createLitBar(now = () => performance.now()) {
    let bar = null;
    let text = null;
    let steps = 24;
    let litMs = 0;
    let maxLitMs = 0;
    let stamp = 0;
    let drawnFill = null;
    let drawnText = null;
    let offStep = null;

    const leftAt = (t) => Math.max(0, litMs - Math.max(0, t - stamp));

    const paint = (t) => {
        const left = leftAt(t);
        const n = maxLitMs > 0 ? filledSteps(left / maxLitMs, steps) : 0;
        if (bar && n !== drawnFill) {
            drawnFill = n;
            bar.style.setProperty('--work-bar-fill', String(n / steps));
            bar.setAttribute('data-work-bar-fill', String(n));
        }
        const words = left > 0 ? countdownText(left) : '';
        if (text && words !== drawnText) {
            drawnText = words;
            text.textContent = words;
        }
        if (left <= 0) listen(false);
    };

    function listen(on = litMs > 0 && (bar || text)) {
        if (on && !offStep) offStep = onStep(paint);
        else if (!on && offStep) {
            offStep();
            offStep = null;
        }
    }

    return {
        /** The bar's track and its time's element (either may be null), the track `length` art pixels long. */
        attach(nextBar, nextText, length = steps) {
            bar = nextBar || null;
            text = nextText || null;
            steps = length;
            drawnFill = null;
            drawnText = null;
            paint(now());
            listen();
        },
        /** The engine's lit time now: `{ litMs, maxLitMs }`. */
        set(state) {
            litMs = Math.max(0, Number(state?.litMs) || 0);
            maxLitMs = Math.max(0, Number(state?.maxLitMs) || 0);
            stamp = now();
            paint(stamp);
            listen();
        },
        /** How much is left at time `t`. */
        read(t = now()) {
            return { litMs: leftAt(t), maxLitMs };
        },
        dispose() {
            bar = null;
            text = null;
            listen(false);
        }
    };
}

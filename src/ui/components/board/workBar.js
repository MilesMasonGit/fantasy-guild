import { onStep } from './frameClock.js';

/**
 * The work bar: a thin bar along a worked Token's foot that fills once each work cycle, in whole
 * art pixels.
 * ⚠️ A running bar is written on the shared step clock (`frameClock.onStep`: ten steps a second,
 * every bar in the same frame) and only when its filled length changes by an art pixel; an engine
 * event only moves the model. Bars written on frames of their own (a CSS animation per bar runs
 * out of phase with every other) would put a repaint in nearly every frame of play, the cost the
 * cycle ring was moved onto this clock to stop. The fill is the bar's own `::after`
 * (`.gi-work-bar`, tailwind.css), scaled by `--work-bar-fill`: one element, no layout.
 */

/** The bar's size in art pixels on a full-size Token; a small Token's is half as wide. */
export const WORK_BAR_ART_W = 40;
export const WORK_BAR_ART_H = 2;
/** How far the bar sits up from the bottom of the Token's box, in art pixels. */
export const WORK_BAR_ART_LIFT = 2;

/**
 * Where the bar sits in a Token's box, in mat units, and how many art pixels long it is
 * (`steps`): centred, along the foot of the art. `artUnit` is one art pixel in mat units
 * (`boardScaleAt(fit)`); `artPx` is how big the art is drawn, centred in the box (smaller than
 * the box when the mat is drawn small, so the box's own bottom would leave the bar floating
 * below the art).
 * @returns {{left: number, top: number, width: number, height: number, steps: number}}
 */
export function workBarPlace(boxPx, artUnit, small = false, artPx = boxPx) {
    const steps = small ? WORK_BAR_ART_W / 2 : WORK_BAR_ART_W;
    const width = steps * artUnit;
    const height = WORK_BAR_ART_H * artUnit;
    const foot = (boxPx + Math.min(artPx, boxPx)) / 2;
    return {
        left: (boxPx - width) / 2,
        top: foot - height - WORK_BAR_ART_LIFT * artUnit,
        width,
        height,
        steps
    };
}

/** How many of `steps` art pixels a fraction fills. */
export const filledSteps = (fraction, steps) => Math.floor(Math.max(0, Math.min(1, Number(fraction) || 0)) * steps + 1e-9);

/**
 * One Token's bar as a model its engine events drive, painted onto whichever element is attached
 * (the element comes and goes with a drag; the model stays with the Token). `now()` is the clock
 * between engine ticks (`performance.now()` in the game).
 */
export function createWorkBar(now = () => performance.now()) {
    let el = null;
    let steps = WORK_BAR_ART_W;
    // The cycle as last told: `elapsed` at `stamp`; while `running` it moves on with the clock up
    // to `cycleMs`, stopped it holds.
    let cycleMs = null;
    let running = false;
    let elapsed = 0;
    let stamp = 0;
    let fraction = 0;
    let drawn = null;
    let offStep = null;

    const elapsedAt = (t) => (running && cycleMs ? Math.min(cycleMs, elapsed + Math.max(0, t - stamp)) : elapsed);

    /** Write the bar, only when its filled length changed (or the element is new). */
    const paint = (t) => {
        if (!el) return;
        if (cycleMs) fraction = elapsedAt(t) / cycleMs;
        const n = filledSteps(fraction, steps);
        if (n === drawn) return;
        drawn = n;
        el.style.setProperty('--work-bar-fill', String(n / steps));
        el.setAttribute('data-work-bar-fill', String(n));
    };

    const run = () => {
        running = true;
        if (!offStep) offStep = onStep(paint);
    };
    const stop = () => {
        elapsed = elapsedAt(now());
        running = false;
        offStep?.();
        offStep = null;
    };

    return {
        /** The bar's element (or null), `steps` art pixels long: a new element is drawn at once. */
        attach(next, length = steps) {
            el = next || null;
            steps = length;
            drawn = null;
            paint(now());
        },
        /**
         * The engine's progress on a plain cycle: `{ elapsedMs, cycleTimeMs, percent }`. With no
         * cycle length (a promotion's payload, a reset) the bar holds at `percent`. `live`: a
         * hero works it, so it runs on between ticks.
         */
        progress(p, live) {
            if (p?.cycleTimeMs) cycleMs = p.cycleTimeMs;
            elapsed = p?.elapsedMs != null ? p.elapsedMs : cycleMs ? ((p?.percent || 0) / 100) * cycleMs : 0;
            stamp = now();
            if (!cycleMs) {
                fraction = (p?.percent || 0) / 100;
                paint(stamp);
                return;
            }
            if (live) run();
            else paint(stamp);
        },
        /** A cycle finished: empty again, running on if `live`. */
        complete(live) {
            elapsed = 0;
            stamp = now();
            if (cycleMs && live) run();
            else { fraction = 0; paint(stamp); }
        },
        /** Hold the bar where the cycle stands now, and draw it there. */
        freeze() {
            stop();
            paint(now());
        },
        /** The hero has gone: stopped, and the next cycle starts from nothing. */
        reset() {
            stop();
            elapsed = 0;
            fraction = 0;
        },
        /** Stop for good (the Token has left). */
        dispose() {
            stop();
            el = null;
        },
        /** Where the cycle stands at time `t`, or null with no cycle length known. */
        read(t) {
            return cycleMs ? { elapsedMs: elapsedAt(t), cycleMs } : null;
        },
        get running() { return running; }
    };
}

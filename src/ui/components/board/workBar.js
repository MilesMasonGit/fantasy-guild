import { onStep } from './frameClock.js';

/**
 * The work bar: a thin bar that fills once each work cycle, in whole art pixels. It is drawn in
 * the work plate under the Token and its hero (`WorkPlateLayer`); the model behind it is the
 * Token's own: `TokenBubbles` keeps it and feeds it the engine's events, and shares it by id
 * ({@link shareWorkBar}) for the plate to draw.
 * ⚠️ A running bar is written on the shared step clock (`frameClock.onStep`: ten steps a second,
 * every bar in the same frame) and only when its filled length changes by an art pixel; an engine
 * event only moves the model. Bars written on frames of their own (a CSS animation per bar runs
 * out of phase with every other) would put a repaint in nearly every frame of play, the cost the
 * cycle ring was moved onto this clock to stop. The fill is the bar's own `::after`
 * (`.gi-work-bar`, tailwind.css), scaled by `--work-bar-fill`: one element, no layout.
 */

/** How many steps a model fills in until an element is attached with its own length. */
export const WORK_BAR_ART_W = 40;

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

    // On the step clock only while it runs AND something shows it: a model with no element costs
    // nothing between engine events.
    const listen = () => {
        if (running && el) {
            if (!offStep) offStep = onStep(paint);
        } else if (offStep) {
            offStep();
            offStep = null;
        }
    };
    const run = () => {
        running = true;
        listen();
    };
    const stop = () => {
        elapsed = elapsedAt(now());
        running = false;
        listen();
    };

    return {
        /** The bar's element (or null), `steps` art pixels long: a new element is drawn at once. */
        attach(next, length = steps) {
            el = next || null;
            steps = length;
            drawn = null;
            paint(now());
            listen();
        },
        /**
         * The engine's progress on a plain cycle: `{ elapsedMs, cycleTimeMs, percent }`. With no
         * cycle length (a reset) the bar holds at `percent`. `live`: a
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
            el = null;
            stop();
        },
        /** Where the cycle stands at time `t`, or null with no cycle length known. */
        read(t) {
            return cycleMs ? { elapsedMs: elapsedAt(t), cycleMs } : null;
        },
        get running() { return running; }
    };
}

/** instanceId → the Token's bar model, while its `TokenBubbles` is mounted. */
const owned = new Map();
/** instanceId → who wants to hear when that Token's model comes or goes. */
const watchers = new Map();

const tell = (instanceId, bar) => watchers.get(instanceId)?.forEach(fn => fn(bar));

/**
 * Share Token `instanceId`'s bar model (its owner, `TokenBubbles`, while mounted).
 * @returns {() => void} stop sharing
 */
export function shareWorkBar(instanceId, bar) {
    owned.set(instanceId, bar);
    tell(instanceId, bar);
    return () => {
        if (owned.get(instanceId) !== bar) return;
        owned.delete(instanceId);
        tell(instanceId, null);
    };
}

/**
 * Hear Token `instanceId`'s bar model now and whenever it comes or goes (`fn(bar | null)`): the
 * plate attaches its element to whichever model is there.
 * @returns {() => void} stop hearing
 */
export function watchWorkBar(instanceId, fn) {
    let set = watchers.get(instanceId);
    if (!set) {
        set = new Set();
        watchers.set(instanceId, set);
    }
    set.add(fn);
    fn(owned.get(instanceId) || null);
    return () => {
        set.delete(fn);
        if (!set.size && watchers.get(instanceId) === set) watchers.delete(instanceId);
    };
}

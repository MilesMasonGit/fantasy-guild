// Judging the CPU slowdown Chrome delivered (bench/README.md, "Chrome's CPU throttle"). A bench asks
// Chrome for one rate with --cpu; --slowdown-target says which rate it wants to measure at, for a PC
// where asking 3.2× delivers about 4×. Without it the target is the rate asked.

/** Delivered more than this share off the target measures a different machine. */
export const SLOWDOWN_TOLERANCE = 0.25;

export function parseSlowdownTarget(value) {
    const target = Number(value);
    if (!(target > 0)) throw new Error('--slowdown-target needs a slowdown rate, e.g. --cpu=3.2 --slowdown-target=4');
    return target;
}

/** The delivered slowdowns too far off the target; none at 1×, which Chrome does not throttle. */
export function slowdownsOff(slowdown, target) {
    if (target === 1 || !slowdown) return [];
    return slowdown.filter((s) => Number.isFinite(s) && Math.abs(s - target) / target > SLOWDOWN_TOLERANCE);
}

/** Why a throttled window cannot be used, or null. */
export function slowdownReject(slowdown, target) {
    const off = slowdownsOff(slowdown, target);
    return off.length ? `Chrome delivered a ${off[0]}× slowdown, not the ${target}× asked` : null;
}

/** The note printed beside a throttled measurement: what Chrome delivered, and a warning when off. */
export function slowdownNote(slowdown, target) {
    if (target === 1 || !slowdown) return '';
    const shown = slowdown.map((s) => (Number.isFinite(s) ? `${s}×` : '?')).join(' → ');
    return `, slowdown ${shown}${slowdownsOff(slowdown, target).length ? ` ⚠ not the ${target}× asked` : ''}`;
}

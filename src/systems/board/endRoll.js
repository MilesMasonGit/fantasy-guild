// the roll that ends a gathering source by chance

/**
 * Whether a source that runs out by chance ends now: one draw at the chance that any of `times`
 * rolls of `chance` percent would end it. A sure end (100 % or more) and a chance of nothing draw
 * nothing, so a source that cannot go either way leaves the seeded stream as it was.
 *
 * ⚠️ One draw per spend, and only where a cycle spends (`Charges.applyDelta`, `Fields.harvested`),
 * never per tick: a long step rolls as often as short ones for the same cycles, and a catch-up rolls
 * exactly as the plain loop's steps of its size. Cycles that end within one step roll in the mat's
 * order, so small and big steps can hand them different numbers from the stream.
 */
export function endsNow(chance, times = 1) {
    const p = Number(chance);
    const n = Number(times);
    if (!(p > 0) || !(n > 0)) return false;
    if (p >= 100) return true;
    const either = n === 1 ? p : 100 * (1 - (1 - p / 100) ** n);
    return Math.random() * 100 < either;
}

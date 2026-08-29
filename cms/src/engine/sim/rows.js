/**
 * Economic simulator — audit rows (phase P3+4).
 *
 * A row is what the simulator says out loud. Plan §12 sets the bar: *a designer
 * who reads no formulas knows which tag or dial to change next.* So a row
 * carries **what**, **why in game terms**, and **remedies, ranked**.
 *
 * Severities follow the existing audit panel (plan §12):
 * - `critical` — unpriceable content (orphans, cycles, deferred-only items)
 * - `warning`  — in-game but off-target (an unclosed integer residual)
 * - `info`     — the simulator exercised judgement you may want to see
 *                (margin floor engaged, anchor candidate changed, an untagged
 *                producer, a deferred-scope source)
 *
 * ⚠️ P5 will render these somewhere. Today the only consumer is `dryRun.mjs`
 * and the tests — nothing in the CMS reads them yet.
 */

export const SEVERITY = Object.freeze({
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info',
});

const SEVERITY_ORDER = Object.freeze({ critical: 0, warning: 1, info: 2 });

/** Build one row. `code` is the stable machine name; `message` is the prose. */
export function makeRow(severity, code, message, extra = {}) {
    return Object.freeze({
        severity,
        code,
        message,
        entityId: extra.entityId ?? null,
        itemId: extra.itemId ?? null,
        remedies: Object.freeze(extra.remedies ?? []),
        detail: Object.freeze(extra.detail ?? {}),
    });
}

/**
 * Sort rows into a stable, human-readable order: severity, then code, then the
 * ids. **Stability here is what makes two runs byte-identical** (plan §11), so
 * this is an acceptance criterion, not tidiness.
 */
export function sortRows(rows) {
    return [...rows].sort((a, b) => {
        const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (s !== 0) return s;
        if (a.code !== b.code) return a.code < b.code ? -1 : 1;
        const ai = `${a.itemId ?? ''}|${a.entityId ?? ''}`;
        const bi = `${b.itemId ?? ''}|${b.entityId ?? ''}`;
        if (ai !== bi) return ai < bi ? -1 : 1;
        return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
    });
}

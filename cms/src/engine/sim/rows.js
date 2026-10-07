/**
 * Economic simulator: audit rows. A row is what the simulator says out loud: what, why in game terms, and ranked remedies. Severities: `critical` is unpriceable content (orphans, cycles, deferred-only items); `warning` is in-game but off-target (an unclosed integer residual); `info` is judgement the simulator exercised that you may want to see.
 * ⚠️ The audit panel has no shape of its own for a row: `recalculateEconomy` flattens each into a line of prose and sends it through the auditor's refusal channel.
 */

export const SEVERITY = Object.freeze({
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info',
});

const SEVERITY_ORDER = Object.freeze({ critical: 0, warning: 1, info: 2 });

/** Build one row. `code` is the stable machine name; `message` is the prose. `what` and `why` are carried separately so a surface with room for two lines can show them apart; a row built without them keeps `message` as its whole story, and `refusals.js` fills them in. */
export function makeRow(severity, code, message, extra = {}) {
    return Object.freeze({
        severity,
        code,
        message,
        what: extra.what ?? null,
        why: extra.why ?? null,
        entityId: extra.entityId ?? null,
        itemId: extra.itemId ?? null,
        remedies: Object.freeze(extra.remedies ?? []),
        detail: Object.freeze(extra.detail ?? {}),
    });
}

/** Sort rows into a stable, human-readable order: severity, then code, then the ids. Stability is what makes two runs byte-identical. */
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

/**
 * Economic simulator: the churn report. After every Recalculate it says what moved, so adding one Token cannot silently re-price half the game unnoticed. The report holds `ranAt`, `valuesChanged`, `itemsPriced`, `largestMovers` (at most five, biggest relative move first), `tuned`, `refusals` and `refusalKeys`.
 * ⚠️ `refusalKeys` exists for the machine: the next run diffs against it to say what is new and what cleared, so keep it wherever the report is stored.
 * ⚠️ A first run has nothing to diff against, so it reports a refusal total and claims nothing new.
 */

import { isRefusal } from './refusals.js';

/** How many movers the report names. The rest are a count, not a list. */
const MOVER_LIMIT = 5;

/** A refusal's identity across runs: the same complaint about the same thing. */
export function refusalKey(row) {
    return `${row.code}|${row.entityId ?? ''}|${row.itemId ?? ''}`;
}

/** Every catalogued refusal in a run's rows, keyed and de-duplicated. */
function refusalsOf(rows) {
    const seen = new Map();
    for (const row of rows) {
        if (!isRefusal(row.code)) continue;
        const key = refusalKey(row);
        if (seen.has(key)) continue;
        seen.set(key, { key, code: row.code, entityId: row.entityId, itemId: row.itemId, message: row.message });
    }
    return seen;
}

/**
 * Build the report for one run.
 *
 * @param {object} sim           a `runSim` result
 * @param {object} opts
 * @param {object} opts.itemsBefore  the item records as they were *before* this
 *                                   run wrote anything — the only source of the
 *                                   "from" value
 * @param {object} opts.previous     the previous report, for the refusal diff
 * @param {number} opts.ranAt        injectable so a test is not clock-dependent
 */
export function buildChurnReport(sim, { itemsBefore = {}, previous = null, ranAt = Date.now() } = {}) {
    const movers = [];
    let valuesChanged = 0;

    for (const [key, item] of Object.entries(itemsBefore || {})) {
        const itemId = item?.id ?? key;
        const from = Number.isFinite(item?.value) ? item.value : null;
        const to = sim.values.has(itemId) ? sim.values.get(itemId) : null;
        if (from === to) continue;
        valuesChanged += 1;
        movers.push({
            itemId,
            from,
            to,
            delta: (to ?? 0) - (from ?? 0),
            factor: from && to ? to / from : null,
        });
    }

    // An item that arrived or vanished has no factor, and is the biggest news
    // there is; `MAX_VALUE` rather than `Infinity` so two of them compare equal
    // instead of subtracting to NaN.
    const weight = (m) => (m.factor === null ? Number.MAX_VALUE : Math.max(m.factor, 1 / m.factor));
    movers.sort((a, b) => (weight(b) - weight(a)) || (a.itemId < b.itemId ? -1 : 1));

    const tuned = [...(sim.tunings?.values() ?? [])]
        .filter((t) => t.lever && t.lever !== 'none')
        .map((t) => ({ entityId: t.entityId, name: t.name, lever: t.lever, diff: t.diff }))
        .sort((a, b) => (a.entityId < b.entityId ? -1 : 1));

    const now = refusalsOf(sim.rows);
    const before = new Set(previous?.refusalKeys ?? []);
    const isFirstRun = previous === null;

    return {
        ranAt,
        valuesChanged,
        itemsPriced: sim.values.size,
        largestMovers: movers.slice(0, MOVER_LIMIT),
        tuned,
        refusals: {
            total: now.size,
            // With nothing to diff against, "new" would mean "all of them",
            // which reads as an alarm rather than as news. A first run reports
            // its refusals as a total and claims no change.
            new: isFirstRun ? [] : [...now.values()].filter((r) => !before.has(r.key)),
            cleared: isFirstRun ? [] : [...before].filter((k) => !now.has(k)).map((key) => ({
                key,
                code: key.split('|')[0],
                entityId: key.split('|')[1] || null,
                itemId: key.split('|')[2] || null,
                message: null,
            })),
        },
        refusalKeys: [...now.keys()].sort(),
    };
}

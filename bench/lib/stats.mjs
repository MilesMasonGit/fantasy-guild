// Fantasy Guild bench — small statistics helpers (plain JS, no engine imports).

/** The q-quantile (0–1) of an ascending-sorted array, nearest-rank. */
export function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
    return sorted[i];
}

/** mean / p50 / p95 / p99 / max of a list of milliseconds. */
export function summarise(samples) {
    const sorted = Float64Array.from(samples).sort();
    let sum = 0;
    for (const v of sorted) sum += v;
    return {
        n: sorted.length,
        mean: sorted.length ? sum / sorted.length : NaN,
        p50: quantile(sorted, 0.5),
        p95: quantile(sorted, 0.95),
        p99: quantile(sorted, 0.99),
        max: sorted.length ? sorted[sorted.length - 1] : NaN
    };
}

/** The median of plain numbers. */
export function median(values) {
    const v = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!v.length) return NaN;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

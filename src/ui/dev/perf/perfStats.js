// Fixed-size statistics for the Perf HUD.
// ⚠️ Bounded memory by construction. A long soak is a leak detector, so the tool running it
// must not grow: a whole-window histogram with fixed buckets, and a ring buffer of the most
// recent samples, both allocated once.

/**
 * A histogram of millisecond samples in fixed-width buckets, plus an overflow
 * bucket, an exact max and an exact sum. Quantiles are read to bucket
 * resolution (the upper edge of the bucket, so they never flatter).
 */
export class MsHistogram {
    /**
     * @param {number} bucketMs width of one bucket
     * @param {number} maxMs    samples at or above this go to the overflow bucket
     */
    constructor(bucketMs, maxMs) {
        this.bucketMs = bucketMs;
        this.maxMs = maxMs;
        this.buckets = new Uint32Array(Math.ceil(maxMs / bucketMs) + 1);
        this.reset();
    }

    reset() {
        this.buckets.fill(0);
        this.count = 0;
        this.sum = 0;
        this.max = 0;
    }

    add(ms) {
        const i = ms >= this.maxMs ? this.buckets.length - 1 : Math.floor(ms / this.bucketMs);
        this.buckets[i]++;
        this.count++;
        this.sum += ms;
        if (ms > this.max) this.max = ms;
    }

    /** The q-quantile (0–1), as the upper edge of its bucket. NaN when empty. */
    quantile(q) {
        if (!this.count) return NaN;
        const target = Math.max(1, Math.ceil(q * this.count));
        let seen = 0;
        for (let i = 0; i < this.buckets.length; i++) {
            seen += this.buckets[i];
            if (seen >= target) {
                return i === this.buckets.length - 1 ? this.max : Math.min(this.max, (i + 1) * this.bucketMs);
            }
        }
        return this.max;
    }

    /** How many samples were strictly over `ms` (to bucket resolution; exact at bucket edges). */
    countOver(ms) {
        const edge = Math.ceil(ms / this.bucketMs);
        let n = 0;
        for (let i = edge; i < this.buckets.length; i++) n += this.buckets[i];
        return n;
    }

    summary(thresholds = []) {
        const out = {
            count: this.count,
            mean: this.count ? round(this.sum / this.count) : null,
            p50: round(this.quantile(0.5)),
            p95: round(this.quantile(0.95)),
            p99: round(this.quantile(0.99)),
            p999: round(this.quantile(0.999)),
            max: this.count ? round(this.max) : null
        };
        if (thresholds.length) {
            out.over = {};
            out.pctAtOrUnder = {};
            for (const t of thresholds) {
                const over = this.countOver(t);
                out.over[`${t}ms`] = over;
                out.pctAtOrUnder[`${t}ms`] = this.count ? round(100 * (this.count - over) / this.count, 2) : null;
            }
        }
        return out;
    }
}

/** The most recent `size` samples, for "right now" numbers on the HUD. */
export class Ring {
    constructor(size) {
        this.data = new Float32Array(size);
        this.size = size;
        this.reset();
    }

    reset() {
        this.next = 0;
        this.filled = 0;
    }

    add(v) {
        this.data[this.next] = v;
        this.next = (this.next + 1) % this.size;
        if (this.filled < this.size) this.filled++;
    }

    /** p50 / p95 / p99 / max of what the ring holds (sorts a copy — call rarely). */
    summary() {
        if (!this.filled) return { count: 0, p50: null, p95: null, p99: null, max: null };
        const sorted = this.data.slice(0, this.filled).sort();
        const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
        return {
            count: this.filled,
            p50: round(q(0.5)),
            p95: round(q(0.95)),
            p99: round(q(0.99)),
            max: round(sorted[sorted.length - 1])
        };
    }
}

/** Three decimals is plenty for milliseconds; null for "no data". */
export function round(v, places = 3) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    const f = 10 ** places;
    return Math.round(v * f) / f;
}

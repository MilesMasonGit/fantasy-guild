/**
 * Economic simulator — the dials the passes read (phase P3+4).
 *
 * ⚠️ **The dial *store* lands in P5.** This phase takes dials as a plain
 * argument with the defaults below so that every pass stays a pure function.
 * Nothing here touches `useGlobalStore`, and nothing here reads a file.
 *
 * Every number below is transcribed from the plan (§13.1, §13.5, §13.6, §14).
 * ⚠️ None of them is fitted to what happens to sit in `data/` today, and none
 * of them may be adjusted to make a shipped Token land nicer — the content is
 * placeholder and its tags are provisional test substrate.
 */

/**
 * Gold per hour, as **pinned points** (plan §13.1). The developer edits ten
 * pins, not 99 cells.
 *
 * The shape: a flat 7.5%/level compounding to level 70, then 2%/level to 99.
 * The curve is a **floor, not an average** (CMS-133): it balances the
 * just-qualified worker, and a hero levelled past the gate out-earns it through
 * the speed bonus, deliberately unmodelled.
 */
export const GPH_PINS = Object.freeze({
    1: 1200,
    10: 2300,
    20: 4750,
    30: 9800,
    40: 20200,
    50: 41600,
    60: 85800,
    70: 177000,
    85: 238000,
    99: 314000,
});

/**
 * What the Purpose tag is worth in gold (plan §3.3, CMS-137: confirmed by the
 * owner at 1.0 / 0.35 / 0.10).
 *
 * This factor **is** the only thing that makes the Purpose tag economically
 * real: under value-absorbs-yield, an IPH firehose and a GPH treasure would
 * earn identically if their targets matched.
 */
export const PURPOSE_GOLD_FACTORS = Object.freeze({
    gph: 1.0,
    iph: 0.35,
    xph: 0.10,
});

/**
 * Tolerance around the target (plan §13.5), bracketed by the anchor's level.
 * Integer gold forces the band wide where values are small.
 */
export const TOLERANCE_BRACKETS = Object.freeze([
    Object.freeze({ maxLevel: 10, band: 0.25 }),
    Object.freeze({ maxLevel: 30, band: 0.15 }),
    Object.freeze({ maxLevel: Infinity, band: 0.10 }),
]);

export const DEFAULT_DIALS = Object.freeze({
    gphPins: GPH_PINS,
    purposeGoldFactors: PURPOSE_GOLD_FACTORS,
    toleranceBrackets: TOLERANCE_BRACKETS,
    /** Non-anchor sources get a doubled band (plan §13.5). Unused until P6. */
    nonAnchorBandMultiplier: 2,
    /** Minimum markup per processing step (owner: ~15%, plan §13.6). */
    craftMarginPerStep: 0.15,
    /**
     * Downcycling's one number (CMS-130). Developer-set, and **strictly under
     * 100%** — at or above it, breaking a thing down and rebuilding it would
     * duplicate gold, so `normaliseDials` refuses to go there.
     *
     * Plan §14 item 11b makes this dial **developer-set** — "anything under
     * 100%, sensibly well under" — so 0.5 needs no owner ruling and is not
     * waiting on one. It is turnable like any other dial once the Dashboard
     * lands, and no shipped recipe is a downcycle today, so nothing currently
     * depends on the number.
     */
    downcycleRecoveryRatio: 0.5,
});

/**
 * Validate and fill in a dial set. Pure; returns a new frozen object.
 *
 * The recovery-ratio guard is the one dial that *refuses* rather than clamps:
 * a ratio at or above 1 is a gold duplicator, and silently clamping it would
 * hide a developer's mistake behind a plausible number.
 */
export function normaliseDials(overrides = {}) {
    const dials = { ...DEFAULT_DIALS, ...overrides };
    const ratio = dials.downcycleRecoveryRatio;
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
        throw new Error(
            `downcycleRecoveryRatio must be greater than 0 and strictly under 1 (got ${ratio}). ` +
            'At or above 100% a downcycle loop duplicates gold.'
        );
    }
    if (!Number.isFinite(dials.craftMarginPerStep) || dials.craftMarginPerStep < 0) {
        throw new Error(`craftMarginPerStep must be a number ≥ 0 (got ${dials.craftMarginPerStep}).`);
    }
    return Object.freeze(dials);
}

/**
 * Gold per hour at `level`, **linearly interpolated** between the pins.
 *
 * Linear interpolation (rather than geometric) matches the precedent already
 * in the CMS — `velocityCalculator.getVelocityTargets` interpolates its GPH
 * pins the same way, and `CMSBalanceEngine.test.js` pins that behaviour. Below
 * the first pin and above the last, the curve is flat.
 */
export function gphAt(level, dials = DEFAULT_DIALS) {
    const pins = dials.gphPins || GPH_PINS;
    const levels = Object.keys(pins).map(Number).sort((a, b) => a - b);
    const L = Number.isFinite(level) ? level : 1;
    if (L <= levels[0]) return pins[levels[0]];
    if (L >= levels[levels.length - 1]) return pins[levels[levels.length - 1]];
    for (let i = 0; i < levels.length - 1; i++) {
        const lo = levels[i];
        const hi = levels[i + 1];
        if (L >= lo && L <= hi) {
            const t = (L - lo) / (hi - lo);
            return pins[lo] + t * (pins[hi] - pins[lo]);
        }
    }
    return pins[levels[levels.length - 1]];
}

/** The Purpose tag's gold factor. An unknown tag reads as 0 — it earns nothing. */
export function purposeGoldFactor(purpose, dials = DEFAULT_DIALS) {
    const factors = dials.purposeGoldFactors || PURPOSE_GOLD_FACTORS;
    return factors[purpose] ?? 0;
}

/** The tolerance band (a fraction) for an anchor at `level`. */
export function toleranceFor(level, dials = DEFAULT_DIALS, { isAnchor = true } = {}) {
    const brackets = dials.toleranceBrackets || TOLERANCE_BRACKETS;
    const L = Number.isFinite(level) ? level : 1;
    const bracket = brackets.find(b => L <= b.maxLevel) || brackets[brackets.length - 1];
    const multiplier = isAnchor ? 1 : (dials.nonAnchorBandMultiplier ?? 2);
    return bracket.band * multiplier;
}

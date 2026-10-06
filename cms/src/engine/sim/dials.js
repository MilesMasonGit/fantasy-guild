/**
 * Economic simulator: the dials the passes read. Every pass stays a pure function: dials arrive as a plain argument and the defaults below are the whole list. Nothing here touches a store or a file: `useGlobalStore` holds the developer's turned copy under `simDials` and `recalculateEconomy` hands it in.
 * ⚠️ The one dial no pass reads is `skillMasteryHours`: it is an expectation, not an input, so turning it does not move the curve (see `PaceDials`).
 */

/** Gold per hour, as pinned points: the developer edits ten pins, not 99 cells. A flat 7.5%/level compounding to level 70, then 2%/level to 99. The curve is a floor, not an average: it balances the just-qualified worker, and a hero levelled past the gate out-earns it through the speed bonus, deliberately unmodelled. */
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
 * Experience per hour, as pinned points: 7.5% compounding per level from about 700 XPH at level 1.
 * ⚠️ The pins are denser than a readable sample, deliberately: the curve is read by straight-line interpolation (`xphAt`), and a chord across twenty levels of a compounding curve sits well above it, so a sparse set overstates mid-segment XPH.
 */
export const XPH_PINS = Object.freeze({
    1: 700,
    10: 1340,
    20: 2750,
    30: 5700,
    40: 11800,
    50: 24200,
    60: 50300,
    70: 103000,
    80: 214000,
    90: 437000,
    99: 837000,
});

/** What the Purpose tag is worth in gold. This factor is the only thing that makes the Purpose tag economically real: under value-absorbs-yield, an IPH firehose and a GPH treasure would earn identically if their targets matched. */
export const PURPOSE_GOLD_FACTORS = Object.freeze({
    gph: 1.0,
    iph: 0.35,
    xph: 0.10,
});

/** Tolerance around the target, bracketed by the anchor's level. Integer gold forces the band wide where values are small. */
export const TOLERANCE_BRACKETS = Object.freeze([
    Object.freeze({ maxLevel: 10, band: 0.25 }),
    Object.freeze({ maxLevel: 30, band: 0.15 }),
    Object.freeze({ maxLevel: Infinity, band: 0.10 }),
]);

/** What the Purpose tag is worth in XP: the mirror of the gold factors, so Purpose is a seesaw rather than a label (GPH pays and teaches little, XPH teaches and pays little, IPH sits between). XP is derived, never targeted independently, so the two cannot conflict. */
export const PURPOSE_XP_FACTORS = Object.freeze({
    xph: 1.0,
    iph: 0.5,
    gph: 0.3,
});

/** Rarity weights. The array order of `TOKEN_RARITIES` is the tier order; these are the draw weights a Map pool renormalises within. */
export const RARITY_WEIGHTS = Object.freeze({
    common: 100,
    uncommon: 40,
    rare: 12,
    epic: 4,
    mythic: 1,
});

export const DEFAULT_DIALS = Object.freeze({
    gphPins: GPH_PINS,
    xphPins: XPH_PINS,
    /**
     * Hours to take one skill 1→99.
     * ⚠️ An expectation, not an input: no pass reads it to decide anything. The XP pass integrates `xphPins` against the game's own threshold curve (`src/utils/XPCurve.js`) and reports the hours that actually fall out; the Pace dial shows the two side by side. Turning this alone moves nothing.
     */
    skillMasteryHours: 55,
    /** The player the projections assume, not a property of the game. The XP pass turns the pacing projection into an estimated day in reach for every Map's price. */
    hoursPerDay: 8,

    purposeGoldFactors: PURPOSE_GOLD_FACTORS,
    purposeXpFactors: PURPOSE_XP_FACTORS,
    /** How expensive training may be, as a fraction of the level's GPH. Read by the TUNE pass: an XP-tagged source that runs gold-negative is fine inside this and refuses beyond it. */
    trainingLossCap: 0.25,

    craftMarginPerStep: 0.15,
    /** What a Map's scrapped contents fetch, as a fraction of their value. No per-copy cap: a Mythic windfall approaching the Map's price is a wanted story. Read by the Map pass through `scrapRatioAt`, which also accepts an `{ early, late }` pin pair in place of the single number. */
    mapScrapRatio: 0.40,
    /** Map productive return as two pins: an early Map plainly funds several more, a late one barely clears its cost. Read by the Map pass through `productiveReturnAt`, which interpolates linearly over the Map's derived level, `early` at level 1 and `late` at level 99, the same reading `gphAt` takes of the GPH pins. */
    mapProductiveReturn: Object.freeze({ early: 10, late: 1.5 }),
    rarityPremium: 0.8,
    /** Assumed productive lifetime of an unlimited-use Token, in hours. Feeds the Map check only. */
    unlimitedLifetimeHours: 16,

    toleranceBrackets: TOLERANCE_BRACKETS,
    /** Non-anchor sources get a doubled band. Read by the TUNE pass through `toleranceFor`; it is step 0 of the lever policy. */
    nonAnchorBandMultiplier: 2,
    rarityWeights: RARITY_WEIGHTS,
    /** Downcycling's one number. Developer-set and strictly under 100%: at or above it, breaking a thing down and rebuilding it would duplicate gold, so `normaliseDials` refuses it. */
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
    // ⚠️ An `undefined` value is "not set", not "set to nothing". A stored dial
    // set written before a dial existed carries the key absent, but a partial
    // object built by hand can carry it explicitly undefined — and spreading
    // that over the defaults would blank a required number and throw below.
    const supplied = Object.fromEntries(
        Object.entries(overrides || {}).filter(([, value]) => value !== undefined)
    );
    const dials = { ...DEFAULT_DIALS, ...supplied };
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

/** Gold per hour at `level`, linearly interpolated between the pins: between two neighbouring pins the value moves by an equal number of gold per level, so moving one pin moves only the two segments touching it. Flat below the first pin and above the last. */
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

export function purposeGoldFactor(purpose, dials = DEFAULT_DIALS) {
    const factors = dials.purposeGoldFactors || PURPOSE_GOLD_FACTORS;
    return factors[purpose] ?? 0;
}

export function toleranceFor(level, dials = DEFAULT_DIALS, { isAnchor = true } = {}) {
    const brackets = dials.toleranceBrackets || TOLERANCE_BRACKETS;
    const L = Number.isFinite(level) ? level : 1;
    const bracket = brackets.find(b => L <= b.maxLevel) || brackets[brackets.length - 1];
    const multiplier = isAnchor ? 1 : (dials.nonAnchorBandMultiplier ?? 2);
    return bracket.band * multiplier;
}

/**
 * A dial that may be one number or an `{ early, late }` pin pair, read at a Map's derived level.
 * ⚠️ `early` is read at level 1 and `late` at level 99 (the whole skill range), interpolated in a straight line; a pair of equal values is a flat dial, and a bare number is the same thing written shorter.
 */
export function pinnedAt(dial, level, fallback) {
    if (Number.isFinite(dial)) return dial;
    const early = Number.isFinite(dial?.early) ? dial.early : fallback;
    const late = Number.isFinite(dial?.late) ? dial.late : early;
    const L = Number.isFinite(level) ? Math.max(1, Math.min(99, level)) : 1;
    const t = (L - 1) / 98;
    return early + t * (late - early);
}

/** What a Map's scrapped contents fetch, as a fraction of the Map's cost, at the Map's derived level. Flat while the dial is a single number. */
export function scrapRatioAt(level, dials = DEFAULT_DIALS) {
    return pinnedAt(dials.mapScrapRatio ?? DEFAULT_DIALS.mapScrapRatio, level, 0.40);
}

/**
 * How many times its own cost a Map's burst must earn back, at the Map's
 * derived level: an early Map plainly funds several more, a late
 * one barely clears its cost.
 */
export function productiveReturnAt(level, dials = DEFAULT_DIALS) {
    return pinnedAt(dials.mapProductiveReturn ?? DEFAULT_DIALS.mapProductiveReturn, level, 10);
}

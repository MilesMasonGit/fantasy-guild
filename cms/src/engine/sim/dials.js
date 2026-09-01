/**
 * Economic simulator — the dials the passes read.
 *
 * Every pass stays a pure function: dials arrive as a plain argument, and the
 * defaults below are the whole §14 list. Nothing in this file touches a store
 * or reads a file — `useGlobalStore` holds the developer's turned copy under
 * its `simDials` key and `recalculateEconomy` hands it in.
 *
 * ⚠️ **Only some of these are read yet** (P5). The passes that exist —
 * TIME, ANCHOR, PRICE — read `gphPins`, `purposeGoldFactors`,
 * `toleranceBrackets`, `craftMarginPerStep` and `downcycleRecoveryRatio`.
 * The rest are stored, migrated and turnable, and the passes that consume them
 * are not built: the lever policy reads `nonAnchorBandMultiplier`, the Map pass
 * reads the Map and rarity dials, and the XP pass reads the XP ones. A dial
 * being here is not a claim that anything acts on it today.
 *
 * Every number below is transcribed from the plan (§13.1, §13.4, §13.5, §13.6,
 * §14). ⚠️ None of them is fitted to what happens to sit in `data/` today, and
 * none of them may be adjusted to make a shipped Token land nicer — the content
 * is placeholder and its tags are provisional test substrate.
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

/**
 * What the Purpose tag is worth in **XP** (plan §14 item 5). The mirror of the
 * gold factors: a hero parked on gold-tagged work trains at ~0.3× the curve.
 *
 * ⚠️ Read by nothing yet — XP derivation is a later phase.
 */
export const PURPOSE_XP_FACTORS = Object.freeze({
    xph: 1.0,
    iph: 0.5,
    gph: 0.3,
});

/**
 * Rarity weights (plan §13.4). The array order of `TOKEN_RARITIES` is the tier
 * order; these are the draw weights a Map pool renormalises within.
 *
 * ⚠️ Read by nothing yet — the Map pass is a later phase.
 */
export const RARITY_WEIGHTS = Object.freeze({
    common: 100,
    uncommon: 40,
    rare: 12,
    epic: 4,
    mythic: 1,
});

export const DEFAULT_DIALS = Object.freeze({
    // ── Pace ────────────────────────────────────────────────────────────────
    gphPins: GPH_PINS,
    /** Hours to take one skill 1→99 (plan §13.2). Not read yet. */
    skillMasteryHours: 55,
    /**
     * The player the projections assume, not a property of the game
     * (plan §14 item 3). Not read yet.
     */
    hoursPerDay: 8,

    // ── Purpose ─────────────────────────────────────────────────────────────
    purposeGoldFactors: PURPOSE_GOLD_FACTORS,
    /** Not read yet — see `PURPOSE_XP_FACTORS`. */
    purposeXpFactors: PURPOSE_XP_FACTORS,
    /**
     * How expensive training may be, as a fraction of the level's GPH
     * (plan §14 item 6). Not read yet.
     */
    trainingLossCap: 0.25,

    // ── Value chain ─────────────────────────────────────────────────────────
    /** Minimum markup per processing step (owner: ~15%, plan §13.6). */
    craftMarginPerStep: 0.15,
    /**
     * What a Map's scrapped contents fetch, as a fraction of their value
     * (owner: ~40%, plan §13.6). **No per-copy cap** — a Mythic windfall
     * approaching the Map's price is a wanted story. Not read yet.
     */
    mapScrapRatio: 0.40,
    /**
     * Map productive return, as the owner's two pins (plan §13.6): an early Map
     * plainly funds several more, a late one barely clears its cost. What sits
     * between the pins — and what the axis even is — belongs to the Map pass,
     * which is not built. Not read yet.
     */
    mapProductiveReturn: Object.freeze({ early: 10, late: 1.5 }),
    /** How steeply scrap value tracks scarcity, 0–1 (plan §14 item 10). Not read yet. */
    rarityPremium: 0.8,
    /**
     * Assumed productive lifetime of an unlimited-use Token, in hours
     * (plan §14 item 11). Feeds the Map check only. Not read yet.
     */
    unlimitedLifetimeHours: 16,

    // ── Tolerance ───────────────────────────────────────────────────────────
    toleranceBrackets: TOLERANCE_BRACKETS,
    /** Non-anchor sources get a doubled band (plan §13.5). Not read yet. */
    nonAnchorBandMultiplier: 2,
    /** How lopsided bursts feel (plan §13.4). Not read yet. */
    rarityWeights: RARITY_WEIGHTS,
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

/**
 * Gold per hour at `level`, **linearly interpolated** between the pins.
 *
 * Straight-line interpolation, not geometric: between two neighbouring pins the
 * value moves by an equal number of gold per level, so `gphAt(15)` with pins at
 * 10 (2,300) and 20 (4,750) is 3,525 — the midpoint. Below the first pin and
 * above the last the curve is flat. Straight lines are what makes a pin
 * editable with confidence: moving one pin moves only the two segments touching
 * it, by an amount the developer can read off the table.
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

/**
 * Economic simulator — the dials the passes read.
 *
 * Every pass stays a pure function: dials arrive as a plain argument, and the
 * defaults below are the whole §14 list. Nothing in this file touches a store
 * or reads a file — `useGlobalStore` holds the developer's turned copy under
 * its `simDials` key and `recalculateEconomy` hands it in.
 *
 * **Every dial below is read by a pass as of P8.** The assembly line is
 * complete: TIME, ANCHOR, PRICE, TUNE, MAP and XP between them consume the
 * whole §14 list — `gphPins`, `xphPins`, `purposeGoldFactors`,
 * `purposeXpFactors`, `hoursPerDay`, `toleranceBrackets`, `craftMarginPerStep`,
 * `downcycleRecoveryRatio`, `nonAnchorBandMultiplier`, `trainingLossCap`,
 * `rarityWeights`, `rarityPremium`, `mapScrapRatio`, `mapProductiveReturn` and
 * `unlimitedLifetimeHours`.
 *
 * ⚠️ The one exception is `skillMasteryHours`, which is **an expectation, not
 * an input**: the XP pass integrates the real curve against the game's own
 * threshold table and reports the hours it finds, rather than being told them.
 * Turning it does not move the curve — see the note on the dial itself.
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
 * Experience per hour, as **pinned points** (plan §13.2).
 *
 * ## How these were derived, and why there are eleven of them
 *
 * §13.2 states one mechanism — **7.5% compounding per level from ~700 XPH at
 * level 1**, the same growth number that governs the gold curve — and then
 * prints a six-column sample of it:
 *
 * | Level | 1 | 20 | 40 | 60 | 80 | 99 |
 * | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
 * | Printed | 700 | 2,750 | 11,800 | 50,300 | 214,000 | 837,000 |
 * | 700×1.075^(L−1) | 700 | 2,766 | 11,750 | 49,911 | 212,015 | 837,775 |
 * | Agreement | exact | −0.6% | +0.4% | +0.8% | +0.9% | −0.1% |
 *
 * Every printed column reconciles with the stated growth rate to under 1%, so
 * the mechanism and the table are one curve, not two.
 *
 * ⚠️ **The six printed columns are a readable sample, not the storage set.**
 * The curve is read by *straight-line* interpolation (`xphAt`, matching
 * `gphAt`), and a chord drawn across twenty levels of a compounding curve sits
 * well above it — with only the six printed pins stored, mid-segment XPH is
 * overstated by up to ~17% and one skill reaches 99 in 47.4 hours instead of
 * the plan's ~55. So the printed values are stored **verbatim at the levels the
 * plan printed them**, and the gaps are filled at every tenth level from the
 * same 7.5% rate. Every consecutive pair below grows at 7.40–7.59% per level,
 * and the integration in `hoursToMastery` lands at 53.2 hours — inside the
 * plan's 50–60 band.
 *
 * ⚠️ Unlike the gold curve, this one does **not** bend at level 70. §13.1 gives
 * gold a deliberate late-game flattening (7.5% to 70, then 2%); §13.2's printed
 * 99 column is exactly what unbroken 7.5% compounding produces, so the XP curve
 * runs straight to the top. That asymmetry is in the plan's own numbers, not an
 * inference: it is what makes late levels cost hours while gold stops racing.
 */
export const XPH_PINS = Object.freeze({
    1: 700,        // printed
    10: 1340,
    20: 2750,      // printed
    30: 5700,
    40: 11800,     // printed
    50: 24200,
    60: 50300,     // printed
    70: 103000,
    80: 214000,    // printed
    90: 437000,
    99: 837000,    // printed
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
 * Read by the XP pass (P8). Together with the gold factors this is what makes
 * the Purpose tag a **seesaw** rather than a label: GPH pays and teaches
 * little, XPH teaches and pays little, IPH sits between. No conflict is
 * possible because XP is derived, never targeted independently.
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
    /** Experience per hour, pinned (plan §13.2). Read by the XP pass. */
    xphPins: XPH_PINS,
    /**
     * Hours to take one skill 1→99 (plan §13.2).
     *
     * ⚠️ **This is an expectation, not an input.** No pass reads it to decide
     * anything: the XP pass integrates `xphPins` against the game's own
     * threshold curve (`src/utils/XPCurve.js`) and reports the hours that
     * actually fall out, which is 53.2 at the shipped pins. This number is what
     * the plan says that integration *should* land near, and the Pace dial
     * shows the two side by side so a pin edit that wrecks the climb is
     * visible immediately. Turning this alone moves nothing.
     */
    skillMasteryHours: 55,
    /**
     * The player the projections assume, not a property of the game
     * (plan §14 item 3). Read by the XP pass, which turns the pacing projection
     * into an "estimated day in reach" for every Map's price.
     */
    hoursPerDay: 8,

    // ── Purpose ─────────────────────────────────────────────────────────────
    purposeGoldFactors: PURPOSE_GOLD_FACTORS,
    /** The other half of the seesaw — see `PURPOSE_XP_FACTORS`. Read by the XP pass. */
    purposeXpFactors: PURPOSE_XP_FACTORS,
    /**
     * How expensive training may be, as a fraction of the level's GPH
     * (plan §14 item 6). Read by the TUNE pass: an XP-tagged source that runs
     * gold-negative is fine inside this, and refuses beyond it.
     */
    trainingLossCap: 0.25,

    // ── Value chain ─────────────────────────────────────────────────────────
    /** Minimum markup per processing step (owner: ~15%, plan §13.6). */
    craftMarginPerStep: 0.15,
    /**
     * What a Map's scrapped contents fetch, as a fraction of their value
     * (owner: ~40%, plan §13.6). **No per-copy cap** — a Mythic windfall
     * approaching the Map's price is a wanted story.
     *
     * Read by the Map pass (P7) through `scrapRatioAt`, which also accepts an
     * `{ early, late }` pin pair here in place of the single number, so the
     * bound can be made level-dependent without any pass changing. The default
     * stays the plan's one number: §14 pins the *return*, not this.
     */
    mapScrapRatio: 0.40,
    /**
     * Map productive return, as the owner's two pins (plan §13.6): an early Map
     * plainly funds several more, a late one barely clears its cost.
     *
     * Read by the Map pass (P7) through `productiveReturnAt`, which
     * interpolates the pins **linearly over the Map's derived level**, `early`
     * at level 1 and `late` at level 99 — the same straight-line reading
     * `gphAt` takes of the GPH pins, and for the same reason: moving a pin must
     * move the curve by an amount the developer can read off it.
     */
    mapProductiveReturn: Object.freeze({ early: 10, late: 1.5 }),
    /** How steeply scrap value tracks scarcity, 0–1 (plan §14 item 10). Read by the Map pass. */
    rarityPremium: 0.8,
    /**
     * Assumed productive lifetime of an unlimited-use Token, in hours
     * (plan §14 item 11). Feeds the Map check only.
     */
    unlimitedLifetimeHours: 16,

    // ── Tolerance ───────────────────────────────────────────────────────────
    toleranceBrackets: TOLERANCE_BRACKETS,
    /** Non-anchor sources get a doubled band (plan §13.5). Read by the TUNE
     *  pass through `toleranceFor`, and it is step 0 of the lever policy. */
    nonAnchorBandMultiplier: 2,
    /** How lopsided bursts feel (plan §13.4). Read by the Map pass. */
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

/**
 * A dial that may be either one number or an `{ early, late }` pin pair, read
 * at a Map's derived level.
 *
 * ⚠️ **The endpoints are an implementation choice, not the plan's.** Plan §13.6
 * gives the owner two pins and says "interpolated over Map level" without
 * naming where each pin sits. This reads `early` at level 1 and `late` at level
 * 99 — the whole skill range — and interpolates in a straight line between
 * them, matching `gphAt`'s reading of the GPH pins. A pin pair whose values are
 * equal is a flat dial, and a bare number is the same thing written shorter.
 */
export function pinnedAt(dial, level, fallback) {
    if (Number.isFinite(dial)) return dial;
    const early = Number.isFinite(dial?.early) ? dial.early : fallback;
    const late = Number.isFinite(dial?.late) ? dial.late : early;
    const L = Number.isFinite(level) ? Math.max(1, Math.min(99, level)) : 1;
    const t = (L - 1) / 98;
    return early + t * (late - early);
}

/**
 * What a Map's scrapped contents fetch, as a fraction of the Map's cost, at the
 * Map's derived level (plan §13.6, CMS-48).
 *
 * The shipped default is a single number, so this is flat until someone turns
 * it into a pin pair.
 */
export function scrapRatioAt(level, dials = DEFAULT_DIALS) {
    return pinnedAt(dials.mapScrapRatio ?? DEFAULT_DIALS.mapScrapRatio, level, 0.40);
}

/**
 * How many times its own cost a Map's burst must earn back, at the Map's
 * derived level (plan §13.6): an early Map plainly funds several more, a late
 * one barely clears its cost.
 */
export function productiveReturnAt(level, dials = DEFAULT_DIALS) {
    return pinnedAt(dials.mapProductiveReturn ?? DEFAULT_DIALS.mapProductiveReturn, level, 10);
}

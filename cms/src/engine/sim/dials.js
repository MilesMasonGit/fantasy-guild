/**
 * Economic simulator: the dials the passes read. Every pass stays a pure function: dials arrive as a plain argument and the defaults below are the whole list. Nothing here touches a store or a file: `useGlobalStore` holds the developer's turned copy under `simDials` and `recalculateEconomy` hands it in.
 * The earn curves and the purpose tilt are not dials: they are the balance rules' (`../balanceRules.js`), which the ledger reads too, so the simulator and the ledger cannot price work by two rulebooks.
 * ⚠️ The one dial no pass reads is `skillMasteryHours`: it is an expectation, not an input, so turning it does not move the curve (see `PaceDials`).
 */

import { worthAnHourAt, goodsTilt } from '../balanceRules.js';

/**
 * The dials that once held the earn curves and the purpose factors. A dial set stored before the curves moved to the balance rules still carries them (the owner's workspace does), so `normaliseDials` drops them: kept, they would read as live dials that change nothing.
 */
export const RETIRED_CURVE_DIALS = Object.freeze(['gphPins', 'xphPins', 'purposeGoldFactors', 'purposeXpFactors']);

/** Tolerance around the target, bracketed by the anchor's level. Integer gold forces the band wide where values are small. */
export const TOLERANCE_BRACKETS = Object.freeze([
    Object.freeze({ maxLevel: 10, band: 0.25 }),
    Object.freeze({ maxLevel: 30, band: 0.15 }),
    Object.freeze({ maxLevel: Infinity, band: 0.10 }),
]);

export const DEFAULT_DIALS = Object.freeze({
    /**
     * Hours to take one skill 1→99.
     * ⚠️ An expectation, not an input: no pass reads it to decide anything. The XP pass integrates the rules' XP an hour against the game's own threshold curve (`src/utils/XPCurve.js`) and reports the hours that actually fall out; the Pace dial shows the two side by side. Turning this alone moves nothing.
     */
    skillMasteryHours: 55,
    /** The player the projections assume, not a property of the game: the Pace dial's curve preview reads it. */
    hoursPerDay: 8,

    /** How expensive training may be, as a fraction of the level's GPH. Read by the TUNE pass: an XP-tagged source that runs gold-negative is fine inside this and refuses beyond it. */
    trainingLossCap: 0.25,

    craftMarginPerStep: 0.15,
    /** Assumed productive lifetime of an unlimited-use Token, in hours: the lifetime `checkPass` reports for one. */
    unlimitedLifetimeHours: 16,

    toleranceBrackets: TOLERANCE_BRACKETS,
    /** Non-anchor sources get a doubled band. Read by the TUNE pass through `toleranceFor`; it is step 0 of the lever policy. */
    nonAnchorBandMultiplier: 2,
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
        Object.entries(overrides || {}).filter(([key, value]) => value !== undefined && !RETIRED_CURVE_DIALS.includes(key))
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

/** Gold an hour of work at `level`, before its Purpose: the balance rules' worth curve (section 7). No dial moves it. */
export function gphAt(level) {
    return worthAnHourAt(level);
}

/** The Purpose tag's share of the worth curve: the balance rules' tilt (training 0.5, balanced 1, earning 1.5); 0 for an unknown tag. */
export function purposeGoldFactor(purpose) {
    return goodsTilt(purpose);
}

export function toleranceFor(level, dials = DEFAULT_DIALS, { isAnchor = true } = {}) {
    const brackets = dials.toleranceBrackets || TOLERANCE_BRACKETS;
    const L = Number.isFinite(level) ? level : 1;
    const bracket = brackets.find(b => L <= b.maxLevel) || brackets[brackets.length - 1];
    const multiplier = isAnchor ? 1 : (dials.nonAnchorBandMultiplier ?? 2);
    return bracket.band * multiplier;
}


/**
 * Economic simulator — pass 5's **XP half** (phase P8).
 *
 * ```
 * adapt → 1. TIME → 2. ANCHOR → 3. PRICE → 4. TUNE → 5. MAP + XP
 * ```
 *
 * This is the last derivation. Until this phase, authored `xp` passed through
 * the write-back untouched; from here it is derived like every other number the
 * game reads, and **Recalculate does the whole job**.
 *
 * ## The formula (plan §8), exactly
 *
 * ```
 * xp per cycle = XPH curve(required level) × purpose XP factor × cycle hours
 *                rounded, minimum 1
 * ```
 *
 * Three things follow from it, and all three are deliberate:
 *
 * 1. **XP is derived, never targeted.** Nothing anywhere asks "is this Token's
 *    XP right?" and adjusts something to make it so. The cycle time was settled
 *    by TIME (and possibly moved by TUNE), the level is authored, the Purpose
 *    tag is authored — XP is what falls out. That is why the gold seesaw below
 *    can never produce a conflict: there is no second target to disagree with.
 * 2. **The Purpose tag is a seesaw.** Against the gold factors (1.0 / 0.35 /
 *    0.10) these run the other way (1.0 / 0.5 / 0.3): a GPH source pays well and
 *    teaches a trickle, an XPH source teaches fast and pays a trickle, IPH sits
 *    between. One tag, two opposed consequences, no third dial.
 * 3. **The curve is a floor, not an average** — the same property CMS-133 gives
 *    the GPH curve. `cycle hours` here is the *authored* cycle length, with no
 *    speed bonus applied, so a hero levelled past the gate runs more cycles per
 *    hour and out-trains the curve. Deliberately unmodelled, exactly as on the
 *    gold side.
 *
 * ## ⚠️ The granularity wobble (F8) — accepted, not a bug
 *
 * The minimum-1 rule means a **Fast, GPH-tagged source below roughly level 10
 * over-teaches**: 1 XP on a 10-second cycle is ~360 XP/hour against a target
 * near 200. This is accepted rather than engineered around. Those levels take
 * minutes of real time anyway, and the alternative — running XP through the
 * lever machinery so a quantity could be nudged to close the gap — would buy
 * precision exactly where the brief says precision is cheapest.
 *
 * **It is documented here, and it files an Info row** (`xp-granularity`), so
 * nobody later reads it off the data and mistakes it for a defect.
 *
 * ## What this file does not do
 *
 * It writes nothing. Like every other pass it is a pure function returning Maps;
 * `sim/writeBack.js` is the one place a result becomes a stored field.
 */

import { xpForLevel } from '../../../../src/utils/XPCurve.js';
import { DEFAULT_DIALS, PURPOSE_XP_FACTORS, XPH_PINS, gphAt } from './dials.js';
import { makeRow, SEVERITY } from './rows.js';

/** The levels §13.2 prints, and the values it prints there. Pinned by a test. */
export const PRINTED_XPH_PINS = Object.freeze({
    1: 700, 20: 2750, 40: 11800, 60: 50300, 80: 214000, 99: 837000,
});

/**
 * How far a derived XP/hour may sit above its target before the granularity
 * wobble is worth saying out loud. Rounding one cycle up can only ever add less
 * than one XP, so on any cycle earning more than a couple of XP the effect is
 * invisible; at 1.5× it is the F8 case and nothing else.
 */
const WOBBLE_FACTOR = 1.5;

/**
 * Experience per hour at `level`, **linearly interpolated** between the pins.
 *
 * ⚠️ Deliberately identical in shape to `gphAt`: straight lines between pins,
 * flat below the first and above the last. P3+4 chose straight lines so that
 * moving one pin moves only the two segments touching it, by an amount the
 * developer can read off the table — and one growth number governing both
 * curves is a stated design property, so the two must not read differently.
 */
export function xphAt(level, dials = DEFAULT_DIALS) {
    const pins = dials.xphPins || XPH_PINS;
    const levels = Object.keys(pins).map(Number).sort((a, b) => a - b);
    if (levels.length === 0) return 0;
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

/**
 * The Purpose tag's XP factor. An unknown or missing tag reads as **0** — it
 * teaches nothing — and `xpPerCycle` turns that into *no XP at all* rather than
 * into the minimum of 1. The min-1 floor is a rounding rule for work that does
 * teach; it must never manufacture XP for work that does not.
 */
export function purposeXpFactor(purpose, dials = DEFAULT_DIALS) {
    const factors = dials.purposeXpFactors || PURPOSE_XP_FACTORS;
    return factors[purpose] ?? 0;
}

/**
 * XP awarded for one cycle — the §8 formula, guarded.
 *
 * Returns `null` for anything the simulator cannot honestly answer: no solved
 * cycle, a non-finite cycle length, a nonsense level, an untagged or unknown
 * Purpose. **`null`, never `NaN` and never 0.**
 *
 * ⚠️ This guard is the P7 lesson applied ahead of time. A `NaN` here would be
 * written straight onto a Token's `config.xp`, and every comparison against it
 * — in a test, in a later pass, in the game — is `false`, so it would read as
 * "fine" everywhere it was checked. A verdict wrong in the reassuring direction
 * is worse than a loud failure.
 */
export function xpPerCycle(level, purpose, cycleTimeMs, dials = DEFAULT_DIALS) {
    if (!Number.isFinite(cycleTimeMs) || cycleTimeMs <= 0) return null;
    if (!Number.isFinite(level) || level < 1) return null;
    const factor = purposeXpFactor(purpose, dials);
    if (!Number.isFinite(factor) || factor <= 0) return null;
    const xph = xphAt(level, dials);
    if (!Number.isFinite(xph) || xph <= 0) return null;
    const raw = xph * factor * (cycleTimeMs / 3600000);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    // Rounded, minimum 1 (plan §8). See the F8 note at the top of this file.
    return Math.max(1, Math.round(raw));
}

// === Pacing projections ======================================================

/**
 * How long one focused skill takes to climb 1 → 99, in board-hours.
 *
 * The XPH curve is integrated against **the game's own threshold curve**,
 * imported from `src/utils/XPCurve.js` rather than reimplemented: the claim
 * "roughly 50–60 hours" is only meaningful against the thresholds the game
 * actually uses, and a second copy of that formula in the CMS would let the two
 * drift without either side noticing.
 *
 * Classically back-loaded, and the shape is the point: the first twenty levels
 * are under three hours between them, level 90 onwards costs over an hour each,
 * and the last ten levels are about a quarter of the whole climb.
 */
export function hoursToMastery(dials = DEFAULT_DIALS) {
    let hours = 0;
    for (let level = 1; level < 99; level++) {
        const need = xpForLevel(level + 1) - xpForLevel(level);
        const rate = xphAt(level, dials);
        if (!Number.isFinite(need) || need <= 0) continue;
        if (!Number.isFinite(rate) || rate <= 0) return Infinity;
        hours += need / rate;
    }
    return hours;
}

/**
 * The pacing projection: where a hero is, and how much gold they have earned,
 * after every board-hour of the climb.
 *
 * ## ⚠️ The player this assumes (an implementation default, stated)
 *
 * Plan §14 calls `hoursPerDay` "the player the projections assume, not a
 * property of the game", and §13.2 pins the curves — but it never says which
 * Purpose tag the projected hero's work carries. This projects the **notional
 * worker the curves themselves describe**: earning `gphAt(level)` and training
 * at `xphAt(level)`, with no Purpose factor on either side.
 *
 * That is the only reading that keeps the two curves talking about the same
 * person. Applying a Purpose factor would have to apply *both* halves of the
 * seesaw, and the projection would then describe one particular authoring
 * choice rather than the pacing of the progression.
 *
 * It is also **gross income with no spending model**. The ladder answers "the
 * earliest a player could have this much gold", which is what a developer
 * pricing a Map wants to see; it is an upper bound on affordability, not a
 * forecast of a real wallet.
 *
 * Returns one segment per level, each carrying the cumulative hours and gold at
 * its start, plus a flat tail: past 99 there is no more levelling, so income
 * continues at the level-99 rate forever.
 */
export function buildProjection(dials = DEFAULT_DIALS) {
    const segments = [];
    let hours = 0;
    let gold = 0;
    for (let level = 1; level < 99; level++) {
        const need = xpForLevel(level + 1) - xpForLevel(level);
        const rate = xphAt(level, dials);
        const gph = gphAt(level, dials);
        if (!Number.isFinite(need) || need <= 0) continue;
        if (!Number.isFinite(rate) || rate <= 0) break;
        const span = need / rate;
        const earned = Number.isFinite(gph) && gph > 0 ? gph * span : 0;
        segments.push({ level, hoursAtStart: hours, goldAtStart: gold, hours: span, gold: earned });
        hours += span;
        gold += earned;
    }
    const tailGph = gphAt(99, dials);
    return Object.freeze({
        segments,
        masteryHours: hours,
        goldAtMastery: gold,
        tailGph: Number.isFinite(tailGph) && tailGph > 0 ? tailGph : 0,
    });
}

/**
 * The board-hours a projected hero needs to have earned `gold` in total.
 *
 * `null` for anything unanswerable — a non-finite target, a negative one, or a
 * projection whose tail earns nothing and therefore never reaches the number.
 * ⚠️ Not `Infinity`: a caller comparing `Infinity` against a bound gets a
 * defensible answer, but a caller *formatting* it prints "Infinity" into a
 * table cell, and "—" is the honest rendering of "the curves do not get there".
 */
export function hoursForGold(gold, projection) {
    if (!Number.isFinite(gold) || gold < 0) return null;
    if (gold === 0) return 0;
    for (const segment of projection.segments) {
        const end = segment.goldAtStart + segment.gold;
        if (gold <= end) {
            if (!(segment.gold > 0)) continue;
            const share = (gold - segment.goldAtStart) / segment.gold;
            return segment.hoursAtStart + share * segment.hours;
        }
    }
    if (!(projection.tailGph > 0)) return null;
    return projection.masteryHours + (gold - projection.goldAtMastery) / projection.tailGph;
}

/**
 * "Estimated day in reach" for a price, at `hoursPerDay` of play.
 *
 * Day 1 is the player's first day, so anything affordable inside the first
 * session reads as day 1 rather than day 0. `null` where `hoursForGold` cannot
 * answer, which the table renders as "—".
 */
export function dayInReach(cost, projection, dials = DEFAULT_DIALS) {
    const hours = hoursForGold(cost, projection);
    if (hours === null) return null;
    const perDay = Number.isFinite(dials.hoursPerDay) && dials.hoursPerDay > 0
        ? dials.hoursPerDay
        : DEFAULT_DIALS.hoursPerDay;
    return Math.max(1, Math.ceil(hours / perDay));
}

// === The pass ================================================================

/**
 * Derive XP per cycle for every entity with a solved cycle, and the pacing
 * ladder for every Map.
 *
 * @param {Array}  entities  adapted entities, as `fieldAdapter` returns them
 * @param {object} ctx  `{ cycleTimes, skipped, mapReports, dials }`
 * @returns {{ xp: Map, mapDays: Map, projection: object, masteryHours: number,
 *             rows: Array }}
 *
 * An entity the TIME pass skipped — inert, or untagged — gets **no entry**, and
 * the write-back therefore leaves its authored `xp` exactly as typed. That is
 * the untagged rule applied consistently: the simulator does not guess a tag, so
 * it does not derive the numbers that would follow from one.
 */
export function runXpPass(entities = [], {
    cycleTimes = new Map(),
    skipped = new Map(),
    mapReports = new Map(),
    dials = DEFAULT_DIALS,
} = {}) {
    const xp = new Map();
    const rows = [];

    for (const entity of entities) {
        if (!entity || skipped.has(entity.id)) continue;
        const cycleTimeMs = cycleTimes.get(entity.id);
        const awarded = xpPerCycle(entity.level, entity.purpose, cycleTimeMs, dials);
        if (awarded === null) continue;
        xp.set(entity.id, awarded);

        // ── The F8 wobble, said out loud ────────────────────────────────────
        // Delivered XP/hour against the target the curve set. Cycles per hour
        // here is the plain cycle rate, matching the formula's own reading —
        // the speed bonus lifts both sides equally and cancels.
        const cyclesPerHour = 3600000 / cycleTimeMs;
        const delivered = awarded * cyclesPerHour;
        const target = xphAt(entity.level, dials) * purposeXpFactor(entity.purpose, dials);
        if (target > 0 && delivered > target * WOBBLE_FACTOR) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'xp-granularity',
                `${entity.name} teaches ${Math.round(delivered).toLocaleString()} XP/hour where the curve asks for about ${Math.round(target).toLocaleString()}.`,
                {
                    entityId: entity.id,
                    what: `${entity.name} awards ${awarded} XP for a cycle the curve prices at under one.`,
                    why: 'XP is awarded in whole numbers and a cycle can never teach nothing, so a very short cycle at a low level rounds up. This is expected — those levels pass in minutes — and is not something to tune around.',
                    remedies: [
                        'Nothing, in almost every case: the levels this affects are over in minutes.',
                        'A slower Tempo tag lengthens the cycle and the rounding shrinks with it.',
                        'A higher required level raises the curve until a whole XP is the right answer.',
                    ],
                    detail: { awarded, delivered, target, cycleTimeMs, level: entity.level },
                }
            ));
        }
    }

    // ── The pacing ladder ───────────────────────────────────────────────────
    const projection = buildProjection(dials);
    const mapDays = new Map();
    for (const [id, report] of mapReports) {
        if (!report || report.skipped) continue;
        mapDays.set(id, dayInReach(report.cost, projection, dials));
    }

    return { xp, mapDays, projection, masteryHours: projection.masteryHours, rows };
}

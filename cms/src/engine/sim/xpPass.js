/**
 * Economic simulator, pass 5's XP half. `xp per cycle = XPH curve(required level) × purpose XP factor × cycle hours`, rounded, minimum 1. Recalculate derives it like every other number the game reads.
 * 1. XP is derived, never targeted: nothing asks whether a Token's XP is right and adjusts something to match, so the gold/XP seesaw below can never produce a conflict.
 * 2. The Purpose tag is a seesaw: the XP factors run the opposite way to the gold factors, so a GPH source pays well and teaches a trickle, an XPH source teaches fast and pays a trickle, and IPH sits between.
 * 3. The curve is a floor, not an average: `cycle hours` is the authored cycle length with no speed bonus, so a hero levelled past the gate out-trains it, deliberately unmodelled.
 * ⚠️ The granularity wobble is accepted, not a bug: the minimum-1 rule makes a Fast, GPH-tagged source at low levels over-teach (1 XP on a 10-second cycle is far above its target). It is documented here and files an Info row (`xp-granularity`) so nobody mistakes it for a defect.
 * It writes nothing: like every pass it returns Maps, and `sim/writeBack.js` is the one place a result becomes a stored field.
 */

import { xpForLevel } from '../../../../src/utils/XPCurve.js';
import { DEFAULT_DIALS, PURPOSE_XP_FACTORS, XPH_PINS, gphAt } from './dials.js';
import { makeRow, SEVERITY } from './rows.js';

export const PRINTED_XPH_PINS = Object.freeze({
    1: 700, 20: 2750, 40: 11800, 60: 50300, 80: 214000, 99: 837000,
});

/** How far a derived XP/hour may sit above its target before the granularity wobble is worth saying out loud: rounding one cycle up adds less than one XP, so on any cycle earning more than a couple of XP the effect is invisible. */
const WOBBLE_FACTOR = 1.5;

/**
 * Experience per hour at `level`, linearly interpolated between the pins.
 * ⚠️ Deliberately identical in shape to `gphAt` (straight lines between pins, flat below the first and above the last), so one growth number governing both curves does not read differently on each.
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

/** The Purpose tag's XP factor. An unknown or missing tag reads as 0 (it teaches nothing), and `xpPerCycle` turns that into no XP at all rather than the minimum of 1: the min-1 floor is a rounding rule for work that does teach and must never manufacture XP for work that does not. */
export function purposeXpFactor(purpose, dials = DEFAULT_DIALS) {
    const factors = dials.purposeXpFactors || PURPOSE_XP_FACTORS;
    return factors[purpose] ?? 0;
}

/**
 * XP awarded for one cycle. Returns `null` for anything the simulator cannot honestly answer: no solved cycle, a non-finite cycle length, a nonsense level, an untagged or unknown Purpose. `null`, never `NaN` and never 0.
 * ⚠️ A `NaN` here would be written onto a Token's `config.xp` and every comparison against it is `false`, so it would read as fine everywhere it was checked.
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
    return Math.max(1, Math.round(raw));
}

/** How long one focused skill takes to climb 1 → 99, in board-hours. The XPH curve is integrated against the game's own threshold curve, imported from `src/utils/XPCurve.js` rather than reimplemented, so the two cannot drift apart unnoticed. */
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
 * The pacing projection: where a hero is, and how much gold they have earned, after every board-hour of the climb.
 * ⚠️ It projects the notional worker the curves themselves describe, earning `gphAt(level)` and training at `xphAt(level)` with no Purpose factor on either side; that is the only reading that keeps the two curves talking about the same person.
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
 * The board-hours a projected hero needs to have earned `gold` in total. `null` for anything unanswerable: a non-finite or negative target, or a projection whose tail earns nothing.
 * ⚠️ Not `Infinity`: a caller formatting it would print Infinity into a table cell, and a dash is the honest rendering of the curves not getting there.
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

/** Estimated day in reach for a price, at `hoursPerDay` of play. Day 1 is the first day, so anything affordable inside the first session reads as day 1 rather than day 0. `null` where `hoursForGold` cannot answer, which the table renders as a dash. */
export function dayInReach(cost, projection, dials = DEFAULT_DIALS) {
    const hours = hoursForGold(cost, projection);
    if (hours === null) return null;
    const perDay = Number.isFinite(dials.hoursPerDay) && dials.hoursPerDay > 0
        ? dials.hoursPerDay
        : DEFAULT_DIALS.hoursPerDay;
    return Math.max(1, Math.ceil(hours / perDay));
}

/**
 * Derive XP per cycle for every entity with a solved cycle, and the pacing
 * projection.
 *
 * @param {Array}  entities  adapted entities, as `fieldAdapter` returns them
 * @param {object} ctx  `{ cycleTimes, skipped, dials }`
 * @returns {{ xp: Map, projection: object, masteryHours: number, rows: Array }}
 *
 * An entity the TIME pass skipped — inert, or untagged — gets **no entry**, and
 * the write-back therefore leaves its authored `xp` exactly as typed. That is
 * the untagged rule applied consistently: the simulator does not guess a tag, so
 * it does not derive the numbers that would follow from one.
 */
export function runXpPass(entities = [], {
    cycleTimes = new Map(),
    skipped = new Map(),
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

        // Delivered XP/hour against the target the curve set. Cycles per hour here is the plain cycle rate, matching the formula's own reading: the speed bonus lifts both sides equally and cancels.
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

    const projection = buildProjection(dials);
    return { xp, projection, masteryHours: projection.masteryHours, rows };
}

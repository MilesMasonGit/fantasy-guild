/**
 * Economic simulator, pass 5's XP half. `xp per cycle = XP an hour(required level) × purpose XP tilt × cycle hours`, rounded, minimum 1. Recalculate derives it like every other number the game reads. The curve and the tilt are the balance rules' (`../balanceRules.js`, BALANCE_RULES section 1), not dials.
 * 1. XP is derived, never targeted: nothing asks whether a Token's XP is right and adjusts something to match, so the gold/XP seesaw below can never produce a conflict.
 * 2. The Purpose tag is a seesaw, the rules' moderate tilt: training (XPH) pays 1.5x the XP and half the goods, balanced (IPH) both in full, earning (GPH) half the XP and 1.5x the goods.
 * ⚠️ Where the simulator stops short of section 1: it pays the plain XP an hour at the required level, not divided by the optimized boost factor, not at the midpoint to the skill's next unlock, and with no trimming of the cycle to whole XP. Those need the boost budget and each skill's unlock ladder, which the balancer's solver and the ledger hold; a balancing pack pins its numbers (`sim.xpPinned`) where it sets them.
 * 3. `cycle hours` is the authored cycle length, which every hero runs at: a skill level adds no work speed.
 * ⚠️ The granularity wobble is accepted, not a bug: the minimum-1 rule makes a Fast, GPH-tagged source at low levels over-teach (1 XP on a 10-second cycle is far above its target). It is documented here and files an Info row (`xp-granularity`) so nobody mistakes it for a defect.
 * It writes nothing: like every pass it returns Maps, and `sim/writeBack.js` is the one place a result becomes a stored field.
 * ⚠️ A pin (`sim.xpPinned`, set in the editors or by a balancing pack) means no entry, so the write-back keeps the record's own number. The curve assumes a hero works a source without a break, which a source limited by its rest or regrowth does not allow; the ledger's preview reads what it really teaches.
 */

import { xpForLevel } from '../../../../src/utils/XPCurve.js';
import { gphAt } from './dials.js';
import { xpAnHourAt, xpTilt } from '../balanceRules.js';
import { makeRow, SEVERITY } from './rows.js';

/** How far a derived XP/hour may sit above its target before the granularity wobble is worth saying out loud: rounding one cycle up adds less than one XP, so on any cycle earning more than a couple of XP the effect is invisible. */
const WOBBLE_FACTOR = 1.5;

/** Experience an hour of work at `level`, before its Purpose: the balance rules' XP curve (section 1). No dial moves it. */
export function xphAt(level) {
    return xpAnHourAt(level);
}

/** The Purpose tag's XP tilt. An unknown or missing tag reads as 0 (it teaches nothing), and `xpPerCycle` turns that into no XP at all rather than the minimum of 1: the min-1 floor is a rounding rule for work that does teach and must never manufacture XP for work that does not. */
export function purposeXpFactor(purpose) {
    return xpTilt(purpose);
}

/**
 * XP awarded for one cycle. Returns `null` for anything the simulator cannot honestly answer: no solved cycle, a non-finite cycle length, a nonsense level, an untagged or unknown Purpose. `null`, never `NaN` and never 0.
 * ⚠️ A `NaN` here would be written onto a Token's `config.xp` and every comparison against it is `false`, so it would read as fine everywhere it was checked.
 */
export function xpPerCycle(level, purpose, cycleTimeMs) {
    if (!Number.isFinite(cycleTimeMs) || cycleTimeMs <= 0) return null;
    if (!Number.isFinite(level) || level < 1) return null;
    const factor = purposeXpFactor(purpose);
    if (!Number.isFinite(factor) || factor <= 0) return null;
    const xph = xphAt(level);
    if (!Number.isFinite(xph) || xph <= 0) return null;
    const raw = xph * factor * (cycleTimeMs / 3600000);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.max(1, Math.round(raw));
}

/** How long one focused skill takes to climb 1 → 99, in board-hours. The XP curve is integrated against the game's own threshold curve, imported from `src/utils/XPCurve.js` rather than reimplemented, so the two cannot drift apart unnoticed. */
export function hoursToMastery() {
    let hours = 0;
    for (let level = 1; level < 99; level++) {
        const need = xpForLevel(level + 1) - xpForLevel(level);
        const rate = xphAt(level);
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
export function buildProjection() {
    const segments = [];
    let hours = 0;
    let gold = 0;
    for (let level = 1; level < 99; level++) {
        const need = xpForLevel(level + 1) - xpForLevel(level);
        const rate = xphAt(level);
        const gph = gphAt(level);
        if (!Number.isFinite(need) || need <= 0) continue;
        if (!Number.isFinite(rate) || rate <= 0) break;
        const span = need / rate;
        const earned = Number.isFinite(gph) && gph > 0 ? gph * span : 0;
        segments.push({ level, hoursAtStart: hours, goldAtStart: gold, hours: span, gold: earned });
        hours += span;
        gold += earned;
    }
    const tailGph = gphAt(99);
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

/**
 * Derive XP per cycle for every entity with a solved cycle, and the pacing
 * projection.
 *
 * @param {Array}  entities  adapted entities, as `fieldAdapter` returns them
 * @param {object} ctx  `{ cycleTimes, skipped }`
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
} = {}) {
    const xp = new Map();
    const rows = [];

    for (const entity of entities) {
        if (!entity || skipped.has(entity.id)) continue;
        const cycleTimeMs = cycleTimes.get(entity.id);
        const awarded = xpPerCycle(entity.level, entity.purpose, cycleTimeMs);
        if (awarded === null) continue;
        if (entity.xpPinned) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'xp-pinned',
                `${entity.name}'s XP a cycle is pinned at ${entity.authoredXp ?? 'nothing'}; the curve would give ${awarded}.`,
                {
                    entityId: entity.id,
                    what: `${entity.name} keeps the XP a cycle written on it, whatever its level, Tempo and Purpose would derive.`,
                    why: 'Recalculate and Sync leave a pinned number alone. A balancing pack pins the XP numbers it sets, so they survive.',
                    remedies: ['Untick the pin beside its XP in the editor to let Recalculate derive it again.'],
                    detail: { pinned: entity.authoredXp, derived: awarded, cycleTimeMs, level: entity.level },
                }
            ));
            continue;
        }
        xp.set(entity.id, awarded);

        // Delivered XP/hour against the target the curve set. Cycles per hour here is the plain cycle rate, matching the formula's own reading.
        const cyclesPerHour = 3600000 / cycleTimeMs;
        const delivered = awarded * cyclesPerHour;
        const target = xphAt(entity.level) * purposeXpFactor(entity.purpose);
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

    const projection = buildProjection();
    return { xp, projection, masteryHours: projection.masteryHours, rows };
}

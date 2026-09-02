/**
 * Economic simulator — the **check pass** (phase P9).
 *
 * Every other pass derives something. This one derives nothing at all: it reads
 * the settled line and says out loud what looks wrong. Two checks live here.
 *
 * ## 1. The progression guard (plan §13.5, correction F1)
 *
 * > The band **ceiling** at level L must sit below the band **floor** at level
 * > L+10, everywhere on the curve.
 *
 * That is criterion 4's real promise — *a level-20 source out-earns a level-10
 * source, always* — and it is the one refusal in this tool aimed at the
 * **developer's dials** rather than at content. Turn the band widths up far
 * enough, or flatten the earn curve far enough, and two decades of the game
 * start paying the same; nothing else in the simulator would notice.
 *
 * F1 already corrected the plan once: the guard holds for **anchor bands only**,
 * because the doubled non-anchor band overlaps at the 10/20 seam (level 10's
 * non-anchor ceiling ~3,450 against level 20's non-anchor floor ~3,325). Both
 * numbers are verified against the shipped curve in `EconSimGuards.test.js`.
 *
 * ### ⚠️ A second exception, found in P9 and NOT in the plan
 *
 * The claim is not true of the shipped anchor curve either, at the top end.
 * §13.1 deliberately bends the gold curve at level 70 — 7.5%/level below it,
 * ~2%/level above — and ten levels of 2% growth is ×1.219, while clearing a
 * ±10% band from ceiling to floor needs ×1.223. So the ordering fails by a
 * fraction of a percent at **13 level pairs between 72 and 99**, on the default
 * dials, with no dial turned wrongly. It is the plan's own late-game
 * flattening, not a mistake anyone made.
 *
 * Refusing the shipped defaults would make the guard the first thing a new user
 * has to learn to ignore, so the guard **refuses only where the curve is still
 * compounding** (both levels of the pair at or below the bend) and reports the
 * flattened tail as a single named Info row. Same treatment F1 gave the
 * non-anchor seam: checked, named, accepted, and visible.
 *
 * ## 2. Charge scale, hours-first (CMS-135, ruled 2026-08-28)
 *
 * > The panel always shows lifetime-in-hours, with soft Info rows for scale
 * > outliers — a Common living over about a day, any Token living under about
 * > ten minutes.
 *
 * Charges stay hand-typed (D-176 untouched); this only translates them into the
 * unit a designer can feel, and complains when the translation is absurd. It is
 * what stops the old corpus's 1-to-8,000 charge spread recurring unnoticed.
 *
 * ⚠️ Charges are read through `liveCharges` — **`uses`, never `charges`** (S6).
 *
 * Like every pass here this one writes nothing: a caller gets rows and a Map.
 */

import { gphAt, toleranceFor, DEFAULT_DIALS } from './dials.js';
import { isInert, liveCharges } from './fieldAdapter.js';
import { cyclesPerHour } from './tuningPass.js';
import { makeRow, SEVERITY } from './rows.js';
import { makeRefusal } from './refusals.js';

/** The stride criterion 4 is stated over: ten levels of progress. */
export const GUARD_STRIDE = 10;

/** The top of the skill range the guard walks. */
export const GUARD_MAX_LEVEL = 99;

/**
 * Where §13.1's earn curve stops compounding at 7.5%/level and flattens to ~2%.
 *
 * ⚠️ Above this level the ±10% band is wider than ten levels of growth, so the
 * ordering cannot hold there whatever anyone types. Pairs that reach past it are
 * reported, never refused — see the header note.
 */
export const CURVE_FLATTENS_AT = 70;

/** A Common that lives longer than this reads as scenery, not as a supply. */
export const LONG_LIFETIME_HOURS = 24;

/** Anything shorter than this is gone before a player has looked at it. */
export const SHORT_LIFETIME_HOURS = 10 / 60;

/**
 * Walk the curve and compare each level's band ceiling with the floor ten
 * levels up. Pure arithmetic over the dials — no corpus, no content.
 *
 * @returns {{ violations: Array, refusable: Array, tail: Array }}
 *   `refusable` are the pairs entirely inside the compounding stretch; `tail`
 *   are the ones the late-game flattening explains.
 */
export function progressionGuardFindings(dials = DEFAULT_DIALS) {
    const violations = [];
    for (let level = 1; level + GUARD_STRIDE <= GUARD_MAX_LEVEL; level++) {
        const upper = level + GUARD_STRIDE;
        // Anchor bands only (F1). `toleranceFor` defaults to the anchor band;
        // the doubled non-anchor band is the accepted seam overlap.
        const ceiling = gphAt(level, dials) * (1 + toleranceFor(level, dials));
        const floor = gphAt(upper, dials) * (1 - toleranceFor(upper, dials));
        if (ceiling < floor) continue;
        violations.push({ level, upper, ceiling, floor, tail: upper > CURVE_FLATTENS_AT });
    }
    return {
        violations,
        refusable: violations.filter((v) => !v.tail),
        tail: violations.filter((v) => v.tail),
    };
}

/** The guard's rows: at most one refusal, at most one Info. */
export function progressionGuardRows(dials = DEFAULT_DIALS) {
    const { refusable, tail } = progressionGuardFindings(dials);
    const rows = [];
    const g = (n) => Math.round(n).toLocaleString();

    if (refusable.length > 0) {
        // The worst pair leads, because it is the one that explains the shape of
        // the mistake; the count says how much of the curve is affected. One row
        // rather than sixty — a badly-typed band width breaks most of the ladder
        // at once, and sixty criticals would bury every row about content.
        const worst = [...refusable].sort((a, b) => (b.ceiling - b.floor) - (a.ceiling - a.floor))[0];
        rows.push(makeRefusal('progression-guard', {
            what: `A level ${worst.level} source may earn up to ${g(worst.ceiling)}g/h, and a level ${worst.upper} source may earn as little as ${g(worst.floor)}g/h.`,
            why: `Ten levels of progress is supposed to be worth more than the spread inside one level, and at these dials it is not — ${refusable.length === 1 ? 'one pair of levels overlaps' : `${refusable.length} pairs of levels overlap`}, so a player levelling up can end up earning less than they did before.`,
        }, {
            detail: {
                pairs: refusable.length,
                worst: { level: worst.level, upper: worst.upper, ceiling: worst.ceiling, floor: worst.floor },
            },
        }));
    }

    if (tail.length > 0) {
        const first = tail[0];
        const last = tail[tail.length - 1];
        rows.push(makeRow(
            SEVERITY.INFO,
            'progression-guard-tail',
            `Above level ${CURVE_FLATTENS_AT} the earn curve flattens on purpose, and ten levels of it no longer clear the tolerance band — ${tail.length} level pairs between ${first.level} and ${last.upper} overlap slightly. Named and accepted, not refused: it is the late-game compression the earn curve is designed around.`,
            {
                remedies: [
                    'Nothing, if late levels are meant to be about efficiency rather than rate.',
                    'Narrow the top band width dial, if the overlap up here bothers you.',
                    'Raise the late earn-curve pins, if the curve should keep climbing to 99.',
                ],
                detail: { pairs: tail.length, from: first.level, to: last.upper },
            }
        ));
    }

    return rows;
}

/**
 * One Token's lifetime, hours first (CMS-135).
 *
 * `hours = charges ÷ cycles per hour` — how long one copy lasts in work, not how
 * long the player owns it. A Token with no charge count never runs out and
 * reports `unlimited` rather than a number it does not have.
 */
export function lifetimeOf(entity, { cycleTimeMs, dials = DEFAULT_DIALS } = {}) {
    const charges = entity?.charges;
    const unlimited = !Number.isFinite(charges) || charges <= 0;
    const cph = cyclesPerHour(cycleTimeMs, entity?.level);
    if (unlimited) {
        return {
            charges: null,
            unlimited: true,
            hours: dials.unlimitedLifetimeHours ?? DEFAULT_DIALS.unlimitedLifetimeHours,
            assumed: true,
        };
    }
    if (!(cph > 0)) return { charges, unlimited: false, hours: null, assumed: false };
    return { charges, unlimited: false, hours: charges / cph, assumed: false };
}

/**
 * Run the check pass.
 *
 * @param {Array} entities   adapted entities
 * @param {object} ctx       `{ cycleTimes, skipped, tokens, dials }`
 * @returns {{ rows: Array, lifetimes: Map }}
 *   `lifetimes` is keyed by entity id and is what the Simulator panel prints;
 *   recipes are absent from it, because a recipe has no copies to spend.
 */
export function runCheckPass(entities = [], {
    cycleTimes = new Map(),
    skipped = new Map(),
    tokens = {},
    dials = DEFAULT_DIALS,
} = {}) {
    const rows = progressionGuardRows(dials);
    const lifetimes = new Map();

    for (const entity of entities) {
        if (entity.kind !== 'token') continue;
        if (isInert(entity) || skipped.has(entity.id)) continue;

        const life = lifetimeOf(entity, { cycleTimeMs: cycleTimes.get(entity.id), dials });
        lifetimes.set(entity.id, life);

        // An unlimited Token has no authored lifetime to be an outlier of — the
        // Map check already names it (`map-unlimited-token`), and repeating the
        // complaint in a second vocabulary would be two rows for one situation.
        if (life.unlimited || !Number.isFinite(life.hours)) continue;

        const rarity = tokens[entity.id]?.rarity ?? entity.rarity ?? null;
        const hours = life.hours;

        if (rarity === 'common' && hours > LONG_LIFETIME_HOURS) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'charge-lifetime-long',
                `${entity.name} is Common and one copy lasts about ${formatHours(hours)} of work — over a day at the board.`,
                {
                    entityId: entity.id,
                    remedies: [
                        'Give it fewer charges, if an everyday Token should be spent and replaced.',
                        'Tag it rarer, if a copy this long-lived is meant to be a find.',
                        'Nothing, if this Token is scenery a player sets up once.',
                    ],
                    detail: { hours, charges: life.charges, rarity },
                }
            ));
        }

        if (hours < SHORT_LIFETIME_HOURS) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'charge-lifetime-short',
                `${entity.name} is spent in about ${formatHours(hours)} of work — a player will barely see it run.`,
                {
                    entityId: entity.id,
                    remedies: [
                        'Give it more charges, so one copy is worth placing.',
                        'Tag it a slower Tempo, if each cycle should be a bigger event.',
                        'Nothing, if it is meant to be a one-shot.',
                    ],
                    detail: { hours, charges: life.charges, rarity },
                }
            ));
        }
    }

    return { rows, lifetimes };
}

/**
 * Hours, in the unit a person would say out loud.
 *
 * Under an hour reads in minutes, because "0.1h" is a number a designer has to
 * convert before it means anything and the whole point of CMS-135 is that they
 * should not have to.
 */
export function formatHours(hours) {
    if (!Number.isFinite(hours)) return 'unknown';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 10) return `${hours.toFixed(1)}h`;
    return `${Math.round(hours)}h`;
}

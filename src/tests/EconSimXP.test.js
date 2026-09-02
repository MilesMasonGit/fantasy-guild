/**
 * Economic simulator — pass 5's XP half (phase P8).
 *
 * Covers `cms/src/engine/sim/xpPass.js`: the §13.2 curve and its reconciliation
 * against the plan's stated 7.5%/level growth, the §8 per-cycle formula, the
 * Purpose seesaw, the min-1 floor and F8's accepted granularity wobble, the
 * mastery integration against the game's own thresholds, the day-in-reach
 * ladder, the non-finite guard, and idempotence.
 *
 * ## ⚠️ No test here names a shipped Token, item, recipe or Map id
 *
 * The owner authors in this workspace continuously and content-naming tests
 * have broken a dozen times. Everything specific is a fixture; everything
 * asserted against the real corpus is a **rule** that holds whatever the corpus
 * happens to contain.
 *
 * ## ⚠️ Bands, not points, wherever the claim is about shape
 *
 * "One focused skill reaches 99 in 50–60 hours" is a shape claim. Asserting it
 * to a decimal would be fragile theatre that breaks the first time a pin moves
 * by a percent, and would tell nobody anything when it did.
 */

import { describe, it, expect } from 'vitest';

import {
    runXpPass, xphAt, purposeXpFactor, xpPerCycle, hoursToMastery,
    buildProjection, hoursForGold, dayInReach, PRINTED_XPH_PINS,
} from '../../cms/src/engine/sim/xpPass.js';
import { normaliseDials, XPH_PINS, PURPOSE_XP_FACTORS } from '../../cms/src/engine/sim/dials.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { applyTokenResults, applyRecipePoolResults } from '../../cms/src/engine/sim/writeBack.js';
import { xpForLevel } from '../utils/XPCurve.js';

import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';
import itemData from '../../data/items.json';
import mapData from '../../data/maps.json';

const DIALS = normaliseDials();

/** The plan's stated mechanism: 7.5% compounding per level from 700 at level 1. */
const stated = (level) => 700 * Math.pow(1.075, level - 1);

/** A minimal adapted-entity shape, so no test needs a shipped record. */
function fixtureEntity(overrides = {}) {
    return {
        id: 'fx_source',
        name: 'Fixture Source',
        kind: 'token',
        skill: 'mining',
        level: 40,
        purpose: 'xph',
        tempo: 'standard',
        inputs: [],
        outputs: [{ itemId: 'fx_item', abundance: 1, avgQty: 1, chance: 1, chancePercent: 100, minQty: 1, maxQty: 1 }],
        ...overrides,
    };
}

// === §13.2's curve ===========================================================

describe('the XPH curve (plan §13.2)', () => {
    it('reproduces every printed pin exactly', () => {
        for (const [level, value] of Object.entries(PRINTED_XPH_PINS)) {
            expect(xphAt(Number(level), DIALS)).toBe(value);
        }
    });

    it('reconciles every printed pin with 7.5%/level compounding from 700', () => {
        // The reconciliation the plan asks for, done as an assertion rather than
        // as a note: mechanism and printed table must be one curve, not two.
        for (const [level, value] of Object.entries(PRINTED_XPH_PINS)) {
            const drift = Math.abs(value / stated(Number(level)) - 1);
            expect(drift).toBeLessThan(0.01);
        }
    });

    it('grows at close to 7.5% per level across every stored segment', () => {
        const levels = Object.keys(XPH_PINS).map(Number).sort((a, b) => a - b);
        for (let i = 1; i < levels.length; i++) {
            const span = levels[i] - levels[i - 1];
            const rate = Math.pow(XPH_PINS[levels[i]] / XPH_PINS[levels[i - 1]], 1 / span) - 1;
            expect(rate).toBeGreaterThan(0.07);
            expect(rate).toBeLessThan(0.08);
        }
    });

    it('interpolates in a straight line between pins, like the gold curve', () => {
        const pins = { 10: 1000, 20: 3000 };
        const dials = { ...DIALS, xphPins: pins };
        expect(xphAt(15, dials)).toBe(2000);   // the midpoint, not the geometric mean
        expect(xphAt(12, dials)).toBe(1400);
    });

    it('is flat below the first pin and above the last', () => {
        expect(xphAt(0, DIALS)).toBe(xphAt(1, DIALS));
        expect(xphAt(-5, DIALS)).toBe(xphAt(1, DIALS));
        expect(xphAt(200, DIALS)).toBe(xphAt(99, DIALS));
    });

    it('rises monotonically over the whole level range', () => {
        for (let level = 2; level <= 99; level++) {
            expect(xphAt(level, DIALS)).toBeGreaterThan(xphAt(level - 1, DIALS));
        }
    });
});

// === §8's formula ============================================================

describe('xp per cycle (plan §8)', () => {
    it('is curve × purpose factor × cycle hours, rounded', () => {
        const level = 60;
        const cycleTimeMs = 60_000; // one minute
        const expected = Math.round(xphAt(level, DIALS) * PURPOSE_XP_FACTORS.xph * (1 / 60));
        expect(xpPerCycle(level, 'xph', cycleTimeMs, DIALS)).toBe(expected);
    });

    it('scales linearly with cycle length', () => {
        const short = xpPerCycle(60, 'xph', 30_000, DIALS);
        const long = xpPerCycle(60, 'xph', 60_000, DIALS);
        expect(long).toBe(2 * short);
    });
});

describe('the Purpose seesaw', () => {
    it('trains an XPH source about 3× a GPH source at the same level and cycle', () => {
        // The factors are 1.0 / 0.5 / 0.3, so XPH ÷ GPH is 3⅓ before rounding.
        const level = 70;
        const cycleTimeMs = 120_000; // long enough that rounding is negligible
        const xph = xpPerCycle(level, 'xph', cycleTimeMs, DIALS);
        const gph = xpPerCycle(level, 'gph', cycleTimeMs, DIALS);
        expect(xph / gph).toBeGreaterThan(3);
        expect(xph / gph).toBeLessThan(3.5);
    });

    it('orders the three tags XPH > IPH > GPH, the mirror of the gold factors', () => {
        const at = (purpose) => xpPerCycle(50, purpose, 120_000, DIALS);
        expect(at('xph')).toBeGreaterThan(at('iph'));
        expect(at('iph')).toBeGreaterThan(at('gph'));
    });

    it('reads an unknown or missing Purpose tag as no XP at all, never as the minimum', () => {
        // ⚠️ The min-1 floor is a rounding rule for work that does teach. If it
        // applied here, an untagged producer would silently start awarding XP.
        expect(purposeXpFactor('nonsense', DIALS)).toBe(0);
        expect(xpPerCycle(50, 'nonsense', 60_000, DIALS)).toBeNull();
        expect(xpPerCycle(50, null, 60_000, DIALS)).toBeNull();
        expect(xpPerCycle(50, undefined, 60_000, DIALS)).toBeNull();
    });
});

describe('the min-1 floor, and F8’s accepted granularity wobble', () => {
    it('never awards a cycle less than 1 XP', () => {
        // A one-second cycle at level 1 on the least-teaching tag.
        expect(xpPerCycle(1, 'gph', 1000, DIALS)).toBe(1);
    });

    it('over-teaches a fast, gold-tagged, low-level source — expected, not a bug', () => {
        // F8, stated as an assertion so nobody later reads it off the data and
        // files it as a defect. A 10s cycle at level 1 on the GPH tag is priced
        // by the curve at well under one XP, rounds up to 1, and therefore
        // delivers roughly double the curve's hourly target. Accepted: those
        // levels pass in minutes, and closing the gap would mean running XP
        // through the lever machinery for precision worth nothing.
        const cycleTimeMs = 10_000;
        const awarded = xpPerCycle(1, 'gph', cycleTimeMs, DIALS);
        const target = xphAt(1, DIALS) * purposeXpFactor('gph', DIALS);
        const delivered = awarded * (3600000 / cycleTimeMs);

        expect(awarded).toBe(1);
        expect(delivered).toBeGreaterThan(target);      // it over-teaches …
        expect(delivered).toBeLessThan(target * 2.5);   // … but only by the rounding
    });

    it('stops over-teaching once a cycle is worth more than a couple of XP', () => {
        const cycleTimeMs = 30_000;
        const level = 40;
        const awarded = xpPerCycle(level, 'gph', cycleTimeMs, DIALS);
        const target = xphAt(level, DIALS) * purposeXpFactor('gph', DIALS);
        const delivered = awarded * (3600000 / cycleTimeMs);
        // Rounding can only ever add under one XP to a cycle, so once a cycle is
        // worth dozens the effect is invisible. This is the other half of the F8
        // statement: the wobble is bounded, and it is bounded by arithmetic
        // rather than by anything the simulator does about it.
        const raw = target * (cycleTimeMs / 3600000);
        expect(awarded).toBeGreaterThan(10);
        expect(Math.abs(awarded - raw)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(delivered / target - 1)).toBeLessThan(0.02);
    });

    it('files an Info row naming the wobble, rather than leaving it silent', () => {
        const entity = fixtureEntity({ level: 1, purpose: 'gph' });
        const { rows } = runXpPass([entity], {
            cycleTimes: new Map([[entity.id, 10_000]]),
            dials: DIALS,
        });
        const wobble = rows.filter((r) => r.code === 'xp-granularity');
        expect(wobble).toHaveLength(1);
        expect(wobble[0].severity).toBe('info');
        expect(wobble[0].remedies.length).toBeGreaterThan(0);
    });
});

// === The non-finite guard ====================================================

describe('the non-finite guard (the P7 lesson, applied ahead of time)', () => {
    // ⚠️ A NaN written onto `config.xp` would compare false against every bound
    // anyone later checked it with, so it would read as fine everywhere. These
    // pin that the pass returns *nothing* instead.
    const bad = [
        ['no solved cycle', undefined],
        ['a null cycle', null],
        ['a NaN cycle', NaN],
        ['a zero cycle', 0],
        ['a negative cycle', -5000],
        ['an infinite cycle', Infinity],
    ];

    for (const [label, cycleTimeMs] of bad) {
        it(`yields no XP for ${label}, never NaN`, () => {
            const result = xpPerCycle(50, 'xph', cycleTimeMs, DIALS);
            expect(result).toBeNull();
            expect(Number.isNaN(result)).toBe(false);
        });
    }

    const nonsenseLevels = [NaN, null, undefined, Infinity, -1, 0];
    for (const level of nonsenseLevels) {
        it(`yields no XP for a level of ${String(level)}`, () => {
            expect(xpPerCycle(level, 'xph', 60_000, DIALS)).toBeNull();
        });
    }

    it('leaves an unanswerable entity out of the pass’s map entirely', () => {
        const entity = fixtureEntity();
        const { xp } = runXpPass([entity], { cycleTimes: new Map(), dials: DIALS });
        expect(xp.has(entity.id)).toBe(false);
    });

    it('never returns a non-finite value for any entity it does answer for', () => {
        const sim = runSim({ tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData });
        expect(sim.xp.size).toBeGreaterThan(0);
        for (const [id, value] of sim.xp) {
            expect(Number.isFinite(value), `${id} produced ${value}`).toBe(true);
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(1);
        }
    });

    it('produces no XP for an entity the TIME pass skipped', () => {
        const entity = fixtureEntity();
        const { xp } = runXpPass([entity], {
            cycleTimes: new Map([[entity.id, 60_000]]),
            skipped: new Map([[entity.id, 'untagged']]),
            dials: DIALS,
        });
        expect(xp.has(entity.id)).toBe(false);
    });
});

// === The mastery integration =================================================

describe('the mastery check (plan §13.2)', () => {
    it('takes one focused skill 1→99 inside the 50–60 board-hour band', () => {
        const hours = hoursToMastery(DIALS);
        expect(hours).toBeGreaterThanOrEqual(50);
        expect(hours).toBeLessThanOrEqual(60);
    });

    it('integrates against the game’s own threshold curve, not a copy of it', () => {
        // If the CMS ever grew its own thresholds, this sum would stop matching
        // the imported one and the mastery claim would quietly become fiction.
        let hours = 0;
        for (let level = 1; level < 99; level++) {
            hours += (xpForLevel(level + 1) - xpForLevel(level)) / xphAt(level, DIALS);
        }
        expect(hoursToMastery(DIALS)).toBeCloseTo(hours, 6);
    });

    it('is classically back-loaded: the last ten levels are a quarter to a third of the climb', () => {
        const segment = (from, to) => {
            let hours = 0;
            for (let level = from; level < to; level++) {
                hours += (xpForLevel(level + 1) - xpForLevel(level)) / xphAt(level, DIALS);
            }
            return hours;
        };
        const total = hoursToMastery(DIALS);
        const lastTen = segment(89, 99);
        const firstTwenty = segment(1, 20);

        expect(lastTen / total).toBeGreaterThan(0.20);
        expect(lastTen / total).toBeLessThan(0.35);
        // Early levels are minutes, not hours — the other half of "back-loaded".
        expect(firstTwenty).toBeLessThan(5);
        // And every single one of the last ten costs over half an hour.
        for (let level = 89; level < 99; level++) {
            expect(segment(level, level + 1)).toBeGreaterThan(0.5);
        }
    });

    it('moves when a pin moves, so the read-out is not decorative', () => {
        const doubled = Object.fromEntries(
            Object.entries(XPH_PINS).map(([level, value]) => [level, value * 2])
        );
        const faster = hoursToMastery(normaliseDials({ xphPins: doubled }));
        expect(faster).toBeCloseTo(hoursToMastery(DIALS) / 2, 5);
    });
});

// === Day in reach ============================================================

describe('the day-in-reach ladder', () => {
    const projection = buildProjection(DIALS);

    it('needs no time at all for a free thing, and day 1 is the earliest day', () => {
        expect(hoursForGold(0, projection)).toBe(0);
        expect(dayInReach(0, projection, DIALS)).toBe(1);
        expect(dayInReach(1, projection, DIALS)).toBe(1);
    });

    it('divides board-hours by the assumed hours per day, rounding up', () => {
        const cost = 5_000_000;
        const hours = hoursForGold(cost, projection);
        expect(Number.isFinite(hours)).toBe(true);
        for (const hoursPerDay of [1, 4, 8, 16]) {
            const dials = normaliseDials({ hoursPerDay });
            expect(dayInReach(cost, buildProjection(dials), dials))
                .toBe(Math.max(1, Math.ceil(hoursForGold(cost, buildProjection(dials)) / hoursPerDay)));
        }
    });

    it('puts a more expensive thing no earlier than a cheaper one', () => {
        let previous = 0;
        for (const cost of [1_000, 100_000, 1e6, 1e7, 1e8, 1e9]) {
            const day = dayInReach(cost, projection, DIALS);
            expect(day).toBeGreaterThanOrEqual(previous);
            previous = day;
        }
    });

    it('falls back to a nonsense hoursPerDay rather than dividing by it', () => {
        for (const hoursPerDay of [0, -3, NaN, null]) {
            const day = dayInReach(1e6, projection, { ...DIALS, hoursPerDay });
            expect(Number.isFinite(day)).toBe(true);
            expect(day).toBeGreaterThanOrEqual(1);
        }
    });

    it('answers null, not NaN or Infinity, for an unanswerable price', () => {
        for (const cost of [NaN, undefined, null, -100, Infinity]) {
            expect(dayInReach(cost, projection, DIALS)).toBeNull();
        }
    });

    it('projects income that only ever grows, and never stalls after 99', () => {
        expect(projection.goldAtMastery).toBeGreaterThan(0);
        expect(projection.tailGph).toBeGreaterThan(0);
        let goldSoFar = 0;
        let hoursSoFar = 0;
        for (const segment of projection.segments) {
            expect(segment.goldAtStart).toBeCloseTo(goldSoFar, 5);
            expect(segment.hoursAtStart).toBeCloseTo(hoursSoFar, 5);
            expect(segment.hours).toBeGreaterThan(0);
            goldSoFar += segment.gold;
            hoursSoFar += segment.hours;
        }
        expect(hoursSoFar).toBeCloseTo(projection.masteryHours, 5);
    });

    it('gives every priced Map a whole-number day, and skipped Maps none', () => {
        const sim = runSim({ tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData });
        for (const report of sim.maps.values()) {
            if (report.skipped) {
                expect('dayInReach' in report).toBe(false);
                continue;
            }
            const day = report.dayInReach;
            if (day === null) continue;
            expect(Number.isInteger(day)).toBe(true);
            expect(day).toBeGreaterThanOrEqual(1);
        }
    });
});

// === Write-back ==============================================================

describe('write-back — only the fields the runtime reads (finding S18)', () => {
    it('writes a recipe’s `xp` and a Token’s `config.xp`', () => {
        const sim = runSim({ tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData });
        const tokens = applyTokenResults(tokenData, sim);
        let written = 0;
        for (const [id, token] of Object.entries(tokens)) {
            const derived = sim.xp.get(token?.id ?? id);
            if (derived === undefined) continue;
            expect(token.config.xp).toBe(derived);
            written += 1;
        }
        expect(written).toBeGreaterThan(0);
    });

    it('leaves a Token’s dead top-level `xp` exactly as authored', () => {
        // ⚠️ Nothing at runtime reads `token.xp` — `BoardRunner` awards
        // `io.xp ?? config.xp`. It is flagged as a cleanup candidate and
        // deliberately NOT deleted here: removing it is a content migration for
        // its own sitting, and writing it would create a second, disagreeing
        // number where the game reads one.
        const sim = runSim({ tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData });
        const tokens = applyTokenResults(tokenData, sim);
        for (const [id, before] of Object.entries(tokenData)) {
            const after = tokens[id];
            expect('xp' in after).toBe('xp' in before);
            if ('xp' in before) expect(after.xp).toBe(before.xp);
        }
    });

    it('leaves authored `xp` alone on anything the pass had no answer for', () => {
        const sim = { xp: new Map(), cycleTimes: new Map(), downcycles: new Map(), tunings: new Map(), scrapValues: new Map() };
        const tokens = applyTokenResults({ fx: { id: 'fx', config: { xp: 42, outputs: [] } } }, sim);
        expect(tokens.fx.config.xp).toBe(42);

        const pools = applyRecipePoolResults({ mining: [{ id: 'fx_r', xp: 17, outputs: [] }] }, sim);
        expect(pools.mining[0].xp).toBe(17);
    });

    it('writes a recipe’s xp through the pool write-back', () => {
        const sim = {
            xp: new Map([['fx_r', 88]]),
            cycleTimes: new Map(), downcycles: new Map(), tunings: new Map(), scrapValues: new Map(),
        };
        const pools = applyRecipePoolResults({ mining: [{ id: 'fx_r', xp: 17, outputs: [] }] }, sim);
        expect(pools.mining[0].xp).toBe(88);
    });
});

// === Idempotence =============================================================

describe('idempotence (plan §11)', () => {
    it('derives byte-identical XP and days on two consecutive runs', () => {
        const corpus = { tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData };
        const first = runSim(corpus);
        const second = runSim(corpus);
        expect([...second.xp.entries()]).toEqual([...first.xp.entries()]);
        expect(second.masteryHours).toBe(first.masteryHours);
        expect([...second.maps.values()].map((m) => m.dayInReach ?? null))
            .toEqual([...first.maps.values()].map((m) => m.dayInReach ?? null));
    });

    it('is stable when a run is fed its own written-back output', () => {
        const corpus = { tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData };
        const first = runSim(corpus);
        const tokens = applyTokenResults(tokenData, first);
        const second = runSim({ ...corpus, tokens });
        expect([...second.xp.entries()]).toEqual([...first.xp.entries()]);
    });
});

// === Rules over the real corpus ==============================================
//
// ⚠️ Rules only. Nothing below names a shipped id, and nothing below asserts a
// number that authoring could legitimately change.

describe('rules that hold over whatever the corpus contains', () => {
    const sim = runSim({ tokens: tokenData, recipes: recipeData, items: itemData, maps: mapData });
    const entities = adaptCorpus({ tokens: tokenData, recipes: recipeData });

    it('derives XP for exactly the entities that got a solved cycle and a Purpose tag', () => {
        for (const entity of entities) {
            const solved = Number.isFinite(sim.cycleTimes.get(entity.id))
                && !sim.skipped.has(entity.id);
            const factor = purposeXpFactor(entity.purpose, sim.dials);
            expect(sim.xp.has(entity.id)).toBe(solved && factor > 0);
        }
    });

    it('never derives XP that disagrees with the formula it claims to use', () => {
        for (const [id, awarded] of sim.xp) {
            const entity = entities.find((e) => e.id === id);
            expect(awarded).toBe(
                xpPerCycle(entity.level, entity.purpose, sim.cycleTimes.get(id), sim.dials)
            );
        }
    });

    it('teaches more per hour at a higher level, given the same tag and cycle', () => {
        const perHour = (level) => {
            const xp = xpPerCycle(level, 'iph', 60_000, sim.dials);
            return xp * 60;
        };
        for (let level = 2; level <= 99; level++) {
            expect(perHour(level)).toBeGreaterThanOrEqual(perHour(level - 1));
        }
    });
});

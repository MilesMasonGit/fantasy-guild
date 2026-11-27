/**
 * One rulebook (T-715): with the `rulebook` dial on, Recalculate's XP an hour, worth an hour,
 * purpose tilt and optimized boost factor come from the balance rules
 * (`cms/src/engine/balanceRules.js`, BALANCE_RULES sections 1, 5 and 7), a dial set stored before
 * cannot bring the old curves back, and the progression guard strides a tier. With it off (the
 * default), the simulator is main's: the pins, the purpose factors, the ten-level guard.
 *
 * ⚠️ Fixtures only: no shipped id.
 */

import { describe, it, expect } from 'vitest';

import { xpPerCycle, xphAt, purposeXpFactor, hoursToMastery } from '../../cms/src/engine/sim/xpPass.js';
import { normaliseDials, gphAt, purposeGoldFactor, DEFAULT_DIALS } from '../../cms/src/engine/sim/dials.js';
import { progressionGuardFindings, progressionGuardRows, guardStride } from '../../cms/src/engine/sim/checkPass.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { recalculateWorkspace } from '../../cms/src/engine/recalculate.js';
import { xpAnHourAt, worthAnHourAt, optimizedBoostFactor, PURPOSE_TILT } from '../../cms/src/engine/balanceRules.js';
import { DEFAULT_LEDGER_SETTINGS } from '../../cms/src/engine/ledger/settings.js';

const HOUR_MS = 3600000;
const ON = normaliseDials({ rulebook: true });

/** The dial set the owner's workspace stores today: the old pins and the old purpose factors. */
const STORED_BEFORE = Object.freeze({
    gphPins: { 1: 1200, 10: 2300, 20: 4750, 30: 9800, 40: 20200, 50: 41600, 60: 85800, 70: 177000, 85: 238000, 99: 314000 },
    xphPins: { 1: 700, 10: 1340, 20: 2750, 30: 5700, 40: 11800, 50: 24200, 60: 50300, 70: 103000, 80: 214000, 90: 437000, 99: 837000 },
    purposeGoldFactors: { gph: 1, iph: 0.35, xph: 0.1 },
    purposeXpFactors: { xph: 1, iph: 0.5, gph: 0.3 },
});

const out = (itemId) => ({ itemId, chance: 100, minQty: 1, maxQty: 1 });
const token = (id, { level = 1, purpose = 'iph', tempo = 'medium', outputs = [out('fx_item')] } = {}) => ({
    id, name: id, rarity: 'common', tokenType: 'resource', uses: 10,
    config: { skill: 'forestry', skillRequired: level, cycleTimeMs: 10000, inputs: [], outputs },
    sim: { tempo, purpose },
});
const corpus = () => ({
    tokens: {
        a: token('fx_low', { level: 5, purpose: 'xph' }),
        b: token('fx_mid', { level: 40, purpose: 'iph', outputs: [out('fx_mid_item')] }),
        c: token('fx_high', { level: 85, purpose: 'gph', outputs: [out('fx_high_item')] }),
    },
    items: { fx_item: { id: 'fx_item' }, fx_mid_item: { id: 'fx_mid_item' }, fx_high_item: { id: 'fx_high_item' } },
});

describe('the switch', () => {
    it('is off by default', () => {
        expect(DEFAULT_DIALS.rulebook).toBe(false);
        expect(normaliseDials().rulebook).toBe(false);
    });
});

describe('off: the simulator is main\'s', () => {
    it('reads the pins and the purpose factors', () => {
        expect(gphAt(99)).toBe(314000);
        expect(xphAt(1)).toBe(700);
        expect(purposeGoldFactor('gph')).toBe(1);
        expect(purposeXpFactor('gph')).toBe(0.3);
        expect(xpPerCycle(1, 'xph', HOUR_MS)).toBe(700);
    });

    it('keeps a stored dial set\'s pins and factors, and they still move the numbers', () => {
        const dials = normaliseDials(STORED_BEFORE);
        for (const key of Object.keys(STORED_BEFORE)) expect(dials).toHaveProperty(key);
        expect(xpPerCycle(1, 'xph', HOUR_MS, normaliseDials({ xphPins: { 1: 900, 99: 900 } }))).toBe(900);
    });

    it('guards over ten levels', () => {
        expect(guardStride(DEFAULT_DIALS)).toBe(10);
        const { violations } = progressionGuardFindings(normaliseDials({ toleranceBrackets: [{ maxLevel: Infinity, band: 0.5 }] }));
        for (const v of violations) expect(v.upper - v.level).toBe(10);
    });
});

describe('on: the optimized boost factor (BALANCE_RULES sections 1 and 5)', () => {
    it('is 1 / (1 - Maxed speed) x (1 + Maxed XP) at a tier opening: copper 1.375, darkmetal 3', () => {
        expect(optimizedBoostFactor(1)).toBeCloseTo(1 / 0.8 * 1.1, 9);
        expect(optimizedBoostFactor(80)).toBeCloseTo(1 / 0.4 * 1.2, 9);
        expect(optimizedBoostFactor(99)).toBeCloseTo(3, 9);
    });

    it('climbs in a straight line between tier openings', () => {
        // Copper (level 1) to iron (level 20): speed 20 to 30 %, XP 10 % throughout.
        const speed = 0.2 + 0.1 * (9 / 19);
        expect(optimizedBoostFactor(10)).toBeCloseTo(1 / (1 - speed) * 1.1, 9);
        for (let level = 2; level <= 99; level++) {
            expect(optimizedBoostFactor(level)).toBeGreaterThanOrEqual(optimizedBoostFactor(level - 1));
        }
    });

    it('reads the boost budget it is given', () => {
        const none = { ...DEFAULT_LEDGER_SETTINGS, boostBudget: DEFAULT_LEDGER_SETTINGS.boostBudget.map((row) => ({ ...row, speed: { typical: 0, maxed: 0 }, xp: { typical: 0, maxed: 0 } })) };
        expect(optimizedBoostFactor(40, none)).toBe(1);
        const dials = normaliseDials({ rulebook: true, ledgerSettings: none });
        expect(xpPerCycle(40, 'iph', HOUR_MS, dials)).toBe(Math.round(xpAnHourAt(40)));
    });
});

describe('on: XP a cycle follows BALANCE_RULES section 1', () => {
    it('is XP an hour x hours over the boost factor (spot-checks at 1, 40 and 99)', () => {
        expect(xphAt(1, ON)).toBe(1660);
        expect(xphAt(21, ON)).toBeCloseTo(3320, 6);
        expect(xpPerCycle(1, 'iph', HOUR_MS, ON)).toBe(1207);
        expect(xpPerCycle(40, 'iph', HOUR_MS, ON)).toBe(3346);
        expect(xpPerCycle(99, 'iph', HOUR_MS, ON)).toBe(16521);
    });

    it('tilts by purpose: training 1.5x, balanced in full, earning half', () => {
        const at = (purpose) => xpAnHourAt(40) * PURPOSE_TILT[purpose].xp / optimizedBoostFactor(40);
        expect(xpPerCycle(40, 'xph', HOUR_MS, ON)).toBe(Math.round(at('xph')));
        expect(xpPerCycle(40, 'gph', HOUR_MS, ON)).toBe(Math.round(at('gph')));
        expect(purposeXpFactor('xph', ON)).toBe(1.5);
        expect(purposeXpFactor('nonsense', ON)).toBe(0);
    });

    it('reads its XP an hour against the game\'s threshold table, now the balance rules table: about 303 board-hours, the 12.6 days the rules give', () => {
        const hours = hoursToMastery(ON);
        expect(hours).toBeGreaterThan(295);
        expect(hours).toBeLessThan(310);
    });
});

describe('on: worth an hour follows BALANCE_RULES section 7', () => {
    it('is 1,200 gold at level 1 and doubles every 20 levels to about 35,800 at 99', () => {
        expect(gphAt(1, ON)).toBe(1200);
        expect(gphAt(21, ON)).toBeCloseTo(2400, 6);
        expect(Math.round(gphAt(40, ON))).toBe(4636);
        expect(Math.round(gphAt(99, ON))).toBe(35828);
    });

    it('tilts by purpose: training half the goods, balanced in full, earning 1.5x', () => {
        expect(purposeGoldFactor('xph', ON)).toBe(0.5);
        expect(purposeGoldFactor('iph', ON)).toBe(1);
        expect(purposeGoldFactor('gph', ON)).toBe(1.5);
        expect(purposeGoldFactor('nonsense', ON)).toBe(0);
    });

    it('sets a fixture gatherer\'s target from the rule', () => {
        const sim = runSim({ tokens: { a: token('fx_grove', { level: 40, purpose: 'gph' }) }, items: { fx_item: { id: 'fx_item' } } }, { rulebook: true });
        expect(sim.details.get('fx_item').targetPerHour).toBeCloseTo(worthAnHourAt(40) * PURPOSE_TILT.gph.goods, 6);
    });
});

describe('on: a stored dial set cannot bring the old curves back', () => {
    it('drops the old pins and purpose factors from the dials', () => {
        const dials = normaliseDials({ ...STORED_BEFORE, rulebook: true });
        for (const key of Object.keys(STORED_BEFORE)) expect(dials).not.toHaveProperty(key);
    });

    it('derives the same XP and prices with or without the stored dials, on the rule', () => {
        const plain = runSim(corpus(), { rulebook: true });
        const stored = runSim(corpus(), { ...STORED_BEFORE, rulebook: true });
        expect([...stored.xp.entries()]).toEqual([...plain.xp.entries()]);
        expect([...stored.values.entries()]).toEqual([...plain.values.entries()]);
        const cycle = stored.cycleTimes.get('fx_mid');
        expect(stored.xp.get('fx_mid')).toBe(Math.round(xpAnHourAt(40) * cycle / HOUR_MS / optimizedBoostFactor(40)));
    });

    it('changes the numbers against the switch off', () => {
        const off = runSim(corpus(), STORED_BEFORE);
        const on = runSim(corpus(), { ...STORED_BEFORE, rulebook: true });
        expect([...on.xp.entries()]).not.toEqual([...off.xp.entries()]);
    });
});

describe('on: the progression guard strides a tier', () => {
    it('compares a level with 20 levels up, and the rules\' curve clears it at the default bands', () => {
        expect(guardStride(ON)).toBe(20);
        expect(progressionGuardRows(ON)).toEqual([]);
    });

    it('still refuses a band wide enough to swallow a tier', () => {
        const rows = progressionGuardRows(normaliseDials({ rulebook: true, toleranceBrackets: [{ maxLevel: Infinity, band: 0.5 }] }));
        expect(rows.some((r) => r.code === 'progression-guard')).toBe(true);
    });
});

describe('Recalculate hands the plan\'s Ledger settings to the boost factor', () => {
    it('reads the workspace\'s own boost budget when the switch is on', () => {
        const ws = {
            items: { fx_mid_item: { id: 'fx_mid_item' } },
            tokens: { b: token('fx_mid', { level: 40, purpose: 'iph', outputs: [out('fx_mid_item')] }) },
            effects: {}, recipePools: {},
        };
        const none = { ...DEFAULT_LEDGER_SETTINGS, boostBudget: DEFAULT_LEDGER_SETTINGS.boostBudget.map((row) => ({ ...row, speed: { typical: 0, maxed: 0 }, xp: { typical: 0, maxed: 0 } })) };
        const plain = recalculateWorkspace(ws, { rulebook: true }).workspace.tokens.b.config;
        const unboosted = recalculateWorkspace({ ...ws, planSettings: none }, { rulebook: true }).workspace.tokens.b.config;
        expect(unboosted.xp).toBe(Math.round(xpAnHourAt(40) * unboosted.cycleTimeMs / HOUR_MS));
        expect(plain.xp).toBe(Math.round(xpAnHourAt(40) * plain.cycleTimeMs / HOUR_MS / optimizedBoostFactor(40)));
    });
});

/**
 * One rulebook (T-715): Recalculate's XP an hour, worth an hour and purpose tilt come from the
 * balance rules (`cms/src/engine/balanceRules.js`, BALANCE_RULES sections 1 and 7), not from the
 * simulator's own pins, and a dial set stored before the change cannot bring the old curves back.
 *
 * ⚠️ Fixtures only: no shipped id.
 */

import { describe, it, expect } from 'vitest';

import { xpPerCycle } from '../../cms/src/engine/sim/xpPass.js';
import { normaliseDials, gphAt, purposeGoldFactor } from '../../cms/src/engine/sim/dials.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { xpAnHourAt, worthAnHourAt, PURPOSE_TILT } from '../../cms/src/engine/balanceRules.js';

const HOUR_MS = 3600000;

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

describe('XP an hour follows BALANCE_RULES section 1', () => {
    it('pays 1,660 at level 1, doubling every 20 levels (spot-checks at 1, 21, 40 and 99)', () => {
        expect(xpPerCycle(1, 'iph', HOUR_MS)).toBe(1660);
        expect(xpPerCycle(21, 'iph', HOUR_MS)).toBe(3320);
        expect(xpPerCycle(40, 'iph', HOUR_MS)).toBe(6414);
        expect(xpPerCycle(99, 'iph', HOUR_MS)).toBe(49563);
    });

    it('tilts by purpose: training 1.5x, balanced in full, earning half', () => {
        expect(xpPerCycle(40, 'xph', HOUR_MS)).toBe(Math.round(xpAnHourAt(40) * 1.5));
        expect(xpPerCycle(40, 'iph', HOUR_MS)).toBe(Math.round(xpAnHourAt(40)));
        expect(xpPerCycle(40, 'gph', HOUR_MS)).toBe(Math.round(xpAnHourAt(40) * 0.5));
    });
});

describe('worth an hour follows BALANCE_RULES section 7', () => {
    it('is 1,200 gold at level 1 and doubles every 20 levels to about 35,800 at 99', () => {
        expect(gphAt(1)).toBe(1200);
        expect(gphAt(21)).toBeCloseTo(2400, 6);
        expect(Math.round(gphAt(40))).toBe(4636);
        expect(Math.round(gphAt(99))).toBe(35828);
    });

    it('tilts by purpose: training half the goods, balanced in full, earning 1.5x', () => {
        expect(purposeGoldFactor('xph')).toBe(0.5);
        expect(purposeGoldFactor('iph')).toBe(1);
        expect(purposeGoldFactor('gph')).toBe(1.5);
        expect(purposeGoldFactor('nonsense')).toBe(0);
    });

    it('sets a fixture gatherer\'s target from the rule', () => {
        const sim = runSim({ tokens: { a: token('fx_grove', { level: 40, purpose: 'gph' }) }, items: { fx_item: { id: 'fx_item' } } });
        expect(sim.details.get('fx_item').targetPerHour).toBeCloseTo(worthAnHourAt(40) * PURPOSE_TILT.gph.goods, 6);
    });
});

describe('a stored dial set cannot bring the old curves back', () => {
    it('drops the old pins and purpose factors from the dials', () => {
        const dials = normaliseDials(STORED_BEFORE);
        for (const key of Object.keys(STORED_BEFORE)) expect(dials).not.toHaveProperty(key);
    });

    it('derives the same XP and the same prices with or without the stored dials', () => {
        const corpus = {
            tokens: {
                a: token('fx_low', { level: 5, purpose: 'xph' }),
                b: token('fx_mid', { level: 40, purpose: 'iph', outputs: [out('fx_mid_item')] }),
                c: token('fx_high', { level: 85, purpose: 'gph', outputs: [out('fx_high_item')] }),
            },
            items: { fx_item: { id: 'fx_item' }, fx_mid_item: { id: 'fx_mid_item' }, fx_high_item: { id: 'fx_high_item' } },
        };
        const plain = runSim(corpus);
        const stored = runSim(corpus, STORED_BEFORE);
        expect([...stored.xp.entries()]).toEqual([...plain.xp.entries()]);
        expect([...stored.values.entries()]).toEqual([...plain.values.entries()]);
        const cycle = stored.cycleTimes.get('fx_mid');
        expect(stored.xp.get('fx_mid')).toBe(Math.round(xpAnHourAt(40) * PURPOSE_TILT.iph.xp * cycle / HOUR_MS));
    });
});

import { describe, it, expect, vi } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace } from '../../cms/src/engine/ledger/pace.js';
import { DOSE, DOSE_LENGTH } from '../systems/core/consumableRule.js';
import { ruleContent } from './fixtures/ruleChecksWorld.js';

/**
 * The batch check reads a dose's length where the game does (`consumableRule.js` `DOSE_LENGTH`), so
 * when the drinks' cycles change there (the 25-cycle doses of BALANCE_RULES section 5) the check
 * follows with no change of its own. Here the game's drink lasts 100 cycles: ten times today's 10.
 */

vi.mock('../systems/core/consumableRule.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, DOSE_LENGTH: Object.freeze({ ...real.DOSE_LENGTH, [real.DOSE.DRINK]: 100 }) };
});

describe('the batch check follows the game\'s dose length', () => {
    it('a drink lasting 100 cycles spends a tenth of the doses and pays back ten times as much', () => {
        expect(DOSE_LENGTH[DOSE.DRINK]).toBe(100);
        const c = ruleContent({ sky: false });
        const pace = buildPace(c, buildLedger(c));
        const beer = pace.batchPaybackRows().find(r => r.item === 'item_beer');
        expect(beer.doseCycles).toBeCloseTo(100);
        // On the Beer recipe itself (a 10 s cycle) at 10 cycles a dose it was 0.71x: now 7.1x, past 4x.
        expect(beer.ratio).toBeCloseTo(10 * 0.1 / (360 / 10 * (14 / 3600)), 1);
        expect(pace.findings().some(f => f.check === 'batch-payback')).toBe(false);
    });
});

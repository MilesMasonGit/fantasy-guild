import { describe, it, expect } from 'vitest';
import { DOSE, DOSE_LENGTH } from '../systems/core/consumableRule.js';
import { DRINK_CYCLES, WORK_POTION_CYCLES, ELIXIR_FIGHTS } from '../config/loopConstants.js';

/** BALANCE_RULES section 5: a drink or a work potion lasts 25 work cycles; elixirs stay as they are. */
describe('dose lengths', () => {
    it('a drink and a work potion each last 25 work cycles', () => {
        expect(DRINK_CYCLES).toBe(25);
        expect(WORK_POTION_CYCLES).toBe(25);
        expect(DOSE_LENGTH[DOSE.DRINK]).toBe(25);
        expect(DOSE_LENGTH[DOSE.POTION]).toBe(25);
    });

    it('an elixir still lasts its 10 fights', () => {
        expect(ELIXIR_FIGHTS).toBe(10);
        expect(DOSE_LENGTH[DOSE.ELIXIR]).toBe(10);
    });
});

import { describe, it, expect } from 'vitest';
import { MISS, missChance } from '../config/FormulaRegistry.js';
import { t } from '../i18n/index.js';

/** The Accuracy and Dodge tips say the bounds the miss chance is held between. */
describe('the Accuracy and Dodge tips', () => {
    it('say never below 5% or above 40%, the bounds the miss chance keeps', () => {
        const bounds = { min: MISS.MIN, max: MISS.MAX };
        expect(t('heroPanel.combat.accuracyTip', bounds)).toBe("Taken off the hero's chance to miss, never below 5% or above 40%");
        expect(t('heroPanel.combat.dodgeTip', bounds)).toBe("Added to an attacker's chance to miss the hero, never below 5% or above 40%");
        expect(missChance(1, 1, 0, 100)).toBe(MISS.MIN);
        expect(missChance(1, 40, 100, 0)).toBe(MISS.MAX);
    });
});

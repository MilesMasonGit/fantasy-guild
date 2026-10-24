import { describe, it, expect } from 'vitest';
import { rpsOutcome } from '../config/FormulaRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import {
    heroMaxHpFromSkills,
    getHeroCombatStyle,
    heroAttackSpeedMs,
} from '../utils/CombatFormulas.js';

/**
 * The style cycle and a new hero's numbers. The rest of the combat numbers (HP, damage, misses,
 * crits, armour, speed, the level table) are covered in `CombatRules.test.js`.
 */
describe('Combat formulas', () => {
    it('a new hero: 10 HP, no style (a Recruit), a 3 s swing', () => {
        const hero = generateHero();
        expect(hero.hp.max).toBe(10);
        expect(heroMaxHpFromSkills(hero.skills)).toBe(10);
        expect(getHeroCombatStyle(hero)).toBeNull();
        expect(heroAttackSpeedMs(hero)).toBe(3000);
    });

    it('the matchup table is the owner’s four-way cycle: Melee > Ranged > Magic > Stealth > Melee', () => {
        const cycle = ['melee', 'ranged', 'magic', 'stealth'];
        for (let i = 0; i < cycle.length; i++) {
            const a = cycle[i];
            const beaten = cycle[(i + 1) % 4];
            const opposite = cycle[(i + 2) % 4];
            expect(rpsOutcome(a, beaten)).toBe(1);
            expect(rpsOutcome(beaten, a)).toBe(-1);
            expect(rpsOutcome(a, opposite)).toBe(0);
            expect(rpsOutcome(a, a)).toBe(0);
        }
        // Magic used to beat Melee; under the cycle they are opposites.
        expect(rpsOutcome('magic', 'melee')).toBe(0);
        expect(rpsOutcome('ranged', 'stealth')).toBe(0);
    });

    it('every combat skill has exactly one favoured and one unfavoured matchup, and is even against the other two', () => {
        expect(COMBAT_SKILL_IDS).toHaveLength(4);
        for (const atk of COMBAT_SKILL_IDS) {
            // Against all four, itself included: one win, one loss, two even.
            const outcomes = COMBAT_SKILL_IDS.map((d) => rpsOutcome(atk, d)).sort((a, b) => a - b);
            expect(outcomes, atk).toEqual([-1, 0, 0, 1]);
            expect(rpsOutcome(atk, atk)).toBe(0);
            for (const d of COMBAT_SKILL_IDS) expect(rpsOutcome(atk, d)).toBe(-rpsOutcome(d, atk) || 0);
        }
    });

    it('a side with no style is even with everyone', () => {
        for (const s of COMBAT_SKILL_IDS) {
            expect(rpsOutcome(null, s)).toBe(0);
            expect(rpsOutcome(s, null)).toBe(0);
        }
    });
});

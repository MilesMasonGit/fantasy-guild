import { describe, it, expect } from 'vitest';
import { REST_RULE, restRuleEndChance, restRuleBusyShare } from '../../cms/src/engine/balanceRules.js';

/** BALANCE_RULES section 2 (owner, 2026-11-26): a node gives about 15 s of work and is back in about a minute. */
describe('the rest rule', () => {
    it('is 15 s of work and a minute back, held once', () => {
        expect(REST_RULE).toEqual({ workMs: 15000, restMs: 60000 });
        expect(Object.isFrozen(REST_RULE)).toBe(true);
    });

    it('gives a gathering Token the end chance that makes about 15 s of work at its cycle, one decimal, 100 at most', () => {
        expect(restRuleEndChance(6000)).toBe(40);
        expect(restRuleEndChance(6400)).toBe(42.7);
        expect(restRuleEndChance(3000)).toBe(20);
        expect(restRuleEndChance(15000)).toBe(100);
        expect(restRuleEndChance(20000)).toBe(100);
    });

    it('keeps a lone hero at one node busy about a fifth of the time, so a camp needs 4 or 5 nodes', () => {
        expect(restRuleBusyShare()).toBeCloseTo(0.2, 9);
        expect(1 / restRuleBusyShare()).toBe(5);
    });
});

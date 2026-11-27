import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace } from '../../cms/src/engine/ledger/pace.js';
import { proposeBalance, applyProposals, LEVER } from '../../cms/src/engine/ledger/balance.js';
import { balanceText } from '../../cms/src/engine/ledgerBalance.js';
import { ceilingContent } from './fixtures/balanceWorld.js';

/**
 * The XP lever's ceiling: it never raises a work past the point where it out-pays, at any level, the
 * work that was best there before; the early levels the capped number leaves slow are reported as a
 * gap. Fixture: `ceilingContent` in `fixtures/balanceWorld.js` (a Copper Ingot at Smithing 1, a
 * Bronze Ingot at Smithing 10, one Furnace).
 */

const SETTINGS = {
    tierLevels: [{ tier: 0, level: 1 }, { tier: 1, level: 9 }], heroesByTier: [{ tier: 0, heroes: 8 }],
    // A curve that slows faster than the XP table grows, past the owner's range: the early levels then need the most raising.
    paceRule: { stepPct: 12, maxPct: 12 }
};
const COPPER = 'recipe:recipe_copper_ingot';
const BRONZE = 'recipe:recipe_bronze_ingot';
const proposalOf = (result, key) => result.proposals.find(p => p.key === key && p.field === 'xp') || null;
const fieldOf = (row) => row.source.maxed.work?.target.recipe ?? null;
const smithing = (content) => buildPace(content, buildLedger(content), SETTINGS).trackOf('smithing').levels;

describe('the XP lever never raises a work past the work that was best at a later level', () => {
    const content = ceilingContent();
    const bronzeLevels = smithing(content).filter(r => fieldOf(r) === 'recipe_bronze_ingot').map(r => r.level);
    const result = proposeBalance(content, SETTINGS);

    it('the fixture: the Bronze Ingot carries Smithing 10 on, and the Copper Ingot is far too slow on its own levels', () => {
        expect(bronzeLevels[0]).toBe(10);
        expect(bronzeLevels.length).toBeGreaterThan(10);
        const copper = smithing(content).filter(r => fieldOf(r) === 'recipe_copper_ingot');
        expect(Math.min(...copper.map(r => r.hours.maxed * 60 / r.curveMinutes))).toBeGreaterThan(2);
    });

    it('⭐ the Copper Ingot is raised, but the Bronze Ingot keeps every level it carried', () => {
        const copper = proposalOf(result, COPPER);
        expect(copper).toMatchObject({ lever: LEVER.XP, from: 1 });
        expect(copper.to).toBeGreaterThan(1);
        const after = smithing(applyProposals(content, result.proposals));
        for (const level of bronzeLevels) expect(fieldOf(after.find(r => r.level === level))).toBe('recipe_bronze_ingot');
    });

    it('the cap is the Bronze Ingot\'s rate: one XP more and the Copper Ingot takes its levels', () => {
        const copper = proposalOf(result, COPPER);
        const bronze = proposalOf(result, BRONZE)?.to ?? 3;
        expect(copper.to).toBe(bronze - 1);
        const over = applyProposals(content, [...result.proposals, { ...copper, to: copper.to + 1 }]);
        expect(smithing(over).filter(r => r.level >= 10 && fieldOf(r) === 'recipe_copper_ingot').length).toBeGreaterThan(0);
    });

    it('⭐ reports the early levels the cap leaves slow as a gap, not an XP raise', () => {
        const gap = (result.gaps || []).find(g => g.skill === 'smithing');
        expect(gap).toMatchObject({ skill: 'smithing', fromLevel: 1, key: COPPER, xp: proposalOf(result, COPPER).to });
        expect(gap.toLevel).toBeLessThanOrEqual(10);
        expect(gap.wanted).toBeGreaterThan(gap.xp);
        expect(gap.why).toMatch(/Bronze Ingot/);
        expect(gap.why).toMatch(/need a work of their own/);
        expect(balanceText(result)).toMatch(/Levels the XP lever leaves to new content: 1\./);
    });

    it('holds the cap against a later work the lever lowers: the Bronze Ingot at 40 XP comes down, and the Copper Ingot stays under it', () => {
        const c = ceilingContent({ bronzeXp: 40 });
        const r = proposeBalance(c, SETTINGS);
        const bronze = proposalOf(r, BRONZE);
        expect(bronze.to).toBeLessThan(40);
        expect(proposalOf(r, COPPER).to).toBeLessThan(bronze.to);
        const after = smithing(applyProposals(c, r.proposals));
        expect(after.filter(row => row.level >= 10 && fieldOf(row) === 'recipe_copper_ingot')).toEqual([]);
    });

    it('raises as before, with no gap, where no later work carries the levels', () => {
        const c = ceilingContent();
        c.recipes = c.recipes.filter(x => x.id !== 'recipe_bronze_ingot');
        const r = proposeBalance(c, SETTINGS);
        expect(proposalOf(r, COPPER).to).toBeGreaterThan(proposalOf(result, COPPER).to);
        expect(r.gaps.filter(g => g.skill === 'smithing')).toEqual([]);
    });
});

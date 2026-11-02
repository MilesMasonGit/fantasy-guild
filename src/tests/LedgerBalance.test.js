import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace } from '../systems/progression/ledger/pace.js';
import { proposeBalance, applyProposals, LEVER, CANT_FIX } from '../systems/progression/ledger/balance.js';
import { balanceContent, calmContent } from './fixtures/balanceWorld.js';

/**
 * The ledger's balancing preview (brief 290 L9): XP a cycle, level gates, costs and times, and boost
 * strengths proposed so the Typical profile follows the pace curve, each stage meets its budget and
 * boosts meet their targets; what numbers cannot fix is reported. Nothing is applied: the proposals
 * come back with the pace before and after them. Fixture: `fixtures/balanceWorld.js`.
 */

const CAMP_ONLY = { stages: [{ tier: 0, budgetMinutes: 30 }] };
const proposalOf = (result, key, field) => result.proposals.find(p => p.key === key && p.field === field) || null;
const stage = (summary, tier) => summary.stages.find(s => s.tier === tier);

describe('the balancing preview', () => {
    const result = proposeBalance(balanceContent(), CAMP_ONLY);

    it('moves a too-slow stage to its budget: the camp is hours late before, within the tolerance after', () => {
        const before = stage(result.before, 0);
        const after = stage(result.after, 0);
        expect(before.hours).toBeGreaterThan(4);
        expect(before.within).toBe(false);
        expect(Math.abs(after.hours * 60 / 30 - 1)).toBeLessThanOrEqual(0.25);
        expect(after.within).toBe(true);
    });

    it('lowers a level gate that holds a camp entry back, and raises the XP of a source far slower than the curve', () => {
        const gate = proposalOf(result, 'recipe:recipe_elixir', 'levelRequirement');
        expect(gate).toMatchObject({ lever: LEVER.GATE, from: 12 });
        expect(gate.to).toBeLessThan(12);
        expect(gate.to).toBeGreaterThanOrEqual(1);
        const xp = proposalOf(result, 'token:token_herbs', 'config.xp');
        expect(xp).toMatchObject({ lever: LEVER.XP, from: 1 });
        expect(xp.to).toBeGreaterThanOrEqual(4);
        expect(result.after.walls.filter(w => w.skill === 'alchemy')).toEqual([]);
    });

    it('lowers a price that makes one unlock a long wait, and weakens a boost over its target', () => {
        const price = proposalOf(result, 'token:token_statue', 'shop.price.0.quantity');
        expect(price).toMatchObject({ lever: LEVER.COST, from: 5000 });
        expect(price.to).toBeLessThan(5000);
        expect(result.before.unlockWalls.map(u => u.key)).toContain('token:token_statue');
        expect(result.after.unlockWalls.map(u => u.key)).not.toContain('token:token_statue');

        const boost = proposalOf(result, 'effect:fx_grove', 'statements.0.payload.value');
        expect(boost).toMatchObject({ lever: LEVER.BOOST, from: 2 });
        expect(boost.to).toBeGreaterThan(0);
        expect(boost.to).toBeLessThan(2);
        expect(result.before.boosts.map(b => b.kind)).toContain('support');
        expect(result.after.boosts.filter(b => b.kind === 'support')).toEqual([]);
    });

    it('leaves alone what is already within its tolerance: the Oak on the curve keeps its XP', () => {
        expect(result.proposals.filter(p => p.key === 'token:token_oak' || p.key === 'token:token_old_oak')).toEqual([]);
        expect(result.after.walls.filter(w => w.skill === 'forestry')).toEqual([]);
    });

    it('reports a wall numbers cannot fix: one source carries Mining from 1 to 90, and nothing opens between', () => {
        expect(result.after.walls.some(w => w.skill === 'mining')).toBe(true);
        const wall = result.cantFix.find(c => c.kind === 'wall' && c.skill === 'mining');
        expect(wall).toMatchObject({ cause: CANT_FIX.CONTENT });
        expect(wall.message).toMatch(/Vein/);
        expect(wall.message).toMatch(/needs a (new )?source/i);
    });

    it('the after is the pace of the content with the proposals applied, and the content handed in is untouched', () => {
        const content = balanceContent();
        const r = proposeBalance(content, CAMP_ONLY);
        expect(content).toEqual(balanceContent());
        const applied = applyProposals(content, r.proposals);
        expect(content).toEqual(balanceContent());
        const pace = buildPace(applied, buildLedger(applied), CAMP_ONLY);
        expect(pace.stageOf(0).hours).toBeCloseTo(stage(r.after, 0).hours, 6);
        expect(applied.recipes.find(x => x.id === 'recipe_elixir').levelRequirement).toBe(proposalOf(r, 'recipe:recipe_elixir', 'levelRequirement').to);
    });
});

describe('what the preview never does', () => {
    it('proposes nothing for a world already on its pace', () => {
        const r = proposeBalance(calmContent(), { stages: [{ tier: 0, budgetMinutes: 18 }] });
        expect(stage(r.before, 0).within).toBe(true);
        expect(r.proposals).toEqual([]);
        expect(r.after.stages).toEqual(r.before.stages);
    });

    it('cuts a long wait for one unlock even when its stage is on its budget', () => {
        const r = proposeBalance(balanceContent(), { stages: [{ tier: 0, budgetMinutes: 600 }] });
        expect(r.before.unlockWalls.map(u => u.key)).toContain('token:token_statue');
        expect(proposalOf(r, 'token:token_statue', 'shop.price.0.quantity')?.to).toBeLessThan(5000);
        expect(r.after.unlockWalls.map(u => u.key)).not.toContain('token:token_statue');
    });

    it('never proposes a negative, fractional or absurd number, even for a source thousands of times too slow', () => {
        const c = balanceContent();
        // One Herb an hour: Alchemy about 1600 times slower than the curve.
        c.tokens.token_herbs.config.cycleTimeMs = 3_600_000;
        c.tokens.token_statue.shop.price[0].quantity = 5_000_000;
        const r = proposeBalance(c, CAMP_ONLY);
        expect(r.proposals.length).toBeGreaterThan(0);
        for (const p of r.proposals) {
            expect(Number.isFinite(p.to)).toBe(true);
            if (p.lever === LEVER.BOOST) {
                expect(Math.sign(p.to)).toBe(Math.sign(p.from));
                expect(Math.abs(p.to)).toBeLessThanOrEqual(Math.abs(p.from));
                continue;
            }
            expect(Number.isInteger(p.to)).toBe(true);
            expect(p.to).toBeGreaterThanOrEqual(1);
            if (p.lever === LEVER.GATE) expect(p.to).toBeLessThanOrEqual(99);
            if (p.lever === LEVER.XP) expect(p.to).toBeLessThanOrEqual(p.from * 20);
            if (p.lever === LEVER.TIME) expect(p.to).toBeGreaterThanOrEqual(1000);
        }
        const xp = r.proposals.find(p => p.key === 'token:token_herbs' && p.field === 'config.xp');
        expect(xp.to).toBe(20);
        // Capped, so the Herbs still teach too slowly: said, not hidden.
        expect(r.cantFix.find(c => c.key === 'token:token_herbs')).toMatchObject({ cause: CANT_FIX.LIMIT });
    });

    it('never proposes a Guild Hall price or strength, nor moves a gate the world tables set', () => {
        const r = proposeBalance(balanceContent(), CAMP_ONLY);
        expect(r.proposals.every(p => ['item', 'token', 'recipe', 'effect'].includes(p.kind))).toBe(true);
    });
});

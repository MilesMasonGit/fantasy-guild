import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace } from '../../cms/src/engine/ledger/pace.js';
import { proposeBalance, applyProposals, wayOutSuggestion, LEVER, CANT_FIX } from '../../cms/src/engine/ledger/balance.js';
import { balanceContent, calmContent, withWorld } from './fixtures/balanceWorld.js';

/**
 * The ledger's balancing preview (brief 290 L9): XP a cycle, costs and times, boost strengths and
 * coins proposed so the curve's player (Maxed) follows the pace curve and boosts meet their targets;
 * each stage is its way out (settling the next place, owner 2026-11-26), and one off its budget is
 * reported with the settle level or coins the world tables would need. What numbers cannot fix is
 * reported. Nothing is applied: the proposals come back with the pace before and after them.
 * Fixture: `fixtures/balanceWorld.js`.
 */

// The stages follow the pace rule (brief 880 L3): the Starter Camp's budget is the curve's time to level 9, about 30 minutes.
// Eight heroes from the start, so a path is its slowest skill.
const SPARE_HEROES = [{ tier: 0, heroes: 8 }];
const CAMP_ONLY = { tierLevels: [{ tier: 0, level: 1 }, { tier: 1, level: 9 }], heroesByTier: SPARE_HEROES };
const proposalOf = (result, key, field) => result.proposals.find(p => p.key === key && p.field === field) || null;
const stage = (summary, tier) => summary.stages.find(s => s.tier === tier);

describe('the balancing preview', () => {
    const result = proposeBalance(balanceContent(), CAMP_ONLY);

    it('raises the XP of a source far slower than the curve', () => {
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

    it('puts back an XP proposal whose levels another source took over: only numbers that set a level stay', () => {
        const c = balanceContent();
        // The Tonic carries Alchemy 3 on, too slowly; once both are raised the Herbs carry its levels too. That
        // takes a curve that slows faster than the XP table grows: 12 % a level, past the owner's range.
        c.recipes.find(x => x.id === 'recipe_tonic').xp = 2;
        const r = proposeBalance(c, { ...CAMP_ONLY, paceRule: { stepPct: 12, maxPct: 12 } });
        expect(proposalOf(r, 'token:token_herbs', 'config.xp')).toBeTruthy();
        expect(proposalOf(r, 'recipe:recipe_tonic', 'xp')).toBeNull();
        expect(r.after.walls.filter(w => w.skill === 'alchemy')).toEqual([]);
    });

    it('the after is the pace of the content with the proposals applied, and the content handed in is untouched', () => {
        const content = balanceContent();
        const r = proposeBalance(content, CAMP_ONLY);
        expect(content).toEqual(balanceContent());
        const applied = applyProposals(content, r.proposals);
        expect(content).toEqual(balanceContent());
        const pace = buildPace(applied, buildLedger(applied), CAMP_ONLY);
        expect(pace.stageOf(0).hours).toBeCloseTo(stage(r.after, 0).content.hours, 6);
        expect(applied.tokens.token_herbs.config.xp).toBe(proposalOf(r, 'token:token_herbs', 'config.xp').to);
    });
});

describe('what the preview never does', () => {
    it('⭐ never fits a stage\'s full content into its budget: the camp an hour late draws no level gate and no report', () => {
        // The Elixir, planned for the camp at Alchemy 12, holds its content over an hour against its 30 minutes,
        // with heroes to spare and with the reference guild's one hero.
        for (const settings of [CAMP_ONLY, { tierLevels: CAMP_ONLY.tierLevels }]) {
            const r = proposeBalance(balanceContent(), settings);
            expect(stage(r.before, 0).content.hours * 60).toBeGreaterThan(stage(r.before, 0).budgetMinutes * 1.25);
            expect(proposalOf(r, 'recipe:recipe_elixir', 'levelRequirement')).toBeNull();
            expect(r.proposals.filter(p => /levelRequirement|skillRequired/.test(p.field))).toEqual([]);
            // A stage with no place after it has no way out to time, and nothing about it to report.
            expect(stage(r.after, 0)).toMatchObject({ place: null, why: 'none', hours: null, within: true });
            expect(r.cantFix.filter(c => c.kind === 'stage')).toEqual([]);
        }
        expect(LEVER).not.toHaveProperty('GATE');
    });

    it('proposes nothing for a world already on its pace', () => {
        // The camp is done 17 minutes in, at the curve's level 6.
        const r = proposeBalance(calmContent(), { tierLevels: [{ tier: 0, level: 1 }, { tier: 1, level: 6 }], heroesByTier: SPARE_HEROES });
        expect(stage(r.before, 0).within).toBe(true);
        expect(r.proposals).toEqual([]);
        expect(r.after.stages).toEqual(r.before.stages);
    });

    it('cuts a long wait for one unlock even when its stage is on its budget', () => {
        // A camp of ten hours: the curve reaches level 44 then.
        const r = proposeBalance(balanceContent(), { tierLevels: [{ tier: 0, level: 1 }, { tier: 1, level: 44 }] });
        expect(r.before.unlockWalls.map(u => u.key)).toContain('token:token_statue');
        expect(proposalOf(r, 'token:token_statue', 'shop.price.0.quantity')?.to).toBeLessThan(5000);
        expect(r.after.unlockWalls.map(u => u.key)).not.toContain('token:token_statue');
    });

    it('never proposes a negative, fractional or absurd number, even for a source thousands of times too slow', () => {
        const c = balanceContent();
        // One Herb an hour and an hour a brew: Alchemy about 1600 times slower than the curve, its gatherers
        // no help to the Still. The Elixir is planned for plane 3, which has no budget, so its Alchemy 12
        // stays and Alchemy keeps its levels to follow.
        c.tokens.token_herbs.config.cycleTimeMs = 3_600_000;
        for (const recipe of c.recipes) if (recipe.skill === 'alchemy') recipe.durationMs = 3_600_000;
        c.tokens.token_statue.shop.price[0].quantity = 5_000_000;
        c.recipes.find(x => x.id === 'recipe_elixir').plan.tier = 3;
        c.items.item_elixir.plan.tier = 3;
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
            if (p.lever === LEVER.XP) expect(p.to).toBeLessThanOrEqual(p.from * 20);
            if (p.lever === LEVER.TIME) expect(p.to).toBeGreaterThanOrEqual(1000);
        }
        // Capped at 20 times its authored XP, so Alchemy still teaches too slowly: said, not hidden.
        const capped = r.proposals.filter(p => p.lever === LEVER.XP && p.to === p.from * 20);
        expect(capped.length).toBeGreaterThan(0);
        for (const p of capped) expect(r.cantFix.find(c => c.key === p.key)).toMatchObject({ cause: CANT_FIX.LIMIT });
    });

    it('never proposes a Guild Hall price or strength, nor moves a gate the world tables set', () => {
        const r = proposeBalance(balanceContent(), CAMP_ONLY);
        expect(r.proposals.every(p => ['item', 'token', 'recipe', 'effect'].includes(p.kind))).toBe(true);
    });
});

describe('a stage is its way out', () => {
    const paceOf = (content) => buildPace(content, buildLedger(content), CAMP_ONLY);

    it('⭐ shows each stage\'s way out before and after, its full content beside it as information', () => {
        const content = withWorld(balanceContent(), { level: 15 });
        const r = proposeBalance(content, CAMP_ONLY);
        const pace = paceOf(content);
        const g = pace.gateOf(0);
        const camp = stage(r.before, 0);
        expect(camp).toMatchObject({ place: g.place, name: g.name, ring: 1, coins: 0, asks: g.asks, floor: ['goods'], complete: true });
        expect(camp.hours).toBeCloseTo(g.hours, 9);
        expect(camp.offPct).toBeCloseTo((g.hours * 60 / camp.budgetMinutes - 1) * 100, 0);
        expect(camp.within).toBe(false);
        expect(camp.content.entries).toBeGreaterThan(0);
        expect(camp.content.hours).toBeCloseTo(pace.stageOf(0).hours, 9);
        // The numbers proposed move the camp's content, not its way out: Forestry 15 is levelled on the Oak, on the curve.
        expect(stage(r.after, 0).hours).toBeCloseTo(g.hours, 9);
        expect(r.after.stages[r.after.stages.length - 1]).toMatchObject({ place: null, why: 'last', within: true });
    });

    it('⭐ reports a slow way out with the settle level that would bring it to its budget, and writes no level', () => {
        const r = proposeBalance(withWorld(balanceContent(), { level: 15 }), CAMP_ONLY);
        const camp = stage(r.after, 0);
        const left = r.cantFix.find(c => c.key === 'stage:0');
        expect(left).toMatchObject({ kind: 'stage', cause: CANT_FIX.WORLD, related: [camp.place], floor: ['goods'] });
        expect(left.suggest.level).toMatchObject({ skill: 'forestry', from: 15 });
        expect(left.suggest.level.to).toBeLessThan(15);
        expect(left.suggest.level.to).toBeGreaterThan(1);
        expect(Math.abs(left.suggest.level.hours * 60 / camp.budgetMinutes - 1)).toBeLessThanOrEqual(0.25);
        expect(left.suggest.coins).toBeNull();
        expect(left.message).toMatch(/^Starter Camp's way out, settling .+ ring 1 \(Forestry 15\), is had 1 h \d+ min \(\+\d+ %\) into a new game at Maxed, against its budget of 30 min\./);
        expect(left.message).toMatch(/ring 1's settle level Forestry 15 → about \d+ \(the way out then .+\)\. A suggestion only: the preview writes neither\./);
        expect(left.message).toMatch(/A floor: its goods price \(the world seed's\) is not counted, so the real way out is later\.$/);
        expect(r.proposals.filter(p => p.kind === 'world')).toEqual([]);
    });

    it('a fast way out is reported with the higher settle level that would fill its budget', () => {
        const r = proposeBalance(withWorld(balanceContent(), { level: 3 }), CAMP_ONLY);
        const left = r.cantFix.find(c => c.key === 'stage:0');
        expect(left).toMatchObject({ cause: CANT_FIX.WORLD });
        expect(left.suggest.level.from).toBe(3);
        expect(left.suggest.level.to).toBeGreaterThan(3);
        expect(left.message).toMatch(/\(-\d+ %\) into a new game/);
        // At the level suggested it is on its budget, and nothing is reported.
        const on = proposeBalance(withWorld(balanceContent(), { level: left.suggest.level.to }), CAMP_ONLY);
        expect(stage(on.after, 0).within).toBe(true);
        expect(on.cantFix.filter(c => c.kind === 'stage')).toEqual([]);
    });

    it('suggests the ring\'s coins too for a place that asks coins, and no coins for one that asks none', () => {
        const content = withWorld(balanceContent(), { level: 3, coins: 500 });
        content.items.item_wood.value = 1;
        const pace = paceOf(content);
        const B = pace.settings.stages[0].budgetMinutes;
        const g = pace.gateOf(0);
        expect(g.coins).toBe(500);
        expect(g.priceHours).toBeGreaterThan(0);
        expect(g.hours * 60).toBeLessThan(B * 0.75);
        const { level, coins } = wayOutSuggestion(pace, 0, B);
        expect(coins).toMatchObject({ ring: 1, from: 500 });
        expect(coins.to).toBeGreaterThan(500);
        expect(Math.abs(coins.hours * 60 / B - 1)).toBeLessThanOrEqual(0.25);
        expect(pace.wayOutWith(0, { coins: coins.to }).hours).toBeCloseTo(coins.hours, 9);
        expect(level.to).toBeGreaterThan(3);
        expect(wayOutSuggestion(paceOf(withWorld(balanceContent(), { level: 3 })), 0, B).coins).toBeNull();
    });
});

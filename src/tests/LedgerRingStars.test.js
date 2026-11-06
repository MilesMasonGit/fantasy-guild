import { describe, it, expect } from 'vitest';

import { buildLedger, tokenKey, itemKey, wedgeKey, ringKey, starKey, HOW } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE, ringBudgetTier } from '../systems/progression/ledger/pace.js';
import { worldPlan, sweepWorlds, WORLD_F } from '../systems/progression/ledger/world.js';
import { CHECKS } from '../systems/progression/ledger/checks.js';
import { WORLD_FIXTURE_TABLES, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * ⭐ The ledger counts the Guild Hall's ring stars (brief 380 M4): a ring past the first is settled
 * only once its star is lit, so reach and the pace wait for the star's price; checks F find a ring
 * with no star or a star asking for its own ring's goods; the pace prices a ring star to open its
 * ring when the stage before it ends, and finds a ring that opens well before then.
 */

const withTables = (ws) => ({ ...contentOf(ws), worldTables: WORLD_FIXTURE_TABLES });
const ledgerOf = (ws) => buildLedger(withTables(ws));
const paceOf = (ws, settings = null) => {
    const content = withTables(ws);
    return buildPace(content, buildLedger(content), settings);
};
const SEEDS = [1, 2, 3, 4];
const priceOf = (ws, ring, price) => { ws.hallStars[`star_ring_${ring}`].ranks[0].price = price; return ws; };
const noStars = (ws) => { ws.hallStars = {}; return ws; };

describe('reach: a ring past the first waits for its star', () => {
    it('⭐ each ring star is a rule lighting it from the Hall or the star before; every settle of its ring needs it', () => {
        const l = ledgerOf(worldWorkspace());
        expect([...l.world.ringStars]).toEqual([[2, ['star_ring_2']], [3, ['star_ring_3']], [4, ['star_ring_4']]]);
        const lights = l.world.rules.filter(r => r.how === HOW.STAR);
        const two = lights.filter(r => r.gives.some(g => g.key === ringKey(2)));
        // From the Hall, or (a link counts both ways) from the ring-3 star once lit.
        expect(two.map(r => r.needs)).toEqual([[itemKey('item_copper_ore')], [starKey('star_ring_3'), itemKey('item_copper_ore')]]);
        expect(two[0].inputs).toEqual([{ key: itemKey('item_copper_ore'), quantity: 10 }]);
        const three = lights.find(r => r.gives.some(g => g.key === ringKey(3)) && r.needs.includes(starKey('star_ring_2')));
        expect(three).toBeTruthy();
        for (const rule of l.world.rules.filter(r => r.how === HOW.SETTLE)) {
            const ring = Number(rule.id.split(':')[2]);
            expect(rule.needs.includes(ringKey(ring)), rule.id).toBe(ring >= 2);
        }
        expect(l.reachOf(ringKey(2)).tier).toBe(0);
        expect(l.world.names.get(starKey('star_ring_3'))).toBe('Ring 3 Star');
    });

    it('a sky with no ring star leaves the settle rules as they were', () => {
        const l = ledgerOf(noStars(worldWorkspace()));
        expect(l.world.ringStars.size).toBe(0);
        expect(l.world.rules.some(r => r.how === HOW.STAR)).toBe(false);
        expect(l.world.rules.filter(r => r.how === HOW.SETTLE).every(r => !r.needs.some(n => n.startsWith('ring:')))).toBe(true);
    });

    it('a ring star whose price is never made shuts its ring, and what only that ring places, out of reach', () => {
        const ws = priceOf(worldWorkspace(), 2, [{ itemId: 'item_no_such_thing', quantity: 1 }]);
        ws.items.item_no_such_thing = { id: 'item_no_such_thing', name: 'Nothing', type: 'material' };
        const l = ledgerOf(ws);
        expect(l.reachOf(ringKey(2))?.tier ?? null).toBeNull();
        expect(l.reachOf(wedgeKey('ores', 2))?.tier ?? null).toBeNull();
        expect(l.reachOf(tokenKey('token_iron_vein')).tier).toBeNull();
        expect(ledgerOf(worldWorkspace()).reachOf(tokenKey('token_iron_vein')).tier).toBe(2);
    });
});

describe('checks F: the ring stars', () => {
    const plan = (ws, seed) => worldPlan(contentOf(ws), { seed, baseTables: WORLD_FIXTURE_TABLES });
    const ringStar = (findings) => findings.filter(f => f.check === WORLD_F.RING_STAR);

    it('a world whose every ring past the first has a star lit with earlier goods finds nothing', () => {
        for (const seed of SEEDS) expect(ringStar(plan(worldWorkspace(), seed).findings), String(seed)).toEqual([]);
        expect(CHECKS[WORLD_F.RING_STAR]).toMatchObject({ group: 'F' });
    });

    it('⭐ a ring with no star is found, the wild one too, and fails the world', () => {
        const ws = worldWorkspace();
        delete ws.hallStars.star_ring_4;
        const hits = ringStar(plan(ws, 1).findings);
        expect(hits.map(f => f.subject)).toEqual(['ring 4: no star']);
        expect(hits[0].message).toMatch(/No Guild Hall star opens ring 4/);
        const sweep = sweepWorlds(contentOf(noStars(worldWorkspace())), { seeds: SEEDS, baseTables: WORLD_FIXTURE_TABLES });
        expect(sweep.passed).toBe(0);
        expect(sweep.rules[WORLD_F.RING_STAR].subjects.map(s => s.subject)).toEqual(['ring 2: no star', 'ring 3: no star', 'ring 4: no star']);
    });

    it('⭐ a star asking for its own ring\'s goods (no iron to reach iron) is found, and its ring goes uncovered', () => {
        const ws = priceOf(worldWorkspace(), 3, [{ itemId: 'item_ores_3', quantity: 5 }]);
        const p = plan(ws, 2);
        const hits = ringStar(p.findings);
        // Ring 3's goods are had only once ring 3 is settled, which needs the star: never lit, nor
        // the wild ring's star, linked to it alone.
        expect(hits.map(f => f.subject)).toEqual(['ring 3: star never lit', 'ring 4: star never lit']);
        expect(p.findings.some(f => f.check === WORLD_F.COVERAGE)).toBe(true);

        const late = priceOf(worldWorkspace(), 2, [{ itemId: 'item_ores_2', quantity: 5 }]);
        // Ring 2's star asking ring 2 goods is the same loop; one asking ring 3 goods for ring 4 is fine.
        expect(ringStar(plan(late, 2).findings).map(f => f.subject)).toEqual(['ring 2: star never lit', 'ring 3: star never lit', 'ring 4: star never lit']);
        const wild = priceOf(worldWorkspace(), 4, [{ itemId: 'item_ores_3', quantity: 5 }]);
        expect(ringStar(plan(wild, 2).findings)).toEqual([]);
    });

    it('a star asking for a later ring\'s goods, beside earlier ones, is never lit either', () => {
        const ws = worldWorkspace();
        // Ring 3's goods wait on ring 3, which waits on ring 2, which waits on this star.
        priceOf(ws, 2, [{ itemId: 'item_copper_ore', quantity: 5 }, { itemId: 'item_trees_3', quantity: 1 }]);
        const hits = ringStar(plan(ws, 3).findings);
        expect(hits.map(f => f.subject)).toEqual(['ring 2: star never lit', 'ring 3: star never lit', 'ring 4: star never lit']);
    });
});

describe('the pace: the star\'s price is on the way to its ring', () => {
    const settings = { stages: [{ tier: 0, budgetMinutes: 10 }, { tier: 1, budgetMinutes: 60 }, { tier: 2, budgetMinutes: 600 }] };

    it('⭐ a dear ring star moves its ring later by the hours its price takes to gather', () => {
        const cheap = paceOf(worldWorkspace(), settings);
        const dear = paceOf(priceOf(worldWorkspace(), 3, [{ itemId: 'item_copper_ore', quantity: 50000 }]), settings);
        const star = dear.pathOf(starKey('star_ring_3'), PROFILE.TYPICAL);
        expect(star.how).toBe(HOW.STAR);
        expect(star.own).toBeGreaterThan(10);
        expect(dear.ringOpensAt(3).hours).toBeGreaterThan(cheap.ringOpensAt(3).hours + 10);
        expect(dear.ringOpensAt(3).hours).toBeCloseTo(Math.max(star.hours, dear.pathOf(wedgeKey('ores', 3), PROFILE.TYPICAL).start), 6);
        expect(dear.pathOf(itemKey('item_ores_3'), PROFILE.TYPICAL).hours).toBeGreaterThan(star.hours);
        // Ring 2 is not held by ring 3's star.
        expect(dear.ringOpensAt(2).hours).toBeCloseTo(cheap.ringOpensAt(2).hours, 6);
    });

    it('⭐ proposes a price that lights the star when the stage before its ring ends', () => {
        const pace = paceOf(worldWorkspace(), settings);
        const rows = pace.hallPaybacks().filter(r => r.ring);
        expect(rows.map(r => [r.id, r.ring, r.rate])).toEqual([['star_ring_2', 2, false], ['star_ring_3', 3, false], ['star_ring_4', 4, false]]);
        for (const row of rows.slice(0, 2)) {
            const p = row.proposed;
            expect(p.itemId, row.id).toBeTruthy();
            const budget = settings.stages.find(s => s.tier === ringBudgetTier(row.ring)).budgetMinutes / 60;
            expect(p.budgetHours).toBe(budget);
            expect(p.litAt).toBeLessThanOrEqual(budget + 1e-9);
            expect(p.litAt).toBeGreaterThan(budget * 0.85);
            expect(String(p.quantity)).toMatch(/^\d{1,2}0*$/);
        }
        // Priced so, the star is lit when the proposal says.
        const priced = worldWorkspace();
        for (const row of rows.slice(0, 2)) priceOf(priced, row.ring, [{ itemId: row.proposed.itemId, quantity: row.proposed.quantity }]);
        const after = paceOf(priced, settings);
        const three = rows[1].proposed;
        expect(after.pathOf(starKey('star_ring_3'), PROFILE.TYPICAL).hours).toBeCloseTo(three.litAt, 3);
    });

    it('a wild ring\'s star, with no budget for its stage, takes the tables\' wild price growth over the star before', () => {
        const pace = paceOf(worldWorkspace(), settings);
        const rows = pace.hallPaybacks().filter(r => r.ring);
        const [, three, four] = rows;
        expect(four.budgetHours).toBeNull();
        expect(four.proposed.grown).toEqual({ from: 'star_ring_3', growth: WORLD_FIXTURE_TABLES.wild.priceGrowth });
        const hours = three.proposed.priceHours * WORLD_FIXTURE_TABLES.wild.priceGrowth;
        expect(four.proposed.priceHours).toBeLessThanOrEqual(hours + 1e-9);
        expect(four.proposed.priceHours).toBeGreaterThan(hours * 0.85);
        // A strict ring with no budget proposes nothing, and says why.
        const bare = paceOf(worldWorkspace(), { stages: [{ tier: 0, budgetMinutes: 10 }] });
        expect(bare.hallPaybacks().find(r => r.ring === 2).proposed.why).toMatch(/no budget/);
    });

    it('⭐ check D: a ring that can be settled well before the stage before it ends is found, and the star\'s proposal clears it', () => {
        const early = paceOf(worldWorkspace(), settings);
        const found = early.findings().filter(f => f.check === 'ring-open');
        expect(found.map(f => f.key)).toEqual(expect.arrayContaining([`ring:3`]));
        expect(found.find(f => f.key === 'ring:3').message).toMatch(/Ring 3 can first be settled .* before Plane 2 ends/);
        expect(CHECKS['ring-open']).toMatchObject({ group: 'D' });
        // A ring star's first rank is not "not a rate" noise.
        expect(early.findings().some(f => f.check === 'unmodelled' && /Ring \d Star/.test(f.message))).toBe(false);

        const priced = worldWorkspace();
        for (const row of early.hallPaybacks().filter(r => r.ring && r.proposed.itemId)) {
            priceOf(priced, row.ring, [{ itemId: row.proposed.itemId, quantity: row.proposed.quantity }]);
        }
        expect(paceOf(priced, settings).findings().filter(f => f.check === 'ring-open')).toEqual([]);
    });
});

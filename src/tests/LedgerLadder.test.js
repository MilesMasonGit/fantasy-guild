import { describe, it, expect } from 'vitest';

import { buildLedger, tokenKey, itemKey, wedgeKey, rungWedgeKey, ringKey, starKey, HOW, worldRungs, keyed } from '../systems/progression/ledger/engine.js';
import { PLAN_TIERS, PLAN_TIER_LEVELS, tierLevelsOf, tierLevelAt, tierLabel } from '../systems/progression/ledger/plan.js';
import { buildPace, ringBudgetTier, PROFILE } from '../../cms/src/engine/ledger/pace.js';
import { worldPlan, WORLD_F } from '../../cms/src/engine/ledger/world.js';
import { settingsOf } from '../../cms/src/engine/ledger/settings.js';
import { workspaceLedger } from '../../cms/src/engine/ledgerReport.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { WORLD_FIXTURE_RAW, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * ⭐ The ladder in the ledger (brief 880 L2, T-294): plan tiers 0 to 7, and levels by rung. A ring of
 * the world map may hold several rungs (ring 3 mythril to darkmetal): an origin whose main material
 * is planned for a later rung than its ring stands on a place of its own, reached at that rung and
 * settled at that rung's opening level; a ring opens after the ring before's last tier (the tier
 * before its own first rung); the World plan reads a cell by its main origin's rung, its price's
 * goods too. The game's data carries no plan, so the game's reach is as it was.
 */

const DARK = 'token_dark_vein';
const DARK_ORE = 'item_dark_ore';

/** The world fixture with a vein in ores ring 3 whose ore is planned for tier `tier`. */
function ladderWorkspace(tier = 6) {
    const ws = worldWorkspace();
    ws.items[DARK_ORE] = { id: DARK_ORE, name: 'Dark Ore', type: 'material', plan: { tier } };
    ws.tokens[DARK] = {
        id: DARK, name: 'Dark Vein', uses: 3, respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 6000, xp: 1, inputs: [], outputs: [{ itemId: DARK_ORE, chance: 100, minQty: 1, maxQty: 1 }] }
    };
    return ws;
}

/** The fixture's tables with the dark vein listed beside ores ring 3's own node, and other changes. */
function ladderRaw(patch = (raw) => raw) {
    const raw = JSON.parse(JSON.stringify(WORLD_FIXTURE_RAW));
    raw.lines.find(l => l.id === 'ores').origins[3].push({ id: DARK, weight: 1 });
    return patch(raw);
}
const ladderTables = (patch) => normaliseWorldTables(ladderRaw(patch));
const ledgerOf = (ws, tables = ladderTables(), options = {}) => buildLedger({ ...contentOf(ws), worldTables: tables }, options);
const settleOf = (l, key) => l.world.rules.find(r => r.how === HOW.SETTLE && r.gives[0].key === key);

describe('plan tiers and their opening levels', () => {
    it('⭐ the CMS offers tiers 0 to 7, and each opens at the ladder\'s level', () => {
        expect(PLAN_TIERS).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        expect(PLAN_TIER_LEVELS.map(p => [p.tier, p.level])).toEqual([[0, 1], [1, 10], [2, 20], [3, 30], [4, 40], [5, 50], [6, 60], [7, 80]]);
        expect(tierLabel(7)).toBe('Plane 7');
        expect(settingsOf(null).tierLevels).toEqual(PLAN_TIER_LEVELS.map(p => ({ ...p })));
    });

    it('reads saved levels one per tier in tier order, never falling, the ladder\'s when none is readable', () => {
        expect(tierLevelsOf([{ tier: 3, level: 25 }, { tier: 1, level: 5 }, { tier: 2, level: 4 }, { tier: 'x', level: 9 }, { tier: 4, level: 0 }]))
            .toEqual([{ tier: 1, level: 5 }, { tier: 2, level: 5 }, { tier: 3, level: 25 }]);
        expect(tierLevelsOf('nonsense')).toEqual(PLAN_TIER_LEVELS.map(p => ({ ...p })));
        const levels = tierLevelsOf([{ tier: 2, level: 20 }, { tier: 5, level: 50 }]);
        expect([0, 2, 4, 5, 9].map(t => tierLevelAt(levels, t))).toEqual([1, 20, 20, 50, 50]);
        expect(settingsOf({ tierLevels: [{ tier: 6, level: 55 }] }).tierLevels).toEqual([{ tier: 6, level: 55 }]);
    });
});

describe('reach: levels by rung', () => {
    it('⭐ an origin planned for a later rung than its ring stands on a place of that rung, settled at its opening level', () => {
        const l = ledgerOf(ladderWorkspace(6));
        expect(l.reachOf(tokenKey(DARK))).toMatchObject({ tier: 6, how: HOW.WORLD, via: rungWedgeKey('ores', 3, 6) });
        expect(l.reachOf(itemKey(DARK_ORE)).tier).toBe(6);
        // The rung's place: after a cell of the ring before and the ring's star, as the ring's own, at Mining 60 (tier 6's level, over the template's 20).
        expect(settleOf(l, rungWedgeKey('ores', 3, 6))).toMatchObject({
            floor: 6, ring: 3, needs: [wedgeKey('ores', 2), ringKey(3)], gates: [{ skill: 'mining', level: 60 }]
        });
        expect(l.world.names.get(rungWedgeKey('ores', 3, 6))).toBe('Ores ring 3, Plane 6');
        // The ring's own place and what stands on it are as before.
        expect(settleOf(l, wedgeKey('ores', 3))).toMatchObject({ floor: 3, ring: 3, gates: [{ skill: 'mining', level: 20 }] });
        expect(l.reachOf(tokenKey('token_ores_3'))).toMatchObject({ tier: 3, via: wedgeKey('ores', 3) });
        expect(l.world.ringRungs.get(3)).toEqual({ first: 3, last: 6 });
        expect(l.world.rungs.get(DARK)).toBe(6);
    });

    it('asks the opening level the settings give the rung, and never less than the ring\'s template', () => {
        const moved = ledgerOf(ladderWorkspace(6), ladderTables(), { tierLevels: [{ tier: 0, level: 1 }, { tier: 6, level: 55 }] });
        expect(settleOf(moved, rungWedgeKey('ores', 3, 6)).gates).toEqual([{ skill: 'mining', level: 55 }]);
        const low = ledgerOf(ladderWorkspace(6), ladderTables(), { tierLevels: [{ tier: 0, level: 1 }, { tier: 6, level: 5 }] });
        expect(settleOf(low, rungWedgeKey('ores', 3, 6)).gates).toEqual([{ skill: 'mining', level: 20 }]);
        // Through the CMS, the workspace's Ledger settings are read.
        const ws = { ...ladderWorkspace(6), world: ladderRaw(), planSettings: { tierLevels: [{ tier: 0, level: 1 }, { tier: 6, level: 66 }] } };
        expect(settleOf(workspaceLedger(ws), rungWedgeKey('ores', 3, 6)).gates).toEqual([{ skill: 'mining', level: 66 }]);
    });

    it('a ring whose every origin is of a later rung is settled at its first rung', () => {
        const ws = ladderWorkspace(6);
        for (const line of ['ores', 'trees', 'crops', 'herbs', 'waters', 'arcane']) ws.items[`item_${line}_3`].plan = { tier: 4 };
        const l = ledgerOf(ws);
        expect(l.world.ringRungs.get(3)).toEqual({ first: 4, last: 6 });
        expect(settleOf(l, wedgeKey('ores', 3))).toMatchObject({ floor: 4, gates: [{ skill: 'mining', level: 40 }] });
        expect(l.reachOf(tokenKey('token_ores_3'))).toMatchObject({ tier: 4, via: wedgeKey('ores', 3) });
        expect(l.reachOf(tokenKey(DARK))).toMatchObject({ tier: 6, via: rungWedgeKey('ores', 3, 6) });
    });

    it('an origin planned before its ring stays on the ring\'s own place', () => {
        const l = ledgerOf(ladderWorkspace(1));
        expect(l.reachOf(tokenKey(DARK))).toMatchObject({ tier: 3, via: wedgeKey('ores', 3) });
        expect(l.world.rules.some(r => r.id.startsWith('settle:ores:3:'))).toBe(false);
    });

    it('⭐ content with no plan (the game\'s data) reads every ring as one rung, exactly as before', () => {
        const ws = ladderWorkspace(6);
        const strip = (records) => Object.fromEntries(Object.entries(records).map(([id, def]) => {
            const { plan, ...rest } = def;
            return [id, rest];
        }));
        const bare = { ...ws, items: strip(ws.items), tokens: strip(ws.tokens) };
        const l = ledgerOf(bare);
        expect(l.world.rungs.size).toBe(0);
        expect(l.reachOf(tokenKey(DARK))).toMatchObject({ tier: 3, via: wedgeKey('ores', 3) });
        expect(l.world.rules.filter(r => r.how === HOW.SETTLE).map(r => [r.id, r.floor])).toEqual(
            ['ores', 'trees', 'crops', 'herbs', 'waters', 'arcane'].flatMap((line) => [1, 2, 3].map(ring => [`settle:${line}:${ring}`, ring]))
                .sort((a, b) => Number(a[0].split(':')[2]) - Number(b[0].split(':')[2])),
        );
        expect(worldRungs(ladderTables(), keyed(bare.tokens), keyed(bare.items)).ringRungs.get(3)).toEqual({ first: 3, last: 3 });
    });
});

describe('the ring stars: a ring opens after the ring before\'s last tier', () => {
    it('⭐ is the tier before the ring\'s first rung, the ring before\'s last for a ring that lists nothing, n − 1 with no rungs', () => {
        const rungs = new Map([[1, { first: 1, last: 1 }], [2, { first: 2, last: 3 }], [3, { first: 4, last: 7 }]]);
        expect([1, 2, 3, 4].map(r => ringBudgetTier(r, rungs))).toEqual([0, 1, 3, 7]);
        expect([1, 2, 3, 4].map(r => ringBudgetTier(r))).toEqual([0, 1, 2, 3]);
        // A bush planned for a later tier in ring 1 leaves ring 2 where it is.
        const stray = new Map([[1, { first: 1, last: 3 }], [2, { first: 2, last: 3 }]]);
        expect(ringBudgetTier(2, stray)).toBe(1);
    });

    it('⭐ the pace prices ring 3\'s star to the end of the stage before its first rung', () => {
        const ws = ladderWorkspace(6);
        for (const line of ['ores', 'trees', 'crops', 'herbs', 'waters', 'arcane']) ws.items[`item_${line}_3`].plan = { tier: 4 };
        const content = { ...contentOf(ws), worldTables: ladderTables() };
        const pace = buildPace(content, buildLedger(content), null);
        const budgetOf = (tier) => pace.settings.stages.find(s => s.tier === tier).budgetMinutes / 60;
        const three = pace.hallPaybacks().find(r => r.ring === 3);
        expect(three.budgetHours).toBe(budgetOf(3));
        expect(three.proposed.budgetHours).toBe(budgetOf(3));
        expect(budgetOf(3)).toBeGreaterThan(budgetOf(2));
        // Ring 2 still opens after Plane 1.
        expect(pace.hallPaybacks().find(r => r.ring === 2).budgetHours).toBe(budgetOf(1));
        expect(pace.pathOf(starKey('star_ring_3'), PROFILE.TYPICAL).how).toBe(HOW.STAR);
    });
});

describe('the World plan reads a cell by its rung', () => {
    const plan = (ws, seed, tables = ladderTables()) => worldPlan(contentOf(ws), { seed, baseTables: tables });
    const darkCells = (p) => p.world.cells.filter(c => c.ring === 3 && c.origins.some(o => o.role === 'main' && o.id === DARK));

    it('⭐ a cell whose main origin is of a later rung is settled at that rung, at its opening level', () => {
        const p = plan(ladderWorkspace(6), 1);
        const cells = darkCells(p);
        expect(cells.length).toBeGreaterThan(0);
        for (const cell of cells) {
            const at = p.reach.get(`cell:${cell.id}`);
            expect(at.tier, cell.id).toBe(6);
            expect(at.rule.gates, cell.id).toContainEqual({ skill: 'mining', level: 60 });
        }
        expect(p.reach.get(tokenKey(DARK)).tier).toBe(6);
        // The other ring-3 cells keep their ring.
        const others = p.world.cells.filter(c => c.ring === 3 && !cells.includes(c));
        for (const cell of others) expect(p.reach.get(`cell:${cell.id}`).tier, cell.id).toBe(3);
    });

    it('⭐ a price\'s goods must be had before the cell\'s rung: ring-3 goods may price a later rung\'s cell', () => {
        // Ring 3's price names ring 3's own goods: no iron to reach iron, but read by rung.
        const tables = ladderTables((raw) => {
            raw.prices[3].items.push({ qty: 2, item: 'item_ores_3' });
            return raw;
        });
        const p = plan(ladderWorkspace(6), 1, tables);
        const flagged = new Set(p.findings.filter(f => f.check === WORLD_F.PRICE_RING && f.key === itemKey('item_ores_3')).map(f => f.cellId));
        const dark = new Set(darkCells(p).map(c => c.id));
        const ringThree = p.world.cells.filter(c => c.ring === 3).map(c => c.id);
        expect(dark.size).toBeGreaterThan(0);
        for (const id of ringThree) expect([id, flagged.has(id)]).toEqual([id, !dark.has(id)]);
    });
});

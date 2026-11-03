import { describe, it, expect } from 'vitest';

import { buildLedger, tokenKey, itemKey, wedgeKey, HOW } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE } from '../systems/progression/ledger/pace.js';
import { worldPlan } from '../systems/progression/ledger/world.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { workspaceLedger, contentOf as reportContent } from '../../cms/src/engine/ledgerReport.js';
import { WORLD_FIXTURE_RAW, WORLD_FIXTURE_TABLES, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * The ledger's main reach (First reach, Timeline, Pace, checks A to D) reads the world tables: each
 * origin at its table ring, through a cell of its wedge settled at the ring's price; the guaranteed
 * camps at their ring; what a world holds only sometimes (a kit's camps, the chests, the arrivals)
 * by luck; the Starter Camp at tier 0.
 */

const tablesWith = (patch) => normaliseWorldTables({ ...WORLD_FIXTURE_RAW, ...patch });
const withTables = (ws, tables = WORLD_FIXTURE_TABLES) => ({ ...contentOf(ws), worldTables: tables });
const ledgerOf = (ws, tables) => buildLedger(withTables(ws, tables));

describe('origins at their table ring', () => {
    it('places an origin only the tables list at its ring, through a cell of its wedge', () => {
        const ws = worldWorkspace();
        // Before: only the retired maps placed Tokens, so a world-only origin was never reachable.
        expect(buildLedger(contentOf(ws)).reachOf(tokenKey('token_ores_3')).tier).toBeNull();

        const l = ledgerOf(ws);
        expect(l.reachOf(tokenKey('token_ores_3'))).toMatchObject({ tier: 3, how: HOW.WORLD, via: wedgeKey('ores', 3), luckOnly: false });
        expect(l.reachOf(itemKey('item_ores_3')).tier).toBe(3);
        expect(l.reachOf(tokenKey('token_trees_2')).tier).toBe(2);
        expect(l.reachOf(tokenKey('token_iron_vein'))).toMatchObject({ tier: 2, via: wedgeKey('ores', 2) });
        expect(l.world.names.get(wedgeKey('ores', 2))).toBe('Ores ring 2');
        expect(l.pathOf(itemKey('item_ores_3'))).toBe('ores 3 goods ← ores 3 node (Mining 1) ← Ores ring 3 ← settled on the world map (Mining 20)');
    });

    it('settling a cell asks its line\'s skill at its ring\'s level, after a cell of the ring before', () => {
        const l = ledgerOf(worldWorkspace());
        expect(l.reachOf(tokenKey('token_ores_3')).levels).toEqual({ mining: 20 });
        expect(l.reachOf(tokenKey('token_trees_3')).levels).toEqual({ forestry: 20 });
        expect(l.reachOf(tokenKey('token_crops_1')).levels).toEqual({ farming: 2 });
        const settle = l.world.rules.find(r => r.how === HOW.SETTLE && r.gives[0].key === wedgeKey('ores', 3));
        expect(settle).toMatchObject({ floor: 3, needs: [wedgeKey('ores', 2)], gates: [{ skill: 'mining', level: 20 }] });
    });

    it('keeps the Starter Camp at tier 0', () => {
        const l = ledgerOf(worldWorkspace());
        expect(l.reachOf(tokenKey('token_copper_vein'))).toMatchObject({ tier: 0, how: HOW.STARTER_CAMP });
        expect(l.reachOf(itemKey('item_copper_ore')).tier).toBe(0);
    });

    it('lays the plan\'s wedge and ring on the tables, as the World plan does, through the CMS', () => {
        const ws = worldWorkspace();
        ws.tokens.token_ores_3.plan = { wedge: 'trees', ring: 1 };
        const l = workspaceLedger({ ...ws, world: WORLD_FIXTURE_RAW });
        expect(l.reachOf(tokenKey('token_ores_3'))).toMatchObject({ tier: 1, via: wedgeKey('trees', 1) });
        expect(reportContent({ ...ws, world: WORLD_FIXTURE_RAW }).worldTables.lines.find(l2 => l2.id === 'trees').origins[1].map(o => o.id)).toContain('token_ores_3');
    });

    it('reads the placeholder tables when the workspace holds none, as a new game does', () => {
        const ws = worldWorkspace();
        ws.items.item_quartz = { id: 'item_quartz', name: 'Quartz', type: 'material' };
        ws.tokens.token_quartz_deposit = {
            id: 'token_quartz_deposit', name: 'Quartz Deposit', uses: 3, respawn: { mode: 'refill', afterMs: 60000 },
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 6000, xp: 1, inputs: [], outputs: [{ itemId: 'item_quartz', chance: 100, minQty: 1, maxQty: 1 }] },
        };
        const l = workspaceLedger(ws);
        expect(l.world.worldTables.lines.map(x => x.id)).toEqual(normaliseWorldTables(PLACEHOLDER_WORLD_TABLES).lines.map(x => x.id));
        expect(l.reachOf(tokenKey('token_quartz_deposit'))).toMatchObject({ tier: 2, via: wedgeKey('ores', 2) });
    });
});

describe('the pace and the World plan read it', () => {
    it('a world-only origin has a path time, waiting on its line\'s level', () => {
        const ws = worldWorkspace();
        const content = withTables(ws);
        const ledger = buildLedger(content);
        const path = buildPace(content, ledger, null).pathOf(itemKey('item_ores_3'), PROFILE.TYPICAL);
        expect(Number.isFinite(path.hours)).toBe(true);
        expect(path.steps.some(s => s.waitsOn?.skill === 'mining' && s.waitsOn.level === 20)).toBe(true);
    });

    it('a fighting style a cell asks (Magic for Arcane) is not timed: the path is a floor, not never', () => {
        const ws = worldWorkspace();
        const content = withTables(ws);
        const pace = buildPace(content, buildLedger(content), null);
        const path = pace.pathOf(tokenKey('token_arcane_1'), PROFILE.TYPICAL);
        expect(pace.pathOf(wedgeKey('arcane', 1), PROFILE.TYPICAL).gates).toEqual([{ skill: 'magic', level: 2, hours: null }]);
        expect(Number.isFinite(path.hours)).toBe(true);
        expect(path.complete).toBe(false);
        // No level of it is asked of the track: no wall says it never levels.
        expect(pace.trackOf('magic').asks).toEqual([]);
    });

    it('the World plan finds the same with the main ledger handed in', () => {
        const ws = worldWorkspace();
        const tables = tablesWith({ kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }], arrival: { ...WORLD_FIXTURE_RAW.arrival, 3: { count: [3, 3], enemies: [{ id: 'token_goblin' }] } } });
        const ledger = ledgerOf(ws, tables);
        for (const seed of [1, 2, 4]) {
            const own = worldPlan(contentOf(ws), { seed, baseTables: tables });
            const handed = worldPlan(contentOf(ws), { seed, baseTables: tables, ledger });
            expect(handed.findings).toEqual(own.findings);
        }
    });
});

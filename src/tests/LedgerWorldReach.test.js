import { describe, it, expect } from 'vitest';

import { buildLedger, tokenKey, itemKey, wedgeKey, HOW } from '../systems/progression/ledger/engine.js';
import { runChecks } from '../systems/progression/ledger/checks.js';
import { buildPace, PROFILE } from '../systems/progression/ledger/pace.js';
import { worldPlan } from '../systems/progression/ledger/world.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { workspaceLedger, contentOf as reportContent } from '../../cms/src/engine/ledgerReport.js';
import { WORLD_FIXTURE_RAW, WORLD_FIXTURE_TABLES, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * The ledger's main reach (First reach, Timeline, Pace, checks A to D) reads the world tables, not
 * the retired map items: each origin at its table ring, through a cell of its wedge settled at the
 * ring's price; the guaranteed camps at their ring; what a world holds only sometimes (a kit's camps,
 * the hidden extras, the arrivals) by luck; the Starter Camp at tier 0.
 */

const tablesWith = (patch) => normaliseWorldTables({ ...WORLD_FIXTURE_RAW, ...patch });
const withTables = (ws, tables = WORLD_FIXTURE_TABLES) => ({ ...contentOf(ws), worldTables: tables });
const ledgerOf = (ws, tables) => buildLedger(withTables(ws, tables));
const RETIRED_HOWS = [HOW.MAP, HOW.MODIFIER, HOW.TUTORIAL, HOW.BOUNTY, HOW.UPCYCLE];

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

describe('the retired map items', () => {
    it('place nothing: no map, modifier, tutorial, bounty or trading-up rule, and the maps are marked retired', () => {
        const l = ledgerOf(worldWorkspace());
        expect(l.world.rules.filter(r => RETIRED_HOWS.includes(r.how))).toEqual([]);
        expect(l.world.retired).toEqual(new Set([itemKey('map_mountain'), itemKey('map_volcano'), itemKey('mod_deep_veins')]));
        // The Volcano Map's Wild Hive is had from the Crops wedge.
        expect(l.reachOf(tokenKey('token_wild_hive'))).toMatchObject({ tier: 1, via: wedgeKey('crops', 1) });
        // Without the world tables (the game's encyclopedia) the maps are read as before.
        expect(buildLedger(contentOf(worldWorkspace())).world.rules.some(r => r.how === HOW.MAP)).toBe(true);
    });

    it('are not checked as entries: a retired map is not "never reachable"', () => {
        const ws = worldWorkspace();
        const findings = runChecks(ledgerOf(ws), withTables(ws));
        for (const id of ['map_mountain', 'map_volcano', 'mod_deep_veins']) expect(findings.filter(f => f.key === itemKey(id)), id).toEqual([]);
        // And a world-only origin is no longer late.
        expect(findings.filter(f => f.key === itemKey('item_ores_3')).map(f => f.check)).toEqual(['unused']);
        const before = runChecks(buildLedger(contentOf(ws)), contentOf(ws));
        expect(before.filter(f => f.key === itemKey('item_ores_3')).map(f => f.check)).toContain('late');
    });
});

describe('camps', () => {
    it('a guaranteed camp is had for sure at its ring, through the line leaning most to its kit', () => {
        const tables = tablesWith({
            kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }, { id: 'lowland', name: 'Lowland', work: { farming: 1 } }],
            camps: { 2: [{ id: 'token_chief_tent', kits: ['highland'] }] },
            lines: WORLD_FIXTURE_RAW.lines.map(l => ({ ...l, kits: l.id === 'trees' ? { highland: 3, lowland: 1 } : { highland: 1, lowland: 1 } })),
            arrival: { ...WORLD_FIXTURE_RAW.arrival, 3: { count: [3, 3], enemies: [{ id: 'token_goblin' }] } },
        });
        const l = ledgerOf(worldWorkspace(), tables);
        expect(l.reachOf(tokenKey('token_chief_tent'))).toMatchObject({ tier: 2, luckOnly: false, sureTier: 2, via: wedgeKey('trees', 2) });
        expect(l.reachOf(tokenKey('token_goblin_chief'))).toMatchObject({ tier: 2, luckOnly: false });
    });

    it('a wedge whose tables list nothing by the ring comes after one that does, however it leans', () => {
        const tables = tablesWith({
            kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }, { id: 'wetland', name: 'Wetland', work: { fishing: 1 } }],
            camps: { 1: [{ id: 'token_chief_tent', kits: ['wetland'] }] },
            lines: WORLD_FIXTURE_RAW.lines.map(l => (l.id === 'herbs' ? { ...l, kits: { wetland: 3 }, origins: { ...l.origins, 1: [] } }
                : l.id === 'waters' ? { ...l, kits: { highland: 3, wetland: 1 } } : l)),
        });
        expect(ledgerOf(worldWorkspace(), tables).reachOf(tokenKey('token_chief_tent'))).toMatchObject({ tier: 1, via: wedgeKey('waters', 1) });
        const stocked = tablesWith({ ...tables, lines: tables.lines.map(l => (l.id === 'herbs' ? { ...l, origins: WORLD_FIXTURE_RAW.lines.find(x => x.id === 'herbs').origins } : l)) });
        expect(ledgerOf(worldWorkspace(), stocked).reachOf(tokenKey('token_chief_tent'))).toMatchObject({ tier: 1, via: wedgeKey('herbs', 1) });
    });

    it('a kit\'s boss camp, with no guarantee, is had only in some worlds: luck', () => {
        const l = ledgerOf(worldWorkspace());
        expect(l.reachOf(tokenKey('token_chief_tent'))).toMatchObject({ tier: 1, luckOnly: true, sureTier: null });
        expect(l.pathOf(tokenKey('token_chief_tent'))).toMatch(/in some worlds/);
        const tables = tablesWith({ camps: { 1: ['token_chief_tent'] } });
        expect(ledgerOf(worldWorkspace(), tables).reachOf(tokenKey('token_chief_tent'))).toMatchObject({ tier: 1, luckOnly: false });
    });

    it('a guaranteed camp is had once a cell is settled, with no kit naming it', () => {
        const tables = tablesWith({ kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }], camps: { 3: ['token_chief_tent'] } });
        expect(ledgerOf(worldWorkspace(), tables).reachOf(tokenKey('token_chief_tent'))).toMatchObject({ tier: 3, luckOnly: false });
    });
});

describe('what a world holds only sometimes', () => {
    it('an arrival\'s boss is luck at its ring', () => {
        const tables = tablesWith({ kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }] });
        expect(ledgerOf(worldWorkspace(), tables).reachOf(tokenKey('token_goblin_chief'))).toMatchObject({ tier: 3, luckOnly: true, sureTier: null });
    });

    it('an origin every world places is had for sure, however soon it wears out', () => {
        const ws = worldWorkspace();
        delete ws.tokens.token_ores_3.respawn;
        ws.tokens.token_ores_3.uses = 100;
        const l = ledgerOf(ws);
        expect(l.reachOf(itemKey('item_ores_3'))).toMatchObject({ tier: 3, luckOnly: false, oneOffOnly: false });
        // Its wearing out is the fragile check's to say.
        expect(runChecks(l, withTables(ws)).filter(f => f.key === itemKey('item_ores_3')).map(f => f.check)).toContain('fragile');
    });

    it('a treasure extra is a one-off find on the side, never the way in', () => {
        const ws = worldWorkspace();
        ws.tokens.token_iron_chest = {
            id: 'token_iron_chest', name: 'Iron Chest', uses: 1,
            config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: 'item_iron_ore', chance: 100, minQty: 4, maxQty: 8 }] },
        };
        const tables = tablesWith({ extras: [...WORLD_FIXTURE_RAW.extras, { id: 'token_iron_chest', kind: 'treasure', value: 5, rings: [1] }] });
        const l = ledgerOf(ws, tables);
        const iron = l.reachOf(itemKey('item_iron_ore'));
        expect(iron).toMatchObject({ tier: 2, luckOnly: false, via: tokenKey('token_iron_vein') });
        expect(iron.oneOffFind).toMatchObject({ tier: 1, via: tokenKey('token_iron_chest') });
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

    it('the World plan finds the same with the main ledger handed in, and still tells what the maps lost', () => {
        const ws = worldWorkspace();
        const tables = tablesWith({ kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }], arrival: { ...WORLD_FIXTURE_RAW.arrival, 3: { count: [3, 3], enemies: [{ id: 'token_goblin' }] } } });
        const ledger = ledgerOf(ws, tables);
        for (const seed of [1, 2, 4]) {
            const own = worldPlan(contentOf(ws), { seed, baseTables: tables });
            const handed = worldPlan(contentOf(ws), { seed, baseTables: tables, ledger });
            expect(handed.findings).toEqual(own.findings);
        }
        const tent = worldPlan(contentOf(ws), { seed: 4, baseTables: tables, ledger }).findings.find(f => f.subject === tokenKey('token_chief_tent'));
        expect(tent.before).toBe(1);
    });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildLedger, tokenKey, itemKey } from '../systems/progression/ledger/engine.js';
import { cleanPlan, planPlaceOf, PLAN_RINGS } from '../systems/progression/ledger/plan.js';
import { CHECKS } from '../../cms/src/engine/ledger/checks.js';
import {
    WORLD_F, F_CHECKS, plannedTables, originFindings, worldPlan, sweepWorlds, worldChecks,
} from '../../cms/src/engine/ledger/world.js';
import { STRICT_RINGS, normaliseWorldTables } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { workspaceFromDataFiles, validatePack } from '../../cms/src/engine/changePacks.js';
import { WORLD_FIXTURE_RAW, WORLD_FIXTURE_TABLES, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * The ledger meets the world (brief 330 W5): origins carry a wedge and a ring in their plan; the
 * World plan generates a world for a seed from the tables with the plan's places laid on; checks F
 * read it (a ring-N cell asking ring-N materials, key materials not a step from every frontier, the
 * inner rings not covering every Live entry, a wild origin no wedge places, a cell's extras off its
 * ring's value), and many worlds are swept for the rules, per-skill bands and price spreads.
 *
 * The fixture (`fixtures/ledgerWorldMap.js`) keeps every rule, so each block below breaks one.
 */

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const ROOT = path.resolve(DATA, '..');

const plan = (ws, seed, tables = WORLD_FIXTURE_TABLES) => worldPlan(contentOf(ws), { seed, baseTables: tables });
const of = (findings, check) => findings.filter(f => f.check === check);
const tablesWith = (patch) => normaliseWorldTables({ ...WORLD_FIXTURE_RAW, ...patch });
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

/** A gold vein the fixture's tables never list, and its gold. */
function withGold(ws, planBlock) {
    ws.items.item_gold = { id: 'item_gold', name: 'Gold', type: 'material' };
    ws.tokens.token_gold_vein = {
        id: 'token_gold_vein', name: 'Gold Vein', uses: 3, respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 30, cycleTimeMs: 9000, xp: 1, inputs: [], outputs: [{ itemId: 'item_gold', chance: 100, minQty: 1, maxQty: 1 }] },
        ...(planBlock ? { plan: planBlock } : {})
    };
    return ws;
}

describe('wedge and ring on origins: the plan block', () => {
    it('a plan may say where an origin sits: a wedge (a line id) and a strict ring', () => {
        expect(PLAN_RINGS).toEqual(Array.from({ length: STRICT_RINGS }, (_, i) => i + 1));
        expect(planPlaceOf({ plan: { wedge: 'ores', ring: 2 } })).toEqual({ wedge: 'ores', ring: 2 });
        expect(planPlaceOf({ plan: { status: 'live' } })).toEqual({ wedge: null, ring: null });
        expect(planPlaceOf({})).toEqual({ wedge: null, ring: null });
    });

    it('cleanPlan keeps a wedge and a strict ring, tidied, and drops what cannot be one', () => {
        expect(cleanPlan({ wedge: ' ores ', ring: 2 })).toEqual({ wedge: 'ores', ring: 2 });
        expect(cleanPlan({ wedge: '', ring: 0 })).toBeUndefined();
        expect(cleanPlan({ wedge: 'trees', ring: 4 })).toEqual({ wedge: 'trees' });
        expect(cleanPlan({ ring: '3' })).toEqual({ ring: 3 });
        expect(cleanPlan({ status: 'live', tier: 2, wedge: 'ores', ring: 2, note: 'x' })).toEqual({ status: 'live', tier: 2, wedge: 'ores', ring: 2, note: 'x' });
    });

    it('a change pack may not set a wedge that is not text or a ring outside the strict rings', () => {
        const pack = (planBlock) => ({
            format: 'fantasy-guild-change-pack', version: 1, id: 'w5-wedges', createdAt: '2026-11-01T12:00:00Z', asked: 'Place the coal vein',
            entries: [{ op: 'create', kind: 'token', id: 'token_tin_vein', value: { id: 'token_tin_vein', name: 'Tin Vein', plan: planBlock }, note: 'A new vein' }],
        });
        expect(validatePack(pack({ wedge: 'ores', ring: 1 }))).toEqual({ ok: true });
        expect(validatePack(pack({ wedge: 3 })).errors.join(' ')).toMatch(/wedge/);
        expect(validatePack(pack({ ring: 4 })).errors.join(' ')).toMatch(/ring/);
    });
});

describe('the planned tables: the plan lays its places on the tables', () => {
    it('with no place in any plan, the tables are the base tables, nothing moved', () => {
        const { tables, moved, unknown } = plannedTables(WORLD_FIXTURE_TABLES, worldWorkspace().tokens);
        expect(tables.lines).toEqual(WORLD_FIXTURE_TABLES.lines);
        expect(moved).toEqual([]);
        expect(unknown).toEqual([]);
    });

    it('an origin the plan places moves there from wherever the base listed it, keeping its weight', () => {
        const ws = worldWorkspace();
        ws.tokens.token_coal_vein.plan = { wedge: 'trees', ring: 2 };
        const { tables, moved } = plannedTables(WORLD_FIXTURE_TABLES, ws.tokens);
        const ores = tables.lines.find(l => l.id === 'ores');
        const trees = tables.lines.find(l => l.id === 'trees');
        expect(ores.origins[1].map(o => o.id)).not.toContain('token_coal_vein');
        expect(trees.origins[2].find(o => o.id === 'token_coal_vein')).toEqual({ id: 'token_coal_vein', weight: 1 });
        expect(moved).toEqual([{ id: 'token_coal_vein', from: { line: 'ores', ring: 1 }, to: { line: 'trees', ring: 2 } }]);
        // The base tables are left as they were.
        expect(WORLD_FIXTURE_TABLES.lines.find(l => l.id === 'ores').origins[1].map(o => o.id)).toContain('token_coal_vein');
    });

    it('a Planned stub placed by its plan joins the tables; a wedge the tables lack is listed, not placed', () => {
        const ws = worldWorkspace();
        ws.tokens.token_mythril_vein.plan = { status: 'planned', tier: 3, wedge: 'ores', ring: 3 };
        ws.tokens.token_coal_vein.plan = { wedge: 'volcanoes', ring: 1 };
        const { tables, moved, unknown } = plannedTables(WORLD_FIXTURE_TABLES, ws.tokens);
        expect(tables.lines.find(l => l.id === 'ores').origins[3].map(o => o.id)).toContain('token_mythril_vein');
        expect(moved).toContainEqual({ id: 'token_mythril_vein', from: null, to: { line: 'ores', ring: 3 } });
        expect(unknown).toEqual([{ id: 'token_coal_vein', wedge: 'volcanoes' }]);
        expect(tables.lines.find(l => l.id === 'ores').origins[1].map(o => o.id)).toContain('token_coal_vein');
    });
});

describe('checks F on a world that keeps every rule', () => {
    it('every F check has its group, a severity and words', () => {
        expect(F_CHECKS).toEqual([WORLD_F.PRICE_RING, WORLD_F.KEY_REACH, WORLD_F.COVERAGE, WORLD_F.NO_WEDGE, WORLD_F.VALUE, WORLD_F.RING_STAR]);
        for (const id of [...F_CHECKS, WORLD_F.RULE]) {
            expect(CHECKS[id]).toMatchObject({ group: 'F' });
            expect(CHECKS[id].label.length).toBeGreaterThan(5);
        }
    });

    it('finds nothing in world after world of the fixture', () => {
        for (const seed of SEEDS) {
            const p = plan(worldWorkspace(), seed);
            expect(p.findings.map(f => f.message)).toEqual([]);
            expect(p.world.cells.filter(c => c.ring >= 1 && c.ring <= STRICT_RINGS)).toHaveLength(36);
        }
    });

    it('reads each inner cell as a place the guild settles: its contents are first had at its ring', () => {
        const p = plan(worldWorkspace(), 3);
        expect(p.reach.get(tokenKey('token_iron_vein')).tier).toBe(2);
        expect(p.reach.get(itemKey('item_iron_ore')).tier).toBe(2);
        expect(p.reach.get(itemKey('item_ores_3')).tier).toBe(3);
        // The Chief's Tent: a combat specialty's boss camp, so somewhere in the inner rings.
        expect(p.reach.get(tokenKey('token_chief_tent')).tier).not.toBeNull();
    });
});

describe('F: a ring-N cell asking ring-N materials (no iron to reach iron)', () => {
    it('a price slot naming an item first had at the cell\'s own ring is found on every such cell', () => {
        const tables = tablesWith({ prices: { ...WORLD_FIXTURE_RAW.prices, 2: { ...WORLD_FIXTURE_RAW.prices[2], items: [...WORLD_FIXTURE_RAW.prices[2].items, { qty: 2, item: 'item_iron_ingot' }] } } });
        const p = plan(worldWorkspace(), 5, tables);
        const hits = of(p.findings, WORLD_F.PRICE_RING);
        expect(hits).toHaveLength(12);
        expect(new Set(hits.map(f => p.world.cells.find(c => c.id === f.cellId).ring))).toEqual(new Set([2]));
        expect(hits[0]).toMatchObject({ subject: itemKey('item_iron_ingot'), severity: 'warn' });
        expect(hits[0].message).toMatch(/Iron Ingot.*ring 2/);
    });

    it('a price slot naming an item the inner rings never give is found too', () => {
        const ws = worldWorkspace();
        ws.items.item_star = { id: 'item_star', name: 'Star', type: 'material' };
        const tables = tablesWith({ prices: { ...WORLD_FIXTURE_RAW.prices, 1: { ...WORLD_FIXTURE_RAW.prices[1], items: [{ qty: 5 }, { qty: 1, item: 'item_star' }] } } });
        const hits = of(plan(ws, 5, tables).findings, WORLD_F.PRICE_RING);
        expect(hits).toHaveLength(6);
        expect(hits[0].message).toMatch(/Star.*never/);
    });

    it('a gathered material of the cell\'s own ring (the world\'s own rule) is found', () => {
        const p = plan(worldWorkspace(), 5);
        const cell = p.world.cells.find(c => c.ring === 2);
        cell.requires.items[0].itemId = 'item_iron_ore';
        const hits = of(worldChecks(p), WORLD_F.PRICE_RING);
        expect(hits.map(f => f.cellId)).toContain(cell.id);
        expect(hits.find(f => f.cellId === cell.id).subject).toBe(itemKey('item_iron_ore'));
    });
});

describe('F: key materials not a step from every frontier', () => {
    it('a ring-1 cell with no ring-2 neighbour holding iron is found, for that key', () => {
        const p = plan(worldWorkspace(), 6);
        for (const cell of p.world.cells.filter(c => c.ring === 2)) cell.origins = cell.origins.filter(o => o.id !== 'token_iron_vein');
        const hits = of(worldChecks(p), WORLD_F.KEY_REACH);
        expect(hits).toHaveLength(6);
        expect(hits.every(f => f.subject === tokenKey('token_iron_vein'))).toBe(true);
    });
});

describe('F: the inner rings not covering every Live entry', () => {
    it('a Live origin no table places, and what only it gives, are not covered', () => {
        const p = plan(withGold(worldWorkspace()), 2);
        const hits = of(p.findings, WORLD_F.COVERAGE);
        expect(hits.map(f => f.subject).sort()).toEqual([itemKey('item_gold'), tokenKey('token_gold_vein')]);
        expect(hits.find(f => f.subject === itemKey('item_gold')).message).toMatch(/Gold Vein/);
    });

    it('Parked and Planned entries are not asked to be covered', () => {
        const p = plan(withGold(worldWorkspace(), { status: 'parked' }), 2);
        expect(of(p.findings, WORLD_F.COVERAGE).map(f => f.subject)).toEqual([itemKey('item_gold')]);
        const keys = of(plan(worldWorkspace(), 2).findings, WORLD_F.COVERAGE).map(f => f.subject);
        expect(keys).not.toContain(tokenKey('token_mythril_vein'));
    });

    it('an enemy no kit or arrival brings is not covered', () => {
        const ws = worldWorkspace();
        const tables = tablesWith({ kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }], arrival: { ...WORLD_FIXTURE_RAW.arrival, 3: { count: [3, 3], enemies: [{ id: 'token_goblin' }] } } });
        const hits = of(plan(ws, 4, tables).findings, WORLD_F.COVERAGE);
        expect(hits.map(f => f.subject)).toEqual(expect.arrayContaining([tokenKey('token_chief_tent'), tokenKey('token_goblin_chief')]));
    });
});

describe('F: a wild origin no wedge places', () => {
    it('a Live Token whose own work yields a material, which no table or plan places, is found', () => {
        const findings = originFindings(contentOf(withGold(worldWorkspace())), { baseTables: WORLD_FIXTURE_TABLES });
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ check: WORLD_F.NO_WEDGE, key: tokenKey('token_gold_vein'), severity: 'warn' });
        expect(findings[0].message).toMatch(/Gold/);
        // It is part of each world's findings as well.
        expect(of(plan(withGold(worldWorkspace()), 1).findings, WORLD_F.NO_WEDGE)).toHaveLength(1);
    });

    it('its plan\'s wedge and ring place it: no finding, and the world holds it at that ring', () => {
        const ws = withGold(worldWorkspace(), { wedge: 'ores', ring: 3 });
        expect(originFindings(contentOf(ws), { baseTables: WORLD_FIXTURE_TABLES })).toEqual([]);
        const p = plan(ws, 1);
        expect(p.findings).toEqual([]);
        expect(p.reach.get(itemKey('item_gold')).tier).toBe(3);
    });

    it('a plan naming a wedge the tables lack is found; a Starter Camp origin, a station, an enemy, a spawner and a grown Token are not origins to place', () => {
        const ws = withGold(worldWorkspace(), { wedge: 'volcanoes', ring: 2 });
        const findings = originFindings(contentOf(ws), { baseTables: WORLD_FIXTURE_TABLES });
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toMatch(/volcanoes/);
        const camp = worldWorkspace();
        camp.tokens.token_salt_pan = { id: 'token_salt_pan', name: 'Salt Pan', config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 5000, xp: 1, inputs: [], outputs: [{ itemId: 'item_coal', chance: 100, minQty: 1, maxQty: 1 }] } };
        camp.starterCamp.tokens.push({ typeId: 'token_salt_pan', x: 900, y: 100 });
        expect(originFindings(contentOf(camp), { baseTables: WORLD_FIXTURE_TABLES })).toEqual([]);
        expect(originFindings(contentOf(worldWorkspace()), { baseTables: WORLD_FIXTURE_TABLES })).toEqual([]);
    });

    it('a Parked wild origin is left alone', () => {
        expect(originFindings(contentOf(withGold(worldWorkspace(), { status: 'parked' })), { baseTables: WORLD_FIXTURE_TABLES })).toEqual([]);
    });
});

describe('F: a cell\'s value off by more than ±10 %', () => {
    it('a strict cell whose extras are worth more than its ring\'s value and tolerance is found', () => {
        const p = plan(worldWorkspace(), 7);
        const cell = p.world.cells.find(c => c.ring === 1);
        cell.extras = [{ id: 'token_fixture_chest', kind: 'treasure', value: 10 }, { id: 'token_fixture_chest', kind: 'treasure', value: 10 }];
        cell.value = 20;
        const hits = of(worldChecks(p), WORLD_F.VALUE);
        expect(hits.map(f => f.cellId)).toEqual([cell.id]);
        expect(hits[0].subject).toBe('ring 1');
    });
});

describe('the other rules of the world', () => {
    it('a line with nothing for a ring is listed under the world\'s other rules, grouped by line and ring', () => {
        const lines = WORLD_FIXTURE_RAW.lines.map(l => (l.id === 'arcane' ? { ...l, origins: { ...l.origins, 1: [] } } : l));
        const p = plan(worldWorkspace(), 1, tablesWith({ lines }));
        const rule = of(p.findings, WORLD_F.RULE);
        expect(rule.length).toBeGreaterThan(0);
        expect(rule.map(f => f.subject)).toContain('no-main: Arcane ring 1');
        // Not one of the five.
        expect(p.findings.filter(f => F_CHECKS.includes(f.check)).map(f => f.check)).not.toContain(WORLD_F.RULE);
    });
});

describe('many worlds: the rules, per-skill bands and price spreads', () => {
    it('counts the worlds that pass, and groups each rule\'s failures by what fails across worlds', () => {
        const clean = sweepWorlds(contentOf(worldWorkspace()), { seeds: SEEDS, baseTables: WORLD_FIXTURE_TABLES });
        expect(clean).toMatchObject({ seeds: SEEDS.length, passed: SEEDS.length, passedAll: SEEDS.length });
        const gold = sweepWorlds(contentOf(withGold(worldWorkspace())), { seeds: SEEDS, baseTables: WORLD_FIXTURE_TABLES });
        expect(gold.passed).toBe(0);
        const coverage = gold.rules[WORLD_F.COVERAGE];
        expect(coverage.worlds).toBe(SEEDS.length);
        expect(coverage.subjects.find(s => s.subject === tokenKey('token_gold_vein'))).toMatchObject({ worlds: SEEDS.length, name: 'Gold Vein' });
        expect(gold.rules[WORLD_F.NO_WEDGE].subjects).toHaveLength(1);
    });

    it('per skill and ring: how many cells offer its new work and how many heroes it keeps busy, as a band over the worlds', () => {
        const sweep = sweepWorlds(contentOf(worldWorkspace()), { seeds: SEEDS, baseTables: WORLD_FIXTURE_TABLES });
        const mining1 = sweep.bands.find(b => b.skill === 'mining' && b.ring === 1);
        expect(mining1.cells.min).toBeGreaterThan(0);
        expect(mining1.cells.min).toBeLessThanOrEqual(mining1.cells.median);
        expect(mining1.cells.median).toBeLessThanOrEqual(mining1.cells.max);
        expect(mining1.heroes.max).toBeGreaterThan(0);
        expect(mining1.zero).toBe(0);
        const lines = WORLD_FIXTURE_RAW.lines.map(l => (l.id === 'herbs' ? { ...l, origins: { ...l.origins, 1: [] } } : l));
        const holes = sweepWorlds(contentOf(worldWorkspace()), { seeds: SEEDS, baseTables: tablesWith({ lines }) });
        const herbs1 = holes.bands.find(b => b.skill === 'alchemy' && b.ring === 1);
        expect(herbs1.zero).toBeGreaterThan(0);
    });

    it('per ring: the spread of a cell\'s price in items and in hero time, dearer outward', () => {
        const sweep = sweepWorlds(contentOf(worldWorkspace()), { seeds: SEEDS, baseTables: WORLD_FIXTURE_TABLES });
        const rings = sweep.prices.map(p => p.ring);
        expect(rings).toEqual([1, 2, 3, 4]);
        const [r1, r2] = sweep.prices;
        expect(r1.items).toEqual({ min: 5, median: 5, max: 5 });
        expect(r2.items.min).toBe(15);
        expect(r1.effortMs.min).toBeGreaterThan(0);
        expect(r2.effortMs.median).toBeGreaterThan(r1.effortMs.median);
        expect(r2.skills).toEqual([{ level: 10, cells: expect.any(Number) }]);
    });
});

describe('on the shipped content and the placeholder tables', () => {
    it('a world generates and is read without throwing, and a few worlds sweep', () => {
        const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
        const ws = workspaceFromDataFiles({
            items: read('data/items.json'), tokens: read('data/tokens.json'), effects: read('data/effects.json'),
            tokenRecipes: read('data/tokenRecipes.json'), starterCamp: read('data/starterCamp.json'), plan: read('cms/plan/plan.json'),
        });
        const base = normaliseWorldTables(PLACEHOLDER_WORLD_TABLES);
        const content = contentOf(ws);
        const ledger = buildLedger(content);
        const p = worldPlan(content, { seed: 1, baseTables: base, ledger });
        expect(p.world.cells.length).toBeGreaterThan(36);
        expect(p.findings.every(f => CHECKS[f.check]?.group === 'F')).toBe(true);
        const sweep = sweepWorlds(content, { seeds: [1, 2, 3], baseTables: base, ledger });
        expect(sweep.seeds).toBe(3);
    });
});

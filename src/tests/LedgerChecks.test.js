import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildLedger, itemKey, tokenKey, recipeKey } from '../systems/progression/ledger/engine.js';
import { runChecks, CHECKS, filterFindings, findingsByKey, STARTER_CAMP_KEY } from '../systems/progression/ledger/checks.js';
import { ledgerWorkspace } from './fixtures/ledgerWorld.js';

/**
 * The ledger's checks A to C (`ledger/checks.js`) on the fixture world (`fixtures/ledgerWorld.js`),
 * each check made to fire by a small change to it, and on the shipped content, where they must find
 * what the audit of 2026-10-28 found by hand.
 */

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');

const checksOf = (ws) => runChecks(buildLedger(ws), ws);
const on = (findings, key, check) => findings.filter((f) => f.key === key && (!check || f.check === check));
const recipe = (ws, id) => Object.values(ws.recipePools).flat().find((r) => r.id === id);

describe('checks on the fixture world', () => {
    it('gives every finding a known check, its group, a severity and words, worst first', () => {
        const findings = checksOf(ledgerWorkspace());
        expect(findings.length).toBeGreaterThan(0);
        for (const f of findings) {
            expect(CHECKS[f.check]).toBeTruthy();
            expect(f.group).toBe(CHECKS[f.check].group);
            expect(['block', 'warn', 'info']).toContain(f.severity);
            expect(f.message.length).toBeGreaterThan(10);
        }
        const rank = { block: 0, warn: 1, info: 2 };
        for (let i = 1; i < findings.length; i++) expect(rank[findings[i - 1].severity]).toBeLessThanOrEqual(rank[findings[i].severity]);
    });

    it('A: names something that does not exist, as a Block on the record that names it', () => {
        const ws = ledgerWorkspace();
        ws.tokens.token_coal_vein.config.outputs.push({ itemId: 'item_nope', chance: 100, minQty: 1, maxQty: 1 });
        ws.starterCamp.tokens.push({ typeId: 'token_gone', x: 0, y: 0 });
        const findings = checksOf(ws);
        expect(on(findings, tokenKey('token_coal_vein'), 'unknown-ref')[0]).toMatchObject({ severity: 'block', related: [itemKey('item_nope')] });
        expect(on(findings, STARTER_CAMP_KEY, 'unknown-ref')[0].message).toMatch(/token_gone/);
    });

    it('A: used but never produced, and produced but unused', () => {
        const ws = ledgerWorkspace();
        ws.items.item_salt = { id: 'item_salt', name: 'Salt', type: 'material' };
        recipe(ws, 'recipe_copper_ingot').inputs.push({ itemId: 'item_salt', quantity: 1 });
        const findings = checksOf(ws);
        expect(on(findings, itemKey('item_salt'), 'never-produced')[0].message).toMatch(/Spent by Copper Ingot/);
        // Said once: not also "never reachable".
        expect(on(findings, itemKey('item_salt'), 'never-reachable')).toHaveLength(0);
        // The Birdwatcher's nests are made and nothing spends them; food and tools are used by heroes.
        expect(on(findings, itemKey('item_bird_nest'), 'unused')).toHaveLength(1);
        expect(on(findings, itemKey('item_shrimp'), 'unused')).toHaveLength(0);
    });

    it('A: never reachable says why, and a loop with no way in is named as one', () => {
        const ws = ledgerWorkspace();
        ws.tokens.token_lonely = { id: 'token_lonely', name: 'Lonely Rock', config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, inputs: [], outputs: [] } };
        delete ws.tokens.token_wild_patch.field;
        const findings = checksOf(ws);
        expect(on(findings, tokenKey('token_lonely'), 'never-reachable')[0].message).toMatch(/nothing makes or places it/);
        const loop = on(findings, itemKey('item_wheat_seed'), 'loop')[0];
        expect(loop.message).toMatch(/Wheat Seed → .*Wheat.* → Wheat Seed/);
    });

    it('A: a tool nothing gives, one starter tool for a whole skill, a recipe nothing can host', () => {
        const ws = ledgerWorkspace();
        ws.tokens.token_deep_vein = { id: 'token_deep_vein', name: 'Deep Vein', needsTool: { kind: 'pickaxe', minTier: 5 }, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, inputs: [], outputs: [{ itemId: 'item_coal', chance: 100 }] } };
        ws.starterCamp.tokens.push({ typeId: 'token_deep_vein', x: 0, y: 0 });
        ws.recipePools.smithing.push({ id: 'recipe_pot', name: 'Pot', skill: 'smithing', stationKinds: ['kiln'], inputs: [], outputs: [{ itemId: 'item_coal' }] });
        const findings = checksOf(ws);
        expect(on(findings, tokenKey('token_deep_vein'), 'tool-missing')[0].message).toMatch(/pickaxe 5\+/);
        expect(on(findings, itemKey('item_copper_sickle'), 'tool-single')[0]).toMatchObject({ severity: 'warn' });
        expect(on(findings, itemKey('item_fishing_rod'), 'tool-single')[0]).toMatchObject({ severity: 'warn' });
        // The Iron Pickaxe is made, so a second pickaxe comes later: a fact, not a problem.
        expect(on(findings, itemKey('item_copper_pickaxe'), 'tool-single')[0]).toMatchObject({ severity: 'info' });
        expect(on(findings, itemKey('item_copper_pickaxe'), 'tool-single')[0].message).toMatch(/Iron Pickaxe/);
        expect(on(findings, recipeKey('recipe_pot'), 'no-host')[0].message).toMatch(/kiln/);
    });

    it('B: a leak before its tier, late after it, and an ingredient from a later tier', () => {
        const ws = ledgerWorkspace();
        ws.items.item_copper_ingot.plan = { tier: 1 };
        ws.items.item_iron_ingot.plan = { tier: 1 };
        const findings = checksOf(ws);
        expect(on(findings, itemKey('item_copper_ingot'), 'leak')[0].message).toMatch(/Reachable at Starter Camp, before its tier \(Plane 1\): Copper Ingot ← Furnace/);
        expect(on(findings, itemKey('item_iron_ingot'), 'late')[0].message).toMatch(/Plane 2, later than its tier \(Plane 1\)/);
        expect(on(findings, itemKey('item_iron_ingot'), 'later-ingredient')[0]).toMatchObject({ related: [itemKey('item_iron_ore')] });
        // In its tier, nothing to say.
        expect(on(checksOf(ledgerWorkspace()), itemKey('item_iron_ingot'), 'late')).toHaveLength(0);
        expect(on(checksOf(ledgerWorkspace()), itemKey('item_iron_ingot'), 'leak')).toHaveLength(0);
    });

    it('B: Live content that needs a Planned entry is a Block; stubs nothing points to, and items with no tier, are noted', () => {
        const ws = ledgerWorkspace();
        recipe(ws, 'recipe_iron_pickaxe').inputs.push({ itemId: 'item_mythril_ore', quantity: 1 });
        const findings = checksOf(ws);
        expect(on(findings, recipeKey('recipe_iron_pickaxe'), 'refs-planned')[0]).toMatchObject({ severity: 'block', related: [itemKey('item_mythril_ore')] });
        // Once Live content names it, the stub is no orphan.
        expect(on(findings, itemKey('item_mythril_ore'), 'orphan-stub')).toHaveLength(0);
        const plain = checksOf(ledgerWorkspace());
        expect(on(plain, itemKey('item_mythril_ore'), 'orphan-stub')).toHaveLength(1);
        expect(on(plain, tokenKey('token_mythril_vein'), 'orphan-stub')).toHaveLength(1);
        expect(on(plain, itemKey('item_coal'), 'no-tier')[0]).toMatchObject({ severity: 'info' });
        expect(on(plain, itemKey('item_copper_ore'), 'no-tier')).toHaveLength(0);
        // A Planned stub is not in the game: no reach checks on it.
        expect(on(plain, itemKey('item_mythril_ore'), 'never-reachable')).toHaveLength(0);
    });

    it('C: luck only, a single map, a first kill only, the Shop only', () => {
        const findings = checksOf(ledgerWorkspace());
        // Honey: 3 % from goblins in the camp; the Volcano's hive is sure.
        expect(on(findings, itemKey('item_honey'), 'luck-only')[0]).toMatchObject({ severity: 'info' });
        expect(on(findings, itemKey('item_honey'), 'luck-only')[0].message).toMatch(/3% from Goblin.*sure way from Plane 2/);
        // Iron Ore: only the Volcano's veins (the Fire Elemental's 2 % spawn is luck), and Iron Ingot needs it.
        expect(on(findings, itemKey('item_iron_ore'), 'fragile')[0]).toMatchObject({ severity: 'warn', message: 'Only from the Volcano Map (Iron Vein).' });
        expect(on(findings, itemKey('map_volcano'), 'first-kill-only')[0].message).toMatch(/Goblin Chief/);
        expect(on(findings, tokenKey('token_wood_foundation'), 'shop-only')[0].message).toBe('Only from the Shop, for 15 Oak Wood.');
    });

    it('C: a place only luck opens does not count as a second source', () => {
        const ws = ledgerWorkspace();
        ws.tokens.token_fire_elemental.config.outputs.push({ itemId: 'item_iron_ore', chance: 100, minQty: 1, maxQty: 1 });
        // A 2 % ambush in the camp's coal vein: the Fire Elemental can turn up there, but only by luck.
        ws.tokens.token_coal_vein.statements = [{ keyword: 'spawns', payload: { typeId: 'token_fire_elemental', chance: 2 }, when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self' } }];
        expect(on(checksOf(ws), itemKey('item_iron_ore'), 'fragile')[0].message).toBe('Only from the Volcano Map (Iron Vein, Fire Elemental).');
        // A sure one in the camp is a second source.
        ws.tokens.token_coal_vein.statements[0].payload.chance = 50;
        expect(on(checksOf(ws), itemKey('item_iron_ore'), 'fragile')).toHaveLength(0);
    });

    it('C: luck only with no sure way at all is a Warn', () => {
        const ws = ledgerWorkspace();
        ws.items.map_volcano.cartography.nodes = ws.items.map_volcano.cartography.nodes.filter((n) => n.typeId !== 'token_wild_hive');
        const honey = on(checksOf(ws), itemKey('item_honey'), 'luck-only')[0];
        expect(honey).toMatchObject({ severity: 'warn' });
        expect(honey.message).toMatch(/no sure way/);
    });

    it('silences Parked entries, and only them', () => {
        const ws = ledgerWorkspace();
        // The Gem is Parked: only a Planned recipe makes it, so it would be never reachable.
        expect(on(checksOf(ws), itemKey('item_gem'))).toHaveLength(0);
        ws.items.item_gem.plan = { status: 'live' };
        expect(on(checksOf(ws), itemKey('item_gem'), 'never-reachable')).toHaveLength(1);
        ws.items.item_bird_nest.plan = { status: 'parked' };
        expect(on(checksOf(ws), itemKey('item_bird_nest'))).toHaveLength(0);
        ws.items.item_bird_nest.plan = { status: 'draft' };
        expect(on(checksOf(ws), itemKey('item_bird_nest'), 'unused')).toHaveLength(1);
    });

    it('takes findings from elsewhere, silenced and sorted with the rest', () => {
        const ws = ledgerWorkspace();
        const extra = [
            { check: 'game-rule', key: itemKey('item_coal'), severity: 'block', message: 'A rule the game refuses.' },
            { check: 'pricing', key: itemKey('item_gem'), severity: 'warn', message: 'Cannot price it.' },
        ];
        const findings = runChecks(buildLedger(ws), ws, { extra });
        expect(findings[0]).toMatchObject({ check: 'game-rule', key: itemKey('item_coal'), group: 'A', name: 'Coal' });
        expect(on(findings, itemKey('item_gem'))).toHaveLength(0);
    });

    it('filters and groups findings for the problems list and the rows', () => {
        const findings = checksOf(ledgerWorkspace());
        expect(filterFindings(findings, { group: 'C' }).every((f) => f.group === 'C')).toBe(true);
        expect(filterFindings(findings, { severity: 'warn', check: 'fragile' }).map((f) => f.name)).toEqual(['Iron Ore']);
        expect(filterFindings(findings, { search: 'VOLCANO MAP (iron' })).toHaveLength(1);
        const byKey = findingsByKey(findings);
        expect(byKey.get(itemKey('item_iron_ore')).map((f) => f.check)).toContain('fragile');
    });
});

describe('checks on the shipped content (the audit of 2026-10-28)', () => {
    const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
    const content = () => ({
        items: read('items.json'), tokens: read('tokens.json'), recipes: read('tokenRecipes.json'),
        effects: read('effects.json'), starterCamp: read('starterCamp.json'),
    });

    it('finds Iron Ore only on the Volcano map, the lone starter tools, and the made-but-unused loose ends', () => {
        const c = content();
        const findings = runChecks(buildLedger(c), c);
        expect(on(findings, itemKey('item_iron_ore'), 'fragile')[0].message).toMatch(/^Only from the Volcano Map \(Iron Ore Vein/);
        expect(on(findings, itemKey('item_trap'), 'tool-single')[0]).toMatchObject({ severity: 'warn' });
        expect(on(findings, itemKey('item_copper_sickle'), 'tool-single')).toHaveLength(1);
        expect(on(findings, itemKey('item_fishing_rod'), 'tool-single')).toHaveLength(1);
        for (const id of ['item_bones', 'item_beeswax_comb', 'item_grape_seed', 'item_salmon']) {
            expect(on(findings, itemKey(id), 'unused'), id).toHaveLength(1);
        }
        // Many entries are never reachable; nothing yet tells parked from broken.
        expect(findings.filter((f) => f.check === 'never-reachable' && f.key.startsWith('item:')).length).toBeGreaterThan(20);
        expect(findings.filter((f) => f.check === 'never-reachable' && f.key.startsWith('token:')).length).toBeGreaterThan(20);
    });

    it('turns the camp leaks red once they carry their plane as a tier', () => {
        const c = content();
        const leaks = ['token_beehive', 'token_alchemy_table', 'token_apple_orchard', 'token_goblin_camp'].map(tokenKey).concat(itemKey('item_lavender'));
        for (const key of leaks) {
            const [kind, id] = key.split(':');
            c[kind === 'item' ? 'items' : 'tokens'][id].plan = { tier: 1 };
        }
        const findings = runChecks(buildLedger(c), c);
        for (const key of leaks) {
            const leak = on(findings, key, 'leak')[0];
            expect(leak, key).toBeTruthy();
            expect(leak.message).toMatch(/^Reachable at Starter Camp, before its tier \(Plane 1\)/);
        }
        // Parked, it is left alone.
        c.tokens.token_beehive.plan = { tier: 1, status: 'parked' };
        expect(on(runChecks(buildLedger(c), c), tokenKey('token_beehive'))).toHaveLength(0);
    });
});

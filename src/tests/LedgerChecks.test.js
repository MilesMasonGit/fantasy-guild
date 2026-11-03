import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildLedger, itemKey, tokenKey, recipeKey } from '../systems/progression/ledger/engine.js';
import { runChecks, CHECKS, filterFindings, findingsByKey, STARTER_CAMP_KEY } from '../systems/progression/ledger/checks.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { ledgerContent, withIronChest, withoutOrigin } from './fixtures/ledgerWorld.js';

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
        const findings = checksOf(ledgerContent());
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
        const ws = ledgerContent();
        ws.tokens.token_coal_vein.config.outputs.push({ itemId: 'item_nope', chance: 100, minQty: 1, maxQty: 1 });
        ws.starterCamp.tokens.push({ typeId: 'token_gone', x: 0, y: 0 });
        const findings = checksOf(ws);
        expect(on(findings, tokenKey('token_coal_vein'), 'unknown-ref')[0]).toMatchObject({ severity: 'block', related: [itemKey('item_nope')] });
        expect(on(findings, STARTER_CAMP_KEY, 'unknown-ref')[0].message).toMatch(/token_gone/);
    });

    it('A: used but never produced, and produced but unused', () => {
        const ws = ledgerContent();
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
        const ws = ledgerContent();
        ws.tokens.token_lonely = { id: 'token_lonely', name: 'Lonely Rock', config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, inputs: [], outputs: [] } };
        delete ws.tokens.token_wild_patch.field;
        const findings = checksOf(ws);
        expect(on(findings, tokenKey('token_lonely'), 'never-reachable')[0].message).toMatch(/nothing makes or places it/);
        const loop = on(findings, itemKey('item_wheat_seed'), 'loop')[0];
        expect(loop.message).toMatch(/Wheat Seed → .*Wheat.* → Wheat Seed/);
    });

    it('A: a tool nothing gives, one starter tool for a whole skill, a recipe nothing can host', () => {
        const ws = ledgerContent();
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
        const ws = ledgerContent();
        ws.items.item_copper_ingot.plan = { tier: 1 };
        ws.items.item_iron_ingot.plan = { tier: 1 };
        const findings = checksOf(ws);
        expect(on(findings, itemKey('item_copper_ingot'), 'leak')[0].message).toMatch(/Reachable at Starter Camp, before its tier \(Plane 1\): Copper Ingot ← Furnace/);
        expect(on(findings, itemKey('item_iron_ingot'), 'late')[0].message).toMatch(/Plane 2, later than its tier \(Plane 1\)/);
        expect(on(findings, itemKey('item_iron_ingot'), 'later-ingredient')[0]).toMatchObject({ related: [itemKey('item_iron_ore')] });
        // In its tier, nothing to say.
        expect(on(checksOf(ledgerContent()), itemKey('item_iron_ingot'), 'late')).toHaveLength(0);
        expect(on(checksOf(ledgerContent()), itemKey('item_iron_ingot'), 'leak')).toHaveLength(0);
    });

    it('B: an entry one stage early is a leak', () => {
        const copper = ledgerContent();
        copper.items.item_copper_ingot.plan = { tier: 1 };
        expect(on(checksOf(copper), itemKey('item_copper_ingot'), 'leak')).toHaveLength(1);
    });

    it('B and C: a one-off find is no leak; an entry only one gets is luck only', () => {
        const ws = withIronChest();
        // Ring 1's chest gives Iron Ore at plane 1, but ring 2's veins are the way the plan means.
        expect(on(checksOf(ws), itemKey('item_iron_ore'), 'leak')).toHaveLength(0);
        expect(on(checksOf(ws), itemKey('item_iron_ore'), 'luck-only')).toHaveLength(0);
        const findings = checksOf(withoutOrigin(ws, 'token_iron_vein'));
        const ore = on(findings, itemKey('item_iron_ore'), 'luck-only')[0];
        expect(ore).toMatchObject({ severity: 'warn' });
        expect(ore.message).toBe('Only ever through a one-off find (Iron Chest), which wears out for good, and no sure way.');
        expect(on(findings, itemKey('item_iron_ingot'), 'luck-only')[0].message).toMatch(/one-off find \(Iron Chest\)/);
    });

    it('B: Live content that needs a Planned entry is a Block; stubs nothing points to, and items with no tier, are noted', () => {
        const ws = ledgerContent();
        recipe(ws, 'recipe_iron_pickaxe').inputs.push({ itemId: 'item_mythril_ore', quantity: 1 });
        const findings = checksOf(ws);
        expect(on(findings, recipeKey('recipe_iron_pickaxe'), 'refs-planned')[0]).toMatchObject({ severity: 'block', related: [itemKey('item_mythril_ore')] });
        // Once Live content names it, the stub is no orphan.
        expect(on(findings, itemKey('item_mythril_ore'), 'orphan-stub')).toHaveLength(0);
        const plain = checksOf(ledgerContent());
        expect(on(plain, itemKey('item_mythril_ore'), 'orphan-stub')).toHaveLength(1);
        expect(on(plain, tokenKey('token_mythril_vein'), 'orphan-stub')).toHaveLength(1);
        expect(on(plain, itemKey('item_coal'), 'no-tier')[0]).toMatchObject({ severity: 'info' });
        expect(on(plain, itemKey('item_copper_ore'), 'no-tier')).toHaveLength(0);
        // A Planned stub is not in the game: no reach checks on it.
        expect(on(plain, itemKey('item_mythril_ore'), 'never-reachable')).toHaveLength(0);
    });

    it('C: luck only, the Shop only', () => {
        const findings = checksOf(ledgerContent());
        // Honey: 3 % from goblins in the camp; ring 2's hive is sure.
        expect(on(findings, itemKey('item_honey'), 'luck-only')[0]).toMatchObject({ severity: 'info' });
        expect(on(findings, itemKey('item_honey'), 'luck-only')[0].message).toMatch(/3% from Goblin.*sure way from Plane 2/);
        expect(on(findings, tokenKey('token_wood_foundation'), 'shop-only')[0].message).toBe('Only from the Shop, for 15 Oak Wood.');
    });

    it('C: luck only with no sure way at all is a Warn', () => {
        const honey = on(checksOf(withoutOrigin(ledgerContent(), 'token_wild_hive')), itemKey('item_honey'), 'luck-only')[0];
        expect(honey).toMatchObject({ severity: 'warn' });
        expect(honey.message).toMatch(/no sure way/);
    });

    it('silences Parked entries, and only them', () => {
        const ws = ledgerContent();
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
        const ws = ledgerContent();
        const extra = [
            { check: 'game-rule', key: itemKey('item_coal'), severity: 'block', message: 'A rule the game refuses.' },
            { check: 'pricing', key: itemKey('item_gem'), severity: 'warn', message: 'Cannot price it.' },
        ];
        const findings = runChecks(buildLedger(ws), ws, { extra });
        expect(findings[0]).toMatchObject({ check: 'game-rule', key: itemKey('item_coal'), group: 'A', name: 'Coal' });
        expect(on(findings, itemKey('item_gem'))).toHaveLength(0);
    });

    it('filters and groups findings for the problems list and the rows', () => {
        const findings = checksOf(ledgerContent());
        expect(filterFindings(findings, { group: 'C' }).every((f) => f.group === 'C')).toBe(true);
        expect(filterFindings(findings, { severity: 'info', check: 'luck-only' }).map((f) => f.name)).toEqual(['Honey']);
        expect(filterFindings(findings, { search: '3% FROM GOBLIN' })).toHaveLength(1);
        const byKey = findingsByKey(findings);
        expect(byKey.get(itemKey('item_honey')).map((f) => f.check)).toContain('luck-only');
    });
});

describe('checks on the shipped content (the audit of 2026-10-28)', () => {
    const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
    const content = () => ({
        items: read('items.json'), tokens: read('tokens.json'), recipes: read('tokenRecipes.json'),
        effects: read('effects.json'), starterCamp: read('starterCamp.json'), worldTables: normaliseWorldTables(read('world.json')),
    });

    it('no longer finds Iron Ore only on the Volcano map, and none of the loose ends the ledger fix pack closed', () => {
        const c = content();
        const findings = runChecks(buildLedger(c), c);
        // A Fire Elemental Banner builds Ember Vents, whose elementals drop Iron Ore: the map is not its only way.
        expect(on(findings, itemKey('item_iron_ore'), 'fragile')).toEqual([]);
        // The audit's lone starter tools are made at the Workbench and the Smithy now.
        for (const id of ['item_trap', 'item_copper_sickle', 'item_fishing_rod']) {
            expect(on(findings, itemKey(id), 'tool-single'), id).toEqual([]);
        }
        // And its made-but-unused items are spent: Build Composter, a Fishing Rod, Build Grapevine, Lavender Salmon.
        for (const id of ['item_bones', 'item_beeswax_comb', 'item_grape_seed', 'item_salmon']) {
            expect(on(findings, itemKey(id), 'unused'), id).toEqual([]);
        }
        // Some entries are never reachable; nothing yet tells parked from broken.
        expect(findings.filter((f) => f.check === 'never-reachable' && f.key.startsWith('item:')).length).toBeGreaterThan(0);
        expect(findings.filter((f) => f.check === 'never-reachable' && f.key.startsWith('token:')).length).toBeGreaterThan(0);
    });

    it('turns the camp leaks red once they carry their plane as a tier', () => {
        const c = content();
        const leaks = ['token_beehive', 'token_apple_orchard', 'token_goblin_camp'].map(tokenKey);
        // Reached no earlier than their tier once they carry it: no leak.
        const closed = [tokenKey('token_alchemy_table'), itemKey('item_lavender')];
        for (const key of [...leaks, ...closed]) {
            const [kind, id] = key.split(':');
            c[kind === 'item' ? 'items' : 'tokens'][id].plan = { tier: 1 };
        }
        const findings = runChecks(buildLedger(c), c);
        for (const key of leaks) {
            const leak = on(findings, key, 'leak')[0];
            expect(leak, key).toBeTruthy();
            expect(leak.message).toMatch(/^Reachable at Starter Camp, before its tier \(Plane 1\)/);
        }
        for (const key of closed) expect(on(findings, key, 'leak'), key).toEqual([]);
        // Parked, it is left alone.
        c.tokens.token_beehive.plan = { tier: 1, status: 'parked' };
        expect(on(runChecks(buildLedger(c), c), tokenKey('token_beehive'))).toHaveLength(0);
    });
});

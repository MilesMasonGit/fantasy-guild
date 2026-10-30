// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { workspaceReport, gameRuleFindings, pricingFindings } from '../../cms/src/engine/ledgerReport';
import { sourcesOf, usesOf, layoutTree, effortText, firstReachText, TREE_LAYOUT } from '../../cms/src/engine/ledgerPage';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import { buildLedger, itemKey, tokenKey, recipeKey } from '../systems/progression/ledger/engine.js';
import { tierLabel } from '../systems/progression/ledger/plan.js';
import { ledgerWorkspace, withIronChest } from './fixtures/ledgerWorld.js';

/**
 * The Ledger's problems list and item page (brief 290 L3) on the fixture world: the checks with the
 * game's own content rules and the simulator's refusals beside them, a count per row, and a page per
 * entry with its sources, uses, path and layered ingredient tree. The store never persists here
 * (TESTING, "The CMS").
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
const originalFetch = globalThis.fetch;

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});

const empty = { items: {}, tokens: {}, effects: {}, recipePools: {}, starterCamp: null, planSettings: null };
const store = () => useEntityStore.getState();

describe('the page, worked out', () => {
    const ledger = () => buildLedger(ledgerWorkspace());

    it('lists every source of an item with its tier, and every use', () => {
        const l = ledger();
        const ore = sourcesOf(l, itemKey('item_iron_ore'));
        expect(ore).toEqual([expect.objectContaining({ how: 'work', viaKey: tokenKey('token_iron_vein'), viaName: 'Iron Vein', tier: 2, gates: ['Mining 15'] })]);
        const ingot = sourcesOf(l, itemKey('item_iron_ingot'));
        expect(ingot[0]).toMatchObject({ how: 'craft', viaKey: recipeKey('recipe_iron_ingot'), atName: 'Furnace', gates: ['Smithing 1', 'Smithing 15'] });
        expect(usesOf(l, itemKey('item_iron_ingot'))).toEqual([{ key: recipeKey('recipe_iron_pickaxe'), name: 'Iron Pickaxe', useText: 'an ingredient of' }]);
        // A tool's uses are the work it answers.
        expect(usesOf(l, itemKey('item_fishing_rod')).map((u) => u.name)).toContain('Coast');
        // The Shop's price and a growth's cost are uses too.
        expect(usesOf(l, itemKey('item_oak_wood')).map((u) => u.useText)).toContain('the price of');
        expect(usesOf(l, itemKey('item_seed')).map((u) => u.useText)).toContain('paid to grow');
    });

    it('lays the tree out in layers, the item first, origins last, ingredients from a later tier marked', () => {
        const l = ledger();
        const { tree } = l.treeOf('item_iron_ingot');
        const layout = layoutTree(tree, { tierOf: (k) => l.reachOf(k)?.tier ?? null, luckOf: () => false, rootTier: 1 });
        const at = (name) => layout.nodes.find((n) => n.node.name === name);
        expect(at('Iron Ingot').depth).toBe(0);
        expect(at('Iron Ore').depth).toBe(1);
        expect(at('Iron Ore').x).toBeGreaterThan(at('Iron Ingot').x);
        // The parent sits between its children.
        expect(at('Iron Ingot').y).toBe((at('Iron Ore').y + at('Coal').y) / 2);
        const edge = (name) => layout.edges.find((e) => e.to === at(name).id);
        expect(edge('Iron Ore').later).toBe(true);
        expect(edge('Coal').later).toBe(false);
        expect(layout.width).toBe(TREE_LAYOUT.pad * 2 + 2 * TREE_LAYOUT.nodeW + TREE_LAYOUT.colGap);
    });

    it('says effort and first reach in words', () => {
        expect(effortText(18000 + 24000 + 8000)).toBe('50 s');
        expect(effortText(42 * 60000)).toBe('42 min');
        expect(effortText(65 * 60000)).toBe('1 h 5 min');
        expect(firstReachText(ledger().reachOf(itemKey('item_iron_ore')), tierLabel)).toBe('Plane 2 · Combat 20, Mining 15');
        expect(firstReachText(ledger().reachOf(itemKey('item_mythril_ore')), tierLabel)).toBe('Planned');
    });

    it('puts an earlier one-off find beside first reach, not in it', () => {
        const l = buildLedger(withIronChest());
        expect(firstReachText(l.reachOf(itemKey('item_iron_ore')), tierLabel)).toBe('Plane 2 · Combat 20, Mining 15 · a one-off find at Plane 1 (Iron Chest)');
        const chest = sourcesOf(l, itemKey('item_iron_ore')).find((s) => s.viaKey === tokenKey('token_iron_chest'));
        expect(chest).toMatchObject({ tier: 1, oneOff: true });
    });
});

describe('findings the CMS adds', () => {
    it('files the game’s own content rules under the entry they name, Planned stubs left out', () => {
        const ws = ledgerWorkspace();
        ws.tokens.token_coal_vein.config.skill = 'not_a_skill';
        ws.tokens.token_mythril_vein.config = { skill: 'not_a_skill' };
        const found = gameRuleFindings(ws);
        expect(found.some((f) => f.key === tokenKey('token_coal_vein') && f.check === 'game-rule' && f.severity === 'block')).toBe(true);
        expect(found.some((f) => f.key === tokenKey('token_mythril_vein'))).toBe(false);
    });

    it('turns the last Recalculate’s refusals into pricing findings', () => {
        const ws = ledgerWorkspace();
        const rows = [
            { severity: 'critical', code: 'orphan-item', message: 'Nothing produces it.', itemId: 'item_coal' },
            { severity: 'info', code: 'note', message: 'Just a note.', itemId: 'item_coal' },
            { severity: 'warning', code: 'odd', message: 'Unknown thing.', entityId: 'nothing_here' },
        ];
        expect(pricingFindings(rows, ws)).toEqual([{ check: 'pricing', key: itemKey('item_coal'), severity: 'warn', message: 'Nothing produces it. [orphan-item]' }]);
        const { findings } = workspaceReport(ws, { simRows: rows });
        expect(findings.some((f) => f.check === 'pricing' && f.name === 'Coal')).toBe(true);
    });
});

// Each test mounts the whole tab over the reach engine and every check: seconds under a full suite's load.
describe('the tab', { timeout: 20000 }, () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        useEntityStore.setState(empty);
        useSimulationStore.setState({ simRows: [] });
        store().hydrate(ledgerWorkspace());
    });
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        useEntityStore.setState(empty);
    });

    const mount = () => render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));

    it('counts each row’s problems, Block and Warn apart from Info', () => {
        const view = mount();
        const ore = view.getByLabelText('Problems of Iron Ore');
        expect(ore.getAttribute('data-problems')).toBe('1');
        // Coal has no tier set: a note only.
        const coal = view.getByLabelText('Problems of Coal');
        expect(coal.getAttribute('data-problems')).toBe('0');
        expect(coal.getAttribute('data-info')).toBe('1');
        // The Parked Gem is silenced.
        expect(view.queryByLabelText('Problems of Gem')).toBeNull();
    });

    it('lists the problems, filters them, and opens an entry’s page from one', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: /Problems/ }));
        expect(view.container.querySelectorAll('[data-finding]').length).toBeGreaterThan(5);
        fireEvent.change(view.getByLabelText('Filter by group'), { target: { value: 'C' } });
        const shown = [...view.container.querySelectorAll('[data-finding]')].map((r) => r.getAttribute('data-finding'));
        expect(shown.length).toBeGreaterThan(0);
        expect(shown.every((c) => ['luck-only', 'fragile', 'first-kill-only', 'shop-only'].includes(c))).toBe(true);
        fireEvent.change(view.getByLabelText('Filter by check'), { target: { value: 'fragile' } });
        fireEvent.click(view.getByText('Iron Ore'));
        expect(view.getByLabelText('Ledger page of Iron Ore')).toBeTruthy();
    });

    it('opens an item page from a row: sources, uses, path, problems and the layered tree', () => {
        const view = mount();
        fireEvent.click(view.getAllByText('Iron Ingot').find((el) => el.closest('tr')?.getAttribute('data-row') === 'items:item_iron_ingot'));
        const page = within(view.getByLabelText('Ledger page of Iron Ingot'));
        expect(page.getByText(/Iron Ingot ← Iron Ingot|Iron Ingot ← Furnace/)).toBeTruthy();
        expect(view.container.querySelector('[data-first-reach]').textContent).toMatch(/^Plane 2/);
        expect(view.container.querySelector('[data-effort]').textContent).toBe('50 s');
        expect(within(view.getByLabelText('Uses')).getByText('Iron Pickaxe')).toBeTruthy();
        expect(view.container.querySelector('[data-light]').getAttribute('data-light')).toBe('match');
        const nodes = [...view.container.querySelectorAll('[data-node]')].map((n) => n.getAttribute('data-node'));
        expect(nodes.sort()).toEqual([itemKey('item_coal'), itemKey('item_iron_ingot'), itemKey('item_iron_ore')].sort());

        // A box in the tree opens its page, and so does a name; Back returns to the list.
        fireEvent.click(view.container.querySelector(`[data-node="${itemKey('item_iron_ore')}"]`));
        const orePage = view.getByLabelText('Ledger page of Iron Ore');
        expect(within(orePage).getByText(/Only from the Volcano Map/)).toBeTruthy();
        fireEvent.click(within(view.getByLabelText('Sources')).getByText('Iron Vein'));
        expect(view.getByLabelText('Ledger page of Iron Vein')).toBeTruthy();
        expect(view.container.querySelector('[data-node]')).toBeNull();
        fireEvent.click(view.getByLabelText('Back to the list'));
        expect(view.getByLabelText('Search the ledger')).toBeTruthy();
    });

    it('edits status and tier on the page as the row does, and the traffic light follows on Refresh', () => {
        const view = mount();
        fireEvent.click(view.getAllByText('Copper Ingot').find((el) => el.closest('tr')?.getAttribute('data-row') === 'items:item_copper_ingot'));
        expect(view.container.querySelector('[data-light]').getAttribute('data-light')).toBe('none');
        fireEvent.change(view.getByLabelText('Tier of Copper Ingot'), { target: { value: '1' } });
        expect(store().items.item_copper_ingot.plan).toEqual({ tier: 1 });
        expect(view.container.querySelector('[data-light]').getAttribute('data-light')).toBe('differ');
        fireEvent.click(view.getByText('Refresh'));
        expect(view.container.querySelector('[data-finding="leak"]').textContent).toMatch(/Reachable at Starter Camp, before its tier/);
    });
});

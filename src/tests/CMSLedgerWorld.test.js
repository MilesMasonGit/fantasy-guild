// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, within, act } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import LedgerWorld from '../../cms/src/components/ledger/LedgerWorld.jsx';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import { sweepText, sweepWorkspace, workspaceWorldContext, originPlaces } from '../../cms/src/engine/ledgerWorld.js';
import { WORLD_F } from '../systems/progression/ledger/world.js';
import { WORLD_FIXTURE_RAW, WORLD_FIXTURE_TABLES, worldWorkspace } from './fixtures/ledgerWorldMap.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';

/**
 * The Ledger's World page (brief 330 W5): a seed's world drawn by wedge and ring with each cell's
 * contents and its problems, many worlds at once, and an origin's wedge and ring set on the Entries
 * page. The store never persists here and nothing reaches `data/` (TESTING, "The CMS").
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
const world = (props = {}) => render(React.createElement(LedgerWorld, { onOpen: () => {}, baseTables: WORLD_FIXTURE_TABLES, ...props }));
const cells = (view) => view.container.querySelectorAll('[data-cell]');
const chip = (view, check) => view.container.querySelector(`[data-rule="${check}"]`);

function addGold() {
    store().addToken({
        id: 'token_gold_vein', name: 'Gold Vein', uses: 3, respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 30, cycleTimeMs: 9000, xp: 1, inputs: [], outputs: [{ itemId: 'item_gold', chance: 100, minQty: 1, maxQty: 1 }] },
    });
    store().addItem({ id: 'item_gold', name: 'Gold', type: 'material' });
}

beforeEach(() => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
    useEntityStore.setState(empty);
    store().hydrate(worldWorkspace());
});
afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    useEntityStore.setState(empty);
});

describe('the World plan', () => {
    it('draws the world a seed generates: the Starter Camp and three strict rings, the wild rings on asking', () => {
        const view = world();
        expect(view.container.querySelector('[data-world-plan]').getAttribute('data-world-plan')).toBe('1');
        expect(cells(view)).toHaveLength(37);
        fireEvent.click(view.getByLabelText('Show the wild rings'));
        expect(cells(view)).toHaveLength(37 + 24);
        const before = [...cells(view)].map((c) => c.textContent).join('|');
        fireEvent.change(view.getByLabelText('World seed'), { target: { value: '7' } });
        fireEvent.keyDown(view.getByLabelText('World seed'), { key: 'Enter' });
        expect(view.container.querySelector('[data-world-plan]').getAttribute('data-world-plan')).toBe('7');
        expect([...cells(view)].map((c) => c.textContent).join('|')).not.toBe(before);
    });

    it('opens a cell: its wedge, kit, specialty, origins, price, hidden extras, arrival and problems', () => {
        const view = world();
        const ring2 = view.container.querySelector('[data-cell][data-ring="2"]');
        fireEvent.click(ring2);
        const panel = within(view.container.querySelector('[data-cell-panel]'));
        expect(panel.getByText('Wedge')).toBeTruthy();
        expect(panel.getByText('Highland (mountain)')).toBeTruthy();
        expect(view.container.querySelectorAll('[data-cell-panel] [data-origin]').length).toBeGreaterThan(0);
        expect(view.container.querySelectorAll('[data-cell-panel] [data-price]').length).toBeGreaterThan(0);
        expect(panel.getByText(/Worth 10 of ring 2's 10/)).toBeTruthy();
        expect(panel.getByText(/\d × Goblin/)).toBeTruthy();
        // The camps on its mat, by name, the ring's guaranteed ones marked.
        expect(view.container.querySelector('[data-cell-panel] [data-cell-camps]').textContent).toMatch(/Goblin Camp/);
        expect(panel.getByText('None.')).toBeTruthy();
    });

    it('marks the camps a ring guarantees among a cell\'s camps', () => {
        const view = world({ baseTables: normaliseWorldTables({ ...WORLD_FIXTURE_RAW, camps: { 1: ['token_chief_tent'] } }) });
        const marked = [];
        for (const cell of view.container.querySelectorAll('[data-cell][data-ring="1"]')) {
            fireEvent.click(cell);
            const camps = view.container.querySelector('[data-cell-panel] [data-cell-camps]')?.textContent || '';
            if (/Chief's Tent \(guaranteed\)/.test(camps)) marked.push(cell.getAttribute('data-cell'));
        }
        expect(marked).toHaveLength(1);
    });

    it('lays the problems over the map and counts them per rule; a clean world has none', () => {
        const clean = world();
        for (const check of Object.values(WORLD_F)) expect(chip(clean, check).getAttribute('data-count')).toBe('0');
        cleanup();
        addGold();
        const view = world();
        expect(chip(view, WORLD_F.COVERAGE).getAttribute('data-count')).toBe('2');
        expect(chip(view, WORLD_F.NO_WEDGE).getAttribute('data-count')).toBe('1');
        expect(view.container.querySelector('[data-rule-list="world-coverage"]').textContent).toMatch(/Gold Vein/);
        expect(view.container.querySelector('[data-rule-list="world-coverage"]').textContent).toMatch(/never reachable/);
    });

    it('follows an origin\'s planned wedge and ring as soon as it is set', () => {
        addGold();
        const view = world();
        expect(chip(view, WORLD_F.NO_WEDGE).getAttribute('data-count')).toBe('1');
        act(() => { store().updateToken('token_gold_vein', { plan: { wedge: 'ores', ring: 3 } }); });
        expect(chip(view, WORLD_F.NO_WEDGE).getAttribute('data-count')).toBe('0');
        expect(chip(view, WORLD_F.COVERAGE).getAttribute('data-count')).toBe('0');
        expect(view.container.querySelector('[data-world-moved]').getAttribute('data-world-moved')).toBe('1');
    });

    it('generates many worlds: how many pass, what fails in how many, the bands and the price spreads', async () => {
        addGold();
        const view = world();
        fireEvent.change(view.getByLabelText('How many worlds'), { target: { value: '4' } });
        fireEvent.click(view.getByText('Generate and check'));
        const result = await view.findByText(/worlds pass checks F/, {}, { timeout: 5000 });
        expect(result).toBeTruthy();
        expect(view.container.querySelector('[data-sweep]').getAttribute('data-sweep')).toBe('4');
        expect(view.container.querySelector('[data-sweep-passed]').getAttribute('data-sweep-passed')).toBe('0');
        const coverage = view.container.querySelector('[data-sweep-rule="world-coverage"]');
        expect(coverage.getAttribute('data-worlds')).toBe('4');
        expect(coverage.querySelector('[data-subject="token:token_gold_vein"]').textContent).toMatch(/4 worlds/);
        expect(view.container.querySelector('[data-band="mining"] [data-band-ring="1"]').getAttribute('data-zero')).toBe('0');
        expect(view.container.querySelectorAll('[data-price-ring]')).toHaveLength(4);
    });

    it('puts a sweep in plain words, for the change-pack tool and the report', () => {
        const ctx = workspaceWorldContext(store(), null, WORLD_FIXTURE_TABLES);
        const text = sweepText(sweepWorkspace(ctx, 3));
        expect(text).toMatch(/^3 of 3 worlds pass checks F; 3 keep every rule of the world\./);
        expect(text).toMatch(/ring 1 mining/);
        expect(text).toMatch(/Price per cell, by ring/);
    });
});

describe('wedge and ring on the Entries page', () => {
    it('shows where the game\'s tables put an origin and writes a planned wedge and ring into its plan', () => {
        // The CMS generates from the placeholder tables, which name the game's own Tokens.
        useEntityStore.setState(empty);
        store().hydrate({
            items: { item_copper_ore: { id: 'item_copper_ore', name: 'Copper Ore', type: 'material' }, item_tin: { id: 'item_tin', name: 'Tin', type: 'material' } },
            tokens: {
                token_copper_ore_vein: { id: 'token_copper_ore_vein', name: 'Copper Ore Vein', config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 6000, inputs: [], outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] } },
                token_tin_vein: { id: 'token_tin_vein', name: 'Tin Vein', config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 6000, inputs: [], outputs: [{ itemId: 'item_tin', chance: 100, minQty: 1, maxQty: 1 }] } },
            },
            effects: {}, recipePools: {}, starterCamp: null,
        });
        expect(originPlaces(store().tokens).get('token_copper_ore_vein')).toEqual({ wedge: 'ores', ring: 1, planned: false });
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        expect(view.getByLabelText('Wedge of Copper Ore Vein').value).toBe('ores');
        expect(view.getByLabelText('Ring of Copper Ore Vein').value).toBe('1');
        // A wild origin no wedge places has the choice too.
        expect(view.getByLabelText('Wedge of Tin Vein').value).toBe('');
        fireEvent.change(view.getByLabelText('Wedge of Tin Vein'), { target: { value: 'ores' } });
        expect(store().tokens.token_tin_vein.plan).toEqual({ wedge: 'ores', ring: 1 });
        fireEvent.change(view.getByLabelText('Ring of Tin Vein'), { target: { value: '2' } });
        expect(store().tokens.token_tin_vein.plan).toEqual({ wedge: 'ores', ring: 2 });
        expect(originPlaces(store().tokens).get('token_tin_vein')).toEqual({ wedge: 'ores', ring: 2, planned: true });
        fireEvent.change(view.getByLabelText('Wedge of Tin Vein'), { target: { value: '' } });
        expect(store().tokens.token_tin_vein.plan).toBeUndefined();
        // The World tab is there.
        fireEvent.click(view.getByRole('tab', { name: 'World' }));
        expect(view.container.querySelector('[data-world-plan]')).toBeTruthy();
    });
});

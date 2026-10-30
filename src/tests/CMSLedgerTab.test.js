// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, fireEvent, cleanup, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { snapshot } from '../../cms/src/engine/fileUtils';
import { workspaceFromDataFiles } from '../../cms/src/engine/changePacks';
import { PLAN_SYNC_KEY, PLAN_FILE, mergePlanFile } from '../../cms/src/engine/planFile';
import { ledgerRows, filterLedgerRows } from '../../cms/src/engine/ledgerRows';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import {
    settingsOf, DEFAULT_LEDGER_SETTINGS, stageBudgetMs, minutesPerLevelAt, minutesToReach, formatMinutes,
} from '../systems/progression/ledger/settings.js';
import { tierBudgetMs } from '../systems/progression/ledger/plan.js';

/**
 * The Ledger tab: every entry with its status and tier, edited in place; Planned stubs added there;
 * the Ledger settings, kept with the plan in `cms/plan/plan.json`. The store never persists here
 * and nothing reaches `data/` (TESTING, "The CMS").
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

function workspace() {
    return {
        items: {
            item_ore: { id: 'item_ore', name: 'Ore', type: 'material', plan: { status: 'live', tier: 1 } },
            item_bar: { id: 'item_bar', name: 'Bar', type: 'material' },
            map_volcano: { id: 'map_volcano', name: 'Volcano', type: 'map' },
        },
        tokens: {
            token_vein: { id: 'token_vein', name: 'Vein', config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 6000, inputs: [], outputs: [{ itemId: 'item_ore', chance: 100, minQty: 1, maxQty: 1 }] } },
            token_goblin: { id: 'token_goblin', name: 'Goblin', enemy: { level: 3, style: 'melee' }, plan: { status: 'draft', tier: 0, note: 'camp fight' } },
        },
        effects: {},
        recipePools: {
            smithing: [{ id: 'recipe_bar', name: 'Bar', skill: 'smithing', inputs: [{ itemId: 'item_ore', quantity: 2 }], outputs: [{ itemId: 'item_bar', chance: 100, minQty: 1, maxQty: 1 }] }],
        },
        starterCamp: null,
    };
}

const store = () => useEntityStore.getState();

describe('the rows', () => {
    it('list every item, map, Token, enemy and recipe with its plan', () => {
        const rows = ledgerRows(workspace());
        expect(rows.map((r) => [r.kind, r.id, r.status, r.tier])).toEqual([
            ['item', 'item_bar', 'live', null],
            ['item', 'item_ore', 'live', 1],
            ['map', 'map_volcano', 'live', null],
            ['token', 'token_vein', 'live', null],
            ['enemy', 'token_goblin', 'draft', 0],
            ['recipe', 'recipe_bar', 'live', null],
        ]);
    });

    it('filter by kind, status, tier and text', () => {
        const rows = ledgerRows(workspace());
        expect(filterLedgerRows(rows, { kind: 'enemy' }).map((r) => r.id)).toEqual(['token_goblin']);
        expect(filterLedgerRows(rows, { status: 'draft' }).map((r) => r.id)).toEqual(['token_goblin']);
        expect(filterLedgerRows(rows, { tier: '1' }).map((r) => r.id)).toEqual(['item_ore']);
        expect(filterLedgerRows(rows, { tier: 'none' })).toHaveLength(4);
        expect(filterLedgerRows(rows, { search: 'CAMP FIGHT' }).map((r) => r.id)).toEqual(['token_goblin']);
    });
});

describe('the tab', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        useEntityStore.setState(empty);
        store().hydrate(workspace());
    });
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        useEntityStore.setState(empty);
    });

    it('shows each entry and edits its status and tier in place, as the editors write them', () => {
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        expect(view.getByText('Volcano')).toBeTruthy();
        expect(view.getByLabelText('Status of Goblin').value).toBe('draft');
        expect(view.getByLabelText('Tier of Ore').value).toBe('1');

        // The item Bar sorts before the recipe Bar.
        fireEvent.change(view.getAllByLabelText('Tier of Bar')[0], { target: { value: '2' } });
        expect(store().items.item_bar.plan).toEqual({ tier: 2 });
        fireEvent.change(view.getByLabelText('Status of Vein'), { target: { value: 'parked' } });
        expect(store().tokens.token_vein.plan).toEqual({ status: 'parked' });
        fireEvent.change(view.getAllByLabelText('Tier of Bar')[1], { target: { value: '1' } });
        expect(store().recipePools.smithing[0].plan).toEqual({ tier: 1 });
        // Other fields of a block stay; clearing the tier drops it from the block.
        fireEvent.change(view.getByLabelText('Tier of Goblin'), { target: { value: '' } });
        expect(store().tokens.token_goblin.plan).toEqual({ status: 'draft', note: 'camp fight' });
        fireEvent.change(view.getByLabelText('Note on Ore'), { target: { value: 'first ore' } });
        fireEvent.blur(view.getByLabelText('Note on Ore'));
        expect(store().items.item_ore.plan).toEqual({ status: 'live', tier: 1, note: 'first ore' });
    });

    it('filters the list', () => {
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        fireEvent.change(view.getByLabelText('Filter by kind'), { target: { value: 'map' } });
        expect(view.queryByText('Volcano')).toBeTruthy();
        expect(view.queryByText('Goblin')).toBeNull();
        fireEvent.change(view.getByLabelText('Filter by kind'), { target: { value: '' } });
        fireEvent.change(view.getByLabelText('Search the ledger'), { target: { value: 'gob' } });
        expect(view.queryByText('Goblin')).toBeTruthy();
        expect(view.queryByText('Volcano')).toBeNull();
    });

    it('shows first reach, worked out when the tab opens', () => {
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        const ore = view.container.querySelector('[data-reach="item:item_ore"]');
        expect(ore.textContent).toMatch(/Never|Starter Camp|Plane/);
    });

    it('adds Planned stubs of every kind, promotes one to Draft, and none of the rest reach data/', () => {
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        fireEvent.click(view.getByText('Planned stub'));
        const form = within(view.getByLabelText('Add a Planned stub'));
        const add = (name, kind, tier, note = '') => {
            fireEvent.change(form.getByLabelText('Stub name'), { target: { value: name } });
            fireEvent.change(form.getByLabelText('Stub kind'), { target: { value: kind } });
            fireEvent.change(form.getByLabelText('Stub tier'), { target: { value: tier } });
            fireEvent.change(form.getByLabelText('Stub note'), { target: { value: note } });
            fireEvent.click(form.getByText('Add'));
        };
        add('Mythril Ore', 'item', '3', 'plane 3 ore');
        add('Sky Map', 'map', '3');
        add('Mythril Vein', 'token', '3');
        add('Wyrm', 'enemy', '3');
        fireEvent.change(form.getByLabelText('Stub kind'), { target: { value: 'recipe' } });
        fireEvent.change(form.getByLabelText('Stub skill'), { target: { value: 'smithing' } });
        add('Mythril Bar', 'recipe', '3');

        const s = store();
        const mythril = Object.values(s.items).find((i) => i.name === 'Mythril Ore');
        expect(mythril.plan).toEqual({ status: 'planned', tier: 3, note: 'plane 3 ore' });
        expect(Object.values(s.tokens).find((t) => t.name === 'Wyrm').enemy).toBeTruthy();
        const bar = s.recipePools.smithing.find((r) => r.name === 'Mythril Bar');
        expect(bar.plan).toEqual({ status: 'planned', tier: 3 });

        fireEvent.click(view.getByLabelText('Promote Sky Map to Draft'));
        const sky = Object.values(store().items).find((i) => i.name === 'Sky Map');
        expect(sky.plan).toEqual({ status: 'draft', tier: 3 });

        const files = syncFiles(store().recalculateEconomy({}));
        const game = JSON.stringify([files['items.json'], files['tokens.json'], files['tokenRecipes.json']]);
        expect(game).not.toMatch(/Mythril|Wyrm|"plan"/);
        expect(Object.values(files['items.json']).map((i) => i.name)).toContain('Sky Map');
        const plan = files[PLAN_SYNC_KEY];
        expect(Object.values(plan.planned.items).map((i) => i.name)).toEqual(['Mythril Ore']);
        expect(Object.values(plan.planned.tokens).map((t) => t.name).sort()).toEqual(['Mythril Vein', 'Wyrm']);
        expect(plan.planned.recipes.map((r) => r.name)).toEqual(['Mythril Bar']);
    });

    it('edits the settings, and they ride the Sync into the plan file', () => {
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        fireEvent.click(view.getByRole('tab', { name: 'Settings' }));
        expect(store().planSettings).toBeNull();
        const tolerance = view.getByLabelText('Tolerance in percent');
        fireEvent.change(tolerance, { target: { value: '30' } });
        fireEvent.blur(tolerance);
        expect(store().planSettings.tolerancePct).toBe(30);
        const budget = view.getByLabelText('Budget for Plane 1');
        fireEvent.change(budget, { target: { value: '120' } });
        fireEvent.keyDown(budget, { key: 'Enter' });
        expect(stageBudgetMs(store().planSettings, 1)).toBe(120 * 60000);
        const bad = view.getByLabelText('Check-in from, minutes');
        fireEvent.change(bad, { target: { value: '' } });
        fireEvent.blur(bad);
        expect(store().planSettings.player.checkInMinMinutes).toBe(30);
        fireEvent.change(view.getByLabelText('Rules version'), { target: { value: 'today' } });

        const file = syncFiles(store().recalculateEconomy({}))[PLAN_SYNC_KEY];
        expect(file.settings).toEqual(store().planSettings);
        expect(file.settings).toMatchObject({ tolerancePct: 30, rulesVersion: 'today' });
    });
});

describe('the settings', () => {
    it('start from the owner’s budgets, ±25 %, check-ins every 30 to 60 minutes and 8 hours overnight', () => {
        const d = settingsOf(null);
        expect(d.stages.map((s) => stageBudgetMs(d, s.tier))).toEqual([0, 1, 2].map(tierBudgetMs));
        expect(d.tolerancePct).toBe(25);
        expect(d.player).toEqual({ checkInMinMinutes: 30, checkInMaxMinutes: 60, overnightHours: 8 });
        expect(d.wallFactor).toBe(2);
        expect(settingsOf(undefined)).toEqual(settingsOf(DEFAULT_LEDGER_SETTINGS));
    });

    it('mend what cannot be read and keep fields they do not know', () => {
        const s = settingsOf({ tolerancePct: 'x', stages: [{ tier: 1, budgetMinutes: 90 }, { tier: 0, budgetMinutes: 30 }, { tier: 'a' }], paceCurve: [{ level: 10, minutesPerLevel: 5 }, { level: 0, minutesPerLevel: 1 }], later: { x: 1 } });
        expect(s.tolerancePct).toBe(25);
        expect(s.stages.map((x) => x.tier)).toEqual([0, 1]);
        expect(s.paceCurve).toEqual([{ level: 10, minutesPerLevel: 5 }]);
        expect(s.later).toEqual({ x: 1 });
    });

    it('read the pace curve between its points, and the default puts level 10 inside the first hour', () => {
        const s = settingsOf({ paceCurve: [{ level: 1, minutesPerLevel: 1 }, { level: 11, minutesPerLevel: 100 }] });
        expect(minutesPerLevelAt(s, 6)).toBeCloseTo(10);
        expect(minutesPerLevelAt(s, 50)).toBe(100);
        expect(minutesToReach(settingsOf(null), 10)).toBeLessThan(60);
        expect([45, 90, 1500].map(formatMinutes)).toEqual(['45 min', '1 h 30 min', '1 d 1 h']);
    });
});

describe('settings round-trip', () => {
    const settings = () => settingsOf({ tolerancePct: 20, rulesVersion: 'today' });

    it('through the plan file and back onto the workspace, even with no other plan', () => {
        const ws = { ...workspace(), planSettings: settings() };
        ws.items.item_ore = { id: 'item_ore', name: 'Ore', type: 'material' };
        delete ws.tokens.token_goblin.plan;
        const files = syncFiles(ws);
        expect(files[PLAN_SYNC_KEY].settings).toEqual(settings());
        const restored = workspaceFromDataFiles({
            items: files['items.json'], tokens: files['tokens.json'], tokenRecipes: files['tokenRecipes.json'], plan: files[PLAN_SYNC_KEY],
        });
        expect(restored.planSettings).toEqual(settings());
        expect(mergePlanFile({ items: {} }, { entries: {} }).planSettings).toBeUndefined();
    });

    it('through Restore from Game into the store, and the workspace backup', () => {
        useEntityStore.setState(empty);
        store().hydrate(mergePlanFile(workspace(), syncFiles({ ...workspace(), planSettings: settings() })[PLAN_SYNC_KEY]));
        expect(store().planSettings).toEqual(settings());
        expect(snapshot(store()).planSettings).toEqual(settings());
        const { partialize } = useEntityStore.persist.getOptions();
        expect(partialize(store()).planSettings).toEqual(settings());
        useEntityStore.setState(empty);
    });

    describe('on the server', () => {
        let dataDir, planDir, handler;
        function request(method, url, body) {
            return new Promise((resolve) => {
                const req = new EventEmitter();
                Object.assign(req, { method, url, headers: {} });
                const res = {
                    statusCode: 200,
                    setHeader: () => {},
                    end: (text = '') => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }),
                };
                handler(req, res, () => resolve({ status: 'next' }));
                if (body !== undefined) req.emit('data', JSON.stringify(body));
                req.emit('end');
            });
        }
        beforeAll(() => {
            dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-ledger-tab-data-'));
            planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-ledger-tab-plan-'));
            cmsFileApi({ dataDir, planDir }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
        });
        afterAll(() => {
            fs.rmSync(dataDir, { recursive: true, force: true });
            fs.rmSync(planDir, { recursive: true, force: true });
        });

        it('writes them to the plan file, outside data/, and Restore from Game reads them back', async () => {
            const { [PLAN_SYNC_KEY]: plan, ...files } = syncFiles({ ...workspace(), planSettings: settings() });
            expect((await request('POST', '/api/sync-game-data', { files, plan, confirmRemovals: true })).status).toBe(200);
            expect(JSON.parse(fs.readFileSync(path.join(planDir, PLAN_FILE), 'utf8')).settings).toEqual(settings());
            for (const name of fs.readdirSync(dataDir)) expect(fs.readFileSync(path.join(dataDir, name), 'utf8')).not.toMatch(/tolerancePct/);
            const restored = (await request('GET', '/api/load-game-data')).body;
            expect(restored.planSettings).toEqual(settings());
        });

        it('keeps the file’s settings when a workspace that never set any syncs', async () => {
            const { [PLAN_SYNC_KEY]: plan, ...files } = syncFiles(workspace());
            expect(plan.settings).toBeUndefined();
            expect((await request('POST', '/api/sync-game-data', { files, plan, confirmRemovals: true })).status).toBe(200);
            expect(JSON.parse(fs.readFileSync(path.join(planDir, PLAN_FILE), 'utf8')).settings).toEqual(settings());
        });
    });
});

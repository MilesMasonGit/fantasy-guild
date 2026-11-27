// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { workspaceReport } from '../../cms/src/engine/ledgerReport';
import { runLedgerJobNow } from '../../cms/src/engine/ledgerJobs.js';
import { bundledSources } from '../../cms/src/engine/calibrationStatus';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import {
    CALIBRATED_FILES, hashText, fileHashes, calibrationState, calibrationFinding,
} from '../../cms/src/engine/ledger/calibration.js';
import { paceWorkspace } from './fixtures/paceWorld.js';

/**
 * The Ledger's pace in the CMS (brief 290 L5): checks D in the Problems list, the Pace page (stages,
 * where each skill's rate comes from, the Hall's paybacks), path time and the switchable rates on an
 * entry's page, and the calibration's state. The store never persists here (TESTING, "The CMS").
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

describe('the calibration stamp', () => {
    it('the CMS bundles exactly the files the stamp hashes', () => {
        const texts = bundledSources();
        expect(Object.keys(texts).sort()).toEqual([...CALIBRATED_FILES].sort());
        for (const file of CALIBRATED_FILES) expect(texts[file].length).toBeGreaterThan(100);
    });

    it('hashes a file the same whatever its line endings', () => {
        expect(hashText('a\r\nb\r\n')).toBe(hashText('a\nb\n'));
        expect(hashText('a\nb')).not.toBe(hashText('a\nc'));
    });

    it('says when the calibration was never run, has gone stale, failed, or stands', () => {
        const texts = Object.fromEntries(CALIBRATED_FILES.map((f) => [f, `text of ${f}`]));
        const hashes = fileHashes(texts);
        const stamp = { commit: 'abc1234', date: '2026-10-30T21:00:00Z', passed: true, files: hashes };
        expect(calibrationState(null, hashes).state).toBe('none');
        expect(calibrationState(stamp, hashes).state).toBe('ok');
        expect(calibrationFinding(calibrationState(stamp, hashes))).toBeNull();
        expect(calibrationState({ ...stamp, passed: false }, hashes).state).toBe('failed');
        const moved = fileHashes({ ...texts, 'src/systems/board/BoardRunner.js': 'changed' });
        const stale = calibrationState(stamp, moved);
        expect(stale).toMatchObject({ state: 'stale', changed: ['src/systems/board/BoardRunner.js'] });
        expect(calibrationFinding(stale)).toMatchObject({ check: 'calibration-stale', key: 'calibration:engine' });
        expect(calibrationFinding(stale).message).toMatch(/BoardRunner\.js.*npm run bench:calibrate/);
    });
});

describe('the layouts job', () => {
    it('times the layout the workspace’s pace does not, as plain data the Pace page sets beside its own', () => {
        // The pace times the dense layout; the job times the sparse one beside it.
        const other = runLedgerJobNow('layouts', { workspace: paceWorkspace() });
        expect(other.layout).toBe('sparse');
        expect(Object.keys(other.skills)).toEqual(expect.arrayContaining(['mining', 'construction']));
        const { pace } = workspaceReport(paceWorkspace());
        const spread = pace.layoutSpread(JSON.parse(JSON.stringify(other)));
        expect(spread.skills.find((s) => s.skill === 'mining').days.sparse.maxed).toBeCloseTo(other.skills.mining.maxed, 9);
        expect(spread.skills.find((s) => s.skill === 'mining').warn).toBe(true);
    });
});

describe('the report', () => {
    it('carries the pace and its findings beside checks A to C', () => {
        const { pace, findings } = workspaceReport(paceWorkspace());
        expect(pace).toBeTruthy();
        expect(findings.some((f) => f.check === 'wall' && f.group === 'D' && f.name === 'Construction')).toBe(true);
        expect(workspaceReport(paceWorkspace(), { pace: false }).pace).toBeNull();
    });

    it('reads the Ledger settings: a longer payback lets Typical buy the statue', () => {
        // Yield's places have room for it beside the four Mines.
        const { pace } = workspaceReport({ ...paceWorkspace(), planSettings: { paybackHours: 1000, sitePlaces: { buildings: 8, perKind: 5 } } });
        expect(pace.rateAt({ token: 'token_vein' }, 'typical').chosen.map((c) => c.id)).toContain('token_statue');
    });
});

// Each test mounts the whole tab over the reach engine, the pace and every check.
describe('the tab', { timeout: 20000 }, () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        useEntityStore.setState(empty);
        useSimulationStore.setState({ simRows: [] });
        // The tab's numbers were worked out for a camp of two nodes: the sparse layout (the pace times the dense one by default).
        store().hydrate({ ...paceWorkspace(), planSettings: { layout: 'sparse' } });
    });
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        useEntityStore.setState(empty);
    });

    const mount = () => render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
    const openRow = (view, rowKey, name) => fireEvent.click(view.getAllByText(name).find((el) => el.closest('tr')?.getAttribute('data-row') === rowKey));

    it('a Mine\'s effect on copper is shown and switchable on the vein\'s page', () => {
        const view = mount();
        openRow(view, 'tokens:token_vein', 'Copper Vein');
        const rates = within(view.getByLabelText('Rates'));
        // Typical: the camp, four Mines and Beer; the camp's two veins, 480 cycles an hour, 1.5 ore, four Mines' sure double.
        const items = () => view.container.querySelector('[data-rate-items]').textContent;
        expect(items()).toBe('1440 Copper Ore');
        expect(view.container.querySelector('[data-rate-factor="support:token_mine"]').textContent).toMatch(/Mine ×4.*double drop/i);
        fireEvent.click(rates.getByLabelText('Switch Mine ×4'));
        expect(items()).toBe('720 Copper Ore');
        fireEvent.click(rates.getByLabelText('Switch Mine ×4'));
        expect(items()).toBe('1440 Copper Ore');
        // Bare: one vein, no boosts.
        fireEvent.click(rates.getByRole('tab', { name: 'Bare' }));
        expect(items()).toBe('360 Copper Ore');
    });

    it('shows a path time at each profile with the steps that set it', () => {
        const view = mount();
        openRow(view, 'tokens:token_big_hut', 'Big Hut');
        const path = within(view.getByLabelText('Path time'));
        expect([...view.container.querySelectorAll('[data-path-profile]')].map((r) => r.getAttribute('data-path-profile'))).toEqual(['bare', 'typical', 'maxed']);
        // Construction 15 fed by the foresters it needs, the Starter Camp's one hero building and felling in turn.
        expect(view.container.querySelector('[data-path-profile="typical"] [data-path-hours]').textContent).toMatch(/^11 h 9 min/);
        expect(path.getByText(/waits for Construction 15/)).toBeTruthy();
        // The Construction wall is filed under the skill; the page of what waits on it shows it too.
        expect(view.container.querySelector('[data-waits-on="wall"]').textContent).toMatch(/Construction 1 → 15/);
    });

    it('lists the pacing problems and opens a skill\'s row on the Pace page', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: /Problems/ }));
        fireEvent.change(view.getByLabelText('Filter by group'), { target: { value: 'D' } });
        const checks = [...view.container.querySelectorAll('[data-finding]')].map((r) => r.getAttribute('data-finding'));
        expect(checks).toEqual(expect.arrayContaining(['wall', 'stage-budget', 'profile-bounds']));
        fireEvent.click(view.getAllByText('Construction')[0]);
        expect(view.getByRole('tab', { name: 'Pace' }).getAttribute('aria-selected')).toBe('true');
        expect(view.container.querySelector('[data-breakdown="construction|0"]')).toBeTruthy();
        // ⭐ The way out (the next place's level and price) is what the budget times; the full content is information, never red.
        expect(view.container.querySelector('[data-stage="0"] [data-stage-hours]').textContent).toMatch(/^26 min \(-26 %\)\*$/);
        // ⭐ Every way out is marked a floor, with why: its place's goods price is not counted.
        const ways = [...view.container.querySelectorAll('[data-stage-gate]')].filter((c) => !c.querySelector('[data-stage-gate-none]'));
        expect(ways.length).toBeGreaterThan(0);
        for (const c of ways) expect(c.querySelector('[data-stage-floor]').textContent).toBe("* a floor: its goods price (the world seed's) is not counted");
        expect(view.container.querySelector('[data-stage="0"] [data-stage-gate]').textContent).toMatch(/Trees ring 1: Forestry 5/);
        expect(view.container.querySelector('[data-stage="0"] [data-stage-content]').textContent).toMatch(/^11 h 9 min, 20 entries/);
        expect(view.container.querySelector('[data-stage="0"] [data-stage-content]').getAttribute('style')).not.toMatch(/error|success/);
        expect(view.container.querySelector('[data-stage="0"] [data-stage-heroes]').textContent).toMatch(/^1 hero/);
        expect(view.container.querySelector('[data-stage="3"] [data-stage-gate-none]').textContent).toBe('no place of Plane 4 to settle');
        expect(view.container.querySelector('[data-stage="7"] [data-stage-gate-none]').textContent).toBe('the last stage');
        expect(view.container.querySelector('[data-hall="roster_size|2"]')).toBeTruthy();
    });

    it('⭐ shows both layouts: the nodes the dense one makes more of, and on a click each skill’s days to 99 in both, worked out as a job', async () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: 'Pace' }));
        expect(view.container.querySelector('[data-layout-nodes="1"]').textContent).toMatch(/Copper Vein: .* an hour with 2, .* with 5 \(\+150 %\)/);
        expect(view.container.querySelector('[data-layout-spread]')).toBeNull();
        fireEvent.click(view.container.querySelector('[data-layout-spread-button]'));
        await waitFor(() => expect(view.container.querySelector('[data-layout-spread]')).toBeTruthy(), { timeout: 20000 });
        expect(view.container.querySelector('[data-layout-skill="mining"]').textContent).toMatch(/Mining.*Maxed .* d.*Maxed .* d/);
        // The stages say their heroes, and what their work takes.
        expect(view.container.querySelector('[data-stage="0"] [data-stage-heroes]').textContent).toMatch(/^1 hero/);
        expect(view.container.querySelector('[data-stage="0"] [data-stage-gate]').textContent).toMatch(/their work .* side by side/);
    });

    it('edits the reference guild: heroes by stage, the layouts’ nodes and the layout timed, a site’s places', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: 'Settings' }));
        const set = (label, value) => { const input = view.getByLabelText(label); fireEvent.change(input, { target: { value } }); fireEvent.blur(input); };
        set('Heroes from Plane 2', '3');
        expect(store().planSettings.heroesByTier.find((p) => p.tier === 2).heroes).toBe(3);
        set('Dense layout nodes', '6');
        expect(store().planSettings.layouts).toEqual({ sparse: 2, dense: 6 });
        fireEvent.change(view.getByLabelText('Layout the pace times'), { target: { value: 'dense' } });
        expect(store().planSettings.layout).toBe('dense');
        set('Building places', '10');
        set('Places a kind', '3');
        expect(store().planSettings.sitePlaces).toEqual({ places: 12, buildings: 10, perKind: 3 });
        set('Places round a node', '14');
        expect(store().planSettings.sitePlaces).toEqual({ places: 14, buildings: 10, perKind: 3 });
        set('Dense layout spawners', '3');
        expect(store().planSettings.layoutSpawners).toEqual({ sparse: 1, dense: 3 });
        expect(view.queryByLabelText('Camp copies')).toBeNull();
    });

    it('edits the profile settings', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: 'Settings' }));
        const payback = view.getByLabelText('Payback hours');
        fireEvent.change(payback, { target: { value: '6' } });
        fireEvent.blur(payback);
        expect(store().planSettings.paybackHours).toBe(6);
        const consumables = view.getByLabelText('Consumables target from Starter Camp');
        fireEvent.change(consumables, { target: { value: '120' } });
        fireEvent.blur(consumables);
        expect(store().planSettings.boostTargets.consumable).toEqual([{ tier: 0, pct: 120 }]);
    });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { workspaceReport } from '../../cms/src/engine/ledgerReport';
import { bundledSources } from '../../cms/src/engine/calibrationStatus';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import {
    CALIBRATED_FILES, hashText, fileHashes, calibrationState, calibrationFinding,
} from '../systems/progression/ledger/calibration.js';
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

describe('the report', () => {
    it('carries the pace and its findings beside checks A to C', () => {
        const { pace, findings } = workspaceReport(paceWorkspace());
        expect(pace).toBeTruthy();
        expect(findings.some((f) => f.check === 'wall' && f.group === 'D' && f.name === 'Construction')).toBe(true);
        expect(workspaceReport(paceWorkspace(), { pace: false }).pace).toBeNull();
    });

    it('reads the Ledger settings: a longer payback lets Typical buy the statue', () => {
        const { pace } = workspaceReport({ ...paceWorkspace(), planSettings: { paybackHours: 1000 } });
        expect(pace.rateAt({ token: 'token_vein' }, 'typical').chosen.map((c) => c.id)).toContain('token_statue');
    });
});

// Each test mounts the whole tab over the reach engine, the pace and every check.
describe('the tab', { timeout: 20000 }, () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        useEntityStore.setState(empty);
        useSimulationStore.setState({ simRows: [] });
        store().hydrate(paceWorkspace());
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
        // Typical: the camp, the Mine and Beer; 720 cycles an hour, 1.5 ore, the Mine's quarter more.
        const items = () => view.container.querySelector('[data-rate-items]').textContent;
        expect(items()).toBe('1350 Copper Ore');
        expect(view.container.querySelector('[data-rate-factor="support:token_mine"]').textContent).toMatch(/Mine.*double drop/i);
        fireEvent.click(rates.getByLabelText('Switch Mine'));
        expect(items()).toBe('1080 Copper Ore');
        fireEvent.click(rates.getByLabelText('Switch Mine'));
        expect(items()).toBe('1350 Copper Ore');
        // Bare: one vein, no boosts.
        fireEvent.click(rates.getByRole('tab', { name: 'Bare' }));
        expect(items()).toBe('360 Copper Ore');
    });

    it('shows a path time at each profile with the steps that set it', () => {
        const view = mount();
        openRow(view, 'tokens:token_big_hut', 'Big Hut');
        const path = within(view.getByLabelText('Path time'));
        expect([...view.container.querySelectorAll('[data-path-profile]')].map((r) => r.getAttribute('data-path-profile'))).toEqual(['bare', 'typical', 'maxed']);
        expect(view.container.querySelector('[data-path-profile="typical"] [data-path-hours]').textContent).toMatch(/^6 h/);
        expect(path.getByText(/waits for Construction 15/)).toBeTruthy();
    });

    it('lists the pacing problems and opens a skill\'s row on the Pace page', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: /Problems/ }));
        fireEvent.change(view.getByLabelText('Filter by group'), { target: { value: 'D' } });
        const checks = [...view.container.querySelectorAll('[data-finding]')].map((r) => r.getAttribute('data-finding'));
        expect(checks).toEqual(expect.arrayContaining(['wall', 'stage-budget', 'profile-bounds', 'boost-target']));
        fireEvent.click(view.getAllByText('Construction')[0]);
        expect(view.getByRole('tab', { name: 'Pace' }).getAttribute('aria-selected')).toBe('true');
        expect(view.container.querySelector('[data-breakdown="construction|0"]')).toBeTruthy();
        expect(view.container.querySelector('[data-stage="0"] [data-stage-hours]').textContent).toMatch(/^6 h/);
        expect(view.container.querySelector('[data-hall="roster_size|2"]')).toBeTruthy();
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

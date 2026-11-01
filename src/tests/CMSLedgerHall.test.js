// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { workspaceReport, workspacePace } from '../../cms/src/engine/ledgerReport';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import HallStarsPage from '../../cms/src/components/hallStars/HallStarsPage.jsx';
import { workspaceContent } from '../../cms/src/stores/useLedgerWatchStore.js';
import { runGate } from '../../cms/src/engine/packGate.js';
import { workspaceSnapshot } from '../../cms/src/engine/ledgerJobs.js';
import { paceWorkspace } from './fixtures/paceWorld.js';
import { paceHallSky } from './fixtures/paceHallSky.js';

/**
 * The ledger knows the Hall, in the CMS (brief 320 H2): the workspace's stars reach the pace; the Pace
 * page lists every rank's payback at Typical (red when it does not pay off) with the proposed price,
 * and shows the Hall's share in a skill's breakdown; an entry's rates name the stars Typical bought;
 * the Guild Hall page sets each rank's tier and shows its payback and proposed price. The store never
 * persists here (TESTING, "The CMS").
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

const empty = { items: {}, tokens: {}, effects: {}, recipePools: {}, starterCamp: null, planSettings: null, hallStars: null, hallConstellations: null };
const store = () => useEntityStore.getState();

/** The pace world as the CMS holds it, its vein at 10 XP a cycle, with the test sky. */
function hallWorkspace() {
    const ws = paceWorkspace();
    ws.tokens.token_vein.config.xp = 10;
    const sky = paceHallSky();
    return { ...ws, hallConstellations: sky.constellations, hallStars: sky.stars };
}

describe('the report reads the workspace\'s sky', () => {
    it('the pace prices every star and finds the rank that does not pay back', () => {
        const { pace, findings } = workspaceReport(hallWorkspace());
        expect(pace.hallPaybacks().filter(r => !r.builtIn).map(r => `${r.id}|${r.rank}`)).toEqual([
            'ph_lore|1', 'ph_lore|2', 'ph_quick|1', 'ph_deep|1', 'ph_gold|1', 'ph_rich|1', 'ph_rails|1', 'ph_spring|1', 'ph_spring|2', 'ph_infirmary|1'
        ]);
        expect(findings.filter(f => f.check === 'hall-payback').map(f => f.key)).toEqual(['hall:ph_gold']);
        expect(workspacePace(hallWorkspace()).hallPaybacks().length).toBe(pace.hallPaybacks().length);
        // A workspace with no sky prices only the built-in tracks.
        expect(workspaceReport(paceWorkspace()).pace.hallPaybacks().every(r => r.builtIn)).toBe(true);
    });
});

describe('the change-pack gate reads the sky', () => {
    it('hands the ledger the workspace\'s stars, so a pack adding a star slow to pay back shows that problem as added', () => {
        useEntityStore.setState(empty);
        store().hydrate(hallWorkspace());
        const workspace = workspaceContent(store());
        expect(Object.keys(workspace.hallStars)).toContain('ph_lore');
        const slow = { ...paceHallSky().stars.ph_gold, id: 'ph_gold_two', name: 'Gold Leaf Two' };
        const pack = {
            format: 'fantasy-guild-change-pack', version: 1, id: 'hall-gate', createdAt: '2026-10-30T20:00:00Z', title: 'A slow star', asked: 'A star that never pays back, to see the gate catch it.', summary: 'One star that never pays back.',
            entries: [{ op: 'create', kind: 'hallStar', id: slow.id, value: slow, note: 'Never pays back.' }]
        };
        const gate = runGate(workspace, pack, workspaceSnapshot);
        expect(gate.errors || []).toEqual([]);
        expect(gate.diff.added.map(f => `${f.check}|${f.key}`)).toEqual(['hall-payback|hall:ph_gold_two']);
        // The stars already there are in both sides: the Gold Leaf already in the workspace adds nothing.
        expect(gate.before.findings.some(f => f.key === 'hall:ph_gold')).toBe(true);
        useEntityStore.setState(empty);
    });
});

// Each test mounts the whole tab over the reach engine, the pace and every check.
describe('the Ledger tab', { timeout: 20000 }, () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        useEntityStore.setState(empty);
        useSimulationStore.setState({ simRows: [] });
        store().hydrate(hallWorkspace());
    });
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        useEntityStore.setState(empty);
    });

    const mount = () => render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));

    it('the Pace page: every rank\'s payback at Typical, red when it does not pay off, with the proposed price', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: 'Pace' }));
        const row = (id) => view.container.querySelector(`[data-hall="${id}"]`);
        expect(row('ph_lore|1').getAttribute('data-hall-pays')).toBe('yes');
        expect(row('ph_lore|1').textContent).toMatch(/Lore 1.*Starter Camp.*10 Copper Ore.*Copper Vein/);
        expect(row('ph_lore|1').querySelector('[data-hall-proposed]').textContent).toMatch(/^\d+ Copper Ore \(pays back in 2\d h( \d+ min)?\)$/);
        // Rank 2 raised to rank 1's price: marked, and red, for it then pays back in over a day.
        const raised = row('ph_lore|2').querySelector('[data-hall-proposed]');
        expect(raised.textContent).toMatch(/raised to the rank before\)$/);
        expect(raised.style.color).toBe('var(--color-error)');
        const gold = row('ph_gold|1');
        expect(gold.getAttribute('data-hall-pays')).toBe('no');
        expect(gold.querySelector('[data-hall-payback]').style.color).toBe('var(--color-error)');
        expect(row('ph_spring|2').querySelector('[data-hall-proposed]').textContent).toBe('no tier set');
        // A star that adds no rate has no payback row; it is listed under Problems.
        expect(row('ph_infirmary|1')).toBeNull();
    });

    it('the settings: the Guild Hall payback beside the boosts\' payback, a day unless set', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: 'Settings' }));
        const hall = view.getByLabelText('Guild Hall payback hours');
        expect(hall.value).toBe('24');
        expect(view.getByLabelText('Payback hours').value).toBe('2');
        fireEvent.change(hall, { target: { value: '12' } });
        fireEvent.blur(hall);
        expect(store().planSettings.hallPaybackHours).toBe(12);
        expect(store().planSettings.paybackHours ?? 2).toBe(2);
    });

    it('the Pace page: Mining\'s breakdown shows the Hall\'s share at Typical and at Maxed', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: 'Pace' }));
        const shares = [...view.container.querySelectorAll('[data-breakdown="mining|0"] [data-hall-share]')].map(el => el.textContent);
        expect(shares).toHaveLength(2);
        expect(shares[0]).toMatch(/^Guild Hall \+\d+ % \(Lore 2, Quick Picks 1, Deep Veins 1\)$/);
        expect(shares[1]).toMatch(/Gold Leaf 1/);
        // Forestry holds no star: it says so.
        expect(view.container.querySelector('[data-breakdown="forestry|0"] [data-hall-share]').textContent).toBe('Guild Hall: none at this stage');
    });

    it('the vein\'s page: Typical names the stars it bought and how it opened them; each star is a factor to switch', () => {
        const view = mount();
        const vein = view.getAllByText('Copper Vein').find(el => el.closest('tr')?.getAttribute('data-row') === 'tokens:token_vein');
        fireEvent.click(vein);
        const rates = within(view.getByLabelText('Rates'));
        expect(view.container.querySelector('[data-rate]').textContent).toMatch(/Deep Veins rank 1 \(pays back in .*, opened through Lore 1 and Quick Picks 1\)/);
        expect(view.container.querySelector('[data-rate-factor="hall:ph_lore"]').textContent).toMatch(/Guild Hall.*Lore rank 2.*xp bonus/i);
        const xp = () => view.container.querySelector('[data-rate-xp]').textContent;
        const before = xp();
        fireEvent.click(rates.getByLabelText('Switch Lore rank 2'));
        expect(xp()).not.toBe(before);
    });
});

describe('the Guild Hall page', () => {
    beforeEach(() => {
        useEntityStore.setState(empty);
        store().hydrate(hallWorkspace());
    });
    afterEach(() => {
        cleanup();
        useEntityStore.setState(empty);
    });

    it('sets a rank\'s tier and shows its payback at Typical and the proposed price, worked out again on Refresh', () => {
        const { container } = render(React.createElement(HallStarsPage));
        const lore = container.querySelector('[data-hall-star="ph_lore"]');
        fireEvent.click([...lore.querySelectorAll('button')].find(b => b.textContent.includes('2 ranks')));
        const first = () => lore.querySelector('[data-hall-rank="1"]');
        expect(first().querySelector('[data-hall-rank-tier]').value).toBe('0');
        expect(first().querySelector('[data-hall-rank-payback]').textContent).toMatch(/to gather, saves .* an hour: pays back in \d+ min/);
        expect(first().querySelector('[data-hall-rank-proposed]').textContent).toMatch(/proposed \(preview\): \d+ Copper Ore, pays back in 2\d h/);

        fireEvent.change(first().querySelector('[data-hall-rank-tier]'), { target: { value: '' } });
        expect('tier' in store().hallStars.ph_lore.ranks[0]).toBe(false);
        fireEvent.change(first().querySelector('[data-hall-rank-tier]'), { target: { value: '2' } });
        expect(store().hallStars.ph_lore.ranks[0].tier).toBe(2);
        // The rest of the rank is kept.
        expect(store().hallStars.ph_lore.ranks[0].price).toEqual([{ itemId: 'item_copper_ore', quantity: 10 }]);
        fireEvent.change(first().querySelector('[data-hall-rank-tier]'), { target: { value: '' } });
        fireEvent.click(container.querySelector('[data-hall-pricing-refresh]'));
        expect(first().querySelector('[data-hall-rank-proposed]').textContent).toMatch(/no tier set/);
    });

    it('marks a star with a rank slow to pay back, and a star that adds no rate', () => {
        const { container } = render(React.createElement(HallStarsPage));
        expect(container.querySelector('[data-hall-star="ph_gold"] [data-hall-star-late]').textContent).toBe('1 rank slow to pay back');
        expect(container.querySelector('[data-hall-star="ph_lore"] [data-hall-star-late]')).toBeNull();
        const infirmary = container.querySelector('[data-hall-star="ph_infirmary"]');
        fireEvent.click([...infirmary.querySelectorAll('button')].find(b => b.textContent.includes('1 rank')));
        expect(infirmary.querySelector('[data-hall-rank-payback]').textContent).toMatch(/adds no rate/);
    });
});

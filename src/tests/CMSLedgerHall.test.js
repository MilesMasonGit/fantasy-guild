// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { workspaceReport, workspacePace } from '../../cms/src/engine/ledgerReport';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import HallStarsPage from '../../cms/src/components/hallStars/HallStarsPage.jsx';
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
        expect(row('ph_lore|1').querySelector('[data-hall-proposed]').textContent).toMatch(/^\d+ Copper Ore \(pays back in 1 h \d+ min\)$/);
        const gold = row('ph_gold|1');
        expect(gold.getAttribute('data-hall-pays')).toBe('no');
        expect(gold.querySelector('[data-hall-payback]').style.color).toBe('var(--color-error)');
        expect(row('ph_spring|2').querySelector('[data-hall-proposed]').textContent).toBe('no tier set');
        // A star that adds no rate has no payback row; it is listed under Problems.
        expect(row('ph_infirmary|1')).toBeNull();
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
        expect(first().querySelector('[data-hall-rank-proposed]').textContent).toMatch(/proposed \(preview\): \d+ Copper Ore, pays back in 1 h \d+ min/);

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

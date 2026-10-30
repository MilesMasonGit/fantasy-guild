// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { workspaceReport } from '../../cms/src/engine/ledgerReport';
import {
    timelineOf, crowdedOf, emptyOf, curveLevelAt, timeTicks, OTHER_LANE, CROWD_MIN,
} from '../../cms/src/engine/ledgerTimeline';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import { settingsOf, minutesToReach } from '../systems/progression/ledger/settings.js';
import { paceWorkspace } from './fixtures/paceWorld.js';

/**
 * The Ledger's timeline and hubs (brief 290 L6): a lane per skill against the pace curve, dots at
 * first reach, walls with their blocker, crowded and empty stretches; the hubs chart beside the
 * problems. The store never persists here (TESTING, "The CMS").
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

describe('the timeline', () => {
    const report = workspaceReport(paceWorkspace());
    const timeline = timelineOf(report.pace, report.ledger, { findings: report.findings });
    const lane = (id) => timeline.lanes.find((l) => l.id === id);

    it('draws a lane per levelled skill, its Typical levels and the curve beside them', () => {
        const construction = lane('construction');
        expect(construction.top).toBe(15);
        expect(construction.track[0]).toEqual({ level: 1, hours: 0 });
        const track = report.pace.trackOf('construction');
        expect(construction.track.at(-1)).toEqual({ level: 15, hours: track.levels.at(-1).cumulative.typical });
        for (let i = 1; i < construction.track.length; i++) expect(construction.track[i].hours).toBeGreaterThanOrEqual(construction.track[i - 1].hours);
        expect(construction.curve.map((p) => p.hours)).toEqual(construction.track.map((p) => minutesToReach(report.pace.settings, p.level) / 60));
        expect(timeline.lanes.at(-1).id).toBe(OTHER_LANE);
    });

    it('puts each item and Token at its first reach, at the level its own step asks', () => {
        const hut = lane('construction').dots.find((d) => d.key === 'token:token_big_hut');
        expect(hut.level).toBe(15);
        expect(hut.hours).toBe(report.pace.pathOf('token:token_big_hut', 'typical').hours);
        const ore = lane('mining').dots.find((d) => d.key === 'item:item_copper_ore');
        expect(ore.level).toBe(1);
        // What no skill level gates (the Starter Camp's bank, the Shop) has its own lane.
        expect(lane(OTHER_LANE).dots.every((d) => d.level === null)).toBe(true);
        expect(timeline.lanes.flatMap((l) => l.dots).every((d) => !d.key.startsWith('recipe:'))).toBe(true);
    });

    it('labels the Construction wall with its blocker, from the pace\'s own walls', () => {
        const [wall] = lane('construction').walls;
        const [run] = report.pace.walls('construction');
        expect(wall).toMatchObject({ from: 1, to: 15, startHours: 0, endHours: lane('construction').track.at(-1).hours, hours: run.hours });
        expect(wall.label).toMatch(/^Wall 1 → 15: /);
        expect(wall.blocker).toMatch(/XP\/h/);
        expect(wall.sourceKey).toBe(run.source.work.entry);
        // The finding the Problems list shows is the same run.
        expect(report.findings.find((f) => f.check === 'wall' && f.key === 'skill:construction').message).toMatch(/Construction 1 → 15/);
    });

    it('marks the stages and spans every time it draws', () => {
        expect(timeline.stages.map((s) => s.tier)).toEqual(expect.arrayContaining([0]));
        expect(timeline.maxHours).toBeGreaterThanOrEqual(lane('construction').track.at(-1).hours);
    });
});

describe('crowded and empty stretches', () => {
    const settings = settingsOf(null);

    it('a crowded spot is five or more arrivals within a check-in; the start does not count', () => {
        const at = (minutes) => minutes / 60;
        expect(crowdedOf([0, 0, 0, 0, 0, 0], settings)).toEqual([]);
        expect(crowdedOf([at(10), at(12), at(15), at(20), at(30)], settings)).toEqual([{ startHours: at(10), endHours: at(30), count: CROWD_MIN }]);
        expect(crowdedOf([at(10), at(12), at(15), at(20), at(50)], settings)).toEqual([]);
    });

    it('an empty stretch is ten curve levels with nothing new, and over a check-in', () => {
        const from = minutesToReach(settings, 20) / 60;
        const to = minutesToReach(settings, 31) / 60;
        const [gap] = emptyOf([from, to], settings);
        expect(gap.startHours).toBe(from);
        expect(gap.curveLevels).toBeCloseTo(11);
        expect(emptyOf([from, minutesToReach(settings, 25) / 60], settings)).toEqual([]);
        // Ten levels early on take under an hour: not over a check-in, so not empty.
        expect(emptyOf([1 / 60, minutesToReach(settings, 9) / 60], settings)).toEqual([]);
    });

    it('reads the curve level after some minutes, with the fraction done', () => {
        const settings2 = settingsOf({ paceCurve: [{ level: 1, minutesPerLevel: 10 }] });
        expect(curveLevelAt(settings2, 0)).toBe(1);
        expect(curveLevelAt(settings2, 25)).toBeCloseTo(3.5);
        expect(timeTicks(1 / 60, 3).map((t) => t.text)).toEqual(['1 min', '5 min', '15 min', '30 min', '1 h', '2 h']);
    });
});

// Each test mounts the whole tab over the reach engine, the pace and every check.
describe('the views', { timeout: 20000 }, () => {
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
    const openTimeline = (view) => fireEvent.click(view.getByRole('tab', { name: 'Timeline' }));

    it('draws the lanes and opens an entry\'s page from its dot', () => {
        const view = mount();
        openTimeline(view);
        expect(view.container.querySelector('[data-track="construction"]')).toBeTruthy();
        expect(view.container.querySelector('[data-curve="construction"]')).toBeTruthy();
        expect(view.container.querySelector('[data-wall="construction|1"]')).toBeTruthy();
        fireEvent.click(view.container.querySelector('[data-dot="token:token_big_hut"]'));
        expect(view.getByLabelText('Ledger page of Big Hut')).toBeTruthy();
    });

    it('a wall\'s label names its blocker and opens the blocker\'s page; a lane\'s name its Pace row', () => {
        const view = mount();
        openTimeline(view);
        const label = view.container.querySelector('[data-wall-label="construction|1"]');
        expect(label.textContent).toMatch(/Wall 1 → 15: .* held up by .*XP\/h/);
        fireEvent.click(label);
        expect(view.getByLabelText(/^Ledger page of /)).toBeTruthy();
        fireEvent.click(view.getByRole('tab', { name: 'Timeline' }));
        fireEvent.click(view.container.querySelector('[data-lane-name="construction"]'));
        expect(view.getByRole('tab', { name: 'Pace' }).getAttribute('aria-selected')).toBe('true');
    });

    it('shows the hubs beside the problems: a bar narrows the list, a name opens the item', () => {
        const view = mount();
        fireEvent.click(view.getByRole('tab', { name: /Problems/ }));
        const hubs = [...view.container.querySelectorAll('[data-hub]')].map((h) => h.getAttribute('data-hub'));
        expect(hubs[0]).toBe('item_oak_wood');
        const all = view.container.querySelectorAll('[data-finding]').length;
        fireEvent.click(view.container.querySelector('[data-hub-bar="item_oak_wood"]'));
        expect(view.container.querySelector('[data-problem-scope="item:item_oak_wood"]')).toBeTruthy();
        const scoped = view.container.querySelectorAll('[data-finding]').length;
        expect(scoped).toBeGreaterThan(0);
        expect(scoped).toBeLessThan(all);
        fireEvent.click(view.getByLabelText('List every problem'));
        expect(view.container.querySelectorAll('[data-finding]').length).toBe(all);
        fireEvent.click(view.container.querySelector('[data-hub-name="item_oak_wood"]'));
        expect(view.getByLabelText('Ledger page of Oak Wood')).toBeTruthy();
    });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS, HEARD_WHILE_QUIET } from '../systems/core/engineEvents.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { CatchUpOverlay } from '../ui/components/hud/CatchUpOverlay.jsx';
import { formatAway, summaryView, catchUpTitle, itemChanges } from '../ui/components/hud/catchUpSummary.js';
import * as CatchUp from '../systems/core/CatchUp.js';

// The summary's undo button asks the catch-up driver; here it is a stand-in.
vi.mock('../systems/core/CatchUp.js', () => ({
    canUndo: vi.fn(() => true),
    undoLast: vi.fn(() => true),
    forgetUndo: vi.fn()
}));

/**
 * The catch-up's loading bar and the "While you were away" summary: shown only for a catch-up
 * long enough to `show`, driven by the catch-up's own events, and closed only by the player, who
 * is asked first either way.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_cu_ore: item('fixture_cu_ore', 'Fixture Ore'),
    fixture_cu_log: item('fixture_cu_log', 'Fixture Log'),
    fixture_cu_seed: item('fixture_cu_seed', 'Fixture Seed'),
    fixture_cu_pelt: item('fixture_cu_pelt', 'Fixture Pelt'),
    fixture_cu_meal: item('fixture_cu_meal', 'Fixture Meal'),
    fixture_cu_elixir: item('fixture_cu_elixir', 'Fixture Elixir')
});
const token = (id, name) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_nature'
});
registerTokenTypes({
    fixture_cu_rock: token('fixture_cu_rock', 'Fixture Rock'),
    fixture_cu_wolf: token('fixture_cu_wolf', 'Fixture Wolf')
});

/** A full result, every section filled. */
const fullResult = () => ({
    awayMs: 3 * HOUR + 12 * MIN + 40 * 1000, simulatedMs: 3 * HOUR + 12 * MIN, droppedMs: 0,
    steps: 11520, wallMs: 3000, show: true,
    summary: {
        items: {
            gained: { fixture_cu_ore: 5900, fixture_cu_log: 40 },
            spent: { fixture_cu_seed: 12, fixture_cu_ore: 400 },
            // The Bank's own difference: more logs than were announced (a silent Bank path).
            net: { fixture_cu_ore: 5500, fixture_cu_log: 55, fixture_cu_seed: -12 },
            floor: { fixture_cu_pelt: 7, fixture_cu_log: -3 }
        },
        levelUps: [
            { heroId: 'h1', heroName: 'Aela', skillId: 'mining', skillName: 'Mining', from: 50, to: 51 },
            { heroId: 'h1', heroName: 'Aela', skillId: 'logging', skillName: 'Logging', from: 12, to: 15 },
            { heroId: 'h2', heroName: 'Bram', skillId: 'melee', skillName: 'Melee', from: 3, to: 4 }
        ],
        depleted: { total: 3, byType: { fixture_cu_rock: 3 } },
        wounded: [{ heroId: 'h2', heroName: 'Bram', times: 2 }],
        fightsWon: { total: 11, byEnemy: { fixture_cu_wolf: 9, fixture_cu_rock: 2 } },
        combat: {
            food: { fixture_cu_meal: 14 },
            elixirs: { fixture_cu_elixir: 2 },
            drops: { fixture_cu_pelt: 9 }
        },
        news: {
            recipes: [{ heroId: 'h1', heroName: 'Aela', skillId: 'mining', recipes: [
                { id: 'r_cu_bar', name: 'Fixture Bar', itemId: 'fixture_cu_ore' },
                { id: 'r_cu_plank', name: 'Fixture Plank', itemId: 'fixture_cu_log' }
            ] }],
            finds: [{ itemId: 'fixture_cu_pelt', count: 9 }],
            bankFull: ['fixture_cu_log'],
            knockouts: [{ heroId: 'h2', heroName: 'Bram', times: 2, lost: ['Copper Sword'] }]
        }
    }
});

/** Only time passed: nothing gained, spent, levelled, depleted, wounded or won. */
const emptyResult = () => ({
    awayMs: 45 * MIN, simulatedMs: 45 * MIN, droppedMs: 0, steps: 2700, wallMs: 400, show: true,
    summary: {
        items: { gained: {}, spent: {}, net: {}, floor: {} },
        levelUps: [], depleted: { total: 0, byType: {} }, wounded: [], fightsWon: { total: 0, byEnemy: {} }
    }
});

const publish = (name, payload) => act(() => { EventBus.publish(name, payload); });
const start = (awayMs = 3 * HOUR + 12 * MIN, show = true) =>
    publish(ENGINE_EVENTS.CATCH_UP_STARTED, { awayMs, playMs: Math.min(awayMs, 24 * HOUR), show });
const progress = (fraction, show = true) =>
    publish(ENGINE_EVENTS.CATCH_UP_PROGRESS, { fraction, playedMs: fraction * HOUR, targetMs: HOUR, show });
const finish = (result) => publish(ENGINE_EVENTS.CATCH_UP_FINISHED, result);

const q = (sel) => document.querySelector(sel);
const text = (sel) => q(sel)?.textContent.replace(/\s+/g, ' ').trim();
const escape = () => act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });

/** An Item Bar's name, its abbreviated count, and the exact count it shows on hover. */
const barText = (el) => el && {
    name: el.querySelector('[data-item-bar-name]')?.textContent,
    short: el.querySelector('[data-item-bar-count]')?.textContent ?? null,
    exact: el.querySelector('[data-item-bar-count-exact]')?.textContent ?? null
};
const bar = (section, attr, id) => barText(q(`[data-summary-section="${section}"] [${attr}="${id}"]`));

beforeEach(() => { render(React.createElement(CatchUpOverlay)); });
afterEach(() => {
    cleanup();
    EventBus.setQuiet(false);
    vi.useRealTimers();
    vi.mocked(CatchUp.canUndo).mockReturnValue(true);
    vi.mocked(CatchUp.undoLast).mockClear();
    vi.mocked(CatchUp.forgetUndo).mockClear();
});

describe('the catch-up loading bar', () => {
    it('shows for a catch-up long enough to show, with the time away in its title', () => {
        expect(q('[data-catch-up-bar]')).toBeNull();
        start();
        expect(q('[data-catch-up-bar]')).not.toBeNull();
        expect(text('[data-catch-up-title]')).toBe('Catching up on 3 h 12 min away');
    });

    it('shows nothing for a silent catch-up, start to end', () => {
        start(90 * 1000, false);
        progress(0.5, false);
        expect(document.body.textContent).toBe('');
        finish({ ...emptyResult(), awayMs: 90 * 1000, show: false });
        expect(document.body.textContent).toBe('');
    });

    it('follows the progress events', () => {
        start();
        const fill = () => q('[data-catch-up-fill]').style.transform;
        expect(fill()).toBe('scaleX(0)');
        progress(0.25);
        expect(fill()).toBe('scaleX(0.25)');
        progress(0.6);
        expect(fill()).toBe('scaleX(0.6)');
    });

    it('hears its events while the bus is quiet, as during a real catch-up', () => {
        EventBus.setQuiet(true, { except: HEARD_WHILE_QUIET });
        start();
        progress(0.4);
        expect(q('[data-catch-up-fill]').style.transform).toBe('scaleX(0.4)');
    });

    it('cannot be dismissed mid-run: Esc and clicks leave it', () => {
        start();
        progress(0.3);
        escape();
        act(() => { fireEvent.click(q('[data-catch-up-overlay]')); });
        act(() => { fireEvent.click(q('[data-catch-up-bar]')); });
        expect(q('[data-catch-up-bar]')).not.toBeNull();
        expect(q('[data-catch-up-overlay] button')).toBeNull();
    });

    it('gives way to the summary when the catch-up finishes', () => {
        start();
        finish(fullResult());
        expect(q('[data-catch-up-bar]')).toBeNull();
        expect(q('[data-catch-up-summary]')).not.toBeNull();
    });
});

describe('"While you were away"', () => {
    const column = (id) => q(`[data-summary-column="${id}"]`);
    const sectionsIn = (id) => [...column(id).querySelectorAll('[data-summary-section]')].map(s => s.getAttribute('data-summary-section'));
    const itemRow = (id) => q(`[data-summary-section="items"] [data-item-id="${id}"]`);

    it('two columns: the items on the left, the news on the right', () => {
        start();
        finish(fullResult());
        const body = q('[data-summary-body]');
        expect(body.className).toMatch(/\bgrid-cols-2\b/);
        expect([...body.children].map(c => c.getAttribute('data-summary-column'))).toEqual(['items', 'news']);
        expect(sectionsIn('items')).toEqual(['items']);
    });

    it('the news in the brief\'s order: knock-outs and items lost, recipes, finds, level-ups, Tokens used up, fights', () => {
        start();
        finish(fullResult());
        expect(sectionsIn('news')).toEqual(['knockouts', 'bankFull', 'recipes', 'finds', 'levels', 'depleted', 'kills']);
        const headings = [...column('news').querySelectorAll('[data-summary-heading]')].map(h => h.textContent);
        expect(headings).toEqual(['Knocked out', 'Bank full: waiting on the mat', 'New recipes', 'First finds', 'Level-ups', 'Tokens used up', 'Fights']);
    });

    it('the heading is centred: While you were away, then how long', () => {
        start();
        finish(fullResult());
        expect(q('[data-summary-header]').className).toMatch(/\btext-center\b/);
        expect(text('[data-catch-up-summary] [role="heading"]')).toBe('While you were away');
        expect(text('[data-summary-away]')).toBe('You were away 3 h 12 min');
        expect(q('[data-summary-dropped]')).toBeNull();
    });

    it('each item once, its net in green or red: the Bank and the mat together', () => {
        start();
        finish(fullResult());
        const ids = [...column('items').querySelectorAll('[data-item-bar]')].map(r => r.getAttribute('data-item-id'));
        // Gains biggest first, then losses.
        expect(ids).toEqual(['fixture_cu_ore', 'fixture_cu_log', 'fixture_cu_pelt', 'fixture_cu_seed']);
        // Gained 5,900 and spent 400: one row, +5,500.
        expect(barText(itemRow('fixture_cu_ore'))).toEqual({ name: 'Fixture Ore', short: '+5.5k', exact: '+5,500' });
        // The Bank's 55 (more than announced) less the 3 that left the mat for it.
        expect(barText(itemRow('fixture_cu_log'))).toEqual({ name: 'Fixture Log', short: '+52', exact: '+52' });
        expect(barText(itemRow('fixture_cu_pelt'))).toEqual({ name: 'Fixture Pelt', short: '+7', exact: '+7' });
        expect(barText(itemRow('fixture_cu_seed'))).toEqual({ name: 'Fixture Seed', short: '−12', exact: '−12' });
        const colour = (id) => itemRow(id).querySelector('[data-item-bar-count]').className;
        expect(colour('fixture_cu_ore')).toContain('text-gi-success');
        expect(colour('fixture_cu_seed')).toContain('text-gi-danger');
        expect(colour('fixture_cu_seed')).not.toContain('text-gi-text');
    });

    it('hovering an item says what was gained and spent, and how many wait on the mat', () => {
        start();
        finish(fullResult());
        const tipOf = (id) => {
            act(() => { fireEvent.pointerEnter(itemRow(id), { clientX: 10, clientY: 10 }); });
            const tip = [...q('[data-tooltip]').querySelectorAll('.ui-text-title, .ui-text-body')].map(d => d.textContent);
            act(() => { fireEvent.pointerLeave(itemRow(id)); });
            return tip;
        };
        expect(tipOf('fixture_cu_ore')).toEqual(['Fixture Ore', 'Gained 5,900', 'Spent 400']);
        expect(tipOf('fixture_cu_seed')).toEqual(['Fixture Seed', 'Spent 12']);
        expect(tipOf('fixture_cu_pelt')).toEqual(['Fixture Pelt', 'Gained 7', '7 still waiting on the mat']);
        // No browser tip on top of ours.
        expect(itemRow('fixture_cu_ore').getAttribute('title')).toBeNull();
    });

    it('an item still waiting on the mat keeps a small mark; the others have none', () => {
        start();
        finish(fullResult());
        expect(itemRow('fixture_cu_pelt').querySelector('[data-summary-on-mat]')).not.toBeNull();
        expect(itemRow('fixture_cu_pelt').querySelector('[data-summary-on-mat]').getAttribute('aria-label')).toBe('Waiting on the mat');
        for (const id of ['fixture_cu_ore', 'fixture_cu_log', 'fixture_cu_seed']) {
            expect(itemRow(id).querySelector('[data-summary-on-mat]'), id).toBeNull();
        }
    });

    it('knock-outs say how many times and what they cost; the Bank refusing items, recipes and first finds as before', () => {
        start();
        finish(fullResult());
        const ko = q('[data-summary-section="knockouts"] [data-hero-id="h2"]');
        expect(barText(ko)).toEqual({ name: 'Bram', short: '×2', exact: null });
        expect(ko.textContent).toContain('Lost: Copper Sword');
        expect(ko.querySelector('[data-glyph="down"]')).not.toBeNull();
        const recipe = (id) => barText(q(`[data-summary-section="recipes"] [data-recipe-id="${id}"]`));
        expect(recipe('r_cu_bar')).toEqual({ name: 'Fixture Bar', short: 'Aela', exact: null });
        expect(recipe('r_cu_plank')).toEqual({ name: 'Fixture Plank', short: 'Aela', exact: null });
        expect(bar('finds', 'data-item-id', 'fixture_cu_pelt')).toEqual({ name: 'Fixture Pelt', short: '+9', exact: '+9' });
        expect(bar('bankFull', 'data-item-id', 'fixture_cu_log')).toEqual({ name: 'Fixture Log', short: null, exact: null });
    });

    it('a knock-out the news did not hear still shows, from the fights\' own count', () => {
        start();
        const r = emptyResult();
        r.summary.wounded = [{ heroId: 'h1', heroName: 'Aela', times: 1 }];
        finish(r);
        expect(barText(q('[data-summary-section="knockouts"] [data-hero-id="h1"]'))).toEqual({ name: 'Aela', short: '×1', exact: null });
        expect(sectionsIn('news')).toEqual(['knockouts']);
    });

    it('level-ups and Tokens used up', () => {
        start();
        finish(fullResult());
        const level = (hero, skill) => barText(q(`[data-summary-hero="${hero}"][data-skill-id="${skill}"]`));
        expect(level('h1', 'mining')).toEqual({ name: 'Aela Mining', short: '50 → 51', exact: null });
        expect(level('h1', 'logging')).toEqual({ name: 'Aela Logging', short: '12 → 15', exact: null });
        expect(level('h2', 'melee')).toEqual({ name: 'Bram Melee', short: '3 → 4', exact: null });
        expect(bar('depleted', 'data-type-id', 'fixture_cu_rock')).toEqual({ name: 'Fixture Rock', short: '×3', exact: '×3' });
    });

    it('the fights are only each enemy and its kill count, most first; won, lost, used and drops are gone', () => {
        start();
        finish(fullResult());
        const kills = [...q('[data-summary-section="kills"]').querySelectorAll('[data-item-bar]')];
        expect(kills.map(barText)).toEqual([
            { name: 'Fixture Wolf', short: '×9', exact: '×9' },
            { name: 'Fixture Rock', short: '×2', exact: '×2' }
        ]);
        expect(kills[0].getAttribute('title')).toBe('Fixture Wolf: beaten 9 times');
        expect(kills[0].querySelector('[data-item-bar-sprite] img')).not.toBeNull();
        const panel = q('[data-catch-up-summary]').textContent;
        for (const gone of ['won', 'lost ·', 'Used', 'Drops', 'Fixture Meal', 'Fixture Elixir']) expect(panel).not.toContain(gone);
        expect(q('[data-summary-fight-tally]')).toBeNull();
        expect(q('[data-summary-pill]')).toBeNull();
    });

    it('a return with nothing to say: both columns say so in one muted line, and no zeros', () => {
        start(45 * MIN);
        finish(emptyResult());
        expect(text('[data-summary-away]')).toBe('You were away 45 min');
        expect(sectionsIn('items')).toEqual(['items']);
        expect(sectionsIn('news')).toEqual(['news']);
        expect(text('[data-summary-column="items"] [data-summary-empty]')).toBe('No items gained or spent.');
        expect(text('[data-summary-column="news"] [data-summary-empty]')).toBe('No other news.');
        expect(q('[data-catch-up-summary] [data-item-bar]')).toBeNull();
        expect(q('[data-catch-up-summary]').textContent).not.toMatch(/\b0\b/);
    });

    it('a section with nothing is left out', () => {
        start();
        const r = emptyResult();
        r.summary.levelUps = [{ heroId: 'h1', heroName: 'Aela', skillId: 'mining', skillName: 'Mining', from: 3, to: 4 }];
        finish(r);
        expect(sectionsIn('news')).toEqual(['levels']);
    });

    it('says how much past the 24 h cap was not played', () => {
        start(30 * HOUR);
        finish({ ...emptyResult(), awayMs: 30 * HOUR, simulatedMs: 24 * HOUR, droppedMs: 6 * HOUR });
        expect(text('[data-summary-away]')).toBe('You were away 30 h');
        expect(text('[data-summary-dropped]')).toBe('6 h past the 24 h limit was skipped.');
    });

    it('nothing else closes it: a click on the backdrop or the panel leaves it', () => {
        start();
        finish(fullResult());
        act(() => { fireEvent.click(q('[data-catch-up-overlay]')); });
        act(() => { fireEvent.click(q('[data-catch-up-summary]')); });
        act(() => { fireEvent.keyDown(window, { key: 'Enter' }); });
        expect(q('[data-catch-up-summary]')).not.toBeNull();
    });

    it('a silent catch-up finishing does not replace a summary already open', () => {
        start();
        finish(fullResult());
        start(90 * 1000, false);
        finish({ ...emptyResult(), awayMs: 90 * 1000, show: false });
        expect(text('[data-summary-away]')).toBe('You were away 3 h 12 min');
    });
});

describe('the summary\'s Item Bars and columns', () => {
    const bars = () => [...document.querySelectorAll('[data-catch-up-summary] [data-item-bar]')];

    it('every item, knock-out, Token, level-up and enemy is an Item Bar, one per line', () => {
        start();
        finish(fullResult());
        for (const section of document.querySelectorAll('[data-summary-section]')) {
            const id = section.getAttribute('data-summary-section');
            const list = section.querySelector('[data-summary-list]');
            expect(list.className, id).not.toMatch(/\bgrid\b/);
            expect(list.children.length, id).toBeGreaterThan(0);
            for (const child of list.children) expect(child.hasAttribute('data-item-bar'), id).toBe(true);
        }
        // 4 items; 1 knock-out, 1 Bank full, 2 recipes, 1 first find, 3 level-ups, 1 used up, 2 enemies.
        expect(bars()).toHaveLength(15);
    });

    it('an item\'s bar is the Token inspection\'s: its sprite zooms on hover, its count is short until hovered', () => {
        start();
        finish(fullResult());
        const ore = q('[data-summary-section="items"] [data-item-id="fixture_cu_ore"]');
        expect(ore.className).toMatch(/(^|\s)group(\s|$)/);
        const sprite = ore.querySelector('[data-item-bar-sprite]');
        expect(sprite.className).toContain('group-hover:scale-[2]');
        expect(sprite.querySelector('img')).not.toBeNull();
        const classes = (el) => el.className.split(/\s+/);
        const short = ore.querySelector('[data-item-bar-count]');
        const exact = ore.querySelector('[data-item-bar-count-exact]');
        expect(classes(short)).toContain('group-hover:opacity-0');
        expect(classes(exact)).toContain('opacity-0');
        expect(classes(exact)).toContain('group-hover:opacity-100');
    });

    it('wider than before, each column its own arrow list with no scroll bar', () => {
        start();
        finish(fullResult());
        const panel = q('[data-catch-up-summary]');
        const width = Number(panel.className.match(/\bw-\[(\d+)rem\]/)?.[1]);
        // Two columns of about the old one's width, and under 1366 px wide at 16 px a rem.
        expect(width).toBeGreaterThanOrEqual(48);
        expect(width * 16).toBeLessThan(1366 - 32);
        expect(panel.className).toContain('max-w-full');
        for (const id of ['items', 'news']) {
            const list = q(`[data-summary-column="${id}"] [data-scroll-list]`);
            expect(list, id).not.toBeNull();
            expect(list.className, id).toContain('[scrollbar-width:none]');
            expect(list.className, id).toContain('min-h-0');
            // Room on every side for a hovered sprite's zoom, which the scrolling list would clip.
            expect(list.className, id).toMatch(/\bpx-3\b/);
            expect(list.className, id).toMatch(/\bpb-3\b/);
        }
        expect(q('[data-catch-up-summary] .custom-scrollbar')).toBeNull();
    });

    it('slide in one after another, and the entrance classes come off once it has played', () => {
        vi.useFakeTimers();
        start();
        finish(fullResult());
        const animated = () => document.querySelectorAll('[data-catch-up-summary] .catch-up-row-in');
        // The bars and the 8 headings.
        expect(animated().length).toBe(bars().length + 8);
        const delays = bars().map(r => parseFloat(r.style.animationDelay));
        expect(delays[1]).toBeGreaterThan(delays[0]);
        expect(delays[2]).toBeGreaterThan(delays[1]);
        act(() => { vi.advanceTimersByTime(5000); });
        expect(animated().length).toBe(0);
        expect(bars().every(r => !r.style.animationDelay)).toBe(true);
        expect(bars()).toHaveLength(15);
    });
});

describe('the buttons', () => {
    it('stacked: Return to the Guild first and primary, Load as I left it below it', () => {
        start();
        finish(fullResult());
        const close = q('[data-summary-close]');
        const undo = q('[data-summary-undo]');
        expect(close.textContent).toBe('Return to the Guild');
        expect(undo.textContent).toBe('Load as I left it');
        const closeFrame = close.closest('[data-kit-button]');
        const undoFrame = undo.closest('[data-kit-button]');
        const stack = closeFrame.parentElement;
        expect(undoFrame.parentElement).toBe(stack);
        expect(stack.className).toMatch(/\bflex-col\b/);
        expect([...stack.children]).toEqual([closeFrame, undoFrame]);
        expect(closeFrame.getAttribute('data-kit-button')).toBe('main');
        expect(undoFrame.getAttribute('data-kit-button')).toBe('plain');
        expect(document.activeElement).toBe(close);
    });

    it('Load as I left it is not offered when there is nothing to go back to', () => {
        vi.mocked(CatchUp.canUndo).mockReturnValue(false);
        start();
        finish(fullResult());
        expect(q('[data-summary-undo]')).toBeNull();
        expect(q('[data-summary-close]')).not.toBeNull();
    });

    it('the loading bar still offers no button at all', () => {
        start();
        expect(q('[data-summary-undo]')).toBeNull();
        expect(q('[data-catch-up-overlay] button')).toBeNull();
    });
});

describe('"Return to the Guild" asks first, in plain words', () => {
    const askToReturn = () => {
        start();
        finish(fullResult());
        act(() => { fireEvent.click(q('[data-summary-close]')); });
    };

    it('one click only asks: nothing closes, nothing is let go', () => {
        askToReturn();
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
        const ask = q('[data-summary-confirm="return"]');
        expect(ask.getAttribute('role')).toBe('alertdialog');
        expect(ask.textContent).toContain('Everything from your time away is kept.');
        expect(ask.textContent).not.toMatch(/lost/i);
        expect(q('[data-summary-confirm-yes]').textContent).toBe('Return to the Guild');
        expect(q('[data-summary-confirm-yes]').closest('[data-kit-button]').getAttribute('data-kit-button')).toBe('main');
        // Going on loses nothing, so Enter goes on.
        expect(document.activeElement).toBe(q('[data-summary-confirm-yes]'));
    });

    it('Cancel puts the two buttons back', () => {
        askToReturn();
        act(() => { fireEvent.click(q('[data-summary-confirm-no]')); });
        expect(q('[data-summary-confirm]')).toBeNull();
        expect(q('[data-summary-close]')).not.toBeNull();
        expect(q('[data-summary-undo]')).not.toBeNull();
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
    });

    it('confirming closes it, keeps the catch-up and only then lets the banners come', () => {
        const closed = vi.fn();
        const off = EventBus.subscribe(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED, closed);
        try {
            askToReturn();
            expect(closed).not.toHaveBeenCalled();
            act(() => { fireEvent.click(q('[data-summary-confirm-yes]')); });
            expect(q('[data-catch-up-summary]')).toBeNull();
            expect(CatchUp.undoLast).not.toHaveBeenCalled();
            expect(CatchUp.forgetUndo).toHaveBeenCalledTimes(1);
            expect(closed).toHaveBeenCalledTimes(1);
        } finally {
            off();
        }
    });

    it('Esc asks the same as Return; a second Esc cancels the question', () => {
        start();
        finish(fullResult());
        escape();
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        expect(q('[data-summary-confirm="return"]')).not.toBeNull();
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
        escape();
        expect(q('[data-summary-confirm]')).toBeNull();
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        // Esc, then Return confirms it.
        escape();
        act(() => { fireEvent.click(q('[data-summary-confirm-yes]')); });
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(CatchUp.undoLast).not.toHaveBeenCalled();
    });
});

describe('"Load as I left it" asks first, keeping today\'s warning', () => {
    const askToUndo = () => {
        start();
        finish(fullResult());
        act(() => { fireEvent.click(q('[data-summary-undo]')); });
    };

    it('one click only asks, with two choices; nothing is thrown away yet', () => {
        askToUndo();
        expect(CatchUp.undoLast).not.toHaveBeenCalled();
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
        const ask = q('[data-summary-confirm="undo"]');
        expect(ask.getAttribute('role')).toBe('alertdialog');
        expect(ask.textContent).toContain('Load the game as you left it? Everything from your time away is lost.');
        expect(ask.querySelectorAll('button')).toHaveLength(2);
        expect(q('[data-summary-confirm-yes]').closest('[data-kit-button]').getAttribute('data-kit-button')).toBe('danger');
        // The safe choice has the focus, so a stray Enter cancels.
        expect(document.activeElement).toBe(q('[data-summary-confirm-no]'));
        expect(q('[data-catch-up-summary]')).not.toBeNull();
    });

    it('Cancel does nothing but put the two buttons back', () => {
        askToUndo();
        act(() => { fireEvent.click(q('[data-summary-confirm-no]')); });
        expect(q('[data-summary-confirm]')).toBeNull();
        expect(q('[data-summary-undo]')).not.toBeNull();
        expect(q('[data-summary-close]')).not.toBeNull();
        expect(CatchUp.undoLast).not.toHaveBeenCalled();
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
    });

    it('Esc cancels the question, and only the question', () => {
        askToUndo();
        escape();
        expect(q('[data-summary-confirm]')).toBeNull();
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        expect(CatchUp.undoLast).not.toHaveBeenCalled();
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
    });

    it('confirming turns the catch-up down', () => {
        askToUndo();
        act(() => { fireEvent.click(q('[data-summary-confirm-yes]')); });
        expect(CatchUp.undoLast).toHaveBeenCalledTimes(1);
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
    });
});

describe('how an item\'s net is reckoned (itemChanges)', () => {
    it('the Bank and the mat add up; loot carried from the mat to the Bank counts once', () => {
        // 10 lay on the mat before and were carried in; 4 more were made and banked.
        expect(itemChanges({ gained: { fixture_cu_ore: 14 }, net: { fixture_cu_ore: 14 }, floor: { fixture_cu_ore: -10 } }))
            .toEqual([{ itemId: 'fixture_cu_ore', name: 'Fixture Ore', net: 4, gained: 4, spent: 0, onMat: 0 }]);
    });

    it('loot left on the mat is a gain, marked as waiting there', () => {
        expect(itemChanges({ floor: { fixture_cu_pelt: 30 } }))
            .toEqual([{ itemId: 'fixture_cu_pelt', name: 'Fixture Pelt', net: 30, gained: 30, spent: 0, onMat: 30 }]);
    });

    it('a Bank path that announces nothing: the totals say what came in or went out', () => {
        // Announced 40 in, but the Bank holds 55 more.
        expect(itemChanges({ gained: { fixture_cu_log: 40 }, net: { fixture_cu_log: 55 } })[0])
            .toMatchObject({ net: 55, gained: 55, spent: 0 });
        // Announced 40 in, but the Bank holds only 25 more: 15 went out unannounced.
        expect(itemChanges({ gained: { fixture_cu_log: 40 }, net: { fixture_cu_log: 25 } })[0])
            .toMatchObject({ net: 25, gained: 40, spent: 15 });
        // Nothing announced, the Bank 12 down.
        expect(itemChanges({ net: { fixture_cu_seed: -12 } })[0]).toMatchObject({ net: -12, gained: 0, spent: 12 });
    });

    it('gained − spent is always the net; an item gained and spent evenly shows ±0, last', () => {
        const rows = itemChanges({
            gained: { fixture_cu_ore: 100, fixture_cu_log: 5 },
            spent: { fixture_cu_ore: 100, fixture_cu_seed: 3 },
            net: { fixture_cu_log: 5, fixture_cu_seed: -3 },
            floor: { fixture_cu_pelt: 2 }
        });
        expect(rows.map(r => [r.itemId, r.net])).toEqual([
            ['fixture_cu_log', 5], ['fixture_cu_pelt', 2], ['fixture_cu_seed', -3], ['fixture_cu_ore', 0]
        ]);
        for (const r of rows) expect(r.gained - r.spent, r.itemId).toBe(r.net);
        expect(rows.at(-1)).toMatchObject({ gained: 100, spent: 100 });
    });

    it('nothing moved, nothing listed', () => {
        expect(itemChanges({})).toEqual([]);
        expect(itemChanges({ gained: {}, spent: {}, net: {}, floor: {} })).toEqual([]);
    });
});

describe('the wording of time away', () => {
    it('minutes, hours, hours and minutes', () => {
        expect(formatAway(45 * MIN + 59 * 1000)).toBe('45 min');
        expect(formatAway(3 * HOUR)).toBe('3 h');
        expect(formatAway(3 * HOUR + 12 * MIN)).toBe('3 h 12 min');
        expect(formatAway(30 * HOUR)).toBe('30 h');
        expect(formatAway(20 * 1000)).toBe('less than a minute');
        expect(catchUpTitle(2 * MIN)).toBe('Catching up on 2 min away');
    });

    it('the capped case', () => {
        expect(summaryView({ awayMs: 30 * HOUR, droppedMs: 6 * HOUR, summary: null }).droppedText)
            .toBe('6 h past the 24 h limit was skipped.');
        expect(summaryView({ awayMs: 3 * HOUR, droppedMs: 0, summary: null }).droppedText).toBeNull();
    });
});

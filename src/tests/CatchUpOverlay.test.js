// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, HEARD_WHILE_QUIET } from '../systems/core/engineEvents.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { CatchUpOverlay } from '../ui/components/hud/CatchUpOverlay.jsx';
import { formatAway, summaryView, catchUpTitle } from '../ui/components/hud/catchUpSummary.js';
import * as CatchUp from '../systems/core/CatchUp.js';

// The summary's undo button asks the catch-up driver; here it is a stand-in.
vi.mock('../systems/core/CatchUp.js', () => ({
    canUndo: vi.fn(() => true),
    undoLast: vi.fn(() => true),
    forgetUndo: vi.fn()
}));

/**
 * The catch-up's loading bar and the "While you were away" summary: shown only for a catch-up
 * long enough to `show`, driven by the catch-up's own events, and closed only by the player.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_cu_ore: item('fixture_cu_ore', 'Fixture Ore'),
    fixture_cu_log: item('fixture_cu_log', 'Fixture Log'),
    fixture_cu_seed: item('fixture_cu_seed', 'Fixture Seed'),
    fixture_cu_pelt: item('fixture_cu_pelt', 'Fixture Pelt')
});
const token = (id, name) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5, sprite: 'skill_nature'
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
            spent: { fixture_cu_seed: 12 },
            // The Bank's own difference: more logs than were announced (a silent Bank path).
            net: { fixture_cu_ore: 5900, fixture_cu_log: 55, fixture_cu_seed: -12 },
            floor: { fixture_cu_pelt: 7, fixture_cu_log: -3 }
        },
        levelUps: [
            { heroId: 'h1', heroName: 'Aela', skillId: 'mining', skillName: 'Mining', from: 50, to: 51 },
            { heroId: 'h1', heroName: 'Aela', skillId: 'logging', skillName: 'Logging', from: 12, to: 15 },
            { heroId: 'h2', heroName: 'Bram', skillId: 'melee', skillName: 'Melee', from: 3, to: 4 }
        ],
        depleted: { total: 3, byType: { fixture_cu_rock: 3 } },
        wounded: [{ heroId: 'h2', heroName: 'Bram', times: 2 }],
        fightsWon: { total: 9, byEnemy: { fixture_cu_wolf: 9 } }
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
    it('renders every section from a full result', () => {
        start();
        finish(fullResult());
        expect(text('[data-summary-away]')).toBe('You were away 3 h 12 min.');
        expect(q('[data-summary-dropped]')).toBeNull();

        // The Bank's gain: announced amounts, raised to the Bank's own difference where that is more.
        expect(bar('gained', 'data-item-id', 'fixture_cu_ore')).toEqual({ name: 'Fixture Ore', short: '+5.9k', exact: '+5,900' });
        expect(bar('gained', 'data-item-id', 'fixture_cu_log')).toEqual({ name: 'Fixture Log', short: '+55', exact: '+55' });
        // Loot left on the mat; loot that left the mat is not a gain.
        expect(bar('waiting', 'data-item-id', 'fixture_cu_pelt')).toEqual({ name: 'Fixture Pelt', short: '+7', exact: '+7' });
        expect(q('[data-summary-section="waiting"] [data-item-id="fixture_cu_log"]')).toBeNull();

        expect(bar('spent', 'data-item-id', 'fixture_cu_seed')).toEqual({ name: 'Fixture Seed', short: '−12', exact: '−12' });

        // One bar per hero and skill.
        const level = (hero, skill) => barText(q(`[data-summary-hero="${hero}"][data-skill-id="${skill}"]`));
        expect(level('h1', 'mining')).toEqual({ name: 'Aela Mining', short: '50 → 51', exact: null });
        expect(level('h1', 'logging')).toEqual({ name: 'Aela Logging', short: '12 → 15', exact: null });
        expect(level('h2', 'melee')).toEqual({ name: 'Bram Melee', short: '3 → 4', exact: null });

        expect(bar('depleted', 'data-type-id', 'fixture_cu_rock')).toEqual({ name: 'Fixture Rock', short: '×3', exact: '×3' });
        expect(bar('wounded', 'data-hero-id', 'h2')).toEqual({ name: 'Bram', short: '×2', exact: '×2' });
        expect(bar('fights', 'data-type-id', 'fixture_cu_wolf')).toEqual({ name: 'Fixture Wolf', short: '×9', exact: '×9' });
    });

    it('headings in plain words', () => {
        start();
        finish(fullResult());
        const headings = [...document.querySelectorAll('[data-summary-section]')]
            .map(s => [s.getAttribute('data-summary-section'), s.querySelector('[data-summary-heading]')?.textContent]);
        expect(headings).toEqual([
            ['waiting', 'Items produced'],
            ['gained', 'Items banked'],
            ['spent', 'Items spent'],
            ['levels', 'Level-ups'],
            ['depleted', 'Tokens used up'],
            ['wounded', 'Heroes wounded'],
            ['fights', 'Fights won']
        ]);
        expect(text('[data-catch-up-summary] [role="heading"]')).toBe('While you were away');
    });

    it('leaves empty sections out instead of showing zeros', () => {
        start(45 * MIN);
        finish(emptyResult());
        expect(text('[data-summary-away]')).toBe('You were away 45 min.');
        expect(document.querySelectorAll('[data-summary-section]').length).toBe(0);
        expect(q('[data-catch-up-summary]').textContent).not.toMatch(/\b0\b/);
    });

    it('says how much past the 24 h cap was not played', () => {
        start(30 * HOUR);
        finish({ ...emptyResult(), awayMs: 30 * HOUR, simulatedMs: 24 * HOUR, droppedMs: 6 * HOUR });
        expect(text('[data-summary-away]')).toBe('You were away 30 h.');
        expect(text('[data-summary-dropped]')).toBe('6 h past the 24 h limit was skipped.');
    });

    it('closes with its button', () => {
        start();
        finish(fullResult());
        act(() => { fireEvent.click(q('[data-summary-close]')); });
        expect(q('[data-catch-up-summary]')).toBeNull();
    });

    it('closes with Esc, which means Return to the Guild: nothing is undone', () => {
        start();
        finish(fullResult());
        escape();
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(CatchUp.undoLast).not.toHaveBeenCalled();
        expect(CatchUp.forgetUndo).toHaveBeenCalledTimes(1);
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
        expect(text('[data-summary-away]')).toBe('You were away 3 h 12 min.');
    });
});

describe('the summary\'s Item Bars', () => {
    const bars = () => [...document.querySelectorAll('[data-catch-up-summary] [data-item-bar]')];

    it('every item, Token, level-up, wound and fight is an Item Bar, one per line', () => {
        start();
        finish(fullResult());
        const sections = ['waiting', 'gained', 'spent', 'levels', 'depleted', 'wounded', 'fights'];
        for (const id of sections) {
            const list = q(`[data-summary-section="${id}"] [data-summary-list]`);
            expect(list, id).not.toBeNull();
            // One column: no grid splitting the bars into two.
            expect(list.className, id).not.toMatch(/\bgrid\b/);
            expect(list.children.length, id).toBeGreaterThan(0);
            for (const child of list.children) expect(child.hasAttribute('data-item-bar'), id).toBe(true);
        }
        // 1 waiting, 2 gained, 1 spent, 3 level-ups, 1 depleted, 1 wounded, 1 fight.
        expect(bars()).toHaveLength(10);
        // The old bespoke row is gone.
        expect(q('[data-catch-up-summary] [data-item-row]')).toBeNull();
    });

    it('an item\'s bar is the Token inspection\'s: its sprite zooms on hover, its count is short until hovered', () => {
        start();
        finish(fullResult());
        const ore = q('[data-summary-section="gained"] [data-item-id="fixture_cu_ore"]');
        expect(ore.hasAttribute('data-item-bar')).toBe(true);
        // The hover is the bar's own (`group`): the sprite doubles, the counts swap.
        expect(ore.className).toMatch(/(^|\s)group(\s|$)/);
        const sprite = ore.querySelector('[data-item-bar-sprite]');
        expect(sprite.className).toContain('group-hover:scale-[2]');
        expect(sprite.querySelector('img')).not.toBeNull();

        const short = ore.querySelector('[data-item-bar-count]');
        const exact = ore.querySelector('[data-item-bar-count-exact]');
        expect(short.textContent).toBe('+5.9k');
        expect(exact.textContent).toBe('+5,900');
        // At rest the short count shows and the exact one is hidden; hovered, the other way round.
        const classes = (el) => el.className.split(/\s+/);
        expect(classes(short)).not.toContain('opacity-0');
        expect(classes(short)).toContain('group-hover:opacity-0');
        expect(classes(exact)).toContain('opacity-0');
        expect(classes(exact)).toContain('group-hover:opacity-100');
    });

    it('the bars are wider here than in the Token inspection, inside a list that scrolls', () => {
        start();
        finish(fullResult());
        const panel = q('[data-catch-up-summary]');
        expect(panel.className).toMatch(/w-\[2[6-9]rem\]|w-\[3\drem\]/);
        const body = q('[data-summary-body]');
        expect(body.className).toContain('overflow-y-auto');
        expect(body.className).toContain('min-h-0');
        // Room on every side for a hovered sprite's zoom, which the scrolling list would clip.
        expect(body.className).toMatch(/\bpx-3\b/);
    });

    it('Tokens used up and fights show the Token\'s sprite; level-ups the skill\'s icon', () => {
        start();
        finish(fullResult());
        const rock = q('[data-summary-section="depleted"] [data-type-id="fixture_cu_rock"]');
        expect(rock.querySelector('[data-item-bar-sprite] img')).not.toBeNull();
        const wolf = q('[data-summary-section="fights"] [data-type-id="fixture_cu_wolf"]');
        expect(wolf.querySelector('[data-item-bar-sprite] img')).not.toBeNull();
        const mining = q('[data-summary-hero="h1"][data-skill-id="mining"]');
        expect(mining.hasAttribute('data-item-bar')).toBe(true);
        expect(mining.querySelector('[data-item-bar-sprite]')).not.toBeNull();
        expect(q('[data-summary-section="wounded"] [data-hero-id="h2"] [data-item-bar-sprite]')).not.toBeNull();
    });

    it('slide in one after another, and the entrance classes come off once it has played', () => {
        vi.useFakeTimers();
        start();
        finish(fullResult());
        const animated = () => document.querySelectorAll('[data-catch-up-summary] .catch-up-row-in');
        expect(animated().length).toBe(bars().length + 7);          // the bars and the 7 headings
        const delays = bars().map(r => parseFloat(r.style.animationDelay));
        expect(delays[1]).toBeGreaterThan(delays[0]);
        expect(delays[2]).toBeGreaterThan(delays[1]);
        act(() => { vi.advanceTimersByTime(5000); });
        expect(animated().length).toBe(0);
        expect(bars().every(r => !r.style.animationDelay)).toBe(true);
        expect(bars()).toHaveLength(10);
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
        const stack = close.parentElement;
        expect(undo.parentElement).toBe(stack);
        expect(stack.className).toMatch(/\bflex-col\b/);
        expect([...stack.children]).toEqual([close, undo]);
        // The primary choice wears the gold; the other does not.
        expect(close.className).toContain('bg-gi-gold');
        expect(undo.className).not.toContain('gi-gold');
        expect(document.activeElement).toBe(close);
    });

    it('Return to the Guild keeps the catch-up and lets the undo go', () => {
        start();
        finish(fullResult());
        act(() => { fireEvent.click(q('[data-summary-close]')); });
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(CatchUp.undoLast).not.toHaveBeenCalled();
        expect(CatchUp.forgetUndo).toHaveBeenCalledTimes(1);
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

describe('"Load as I left it" asks first', () => {
    const askToUndo = () => {
        start();
        finish(fullResult());
        act(() => { fireEvent.click(q('[data-summary-undo]')); });
    };

    it('one click only asks, with two choices; nothing is thrown away yet', () => {
        askToUndo();
        expect(CatchUp.undoLast).not.toHaveBeenCalled();
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
        const ask = q('[data-summary-confirm]');
        expect(ask).not.toBeNull();
        expect(ask.getAttribute('role')).toBe('alertdialog');
        expect(ask.querySelectorAll('button')).toHaveLength(2);
        expect(q('[data-summary-confirm-yes]')).not.toBeNull();
        expect(q('[data-summary-confirm-no]')).not.toBeNull();
        // The safe choice has the focus, so a stray Enter cancels.
        expect(document.activeElement).toBe(q('[data-summary-confirm-no]'));
        // The summary stays open behind its question.
        expect(q('[data-catch-up-summary]')).not.toBeNull();
    });

    it('Cancel does nothing but put the two buttons back', () => {
        askToUndo();
        act(() => { fireEvent.click(q('[data-summary-confirm-no]')); });
        expect(q('[data-summary-confirm]')).toBeNull();
        expect(q('[data-catch-up-summary]')).not.toBeNull();
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
        // A second Esc is Return to the Guild again.
        escape();
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(CatchUp.forgetUndo).toHaveBeenCalledTimes(1);
    });

    it('confirming turns the catch-up down', () => {
        askToUndo();
        act(() => { fireEvent.click(q('[data-summary-confirm-yes]')); });
        expect(CatchUp.undoLast).toHaveBeenCalledTimes(1);
        expect(CatchUp.forgetUndo).not.toHaveBeenCalled();
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

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, HEARD_WHILE_QUIET } from '../systems/core/engineEvents.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { CatchUpOverlay } from '../ui/components/hud/CatchUpOverlay.jsx';
import { formatAway, summaryView, catchUpTitle } from '../ui/components/hud/catchUpSummary.js';

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
            gained: { fixture_cu_ore: 1154, fixture_cu_log: 40 },
            spent: { fixture_cu_seed: 12 },
            // The Bank's own difference: more logs than were announced (a silent Bank path).
            net: { fixture_cu_ore: 1154, fixture_cu_log: 55, fixture_cu_seed: -12 },
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

beforeEach(() => { render(React.createElement(CatchUpOverlay)); });
afterEach(() => { cleanup(); EventBus.setQuiet(false); });

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
        expect(text('[data-summary-section="gained"] [data-item-id="fixture_cu_ore"]')).toBe('Fixture Ore +1,154');
        expect(text('[data-summary-section="gained"] [data-item-id="fixture_cu_log"]')).toBe('Fixture Log +55');
        // Loot left on the mat, labelled as such; loot that left the mat is not a gain.
        expect(text('[data-summary-section="waiting"]')).toContain('waiting on the mat');
        expect(text('[data-summary-section="waiting"] [data-item-id="fixture_cu_pelt"]')).toBe('Fixture Pelt +7');
        expect(q('[data-summary-section="waiting"] [data-item-id="fixture_cu_log"]')).toBeNull();

        expect(text('[data-summary-section="spent"] [data-item-id="fixture_cu_seed"]')).toBe('Fixture Seed −12');

        expect(text('[data-summary-hero="h1"]')).toBe('Aela Mining 50 → 51 Logging 12 → 15');
        expect(text('[data-summary-hero="h2"]')).toBe('Bram Melee 3 → 4');

        expect(text('[data-summary-section="depleted"] [data-type-id="fixture_cu_rock"]')).toBe('Fixture Rock ×3');
        expect(text('[data-summary-section="wounded"] [data-hero-id="h2"]')).toBe('Bram ×2');
        expect(text('[data-summary-section="fights"]')).toContain('Fights won 9');
        expect(text('[data-summary-section="fights"] [data-type-id="fixture_cu_wolf"]')).toBe('Fixture Wolf ×9');
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
        expect(text('[data-summary-dropped]')).toBe('6 h of it, beyond the 24 h cap, was not played.');
    });

    it('closes with its button', () => {
        start();
        finish(fullResult());
        act(() => { fireEvent.click(q('[data-summary-close]')); });
        expect(q('[data-catch-up-summary]')).toBeNull();
    });

    it('closes with Esc', () => {
        start();
        finish(fullResult());
        escape();
        expect(q('[data-catch-up-summary]')).toBeNull();
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
            .toBe('6 h of it, beyond the 24 h cap, was not played.');
        expect(summaryView({ awayMs: 3 * HOUR, droppedMs: 0, summary: null }).droppedText).toBeNull();
    });
});

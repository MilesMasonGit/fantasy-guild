// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { kitPanelView } from './fixtures/combatKit.js';

/**
 * The combat screen's look: every health bar green, amber or red by health; the fight window and
 * the mat showing a hit with one set of colours, icons and lengths; and every hero whose fight
 * window is open showing an open fight button.
 */

const moments = new Set();
vi.mock('../ui/components/combat/fightWatch.js', async (importOriginal) => ({
    ...(await importOriginal()),
    subscribeMoments: (fn) => { moments.add(fn); return () => moments.delete(fn); }
}));
const say = (m) => act(() => { for (const fn of [...moments]) fn({ heroId: 'kit_aela', instanceId: 'kit_warlord', ...m }); });

const { VitalBar } = await import('../ui/components/base/VitalBar.jsx');
const { HealthBar } = await import('../ui/components/board/HealthBar.jsx');
const { HP_TONES, HP_GREEN_ABOVE, HP_RED_BELOW, hpToneName } = await import('../ui/components/board/healthBar.js');
const { FightArena } = await import('../ui/components/combat/FightPanel.jsx');
const { buildFloat } = await import('../ui/components/board/fx/fightFloats.js');
const { MOMENT } = await import('../ui/components/combat/fightWatch.js');
const { LANDED_MS, MOVE_MS, HIT_ON_STRIKE_FRAME, LANDED_TONE, landedDelayMs, landedToneName, landedIcon } = await import('../ui/components/combat/hitLook.js');
const { STRIKE_DELAY_MS } = await import('../ui/components/board/hitAnimations.js');
const { CALLOUT_MS } = await import('../ui/components/board/callouts.js');
const { FightLayer } = await import('../ui/components/board/FightLayer.jsx');
const store = await import('../ui/components/combat/fightPanelStore.js');

const h = React.createElement;
const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');

afterEach(() => { cleanup(); moments.clear(); store.resetFightPanels(); });

describe('every health bar is green, amber or red by health, a hero\'s or an enemy\'s', () => {
    it('⭐ the lines: green above half, amber from a half down to a quarter, red below a quarter', () => {
        expect(HP_GREEN_ABOVE).toBe(0.5);
        expect(HP_RED_BELOW).toBe(0.25);
        expect(hpToneName(1)).toBe('green');
        expect(hpToneName(0.51)).toBe('green');
        expect(hpToneName(0.5)).toBe('amber');
        expect(hpToneName(0.25)).toBe('amber');
        expect(hpToneName(0.249)).toBe('red');
        expect(hpToneName(0)).toBe('red');
        expect(new Set(Object.values(HP_TONES).map(t => t.fill)).size).toBe(3);
    });

    it('⭐ the hero bar, the drawer, the fight window and its tabs (VitalBar) follow it', () => {
        for (const [value, tone] of [[90, 'green'], [40, 'amber'], [10, 'red']]) {
            const r = render(h(VitalBar, { value, max: 100 }));
            expect(r.container.firstChild.getAttribute('data-hp-tone')).toBe(tone);
            expect(hex(r.container.querySelector('[data-hp-fill]').style.background)).toBe(HP_TONES[tone].fill);
            cleanup();
        }
    });

    it('⭐ over the fighters on the mat (HealthBar), a hero and an enemy alike', () => {
        for (const who of ['hero', 'enemy']) {
            for (const [cur, tone] of [[30, 'green'], [12, 'amber'], [3, 'red']]) {
                const r = render(h(HealthBar, { who, cur, max: 30 }));
                expect(r.container.firstChild.getAttribute('data-health-tone')).toBe(tone);
                expect(hex(r.container.querySelector('[data-health-fill]').style.background)).toBe(HP_TONES[tone].fill);
                cleanup();
            }
        }
    });
});

describe('the fight window and the mat show a hit the same way', () => {
    const arena = () => render(h(FightArena, { view: { ...kitPanelView(), live: true } }));
    const landed = (root, on) => root.querySelector(`[data-fight-landed="${on}"]`);
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('⭐ one set of colours and icons: each moment the window shows is the mat float\'s colour and glyph', () => {
        const cases = [
            { kind: MOMENT.HIT, on: 'enemy', by: 'enemy', amount: 4 },
            { kind: MOMENT.HIT, on: 'hero', by: 'enemy', amount: 2 },
            { kind: MOMENT.MISS, on: 'hero', by: 'enemy', amount: null },
            { kind: MOMENT.HEAL, on: 'hero', by: 'status', amount: 5 },
            { kind: MOMENT.TICK, on: 'enemy', by: 'status', amount: 2, statusId: 'effect_venom' },
            { kind: MOMENT.TICK, on: 'enemy', by: 'status', amount: 1, statusId: 'effect_burn' },
            { kind: MOMENT.TICK, on: 'hero', by: 'status', amount: 1, statusId: 'effect_venom' }
        ];
        for (const m of cases) {
            const r = arena();
            say(m);
            const el = landed(r.container, m.on);
            expect(el, JSON.stringify(m)).not.toBeNull();
            const tone = LANDED_TONE[landedToneName(m)];
            const shown = el.querySelector('.ui-text-title');
            expect(shown.style.color).toBe(tone.css);
            const float = buildFloat({ heroId: 'kit_aela', instanceId: 'kit_warlord', ...m });
            expect(float.className).toContain(tone.cls);
            const icon = landedIcon(m);
            expect(el.querySelector('[data-fight-landed-icon]')?.getAttribute('data-fight-landed-icon') ?? null).toBe(icon);
            expect(float.querySelector('[data-glyph]')?.getAttribute('data-glyph') ?? null).toBe(icon);
            cleanup();
        }
    });

    it('⭐ a Venom or Burn tick on the enemy is red with its drop or flame in the window, as on the mat', () => {
        const r = arena();
        say({ kind: MOMENT.TICK, on: 'enemy', by: 'status', amount: 2, statusId: 'effect_venom' });
        const el = landed(r.container, 'enemy');
        expect(el.querySelector('.ui-text-title').style.color).toBe('var(--color-ui-red)');
        expect(el.querySelector('[data-fight-landed-icon="drop"]')).not.toBeNull();
        say({ kind: MOMENT.TICK, on: 'enemy', by: 'status', amount: 1, statusId: 'effect_burn' });
        expect(landed(r.container, 'enemy').querySelector('[data-fight-landed-icon="flame"]')).not.toBeNull();
    });

    it('⭐ one timing: a hero\'s blow shows on the strike frame, for as long as the mat\'s float; an enemy\'s at once', () => {
        expect(HIT_ON_STRIKE_FRAME).toBe(true);
        expect(landedDelayMs({ by: 'hero', on: 'enemy' })).toBe(STRIKE_DELAY_MS);
        expect(landedDelayMs({ by: 'enemy', on: 'hero' })).toBe(0);
        expect(landedDelayMs({ by: 'status', on: 'enemy' })).toBe(0);
        const r = arena();
        say({ kind: MOMENT.HIT, on: 'enemy', by: 'hero', amount: 4 });
        act(() => { vi.advanceTimersByTime(STRIKE_DELAY_MS - 1); });
        expect(landed(r.container, 'enemy')).toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
        expect(landed(r.container, 'enemy')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(LANDED_MS - 1); });
        expect(landed(r.container, 'enemy')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
        expect(landed(r.container, 'enemy')).toBeNull();

        say({ kind: MOMENT.HIT, on: 'hero', by: 'enemy', amount: 2 });
        expect(landed(r.container, 'hero')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(LANDED_MS); });
        expect(landed(r.container, 'hero')).toBeNull();
    });

    it('⭐ an enemy\'s move shows as long as the mat\'s bubble, rising and fading the same way', () => {
        expect(MOVE_MS).toBe(CALLOUT_MS);
        const r = arena();
        say({ kind: MOMENT.MOVE, on: 'enemy', by: 'enemy', move: 'Poison Shiv', special: true });
        const bubble = r.container.querySelector('[data-fight-landed-move]');
        expect(bubble.textContent).toBe('Poison Shiv');
        expect(bubble.className).toContain('callout-bubble');
        act(() => { vi.advanceTimersByTime(MOVE_MS - 1); });
        expect(r.container.querySelector('[data-fight-landed-move]')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
        expect(r.container.querySelector('[data-fight-landed-move]')).toBeNull();
    });
});

describe('every hero whose fight window is open shows an open fight button', () => {
    const fights = [
        { tokenId: 'e1', heroId: 'h1', typeId: 'token_goblin', x: 300, y: 300, hx: 200, hy: 300 },
        { tokenId: 'e2', heroId: 'h2', typeId: 'token_goblin', x: 700, y: 300, hx: 600, hy: 300 },
        { tokenId: 'e3', heroId: 'h3', typeId: 'token_goblin', x: 300, y: 700, hx: 200, hy: 700 }
    ];
    const openOn = (root) => [...root.querySelectorAll('[data-fight-chip-open="true"]')].map(b => b.getAttribute('data-fight-chip')).sort();

    it('⭐ top or not; a minimized window counts as closed', () => {
        const r = render(h(FightLayer, { fights }));
        expect(openOn(r.container)).toEqual([]);
        act(() => { store.openFightPanel('h1'); store.openFightPanel('h2'); });
        expect(openOn(r.container)).toEqual(['h1', 'h2']);
        act(() => { store.raiseFightPanel('h1'); });
        expect(openOn(r.container)).toEqual(['h1', 'h2']);
        act(() => { store.minimizeFightPanel('h1'); });
        expect(openOn(r.container)).toEqual(['h2']);
        act(() => { store.restoreFightPanel('h1'); store.closeFightPanel('h2'); });
        expect(openOn(r.container)).toEqual(['h1']);
    });

    it('the open set stays the same while a window only moves, so the mat\'s buttons do not redraw', () => {
        store.openFightPanel('h1');
        const before = store.openFightHeroes();
        store.moveFightPanel('h1', 120, 80);
        store.raiseFightPanel('h1');
        expect(store.openFightHeroes()).toBe(before);
        store.openFightPanel('h2');
        expect(store.openFightHeroes()).not.toBe(before);
    });
});

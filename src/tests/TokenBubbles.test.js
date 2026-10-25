// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { tokenStartingUses, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenBubbles, BUBBLE_TIPS } from '../ui/components/board/TokenBubbles.jsx';
import {
    cycleSecondsText, chargesFraction, ringCount, RING_D_U, RING_STROKE_U, spawnerRing, questRing,
    RING_COLOUR, bubbleSlot, SMALL_OVERHANG_U, GLIDING_RINGS
} from '../ui/components/board/ringRow.js';
import { WorkBarFill } from '../ui/components/board/WorkPlateLayer.jsx';
import { PLATE } from '../ui/components/board/workPlate.js';
import { CHARGE_FLOATERS } from '../ui/components/board/TokenBadges.jsx';
import { PROBLEM_SPRITE, SEVERITY } from '../ui/components/board/problemMark.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { STEP_MS } from '../ui/components/board/frameClock.js';
import { boardScaleAt } from '../ui/components/base/TokenSprite.jsx';
import { restHover } from './fixtures/hoverRest.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The mat layer (brief 120, C1): at rest a Token nobody works shows what is wrong (one problem
 * mark) and nothing else; the rings and the timer come up only on hover. A worked Token's cycle,
 * charges and problem are on its work plate (`WorkPlate.test.js`): its own box draws none of them,
 * but it still keeps the bar's model, which the plate's fill draws (here: `WorkBarFill` beside it).
 * Where each piece sits, when it shows, that the hover rings still glide, the tooltips, and that
 * pressing any of them grabs the Token.
 */

registerTokenTypes({
    fixture_b13_sapling: {
        id: 'fixture_b13_sapling', name: 'Fixture B1.3 Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature'
    },
    fixture_b13_forest: {
        id: 'fixture_b13_forest', name: 'Fixture B1.3 Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
        spawner: { spawns: [{ typeId: 'fixture_b13_sapling', weight: 1 }], allowance: 5, intervalMs: 1000 }
    },
    fixture_bub_grower: {
        id: 'fixture_bub_grower', name: 'Fixture Grower', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        grows: { into: 'fixture_b13_sapling', afterMs: 60000 }
    }
});

const h = React.createElement;
const tree = (...els) => h(DndContext, null, h('div', { 'data-under-test': '' }, ...els));
const mount = (el) => render(tree(el));

const worked = (extra = {}) => ({ typeId: 'fixture_producer', instanceId: 'tok_r', heroId: 'hero_1', alert: null, usesRemaining: null, ...extra });
const bub = (props) => h(TokenBubbles, { instanceId: 'tok_r', boxPx: 128, ...props });
/** The Token's bubbles with its plate's fill beside them, as on the mat. */
const withFill = (props, blocked = false) => [
    h(TokenBubbles, { key: 'b', instanceId: 'tok_r', boxPx: 128, ...props }),
    h(WorkBarFill, { key: 'f', instanceId: 'tok_r', blocked })
];
const ring = (c, kind) => c.querySelector(`[data-ring="${kind}"]`);
const bubble = (c, kind) => c.querySelector(`[data-bubble="${kind}"]`);
const bar = (c) => c.querySelector('[data-work-bar]');
const mark = (c) => c.querySelector('[data-problem-mark]');
const progress = (p) => act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_r', ...p }); });
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
/** Past the next step of the shared step clock (its timer, then its frame). */
const step = () => advance(STEP_MS + 20);
/** Every element the Token's bubbles drew (dnd-kit's own announcer left out). */
const drawn = (c) => [...c.querySelector('[data-under-test]').querySelectorAll('*')];

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the rules, pure', () => {
    it('the cycle number is whole seconds left, rounded up, never 0s while running (the inspection’s)', () => {
        expect(cycleSecondsText(0, 3000)).toBe('3s');
        expect(cycleSecondsText(1000, 3000)).toBe('2s');
        expect(cycleSecondsText(3000, 3000)).toBe('1s');
        expect(cycleSecondsText(0, null)).toBe('');
    });

    it('charges: left over starting, clamped to 1; unlimited has no fraction', () => {
        expect(chargesFraction(3, 5)).toBeCloseTo(0.6);
        expect(chargesFraction(9, 5)).toBe(1);
        expect(chargesFraction(0, 5)).toBe(0);
        expect(chargesFraction(null, 5)).toBeNull();
        expect(chargesFraction(4, null)).toBe(1);
    });

    it('counts shorten to fit inside a ring', () => {
        expect(ringCount(7)).toBe('7');
        expect(ringCount(1200)).toBe('1.2k');
        expect(ringCount(12450)).toBe('12k');
    });

    it('the stroke is 3/28 of the diameter', () => {
        expect(RING_STROKE_U / RING_D_U).toBeCloseTo(3 / 28);
    });

    it('ring spots: timer top-left, quest bottom-centre, charges bottom-right, inside a full-size box', () => {
        const box = { boxPx: 128 };
        const timer = bubbleSlot('timer', box);
        const quest = bubbleSlot('quest', box);
        const charges = bubbleSlot('charges', box);
        expect(timer.top).toBeLessThan(quest.top);
        expect(quest.top).toBe(charges.top);
        expect(quest.left + RING_D_U / 2).toBe(64);
        expect(quest.left + RING_D_U).toBeLessThanOrEqual(charges.left);
        for (const p of [timer, quest, charges]) {
            expect(p.left).toBeGreaterThanOrEqual(0);
            expect(p.top + RING_D_U).toBeLessThanOrEqual(128);
        }
    });

    it('small Token: the rings hang off the box', () => {
        const box = { boxPx: 64, small: true };
        expect(bubbleSlot('timer', box)).toEqual({ left: -SMALL_OVERHANG_U, top: -SMALL_OVERHANG_U });
        expect(bubbleSlot('charges', box).left + RING_D_U).toBeGreaterThan(64);
    });

    it('every count ring glides', () => {
        for (const kind of ['charges', 'spawner', 'quest']) expect(GLIDING_RINGS.has(kind)).toBe(true);
    });

    it('spawner and quest rings', () => {
        expect(spawnerRing({ count: 3, cap: 5 })).toMatchObject({ kind: 'spawner', text: '3/5', fraction: 0.6 });
        expect(spawnerRing(null)).toBeNull();
        expect(questRing({ currentCount: 3, requiredCount: 10, title: 'T' })).toMatchObject({ kind: 'quest', text: '3/10', fraction: 0.3 });
        expect(RING_COLOUR.spawner).toBe('#86efac');
    });
});

describe('⭐ at rest: the bar and the marks, nothing else', () => {
    const everything = { spawner: spawnerRing({ count: 3, cap: 5 }), quest: questRing({ currentCount: 1, requiredCount: 4 }) };
    const clock = () => ({ kind: 'grow', inMs: 3000, everyMs: 60000, into: 'fixture_b13_sapling' });

    it('⭐ not worked, nothing wrong: nothing at all, rings and timer included (even in its last seconds)', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, usesRemaining: 5 }), ...everything, readTimer: clock }));
        expect(drawn(container)).toEqual([]);
    });

    it('⭐ a worked Token draws nothing in its own box: its bar and charges are on its plate', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: 5 }), ...everything, readTimer: clock }));
        expect(drawn(container)).toEqual([]);
    });

    it('⭐ a count change does not bring a ring up by itself: charges, spawner, quest', () => {
        vi.useFakeTimers();
        const { container, rerender } = mount(bub({ token: worked({ heroId: null, usesRemaining: 5 }), ...everything }));
        rerender(tree(bub({
            token: worked({ heroId: null, usesRemaining: 4 }),
            spawner: spawnerRing({ count: 4, cap: 5 }),
            quest: questRing({ currentCount: 2, requiredCount: 4 })
        })));
        expect(container.querySelector('[data-ring]')).toBeNull();
        advance(100);
        expect(container.querySelector('[data-ring]')).toBeNull();
        // The change sets no timers of its own any more.
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a worked Token with a problem draws no mark of its own: the plate says it', () => {
        const { container } = mount(bub({ token: worked({ alert: ALERT.INPUTS }), ...everything }));
        expect(drawn(container)).toEqual([]);
    });

    it('⭐ a Token nobody works, with a problem: one mark, and no ring', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, alert: ALERT.INPUTS }), ...everything }));
        expect(container.querySelectorAll('[data-problem-mark]')).toHaveLength(1);
        expect(container.querySelector('[data-ring]')).toBeNull();
    });

    it('nothing while the Token is dragged', () => {
        const { container } = mount(bub({
            token: worked({ alert: ALERT.NO_ROOM }), isDragging: true, isHovered: true, disallowed: true,
            spawner: spawnerRing({ count: 3, cap: 5 }),
            gear: { show: true, pulsing: true, recipe: null }
        }));
        expect(drawn(container)).toEqual([]);
    });
});

describe('the work bar', () => {
    const fillOf = (c) => Number(bar(c).getAttribute('data-work-bar-fill'));

    const W = PLATE.FILL_STEPS;

    it('⭐ fills in whole art pixels on the shared step clock, and is empty again on CYCLE_COMPLETE', () => {
        vi.useFakeTimers();
        const { container } = render(tree(...withFill({ token: worked() })));
        progress({ percent: 20, elapsedMs: 600, cycleTimeMs: 3000 });
        step();
        const early = fillOf(container);
        expect(Number.isInteger(early)).toBe(true);
        expect(early).toBeGreaterThanOrEqual(Math.floor(0.2 * W));
        expect(early).toBeLessThan(0.3 * W);
        expect(bar(container).style.getPropertyValue('--work-bar-fill')).toBe(String(early / W));

        progress({ percent: 90, elapsedMs: 2700, cycleTimeMs: 3000 });
        step();
        expect(fillOf(container)).toBeGreaterThanOrEqual(Math.floor(0.9 * W));

        act(() => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 'tok_r' }); });
        step();
        expect(fillOf(container)).toBeLessThan(0.1 * W);
    });

    it('runs between engine ticks only while the cycle is live, and schedules nothing when idle', () => {
        vi.useFakeTimers();
        const { container, rerender } = render(tree(...withFill({ token: worked({ heroId: null }) })));
        expect(vi.getTimerCount()).toBe(0);
        rerender(tree(...withFill({ token: worked() })));
        expect(vi.getTimerCount()).toBe(0);           // nothing live until the engine says so
        progress({ percent: 10, elapsedMs: 300, cycleTimeMs: 3000 });
        expect(vi.getTimerCount()).toBe(1);           // the next step
        const before = fillOf(container);
        advance(600);
        expect(fillOf(container)).toBeGreaterThan(before);

        rerender(tree(...withFill({ token: worked({ heroId: null }) })));
        expect(vi.getTimerCount()).toBe(0);
    });

    it('⭐ with nothing drawing it, a live cycle schedules nothing: the model keeps time by itself', () => {
        vi.useFakeTimers();
        const { container } = mount(bub({ token: worked() }));
        progress({ percent: 10, elapsedMs: 300, cycleTimeMs: 3000 });
        expect(bar(container)).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('⭐ blocked: grey, held where it stood, ignoring progress until the alert clears', () => {
        vi.useFakeTimers();
        const { container, rerender } = render(tree(...withFill({ token: worked() })));
        progress({ percent: 50, elapsedMs: 1500, cycleTimeMs: 3000 });
        step();
        rerender(tree(...withFill({ token: worked({ alert: ALERT.INPUTS }) }, true)));
        expect(bar(container).getAttribute('data-work-bar-blocked')).toBe('true');
        const held = fillOf(container);
        expect(held).toBeCloseTo(0.55 * W, -1);
        progress({ percent: 90, elapsedMs: 2700, cycleTimeMs: 3000 });
        advance(1000);
        expect(fillOf(container)).toBe(held);
        expect(vi.getTimerCount()).toBe(0);

        rerender(tree(...withFill({ token: worked() })));
        expect(bar(container).getAttribute('data-work-bar-blocked')).toBeNull();
        progress({ percent: 90, elapsedMs: 2700, cycleTimeMs: 3000 });
        step();
        expect(fillOf(container)).toBeGreaterThanOrEqual(Math.floor(0.9 * W));
    });

    it('a blocked bar is drawn grey by its own rule (tailwind.css)', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const css = fs.readFileSync(path.resolve(__dirname, '../tailwind.css'), 'utf8');
        expect(css).toMatch(/\.gi-work-bar\[data-work-bar-blocked\]::after\s*\{\s*background: var\(--color-work-bar-blocked\);/);
        expect(css).toMatch(/\.gi-work-bar::after\s*\{[^}]*transform: scaleX\(var\(--work-bar-fill, 0\)\);/);
    });

    it('⭐ in a fight: no bar; the enemy health bar instead', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: 4 }) }));
        progress({ percent: 25, combat: true, enemyHp: 30, enemyMaxHp: 40 });
        expect(bar(container)).toBeNull();
        const hb = container.querySelector('[data-health-bar="enemy"]');
        expect(hb.getAttribute('data-health-text')).toBe('30 · 75%');
        progress({ percent: 75, combat: true, enemyHp: 10, enemyMaxHp: 40 });
        expect(container.querySelector('[data-health-bar="enemy"]').getAttribute('data-health-text')).toBe('10 · 25%');
    });

    it('the fill takes no pointer: a press goes through to the plate, which grabs the Token', () => {
        const { container } = render(tree(...withFill({ token: worked() })));
        expect(bar(container).className).toContain('pointer-events-none');
    });
});

describe('hover: the rings, the timer and the gear', () => {
    it('⭐ charges: on hover only, with its number; unlimited has none; a worked Token has them on its plate', () => {
        const start = tokenStartingUses('fixture_producer');
        const idle = (extra) => worked({ heroId: null, ...extra });
        const { container, rerender } = mount(bub({ token: idle({ usesRemaining: start }) }));
        expect(ring(container, 'charges')).toBeNull();
        rerender(tree(bub({ token: idle({ usesRemaining: start }), isHovered: true })));
        expect(ring(container, 'charges').getAttribute('data-ring-text')).toBe(ringCount(start));
        rerender(tree(bub({ token: idle({ usesRemaining: start }), isHovered: false })));
        expect(ring(container, 'charges')).toBeNull();
        rerender(tree(bub({ token: idle({ usesRemaining: null }), isHovered: true })));
        expect(ring(container, 'charges')).toBeNull();
        rerender(tree(bub({ token: worked({ usesRemaining: start }), isHovered: true })));
        expect(ring(container, 'charges')).toBeNull();
    });

    it('a change while hovered moves the same ring, which glides', () => {
        const { container, rerender } = mount(bub({ token: worked({ heroId: null, usesRemaining: 4 }), isHovered: true }));
        const r = ring(container, 'charges');
        expect(r.getAttribute('data-ring-glide')).toBe('true');
        rerender(tree(bub({ token: worked({ heroId: null, usesRemaining: 3 }), isHovered: true })));
        expect(ring(container, 'charges')).toBe(r);
        expect(r.getAttribute('data-ring-text')).toBe('3');
    });

    for (const [kind, props, text] of [
        ['spawner', { spawner: spawnerRing({ count: 4, cap: 5 }) }, '4/5'],
        ['quest', { quest: questRing({ currentCount: 3, requiredCount: 5 }) }, '3/5']
    ]) {
        it(`⭐ ${kind}: hidden at rest, up on hover`, () => {
            const { container, rerender } = mount(bub({ token: worked({ heroId: null }), ...props }));
            expect(ring(container, kind)).toBeNull();
            rerender(tree(bub({ token: worked({ heroId: null }), ...props, isHovered: true })));
            expect(ring(container, kind).getAttribute('data-ring-text')).toBe(text);
            expect(ring(container, kind).getAttribute('data-ring-glide')).toBe('true');
        });
    }

    it('⭐ the timer: only while hovered, top-left, polling only while it shows', () => {
        vi.useFakeTimers();
        const read = () => ({ kind: 'grow', inMs: 30000, everyMs: 60000, into: 'fixture_b13_sapling' });
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), readTimer: read }));
        expect(bubble(container, 'timer')).toBeNull();
        expect(vi.getTimerCount()).toBe(0);

        rerender(tree(bub({ token: worked({ heroId: null }), readTimer: read, isHovered: true })));
        const t = bubble(container, 'timer');
        expect(ring(container, 'grow').getAttribute('data-ring-text')).toBe('0:30');
        expect(ring(container, 'grow').querySelector('[data-ring-arc]').getAttribute('stroke')).toBe(RING_COLOUR.grow);
        expect(parseFloat(t.style.left)).toBe(bubbleSlot('timer', { boxPx: 128 }).left);
        expect(vi.getTimerCount()).toBe(1);

        rerender(tree(bub({ token: worked({ heroId: null }), readTimer: read, isHovered: false })));
        expect(bubble(container, 'timer')).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a hovered timer follows the clock; a resting Token’s fills as it refills', () => {
        vi.useFakeTimers();
        let inMs = 12000;
        const read = () => ({ kind: 'turn', inMs, everyMs: 60000, chance: 30, back: false, into: [] });
        const { container } = mount(bub({ token: worked({ heroId: null }), readTimer: read, isHovered: true }));
        expect(ring(container, 'turn').getAttribute('data-ring-text')).toBe('0:12');
        inMs = 9000;
        advance(300);
        expect(ring(container, 'turn').getAttribute('data-ring-text')).toBe('0:09');
        cleanup();
        const rest = mount(bub({ token: worked({ heroId: null }), isHovered: true, readTimer: () => ({ kind: 'respawn', inMs: 15000, everyMs: 60000 }) }));
        expect(Number(ring(rest.container, 'respawn').getAttribute('data-ring-fraction'))).toBeCloseTo(0.75, 3);
    });

    it('a Token with no clock has no timer', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }), readTimer: () => null, isHovered: true }));
        expect(bubble(container, 'timer')).toBeNull();
    });

    it('growth: nextGrowth reads the clock against afterMs; none for a Token that does not grow', () => {
        expect(TimedChanges.nextGrowth({ typeId: 'fixture_bub_grower', clocks: { growMs: 45000 } }))
            .toEqual({
                inMs: 15000, totalMs: 60000, into: 'fixture_b13_sapling',
                // Brief 230 S2a: a growth that needs no Token in reach and costs nothing.
                paused: false, stopped: false, needsNearby: [], cost: [], short: []
            });
        expect(TimedChanges.nextGrowth({ typeId: 'fixture_producer' })).toBeNull();
    });

    it('⭐ the gear: only on hover, set or not; never while marked for demolition', () => {
        const pending = { show: true, pulsing: true, recipe: null, onClick: vi.fn() };
        const chosen = { show: true, pulsing: false, recipe: { name: 'R' }, onClick: vi.fn() };
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), gear: pending }));
        expect(container.querySelector('[data-station-gear]')).toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), gear: pending, isHovered: true })));
        expect(container.querySelector('[data-station-gear="unset"]')).not.toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), gear: chosen })));
        expect(container.querySelector('[data-station-gear]')).toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), gear: chosen, isHovered: true })));
        expect(container.querySelector('[data-station-gear="set"]')).not.toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), gear: chosen, isHovered: true, marked: true })));
        expect(container.querySelector('[data-station-gear]')).toBeNull();
    });
});

describe('the middle row', () => {
    it('⭐ the marks sit centred on the box: problem mark, demolition mark, disallow mark, in that order', () => {
        const { container } = mount(bub({
            token: worked({ heroId: null, alert: ALERT.INPUTS }), isHovered: true, disallowed: true, marked: true,
            spawner: spawnerRing({ count: 3, cap: 5 }),
            gear: { show: true, pulsing: false, recipe: null }
        }));
        const row = container.querySelector('[data-bubble-row="middle"]');
        expect(parseFloat(row.style.width)).toBe(128);
        expect(parseFloat(row.style.top)).toBe(64);
        expect(row.style.transform).toContain('translateY(-50%)');
        const kinds = [...row.children].map(c => c.getAttribute('data-bubble') || (c.hasAttribute('data-problem-mark') ? 'problem' : '?'));
        expect(kinds).toEqual(['problem', 'marked', 'disallow']);
    });

    it('⭐ hovering never moves a mark: the gear and the spawner ring come up in a row of their own, above the marks', () => {
        const props = {
            token: worked({ heroId: null }), gear: { show: true, pulsing: true, recipe: null, onClick: () => {} },
            spawner: spawnerRing({ count: 3, cap: 5 })
        };
        const { container, rerender } = mount(bub(props));
        const row = container.querySelector('[data-bubble-row="middle"]');
        const markEl = mark(container);
        const at = () => ({ row: row.getAttribute('style'), children: [...row.children] });
        const before = at();
        rerender(tree(bub({ ...props, isHovered: true })));
        expect(container.querySelector('[data-bubble-row="middle"]')).toBe(row);
        expect(mark(container)).toBe(markEl);
        expect(at()).toEqual(before);
        const hoverRow = container.querySelector('[data-bubble-row="hover"]');
        expect([...hoverRow.children].map(c => c.getAttribute('data-bubble') || (c.querySelector('[data-station-gear]') ? 'gear' : '?')))
            .toEqual(['gear', 'spawner']);
        // Above the marks: its bottom edge clear of the mark's top (16 art pixels at 2 units, centred at 64).
        expect(hoverRow.style.transform).toContain('translateY(-100%)');
        expect(parseFloat(hoverRow.style.top)).toBeLessThanOrEqual(64 - 16);
    });

    it('with no marks, the hover row sits at the centre', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }), isHovered: true, spawner: spawnerRing({ count: 3, cap: 5 }) }));
        const hoverRow = container.querySelector('[data-bubble-row="hover"]');
        expect(parseFloat(hoverRow.style.top)).toBe(64);
        expect(hoverRow.style.transform).toContain('translateY(-50%)');
        expect(container.querySelector('[data-bubble-row="middle"]')).toBeNull();
    });

    it('⭐ the disallow and demolition marks show the whole time, hovered or not', () => {
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), disallowed: true, marked: true }));
        expect(container.querySelector('[data-tile-disallowed]')).not.toBeNull();
        expect(container.querySelector('[data-demolish-badge]')).not.toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }) })));
        expect(container.querySelector('[data-tile-disallowed]')).toBeNull();
        expect(container.querySelector('[data-demolish-badge]')).toBeNull();
    });
});

describe('⭐ the problem mark on a Token', () => {
    const say = (alert, needs = []) => act(() => {
        EventBus.publish(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, { instanceId: 'tok_r', alert, needs });
    });
    const hoverText = (c) => {
        fireEvent.pointerEnter(mark(c));
        const tip = document.querySelector('[data-tooltip]');
        return tip ? { text: tip.textContent, colour: tip.querySelector('span')?.style.color } : null;
    };

    beforeAll(() => {
        registerItems({
            fixture_stuck_seed: { id: 'fixture_stuck_seed', name: 'Fixture Seed', type: 'resource' },
            fixture_stuck_water: { id: 'fixture_stuck_water', name: 'Fixture Water', type: 'resource' }
        });
    });

    it('a spawner short of items: a yellow mark naming them; red with no room or at the cap', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        expect(mark(container)).toBeNull();
        say(ALERT.SPAWN_NEEDS_ITEM, ['fixture_stuck_seed', 'fixture_stuck_water']);
        expect(mark(container).getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        expect(mark(container).getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.WAITING]);
        expect(hoverText(container)).toEqual({ text: 'Needs Fixture Seed and Fixture Water to spawn', colour: 'var(--color-ui-gold)' });
        fireEvent.pointerLeave(mark(container));

        say(ALERT.SPAWN_NO_ROOM);
        expect(mark(container).getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.CANT]);
        expect(hoverText(container)).toEqual({ text: 'No room to spawn', colour: 'var(--color-ui-red)' });
        fireEvent.pointerLeave(mark(container));

        say(ALERT.SPAWN_MAT_FULL);
        expect(hoverText(container).text).toBe('Token cap full');
        fireEvent.pointerLeave(mark(container));

        say(null);
        expect(mark(container)).toBeNull();
        expect(container.querySelector('[data-bubble-row="middle"]')).toBeNull();
    });

    it('⭐ a Stump with no Forest in reach, or stopped for want of a seedling: a yellow mark saying which (brief 230 S2a)', () => {
        const grow = (alert, needs = []) => act(() => {
            EventBus.publish(BOARD_EVENTS.GROWTH_ALERT_CHANGED, { instanceId: 'tok_r', alert, needs });
        });
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        grow(ALERT.GROW_NEEDS_NEARBY, ['fixture_b13_forest']);
        expect(mark(container).getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        expect(hoverText(container)).toEqual({ text: 'Needs a Fixture B1.3 Forest nearby to grow', colour: 'var(--color-ui-gold)' });
        fireEvent.pointerLeave(mark(container));

        grow(ALERT.GROW_NEEDS_ITEM, ['fixture_stuck_seed']);
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.GROW_NEEDS_ITEM);
        expect(hoverText(container).text).toBe('Needs Fixture Seed to grow');
        fireEvent.pointerLeave(mark(container));

        grow(null);
        expect(mark(container)).toBeNull();
    });

    it('⭐ an unset station or Foundation: the yellow mark says choose, and a click on it opens the list', () => {
        const onClick = vi.fn();
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), gear: { show: true, pulsing: true, recipe: null, onClick } }));
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_RECIPE);
        expect(mark(container).getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        expect(hoverText(container).text).toBe('Choose a recipe');
        fireEvent.click(mark(container));
        expect(onClick).toHaveBeenCalledTimes(1);

        rerender(tree(bub({ token: worked({ heroId: null }), gear: { show: true, pulsing: true, recipe: null, isFoundation: true, onClick } })));
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_BUILD);
        // A recipe chosen: no mark.
        rerender(tree(bub({ token: worked({ heroId: null }), gear: { show: true, pulsing: false, recipe: { name: 'R' }, onClick } })));
        expect(mark(container)).toBeNull();
        // Marked for demolition: nothing to choose.
        rerender(tree(bub({ token: worked({ heroId: null }), gear: { show: true, pulsing: true, recipe: null, onClick }, marked: true })));
        expect(mark(container)).toBeNull();
    });

    it('a mark a click does not fix does nothing on click but still grabs the Token on a press', () => {
        const grab = vi.fn();
        const onClick = vi.fn();
        const { container } = mount(bub({
            token: worked({ heroId: null, alert: ALERT.NO_ROOM }), dragProps: { onPointerDown: grab },
            gear: { show: true, pulsing: false, recipe: { name: 'R' }, onClick }
        }));
        fireEvent.click(mark(container));
        expect(onClick).not.toHaveBeenCalled();
        fireEvent.pointerDown(mark(container));
        expect(grab).toHaveBeenCalledTimes(1);
    });

    it('a can’t beats a waiting: one mark, red', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, alert: ALERT.INPUTS }) }));
        say(ALERT.SPAWN_MAT_FULL);
        expect(container.querySelectorAll('[data-problem-mark]')).toHaveLength(1);
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.SPAWN_MAT_FULL);
    });

    it('pressing hides an open tooltip', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, alert: ALERT.NO_ROOM }), dragProps: { onPointerDown: vi.fn() } }));
        fireEvent.pointerEnter(mark(container));
        expect(document.body.querySelector('[data-tooltip]')).not.toBeNull();
        fireEvent.pointerDown(mark(container));
        expect(document.body.querySelector('[data-tooltip]')).toBeNull();
    });
});

describe('the floater', () => {
    it('⭐ switched off: a charge spent or restocked draws nothing, worked or not', () => {
        expect(CHARGE_FLOATERS).toBe(false);
        for (const token of [worked({ usesRemaining: 4 }), worked({ heroId: null, usesRemaining: 4 })]) {
            const { container, unmount } = mount(bub({ token }));
            act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: -1, remaining: 3 }); });
            act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: 50, remaining: 53 }); });
            expect(container.querySelector('[data-charge-floater]')).toBeNull();
            expect(drawn(container)).toEqual([]);
            unmount();
        }
    });
});

/** Were the floaters switched back on (`CHARGE_FLOATERS`), where they ride. */
describe.skipIf(!CHARGE_FLOATERS)('the floater, switched on', () => {
    it('⭐ nothing is drawn for it at rest; a -1 rides above the charges spot', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, usesRemaining: 4 }) }));
        expect(drawn(container)).toEqual([]);
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: -1, remaining: 3 }); });
        const floater = container.querySelector('[data-charge-floater]');
        expect(floater.getAttribute('data-charge-floater')).toBe('ring');
        expect(floater.textContent).toBe('-1');
        const slot = container.querySelector('[data-bubble-slot="charges"]');
        expect(slot.contains(floater)).toBe(true);
        expect(parseFloat(slot.style.left)).toBe(bubbleSlot('charges', { boxPx: 128 }).left);
    });

    it('hovering while a number floats keeps it: the floater is not remounted', () => {
        const { container, rerender } = mount(bub({ token: worked({ heroId: null, usesRemaining: 4 }) }));
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: -1, remaining: 3 }); });
        const floater = container.querySelector('[data-charge-floater]');
        rerender(tree(bub({ token: worked({ heroId: null, usesRemaining: 3 }), isHovered: true })));
        expect(ring(container, 'charges')).not.toBeNull();
        expect(container.querySelector('[data-charge-floater]')).toBe(floater);
    });

    it('a Token with no charges floats it from the corner', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: null }) }));
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: 50, remaining: 50 }); });
        expect(container.querySelector('[data-charge-floater]').getAttribute('data-charge-floater')).toBe('corner');
    });
});

describe('tooltips and grabbing', () => {
    const everything = () => bub({
        token: worked({ heroId: null, usesRemaining: 4 }), isHovered: true, disallowed: true,
        spawner: spawnerRing({ count: 3, cap: 5 }),
        quest: questRing({ currentCount: 1, requiredCount: 4 }),
        readTimer: () => ({ kind: 'grow', inMs: 30000, everyMs: 60000, into: 'fixture_b13_sapling' })
    });

    it('⭐ hovering a hover ring or a player mark shows what it means; leaving hides it', () => {
        const { container } = mount(everything());
        const expected = {
            charges: BUBBLE_TIPS.charges(4),
            quest: BUBBLE_TIPS.quest('1/4'),
            spawner: BUBBLE_TIPS.spawner('3/5'),
            disallow: BUBBLE_TIPS.disallow
        };
        for (const [kind, text] of Object.entries(expected)) {
            const el = bubble(container, kind);
            expect(el, kind).not.toBeNull();
            fireEvent.pointerEnter(el);
            expect(document.body.querySelector('[data-bubble-tip]')?.textContent, kind).toBe(text);
            fireEvent.pointerLeave(el);
            expect(document.body.querySelector('[data-bubble-tip]'), kind).toBeNull();
        }
        fireEvent.pointerEnter(bubble(container, 'timer'));
        expect(document.body.querySelector('[data-bubble-tip]').textContent).toMatch(/^Grows into .* in 0:30$/);
    });

    it('⭐ pressing a ring or a mark reaches the Token’s drag handle', () => {
        const onPointerDown = vi.fn();
        const { container } = mount(bub({
            token: worked({ heroId: null, usesRemaining: 4, alert: ALERT.INPUTS }), isHovered: true, disallowed: true,
            spawner: spawnerRing({ count: 3, cap: 5 }),
            quest: questRing({ currentCount: 1, requiredCount: 4 }),
            dragProps: { onPointerDown }
        }));
        for (const kind of ['charges', 'quest', 'spawner', 'disallow']) {
            onPointerDown.mockClear();
            fireEvent.pointerDown(bubble(container, kind));
            expect(onPointerDown, kind).toHaveBeenCalledTimes(1);
        }
        onPointerDown.mockClear();
        fireEvent.pointerDown(mark(container));
        expect(onPointerDown).toHaveBeenCalledTimes(1);
    });
});

describe('on the mat (MatToken)', () => {
    const AT = { x: 560, y: 520 };

    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.heroes = [];
    });

    function put(typeId, point = AT) {
        const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        Placement.placeTokenAt(instance, point);
        return instance;
    }

    function hover(container, tok) {
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({
            left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0
        });
        fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
        restHover();
    }

    it('⭐ a spawner at 3 of 5: nothing at rest; hovered, its 3/5 sits at the centre of the box', () => {
        vi.useFakeTimers();
        const forest = put('fixture_b13_forest');
        put('fixture_b13_sapling', { x: 1200, y: 520 });
        put('fixture_b13_sapling', { x: 1400, y: 300 });
        put('fixture_b13_sapling', { x: 1400, y: 800 });
        const { container } = mount(h(MatBoard));
        const o = container.querySelector(`[data-token-overlay="${forest.id}"]`);
        expect(o.querySelector('[data-ring]')).toBeNull();
        expect(o.querySelector('[data-bubble-row]')).toBeNull();

        hover(container, forest);
        const r = o.querySelector('[data-bubble-row="hover"] [data-ring="spawner"]');
        expect(r.getAttribute('data-ring-text')).toBe('3/5');
        const box = parseFloat(o.style.width);
        const row = o.querySelector('[data-bubble-row]');
        expect(parseFloat(row.style.top)).toBe(box / 2);
        // The name sits under the box, clear of the bubbles inside it.
        expect(o.querySelector('[data-token-name]').style.top).toContain('100%');
        expect(o.querySelector('[data-token-name]').style.bottom).toBe('');
    });

    it('⭐ a Sapling-like grower shows its growth timer top-left only when hovered', () => {
        vi.useFakeTimers();
        const g = put('fixture_bub_grower');
        const { container } = mount(h(MatBoard));
        const o = container.querySelector(`[data-token-overlay="${g.id}"]`);
        expect(o.querySelector('[data-bubble="timer"]')).toBeNull();
        hover(container, g);
        const t = o.querySelector('[data-bubble="timer"]');
        expect(t.querySelector('[data-ring]').getAttribute('data-ring')).toBe('grow');
        expect(parseFloat(t.style.left)).toBe(bubbleSlot('timer', { boxPx: parseFloat(o.style.width) }).left);
    });

    it('⭐ the mark is drawn at the Token’s own art-pixel size', () => {
        const station = put('fixture_consumer');
        station.alert = ALERT.INPUTS;
        const { container } = mount(h(MatBoard));
        const o = container.querySelector(`[data-token-overlay="${station.id}"]`);
        const m = o.querySelector('[data-problem-mark]');
        expect(m.getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        // 16 art pixels at the board's art scale: 2 mat units a pixel with the mat drawn 1:1.
        expect(parseFloat(m.style.width)).toBe(16 * boardScaleAt(1));
        expect(parseFloat(m.style.height)).toBe(16 * boardScaleAt(1));
        expect(m.style.imageRendering).toBe('pixelated');
    });
});

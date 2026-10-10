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
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenBubbles, GLIDE_START_MS, BUBBLE_TIPS } from '../ui/components/board/TokenBubbles.jsx';
import {
    cycleSecondsText, chargesFraction, ringCount, RING_D_U, RING_STROKE_U, spawnerRing, questRing,
    RING_COLOUR, bubbleSlot, timerVisible, BUBBLE_RECENT_MS, TIMER_SOON_MS, SMALL_OVERHANG_U,
    GLIDING_RINGS
} from '../ui/components/board/ringRow.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { STEP_MS } from '../ui/components/board/frameClock.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token bubbles: where each sits in the Token's box, when each shows, that count bubbles
 * glide, that every bubble has a tooltip and that pressing one grabs the Token.
 */

registerTokenTypes({
    fixture_b13_sapling: {
        id: 'fixture_b13_sapling', name: 'Fixture B1.3 Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature'
    },
    fixture_b13_forest: {
        id: 'fixture_b13_forest', name: 'Fixture B1.3 Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature', requiresHero: false,
        spawner: { spawns: [{ typeId: 'fixture_b13_sapling', weight: 1 }], allowance: 5, intervalMs: 1000 }
    },
    fixture_bub_grower: {
        id: 'fixture_bub_grower', name: 'Fixture Grower', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'fixture_b13_sapling', afterMs: 60000 }
    }
});

const h = React.createElement;
const tree = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));
const mount = (el) => render(tree(el));

const worked = (extra = {}) => ({ typeId: 'fixture_producer', instanceId: 'tok_r', heroId: 'hero_1', alert: null, usesRemaining: null, ...extra });
const bub = (props) => h(TokenBubbles, { instanceId: 'tok_r', boxPx: 128, ...props });
const ring = (c, kind) => c.querySelector(`[data-ring="${kind}"]`);
const bubble = (c, kind) => c.querySelector(`[data-bubble="${kind}"]`);
const progress = (p) => act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_r', ...p }); });
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
/** Past the next step of the shared step clock (its timer, then its frame). */
const step = () => advance(STEP_MS + 20);

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the rules, pure', () => {
    it('the cycle number is whole seconds left, rounded up, never 0s while running', () => {
        expect(cycleSecondsText(0, 3000)).toBe('3s');
        expect(cycleSecondsText(1, 3000)).toBe('3s');
        expect(cycleSecondsText(1000, 3000)).toBe('2s');
        expect(cycleSecondsText(2500, 3000)).toBe('1s');
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
        expect(ringCount(250)).toBe('250');
        expect(ringCount(1200)).toBe('1.2k');
        expect(ringCount(5000)).toBe('5k');
        expect(ringCount(12450)).toBe('12k');
    });

    it('the stroke is 3/28 of the diameter', () => {
        expect(RING_STROKE_U / RING_D_U).toBeCloseTo(3 / 28);
    });

    it('⭐ positions: timer top-left, cycle bottom-left, quest bottom-centre, charges bottom-right, all inside a full-size box', () => {
        const box = { boxPx: 128 };
        const timer = bubbleSlot('timer', box);
        const cycle = bubbleSlot('cycle', box);
        const quest = bubbleSlot('quest', box);
        const charges = bubbleSlot('charges', box);
        expect(timer.left).toBe(cycle.left);
        expect(timer.top).toBeLessThan(cycle.top);
        expect(cycle.top).toBe(quest.top);
        expect(quest.top).toBe(charges.top);
        expect(cycle.left).toBeLessThan(quest.left);
        expect(quest.left).toBeLessThan(charges.left);
        expect(quest.left + RING_D_U / 2).toBe(64);          // centred
        for (const p of [timer, cycle, quest, charges]) {
            expect(p.left).toBeGreaterThanOrEqual(0);
            expect(p.top).toBeGreaterThanOrEqual(0);
            expect(p.left + RING_D_U).toBeLessThanOrEqual(128);
            expect(p.top + RING_D_U).toBeLessThanOrEqual(128);
        }
        // The three bottom bubbles do not overlap.
        expect(cycle.left + RING_D_U).toBeLessThanOrEqual(quest.left);
        expect(quest.left + RING_D_U).toBeLessThanOrEqual(charges.left);
    });

    it('⭐ small Token: same corners, hanging off the box, the bottom three still not overlapping', () => {
        const box = { boxPx: 64, small: true };
        const timer = bubbleSlot('timer', box);
        const cycle = bubbleSlot('cycle', box);
        const quest = bubbleSlot('quest', box);
        const charges = bubbleSlot('charges', box);
        expect(timer).toEqual({ left: -SMALL_OVERHANG_U, top: -SMALL_OVERHANG_U });
        expect(charges.left + RING_D_U).toBeGreaterThan(64);       // overhangs the right
        expect(cycle.top + RING_D_U).toBeGreaterThan(64);          // and the bottom
        expect(cycle.left + RING_D_U).toBeLessThanOrEqual(quest.left + 1e-9);
        expect(quest.left + RING_D_U).toBeLessThanOrEqual(charges.left + 1e-9);
    });

    it('a timer shows hovered, or in its last ten seconds', () => {
        expect(timerVisible(false, 60000)).toBe(false);
        expect(timerVisible(true, 60000)).toBe(true);
        expect(timerVisible(false, TIMER_SOON_MS)).toBe(true);
        expect(timerVisible(false, TIMER_SOON_MS + 1)).toBe(false);
        expect(timerVisible(false, 0)).toBe(true);
        expect(timerVisible(true, null)).toBe(false);
    });

    it('every count bubble glides', () => {
        for (const kind of ['charges', 'spawner', 'quest']) expect(GLIDING_RINGS.has(kind)).toBe(true);
    });

    it('spawner and quest rings', () => {
        expect(spawnerRing({ count: 3, cap: 5 })).toMatchObject({ kind: 'spawner', text: '3/5', fraction: 0.6 });
        expect(spawnerRing({ count: 5, cap: 5 }).fraction).toBe(1);
        expect(spawnerRing(null)).toBeNull();
        expect(questRing({ currentCount: 3, requiredCount: 10, title: 'T' })).toMatchObject({ kind: 'quest', text: '3/10', fraction: 0.3 });
        expect(RING_COLOUR.spawner).toBe('#86efac');
        expect(RING_COLOUR.turn).toBe('#7dd3fc');
    });
});

describe('which bubbles show', () => {
    it('nothing at rest: not worked, not hovered, nothing changed', () => {
        const { container } = mount(bub({
            token: worked({ heroId: null, usesRemaining: 5 }),
            spawner: spawnerRing({ count: 3, cap: 5 }),
            quest: questRing({ currentCount: 1, requiredCount: 4 })
        }));
        expect(container.querySelector('[data-bubble]')).toBeNull();
    });

    it('⭐ a worked Token shows the cycle bubble with seconds left, and resets on CYCLE_COMPLETE', () => {
        vi.useFakeTimers();
        const { container } = mount(bub({ token: worked() }));
        const cycle = ring(container, 'cycle');
        expect(cycle).not.toBeNull();
        expect(bubble(container, 'cycle')).not.toBeNull();
        expect(cycle.getAttribute('data-ring-greyed')).toBeNull();

        // The ring draws on the next step (`STEP_MS`), from where the engine said it was.
        progress({ percent: 20, elapsedMs: 600, cycleTimeMs: 3000 });
        step();
        expect(cycle.getAttribute('data-ring-text')).toBe('3s');
        progress({ percent: 50, elapsedMs: 1500, cycleTimeMs: 3000 });
        step();
        expect(cycle.getAttribute('data-ring-text')).toBe('2s');
        expect(Math.abs(Number(cycle.getAttribute('data-ring-fraction')) - 0.5)).toBeLessThan(0.05);
        progress({ percent: 90, elapsedMs: 2700, cycleTimeMs: 3000 });
        step();
        expect(cycle.getAttribute('data-ring-text')).toBe('1s');
        expect(cycle.querySelector('[data-ring-label]').textContent).toBe('1s');

        act(() => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 'tok_r' }); });
        step();
        expect(Number(cycle.getAttribute('data-ring-fraction'))).toBeLessThan(0.05);
        expect(cycle.getAttribute('data-ring-text')).toBe('3s');
    });

    it('the cycle bubble steps between ticks on the shared step clock, and schedules nothing when idle', () => {
        vi.useFakeTimers();
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }) }));
        expect(vi.getTimerCount()).toBe(0);

        rerender(tree(bub({ token: worked() })));
        expect(vi.getTimerCount()).toBe(0);           // nothing live until the engine says so
        progress({ percent: 10, elapsedMs: 300, cycleTimeMs: 3000 });
        expect(vi.getTimerCount()).toBe(1);           // the next step
        step();
        step();
        expect(Number(ring(container, 'cycle').getAttribute('data-ring-fraction'))).toBeGreaterThan(0.1);

        // The hero leaves: the step stops.
        rerender(tree(bub({ token: worked({ heroId: null }) })));
        expect(vi.getTimerCount()).toBe(0);
        expect(container.querySelector('[data-bubble]')).toBeNull();
    });

    it('greys, freezes and hides its number while blocked', () => {
        const { container, rerender } = mount(bub({ token: worked() }));
        progress({ percent: 50, elapsedMs: 1500, cycleTimeMs: 3000 });
        rerender(tree(bub({ token: worked({ alert: ALERT.INPUTS }) })));
        const cycle = ring(container, 'cycle');
        expect(cycle.getAttribute('data-ring-greyed')).toBe('true');
        expect(cycle.getAttribute('data-ring-text')).toBe('');
        expect(cycle.querySelector('[data-ring-label]').style.visibility).toBe('hidden');
        expect(bubble(container, 'cycle').querySelector('[data-ring]').getAttribute('aria-label')).toBe(BUBBLE_TIPS.cycleBlocked);
        const frozen = cycle.getAttribute('data-ring-fraction');
        expect(Number(frozen)).toBeCloseTo(0.5, 1);
        progress({ percent: 90, elapsedMs: 2700, cycleTimeMs: 3000 });
        expect(cycle.getAttribute('data-ring-fraction')).toBe(frozen);
    });

    it('⭐ charges: not just because a hero works it; on hover, and for 2 s after a change', () => {
        vi.useFakeTimers();
        const start = tokenStartingUses('fixture_producer');
        const { container, rerender } = mount(bub({ token: worked({ usesRemaining: start }) }));
        expect(ring(container, 'charges')).toBeNull();

        // Hover.
        rerender(tree(bub({ token: worked({ usesRemaining: start }), isHovered: true })));
        const charges = ring(container, 'charges');
        expect(charges.getAttribute('data-ring-text')).toBe(ringCount(start));
        rerender(tree(bub({ token: worked({ usesRemaining: start }), isHovered: false })));
        expect(ring(container, 'charges')).toBeNull();

        // A change: up for BUBBLE_RECENT_MS, then gone.
        rerender(tree(bub({ token: worked({ usesRemaining: start - 1 }) })));
        advance(GLIDE_START_MS + 1);
        expect(ring(container, 'charges').getAttribute('data-ring-text')).toBe(ringCount(start - 1));
        advance(BUBBLE_RECENT_MS - GLIDE_START_MS - 100);
        expect(ring(container, 'charges')).not.toBeNull();
        advance(200);
        expect(ring(container, 'charges')).toBeNull();
    });

    it('a change while hovered keeps it up past the 2 s', () => {
        vi.useFakeTimers();
        const { container, rerender } = mount(bub({ token: worked({ usesRemaining: 4 }), isHovered: true }));
        rerender(tree(bub({ token: worked({ usesRemaining: 3 }), isHovered: true })));
        advance(BUBBLE_RECENT_MS + 500);
        expect(ring(container, 'charges').getAttribute('data-ring-text')).toBe('3');
    });

    it('unlimited charges draw no charges bubble, worked or hovered', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: null }), isHovered: true }));
        expect(ring(container, 'charges')).toBeNull();
        expect(ring(container, 'cycle')).not.toBeNull();
    });

    it('⭐ in combat: no cycle bubble, and no HP bubble (the health bar replaces it)', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: 4 }) }));
        progress({ percent: 25, combat: true, enemyHp: 30, enemyMaxHp: 40 });
        expect(ring(container, 'cycle')).toBeNull();
        expect(ring(container, 'hp')).toBeNull();
        expect(bubble(container, 'hp')).toBeNull();
        const bar = container.querySelector('[data-health-bar="enemy"]');
        expect(bar.getAttribute('data-health-text')).toBe('30/40');
        expect(Number(bar.getAttribute('data-health-fraction'))).toBeCloseTo(0.75, 2);
        progress({ percent: 75, combat: true, enemyHp: 10, enemyMaxHp: 40 });
        expect(container.querySelector('[data-health-bar="enemy"]').getAttribute('data-health-text')).toBe('10/40');
    });

    it('nothing while the Token is dragged', () => {
        const { container } = mount(bub({
            token: worked(), isDragging: true, isHovered: true, disallowed: true,
            spawner: spawnerRing({ count: 3, cap: 5 }),
            gear: { show: true, pulsing: true, recipe: null }
        }));
        expect(container.querySelector('[data-bubble]')).toBeNull();
        expect(container.querySelector('[data-bubble-row]')).toBeNull();
    });
});

describe('where they sit', () => {
    it('⭐ cycle bottom-left, charges bottom-right, quest bottom-centre', () => {
        const { container } = mount(bub({
            token: worked({ usesRemaining: 4 }), isHovered: true,
            quest: questRing({ currentCount: 1, requiredCount: 4 })
        }));
        const at = (k) => ({ l: parseFloat(bubble(container, k).style.left), t: parseFloat(bubble(container, k).style.top) });
        const cycle = at('cycle');
        const quest = at('quest');
        const slot = container.querySelector('[data-bubble-slot="charges"]');
        const charges = { l: parseFloat(slot.style.left), t: parseFloat(slot.style.top) };
        expect(cycle).toEqual({ l: bubbleSlot('cycle', { boxPx: 128 }).left, t: bubbleSlot('cycle', { boxPx: 128 }).top });
        expect(quest.l + RING_D_U / 2).toBe(64);
        expect(charges.l).toBe(bubbleSlot('charges', { boxPx: 128 }).left);
        expect(cycle.t).toBe(quest.t);
        expect(quest.t).toBe(charges.t);
    });

    it('⭐ the middle row is centred on the box: gear, spawner count, disallow, in that order', () => {
        const { container } = mount(bub({
            token: worked({ heroId: null }), isHovered: true, disallowed: true,
            spawner: spawnerRing({ count: 3, cap: 5 }),
            gear: { show: true, pulsing: false, recipe: null }
        }));
        const row = container.querySelector('[data-bubble-row="middle"]');
        expect(row.style.left).toBe('0px');
        expect(parseFloat(row.style.width)).toBe(128);
        expect(parseFloat(row.style.top)).toBe(64);
        expect(row.style.transform).toContain('translateY(-50%)');
        expect(row.className).toContain('justify-center');
        const kinds = [...row.children].map(c => c.getAttribute('data-bubble') || (c.querySelector('[data-station-gear]') ? 'gear' : '?'));
        expect(kinds).toEqual(['gear', 'spawner', 'disallow']);
    });
});

describe('stuck spawner warning', () => {
    const say = (alert, needs = []) => act(() => {
        EventBus.publish(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, { instanceId: 'tok_r', alert, needs });
    });
    const stuckEl = (c) => c.querySelector('[data-bubble-row="middle"] [data-bubble="stuck"]');
    const tipOf = (c) => {
        fireEvent.pointerEnter(stuckEl(c));
        return document.querySelector('[data-bubble-tip]')?.textContent;
    };

    beforeAll(() => {
        registerItems({
            fixture_stuck_seed: { id: 'fixture_stuck_seed', name: 'Fixture Seed', type: 'resource' },
            fixture_stuck_water: { id: 'fixture_stuck_water', name: 'Fixture Water', type: 'resource' }
        });
    });

    it('needs-item: a yellow bubble in the middle row, naming the items', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        expect(stuckEl(container)).toBeNull();
        say(ALERT.SPAWN_NEEDS_ITEM, ['fixture_stuck_seed']);
        expect(stuckEl(container).querySelector('[data-stuck-badge="needs_item"]')).not.toBeNull();
        expect(tipOf(container)).toBe('Needs Fixture Seed to spawn');
    });

    it('needs-item with two items joins them', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        say(ALERT.SPAWN_NEEDS_ITEM, ['fixture_stuck_seed', 'fixture_stuck_water']);
        expect(tipOf(container)).toBe('Needs Fixture Seed and Fixture Water to spawn');
    });

    it('no-room: a red bubble that says so', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        say(ALERT.SPAWN_NO_ROOM);
        expect(stuckEl(container).querySelector('[data-stuck-badge="no_room"]')).not.toBeNull();
        expect(tipOf(container)).toBe('No room to spawn');
    });

    it('mat full (T-102): a red bubble that says the Token cap is full', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        say(ALERT.SPAWN_MAT_FULL);
        expect(stuckEl(container).querySelector('[data-stuck-badge="mat_full"] img').getAttribute('src')).toContain('ui_alert_red');
        expect(tipOf(container)).toBe('Token cap full');
    });

    it('goes the moment the spawner is no longer stuck, and the state change updates it', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        say(ALERT.SPAWN_NO_ROOM);
        say(ALERT.SPAWN_NEEDS_ITEM, ['fixture_stuck_seed']);
        expect(stuckEl(container).querySelector('[data-stuck-badge="needs_item"]')).not.toBeNull();
        say(null);
        expect(stuckEl(container)).toBeNull();
        expect(container.querySelector('[data-bubble-row="middle"]')).toBeNull();
    });

    it('sits in the middle row beside the spawner count, and a press grabs the Token', () => {
        const grab = vi.fn();
        const { container } = mount(bub({
            token: worked({ heroId: null }), isHovered: true,
            spawner: spawnerRing({ count: 5, cap: 5 }),
            dragProps: { onPointerDown: grab }
        }));
        say(ALERT.SPAWN_NO_ROOM);
        const row = container.querySelector('[data-bubble-row="middle"]');
        expect([...row.children].map(c => c.getAttribute('data-bubble'))).toEqual(['spawner', 'stuck']);
        fireEvent.pointerDown(stuckEl(container));
        expect(grab).toHaveBeenCalledTimes(1);
    });
});

describe('gear and disallow', () => {
    it('the gear shows always while a choice is needed, and on hover once chosen', () => {
        const pending = { show: true, pulsing: true, recipe: null };
        const chosen = { show: true, pulsing: false, recipe: { name: 'R' } };
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), gear: pending }));
        expect(container.querySelector('[data-station-gear="unset"]')).not.toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), gear: chosen })));
        expect(container.querySelector('[data-station-gear]')).toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), gear: chosen, isHovered: true })));
        expect(container.querySelector('[data-station-gear="set"]')).not.toBeNull();
        // No gear for a Token with nothing to choose, hovered or not.
        rerender(tree(bub({ token: worked({ heroId: null }), gear: null, isHovered: true })));
        expect(container.querySelector('[data-station-gear]')).toBeNull();
    });

    it('the disallow mark shows the whole time, hovered or not', () => {
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), disallowed: true }));
        expect(container.querySelector('[data-tile-disallowed]')).not.toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), disallowed: false })));
        expect(container.querySelector('[data-tile-disallowed]')).toBeNull();
    });
});

describe('count bubbles: when they show and how they glide', () => {
    const cases = [
        ['spawner', (v) => ({ spawner: spawnerRing({ count: v, cap: 5 }) }), 3, 4, '4/5'],
        ['quest', (v) => ({ quest: questRing({ currentCount: v, requiredCount: 5 }) }), 2, 3, '3/5']
    ];
    for (const [kind, props, from, to, text] of cases) {
        it(`⭐ ${kind}: hidden at rest, up ~2 s after a change, up on hover`, () => {
            vi.useFakeTimers();
            const { container, rerender } = mount(bub({ token: worked({ heroId: null }), ...props(from) }));
            expect(ring(container, kind)).toBeNull();

            rerender(tree(bub({ token: worked({ heroId: null }), ...props(to) })));
            expect(ring(container, kind)).not.toBeNull();
            advance(GLIDE_START_MS + 1);
            expect(ring(container, kind).getAttribute('data-ring-text')).toBe(text);
            advance(BUBBLE_RECENT_MS);
            expect(ring(container, kind)).toBeNull();

            rerender(tree(bub({ token: worked({ heroId: null }), ...props(to), isHovered: true })));
            expect(ring(container, kind).getAttribute('data-ring-text')).toBe(text);
        });

        it(`⭐ ${kind}: the ring glides: it appears at the old value, then takes the new one`, () => {
            vi.useFakeTimers();
            const { container, rerender } = mount(bub({ token: worked({ heroId: null }), ...props(from) }));
            rerender(tree(bub({ token: worked({ heroId: null }), ...props(to) })));
            const r = ring(container, kind);
            expect(r.getAttribute('data-ring-glide')).toBe('true');       // the CSS transition is on it
            const before = r.getAttribute('data-ring-fraction');
            expect(Number(before)).toBeCloseTo(from / 5, 3);
            advance(GLIDE_START_MS + 1);
            expect(Number(ring(container, kind).getAttribute('data-ring-fraction'))).toBeCloseTo(to / 5, 3);
        });
    }

    it('charges glide too', () => {
        vi.useFakeTimers();
        const { container, rerender } = mount(bub({ token: worked({ usesRemaining: 4 }), isHovered: true }));
        expect(ring(container, 'charges').getAttribute('data-ring-glide')).toBe('true');
        rerender(tree(bub({ token: worked({ usesRemaining: 3 }), isHovered: true })));
        advance(GLIDE_START_MS + 1);
        expect(ring(container, 'charges').getAttribute('data-ring-text')).toBe('3');
    });
});

describe('the timer bubble', () => {
    const grow = (inMs) => () => ({ kind: 'grow', inMs, everyMs: 60000, into: 'fixture_b13_sapling' });

    it('⭐ hidden at rest, up on hover, and by itself in the last 10 s', () => {
        vi.useFakeTimers();
        const read = grow(30000);
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), readTimer: read }));
        expect(bubble(container, 'timer')).toBeNull();

        rerender(tree(bub({ token: worked({ heroId: null }), readTimer: read, isHovered: true })));
        expect(ring(container, 'grow').getAttribute('data-ring-text')).toBe('0:30');
        expect(ring(container, 'grow').querySelector('[data-ring-arc]').getAttribute('stroke')).toBe(RING_COLOUR.grow);
        rerender(tree(bub({ token: worked({ heroId: null }), readTimer: read, isHovered: false })));
        expect(bubble(container, 'timer')).toBeNull();

        const soon = grow(8000);
        cleanup();
        const near = mount(bub({ token: worked({ heroId: null }), readTimer: soon }));
        expect(ring(near.container, 'grow').getAttribute('data-ring-text')).toBe('0:08');
    });

    it('it follows the clock: appears when the countdown enters its last 10 s', () => {
        vi.useFakeTimers();
        let inMs = 12000;
        const read = () => ({ kind: 'turn', inMs, everyMs: 60000, chance: 30, back: false, into: [] });
        const { container } = mount(bub({ token: worked({ heroId: null }), readTimer: read }));
        expect(bubble(container, 'timer')).toBeNull();
        inMs = 9000;
        advance(300);
        expect(ring(container, 'turn').getAttribute('data-ring-text')).toBe('0:09');
        expect(ring(container, 'turn').querySelector('[data-ring-arc]').getAttribute('stroke')).toBe(RING_COLOUR.turn);
    });

    it('sits top-left of the box', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }), readTimer: grow(5000) }));
        const el = bubble(container, 'timer');
        expect(parseFloat(el.style.left)).toBe(bubbleSlot('timer', { boxPx: 128 }).left);
        expect(parseFloat(el.style.top)).toBe(bubbleSlot('timer', { boxPx: 128 }).top);
    });

    it('a Token with no clock has none', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }), readTimer: () => null, isHovered: true }));
        expect(bubble(container, 'timer')).toBeNull();
    });

    it('growth: nextGrowth reads the clock against afterMs; none for a Token that does not grow', () => {
        expect(TimedChanges.nextGrowth({ typeId: 'fixture_bub_grower', clocks: { growMs: 45000 } }))
            .toEqual({ inMs: 15000, into: 'fixture_b13_sapling' });
        expect(TimedChanges.nextGrowth({ typeId: 'fixture_bub_grower' })).toMatchObject({ inMs: 60000 });
        expect(TimedChanges.nextGrowth({ typeId: 'fixture_bub_grower', clocks: { growMs: 99999 } }).inMs).toBe(0);
        expect(TimedChanges.nextGrowth({ typeId: 'fixture_producer' })).toBeNull();
        expect(TimedChanges.nextGrowth({ typeId: 'fixture_bub_grower', turnedFrom: 'x' })).toBeNull();
        expect(TimedChanges.nextGrowth(null)).toBeNull();
    });
});

describe('the floater', () => {
    it('the -1 rides above the charges slot, bubble shown or not', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: 4 }) }));
        expect(ring(container, 'charges')).toBeNull();
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: -1, remaining: 3 }); });
        const floater = container.querySelector('[data-charge-floater]');
        expect(floater.getAttribute('data-charge-floater')).toBe('ring');
        expect(container.querySelector('[data-bubble-slot="charges"]').contains(floater)).toBe(true);
    });

    it('a Token with no charges floats it from the corner', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: null }) }));
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: 50, remaining: 50 }); });
        expect(container.querySelector('[data-charge-floater]').getAttribute('data-charge-floater')).toBe('corner');
    });
});

describe('tooltips and grabbing', () => {
    const everything = () => bub({
        token: worked({ usesRemaining: 4 }), isHovered: true, disallowed: true,
        spawner: spawnerRing({ count: 3, cap: 5 }),
        quest: questRing({ currentCount: 1, requiredCount: 4 }),
        readTimer: () => ({ kind: 'grow', inMs: 30000, everyMs: 60000, into: 'fixture_b13_sapling' })
    });

    it('⭐ hovering a bubble shows what it means; leaving hides it', () => {
        const { container } = mount(everything());
        const expected = {
            cycle: BUBBLE_TIPS.cycle,
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

    it('⭐ pressing a bubble reaches the Token’s drag handle', () => {
        const onPointerDown = vi.fn();
        const { container } = mount(bub({
            token: worked({ usesRemaining: 4 }), isHovered: true, disallowed: true,
            spawner: spawnerRing({ count: 3, cap: 5 }),
            quest: questRing({ currentCount: 1, requiredCount: 4 }),
            dragProps: { onPointerDown }
        }));
        for (const kind of ['cycle', 'charges', 'quest', 'spawner', 'disallow']) {
            onPointerDown.mockClear();
            fireEvent.pointerDown(bubble(container, kind));
            expect(onPointerDown, kind).toHaveBeenCalledTimes(1);
        }
    });

    it('pressing hides an open tooltip', () => {
        const { container } = mount(bub({ token: worked(), dragProps: { onPointerDown: vi.fn() } }));
        const el = bubble(container, 'cycle');
        fireEvent.pointerEnter(el);
        expect(document.body.querySelector('[data-bubble-tip]')).not.toBeNull();
        fireEvent.pointerDown(el);
        expect(document.body.querySelector('[data-bubble-tip]')).toBeNull();
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
    }

    it('⭐ a spawner at 3 of 5: no bubble at rest; hovered, its 3/5 sits in the middle row inside the box', () => {
        const forest = put('fixture_b13_forest');
        put('fixture_b13_sapling', { x: 1200, y: 520 });
        put('fixture_b13_sapling', { x: 1400, y: 300 });
        put('fixture_b13_sapling', { x: 1400, y: 800 });
        const { container } = mount(h(MatBoard));
        const o = container.querySelector(`[data-token-overlay="${forest.id}"]`);
        expect(o.querySelector('[data-ring]')).toBeNull();

        hover(container, forest);
        const r = o.querySelector('[data-bubble-row="middle"] [data-ring="spawner"]');
        expect(r.getAttribute('data-ring-text')).toBe('3/5');
        expect(Number(r.getAttribute('data-ring-fraction'))).toBeCloseTo(0.6, 3);
        const box = parseFloat(o.style.width);
        const row = o.querySelector('[data-bubble-row]');
        expect(parseFloat(row.style.top)).toBe(box / 2);
        expect(parseFloat(row.style.left) + parseFloat(row.style.width) / 2).toBe(box / 2);
        // The name label is above the box.
        const name = o.querySelector('[data-token-name]');
        expect(name.style.bottom).toContain('100%');
        expect(o.querySelector('[data-token-name]').compareDocumentPosition(row)).toBeTruthy();
    });

    it('⭐ a Sapling-like grower shows its growth timer top-left when hovered', () => {
        const g = put('fixture_bub_grower');
        const { container } = mount(h(MatBoard));
        const o = container.querySelector(`[data-token-overlay="${g.id}"]`);
        expect(o.querySelector('[data-bubble="timer"]')).toBeNull();
        hover(container, g);
        const t = o.querySelector('[data-bubble="timer"]');
        expect(t).not.toBeNull();
        expect(t.querySelector('[data-ring]').getAttribute('data-ring')).toBe('grow');
        expect(parseFloat(t.style.left)).toBe(bubbleSlot('timer', { boxPx: parseFloat(o.style.width) }).left);
    });
});

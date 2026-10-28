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
    cycleSecondsText, chargesFraction, ringCount, RING_D_U, RING_STROKE_U, GLIDING_RINGS, TURN_COUNTDOWN_REFRESH_MS
} from '../ui/components/board/ringRow.js';
import { WorkBarFill } from '../ui/components/board/WorkPlateLayer.jsx';
import { PLATE, CELL } from '../ui/components/board/workPlate.js';
import { IDLE_TIPS, idlePlateCells, timerCellOf } from '../ui/components/board/idlePlate.js';
import { MAT_Z } from '../ui/components/board/matLayers.js';
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
 * ⭐ The mat layer (brief 120, C1; concept_token_bars): at rest a Token nobody works shows what is
 * wrong (one problem mark) and nothing else; on hover it gets the idle plate under it (its
 * problem, charges, spawner count, quest progress, timer) and no ring. A worked Token's cycle,
 * charges and problem are on its work plate (`WorkPlate.test.js`): its own box draws none of them,
 * but it still keeps the bar's model, which the plate's fill draws (here: `WorkBarFill` beside it).
 * Where each piece sits, when it shows, the tooltips, and that pressing any of them grabs the
 * Token.
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
/** The node the idle plate draws into, as the mat's `IdlePlateHost`. */
let plateHost = null;
beforeEach(() => {
    plateHost = document.createElement('div');
    plateHost.setAttribute('data-test-plate-host', '');
    document.body.appendChild(plateHost);
});
afterEach(() => { plateHost?.remove(); plateHost = null; });
/** A Token nobody works, rested on by the pointer, with the mat's plate host. */
const idleBub = (props) => bub({ plateHost, x: 400, y: 300, isHovered: true, ...props });
const idlePlate = () => plateHost.querySelector('[data-idle-plate]');
const idleCellKinds = () => [...(idlePlate()?.querySelectorAll('[data-plate-cell]') || [])].map(c => c.getAttribute('data-plate-cell'));
const idleCell = (kind) => idlePlate()?.querySelector(`[data-plate-cell="${kind}"]`) ?? null;
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

    it('the inspection’s charges ring still glides', () => {
        expect([...GLIDING_RINGS]).toEqual(['charges']);
    });

    it('⭐ the idle plate’s cells: the problem, the charges, a spawner, a quest, the timer, in that order', () => {
        const timer = timerCellOf({ kind: 'grow', inMs: 30000, into: 'fixture_b13_sapling' });
        const cells = idlePlateCells({
            problem: { kind: ALERT.INPUTS, severity: SEVERITY.WAITING },
            charges: 4,
            spawner: { count: 3, cap: 5 },
            quest: { currentCount: 12, requiredCount: 10, itemId: 'x' },
            timer
        });
        expect(cells.map(c => c.kind)).toEqual([CELL.PROBLEM, CELL.CHARGES, CELL.SPAWNER, CELL.QUEST, CELL.TIMER]);
        expect(cells[1]).toMatchObject({ count: 4, tip: IDLE_TIPS.charges(4) });
        expect(cells[2]).toMatchObject({ text: '3/5', tip: IDLE_TIPS.spawner('3/5') });
        // A quest past its count reads done, not over.
        expect(cells[3]).toMatchObject({ text: '10/10', itemId: 'x', tip: IDLE_TIPS.quest('10/10') });
        expect(cells[4]).toMatchObject({ text: '0:30', glyph: 'grow' });
        expect(cells[4].tip).toMatch(/^Grows into .* in 0:30$/);
        expect(idlePlateCells({})).toEqual([]);
    });

    it('the timer cell: one glyph per clock, its tip saying what comes; nothing counting, none', () => {
        expect(timerCellOf({ kind: 'respawn', inMs: 15000 })).toMatchObject({ glyph: 'regrow', text: '0:15' });
        expect(timerCellOf({ kind: 'respawn', inMs: 15000 }).tip).toMatch(/^Resting\. Refills in /);
        expect(timerCellOf({ kind: 'respawn', inMs: 15000, paused: true, needsNearby: ['fixture_b13_forest'] }).tip)
            .toBe('Resting. Refills only with Fixture B1.3 Forest nearby');
        expect(timerCellOf({ kind: 'turn', inMs: 5000, chance: 30, back: true }))
            .toMatchObject({ glyph: 'turn', text: '0:05', tip: 'Next roll to turn back in 0:05 (30% chance)' });
        expect(timerCellOf({ kind: 'ripen', inMs: 61000 })).toMatchObject({ glyph: 'grow', text: '1:01' });
        expect(timerCellOf(null)).toBeNull();
    });
});

describe('⭐ at rest: the bar and the marks, nothing else', () => {
    const everything = { spawner: { count: 3, cap: 5 }, quest: { currentCount: 1, requiredCount: 4 } };
    const clock = () => ({ kind: 'grow', inMs: 3000, everyMs: 60000, into: 'fixture_b13_sapling' });

    it('⭐ not worked, nothing wrong: nothing at all, no plate (even in its timer’s last seconds)', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, usesRemaining: 5 }), ...everything, readTimer: clock, plateHost }));
        expect(drawn(container)).toEqual([]);
        expect(plateHost.children).toHaveLength(0);
    });

    it('⭐ a worked Token draws nothing in its own box: its bar and charges are on its plate', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: 5 }), ...everything, readTimer: clock }));
        expect(drawn(container)).toEqual([]);
    });

    it('⭐ a count change does not bring the plate up by itself: charges, spawner, quest', () => {
        vi.useFakeTimers();
        const { container, rerender } = mount(bub({ token: worked({ heroId: null, usesRemaining: 5 }), ...everything, plateHost }));
        rerender(tree(bub({
            token: worked({ heroId: null, usesRemaining: 4 }),
            spawner: { count: 4, cap: 5 },
            quest: { currentCount: 2, requiredCount: 4 },
            plateHost
        })));
        expect(container.querySelector('[data-ring]')).toBeNull();
        advance(100);
        expect(container.querySelector('[data-ring]')).toBeNull();
        expect(plateHost.children).toHaveLength(0);
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
            token: worked({ heroId: null, alert: ALERT.NO_ROOM, usesRemaining: 4 }), isDragging: true, isHovered: true, disallowed: true,
            spawner: { count: 3, cap: 5 }, plateHost, x: 400, y: 300,
            gear: { show: true, pulsing: true, recipe: null }
        }));
        expect(drawn(container)).toEqual([]);
        expect(plateHost.children).toHaveLength(0);
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

describe('⭐ hover: the idle plate under the Token, and the gear', () => {
    const idle = (extra) => worked({ heroId: null, ...extra });

    it('⭐ charges: a plate on hover only, under the Token; unlimited and nothing else to say, no plate; worked, the work plate has them', () => {
        const start = tokenStartingUses('fixture_producer');
        const { container, rerender } = mount(bub({ token: idle({ usesRemaining: start }), plateHost, x: 400, y: 300 }));
        expect(idlePlate()).toBeNull();
        rerender(tree(idleBub({ token: idle({ usesRemaining: start }) })));
        expect(idleCellKinds()).toEqual([CELL.CHARGES]);
        expect(idleCell(CELL.CHARGES).textContent).toBe(ringCount(start));
        // Its own Token's, for the mat's hover and press routing, and in the work plates' layer.
        expect(idlePlate().getAttribute('data-work-plate')).toBe('tok_r');
        rerender(tree(idleBub({ token: idle({ usesRemaining: start }), isHovered: false })));
        expect(idlePlate()).toBeNull();
        rerender(tree(idleBub({ token: idle({ usesRemaining: null }) })));
        expect(idlePlate()).toBeNull();
        rerender(tree(idleBub({ token: worked({ usesRemaining: start }) })));
        expect(idlePlate()).toBeNull();
        // No ring anywhere, ever.
        expect(container.querySelector('[data-ring]')).toBeNull();
        expect(container.querySelector('[data-bubble="charges"]')).toBeNull();
    });

    it('⭐ under the Token itself, centred, tucked under its art', () => {
        mount(idleBub({ token: idle({ usesRemaining: 4 }), typeId: 'fixture_producer' }));
        const slot = plateHost.querySelector('[data-idle-plate-slot]');
        expect(parseFloat(slot.style.left) + parseFloat(slot.style.width) / 2).toBe(400);
        expect(parseFloat(slot.style.top)).toBe(300 + 64 - PLATE.TUCK);
    });

    it('⭐ no host (the plates switched off, or not the rested Token): no plate', () => {
        mount(bub({ token: idle({ usesRemaining: 4 }), isHovered: true, x: 400, y: 300 }));
        expect(document.querySelector('[data-idle-plate]')).toBeNull();
    });

    it('⭐ an enemy never shows charges and gets no plate: hovered, its name and HP only (rule 6)', () => {
        const enemy = { typeId: 'fixture_enemy', instanceId: 'tok_r', heroId: null, alert: null, usesRemaining: 20 };
        const { container } = mount(idleBub({ token: enemy }));
        expect(idlePlate()).toBeNull();
        expect(ring(container, 'charges')).toBeNull();
        expect(bubble(container, 'charges')).toBeNull();
        expect(container.querySelector('[data-health-bar="enemy"]')).not.toBeNull();
    });

    it('a change while hovered redraws the same cell', () => {
        const { rerender } = mount(idleBub({ token: idle({ usesRemaining: 4 }) }));
        const cell = idleCell(CELL.CHARGES);
        rerender(tree(idleBub({ token: idle({ usesRemaining: 3 }) })));
        expect(idleCell(CELL.CHARGES)).toBe(cell);
        expect(cell.textContent).toBe('3');
    });

    for (const [kind, props, text] of [
        [CELL.SPAWNER, { spawner: { count: 4, cap: 5 } }, '4/5'],
        [CELL.QUEST, { quest: { currentCount: 3, requiredCount: 5 } }, '3/5']
    ]) {
        it(`⭐ ${kind}: hidden at rest, its count on the plate on hover`, () => {
            const { container, rerender } = mount(bub({ token: idle(), ...props, plateHost, x: 400, y: 300 }));
            expect(idlePlate()).toBeNull();
            rerender(tree(idleBub({ token: idle(), ...props })));
            expect(idleCellKinds()).toEqual([kind]);
            expect(idleCell(kind).textContent).toBe(text);
            expect(container.querySelector('[data-ring]')).toBeNull();
        });
    }

    it('⭐ the timer: only while hovered, on the plate, polling only while it shows', () => {
        vi.useFakeTimers();
        const read = () => ({ kind: 'grow', inMs: 30000, everyMs: 60000, into: 'fixture_b13_sapling' });
        const { container, rerender } = mount(bub({ token: idle(), readTimer: read, plateHost, x: 400, y: 300 }));
        expect(idlePlate()).toBeNull();
        expect(vi.getTimerCount()).toBe(0);

        rerender(tree(idleBub({ token: idle(), readTimer: read })));
        expect(idleCellKinds()).toEqual([CELL.TIMER]);
        expect(idleCell(CELL.TIMER).textContent).toBe('0:30');
        expect(idleCell(CELL.TIMER).querySelector('img').getAttribute('src')).toContain('svg');
        expect(container.querySelector('[data-ring]')).toBeNull();
        expect(vi.getTimerCount()).toBe(1);

        rerender(tree(idleBub({ token: idle(), readTimer: read, isHovered: false })));
        expect(idlePlate()).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a hovered timer follows the clock', () => {
        vi.useFakeTimers();
        let inMs = 12000;
        const read = () => ({ kind: 'turn', inMs, everyMs: 60000, chance: 30, back: false, into: [] });
        mount(idleBub({ token: idle(), readTimer: read }));
        expect(idleCell(CELL.TIMER).textContent).toBe('0:12');
        inMs = 9000;
        advance(TURN_COUNTDOWN_REFRESH_MS + 50);
        expect(idleCell(CELL.TIMER).textContent).toBe('0:09');
    });

    it('a Token with no clock running and nothing else to say: no plate (the name still shows)', () => {
        mount(idleBub({ token: idle(), readTimer: () => null }));
        expect(idlePlate()).toBeNull();
    });

    it('⭐ a problem: in the plate, the frame its colour, and the mark stays on the Token (rule 2)', () => {
        const { container } = mount(idleBub({ token: idle({ alert: ALERT.NO_ROOM, usesRemaining: 4 }) }));
        expect(idleCellKinds()).toEqual([CELL.PROBLEM, CELL.CHARGES]);
        expect(idlePlate().getAttribute('data-work-plate-tone')).toBe(SEVERITY.CANT);
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.NO_ROOM);
        // Its hover says exactly what, as the mark's does.
        fireEvent.pointerEnter(idleCell(CELL.PROBLEM));
        expect(document.body.querySelector('[data-bubble-tip]').textContent).toMatch(/^No room for what it makes$|^Token cap full$/);
    });

    it('a choice waiting is not repeated on the plate: hovered, its mark is the gear', () => {
        const gear = { show: true, pulsing: true, recipe: null, onClick: vi.fn() };
        const { container } = mount(idleBub({ token: idle({ usesRemaining: 4 }), gear, artUnit: 2 }));
        expect(idleCellKinds()).toEqual([CELL.CHARGES]);
        expect(idlePlate().getAttribute('data-work-plate-tone')).toBeNull();
        expect(container.querySelector('[data-gear-in-mark]')).not.toBeNull();
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
            spawner: { count: 3, cap: 5 },
            gear: { show: true, pulsing: false, recipe: null }
        }));
        const row = container.querySelector('[data-bubble-row="middle"]');
        expect(parseFloat(row.style.width)).toBe(128);
        expect(parseFloat(row.style.top)).toBe(64);
        expect(row.style.transform).toContain('translateY(-50%)');
        const kinds = [...row.children].map(c => c.getAttribute('data-bubble') || (c.hasAttribute('data-problem-mark') ? 'problem' : '?'));
        expect(kinds).toEqual(['problem', 'marked', 'disallow']);
    });

    it('⭐ hovering never moves a mark: the gear comes up in a row of its own, above the marks', () => {
        // A chosen recipe waiting on items: its '!' stays (only a choice waiting swaps for the gear).
        const props = {
            token: worked({ heroId: null, alert: ALERT.INPUTS }), gear: { show: true, pulsing: false, recipe: { name: 'R' }, onClick: () => {} },
            spawner: { count: 3, cap: 5 }, plateHost, x: 400, y: 300
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
            .toEqual(['gear']);
        // The spawner's count is on the plate under the Token, not beside the marks.
        expect(idleCellKinds()).toContain(CELL.SPAWNER);
        // Above the marks: its bottom edge clear of the mark's top (16 art pixels at 2 units, centred at 64).
        expect(hoverRow.style.transform).toContain('translateY(-100%)');
        expect(parseFloat(hoverRow.style.top)).toBeLessThanOrEqual(64 - 16);
    });

    it('with no marks, the hover row sits at the centre', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }), isHovered: true, gear: { show: true, pulsing: false, recipe: { name: 'R' }, onClick: () => {} } }));
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

describe('⭐ a choice waiting: hovered, its \'!\' becomes the 2x gear in the same spot', () => {
    const unset = (extra = {}) => ({ show: true, pulsing: true, recipe: null, onClick: vi.fn(), ...extra });
    const middle = (c) => c.querySelector('[data-bubble-row="middle"]');
    const gearIn = (c) => c.querySelector('[data-gear-in-mark]');

    it('⭐ an unset station and a Foundation: the mark at rest, the gear in its place on hover, the mark again after', () => {
        for (const [gear, kind] of [[unset(), ALERT.CHOOSE_RECIPE], [unset({ isFoundation: true }), ALERT.CHOOSE_BUILD]]) {
            const { container, rerender } = mount(bub({ token: worked({ heroId: null }), gear, artUnit: 2 }));
            const row = middle(container);
            const rowStyle = row.getAttribute('style');
            expect(mark(container).getAttribute('data-problem-mark')).toBe(kind);
            expect(gearIn(container)).toBeNull();

            rerender(tree(bub({ token: worked({ heroId: null }), gear, artUnit: 2, isHovered: true })));
            // The same row, unmoved, with the gear where the mark was and no '!' and no second gear.
            expect(middle(container)).toBe(row);
            expect(row.getAttribute('style')).toBe(rowStyle);
            expect(mark(container)).toBeNull();
            expect(row.firstElementChild).toBe(gearIn(container));
            expect(gearIn(container).getAttribute('data-gear-in-mark')).toBe(kind);
            expect(container.querySelector('[data-bubble-row="hover"]')).toBeNull();
            expect(container.querySelectorAll('[data-station-gear]')).toHaveLength(1);
            // Drawn at its 32px sprite's 2x: 64.
            const button = gearIn(container).querySelector('button');
            expect(button.getAttribute('data-gear-px')).toBe('64');
            expect(button.style.width).toBe('64px');
            expect(button.querySelector('img').style.width).toBe('64px');
            // Its click opens the picker, as the mark's did.
            fireEvent.click(button);
            expect(gear.onClick).toHaveBeenCalledTimes(1);

            rerender(tree(bub({ token: worked({ heroId: null }), gear, artUnit: 2 })));
            expect(mark(container).getAttribute('data-problem-mark')).toBe(kind);
            expect(gearIn(container)).toBeNull();
            cleanup();
        }
    });

    it('the gear follows the Token’s art-pixel size, as the mark does', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }), gear: unset(), artUnit: 3, isHovered: true }));
        expect(gearIn(container).querySelector('button').getAttribute('data-gear-px')).toBe('96');
    });

    it('⭐ waiting on items or room, or a can’t: the \'!\' stays on hover, and a chosen recipe’s gear stays in its own row', () => {
        const chosen = { show: true, pulsing: false, recipe: { name: 'R' }, onClick: vi.fn() };
        for (const [alert, gear] of [[ALERT.INPUTS, chosen], [ALERT.NO_ROOM, chosen], [ALERT.NO_ROOM, unset()]]) {
            const { container } = mount(bub({ token: worked({ heroId: null, alert }), gear, artUnit: 2, isHovered: true }));
            expect(mark(container).getAttribute('data-problem-mark')).toBe(alert);
            expect(gearIn(container)).toBeNull();
            expect(container.querySelector('[data-bubble-row="hover"] [data-station-gear]')).not.toBeNull();
            cleanup();
        }
    });

    it('no gear to show, marked for demolition, or worked: no swap', () => {
        // An engine choose alert with no gear (nothing to pick from): the mark stays.
        let r = mount(bub({ token: worked({ heroId: null, alert: ALERT.CHOOSE_RECIPE }), isHovered: true }));
        expect(mark(r.container).getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_RECIPE);
        expect(gearIn(r.container)).toBeNull();
        cleanup();
        r = mount(bub({ token: worked({ heroId: null }), gear: unset(), marked: true, isHovered: true }));
        expect(gearIn(r.container)).toBeNull();
        expect(r.container.querySelector('[data-station-gear]')).toBeNull();
        cleanup();
        r = mount(bub({ token: worked(), gear: unset(), isHovered: true }));
        expect(gearIn(r.container)).toBeNull();
        expect(mark(r.container)).toBeNull();
    });

    it('beside the disallow mark the gear keeps the mark’s centre', () => {
        // The first item's centre in a centred row is fixed by what follows it, not by its own width.
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), gear: unset(), disallowed: true }));
        const kinds = (c) => [...middle(c).children].map(el => (el.hasAttribute('data-gear-in-mark') ? 'gear' : el.hasAttribute('data-problem-mark') ? 'problem' : el.getAttribute('data-bubble')));
        expect(kinds(container)).toEqual(['problem', 'disallow']);
        rerender(tree(bub({ token: worked({ heroId: null }), gear: unset(), disallowed: true, isHovered: true })));
        expect(kinds(container)).toEqual(['gear', 'disallow']);
    });

    it('pressing the gear grabs the Token, as pressing the mark did', () => {
        const grab = vi.fn();
        const { container } = mount(bub({ token: worked({ heroId: null }), gear: unset(), isHovered: true, dragProps: { onPointerDown: grab } }));
        fireEvent.pointerDown(gearIn(container).querySelector('button'));
        expect(grab).toHaveBeenCalledTimes(1);
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
    it('⭐ nothing is drawn for it at rest; a -1 rides from the corner', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, usesRemaining: 4 }) }));
        expect(drawn(container)).toEqual([]);
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: -1, remaining: 3 }); });
        expect(container.querySelector('[data-charge-floater]').getAttribute('data-charge-floater')).toBe('corner');
    });

    it('a Token with no charges floats it from the corner', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: null }) }));
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: 50, remaining: 50 }); });
        expect(container.querySelector('[data-charge-floater]').getAttribute('data-charge-floater')).toBe('corner');
    });
});

describe('tooltips and grabbing', () => {
    const everything = () => idleBub({
        token: worked({ heroId: null, usesRemaining: 4 }), disallowed: true,
        spawner: { count: 3, cap: 5 },
        quest: { currentCount: 1, requiredCount: 4 },
        readTimer: () => ({ kind: 'grow', inMs: 30000, everyMs: 60000, into: 'fixture_b13_sapling' })
    });

    it('⭐ hovering a plate cell or a player mark shows what it means; leaving hides it', () => {
        const { container } = mount(everything());
        const tipOf = (el) => {
            fireEvent.pointerEnter(el);
            const text = document.body.querySelector('[data-bubble-tip]')?.textContent;
            fireEvent.pointerLeave(el);
            expect(document.body.querySelector('[data-bubble-tip]')).toBeNull();
            return text;
        };
        expect(tipOf(idleCell(CELL.CHARGES))).toBe(IDLE_TIPS.charges(4));
        expect(tipOf(idleCell(CELL.QUEST))).toBe(IDLE_TIPS.quest('1/4'));
        expect(tipOf(idleCell(CELL.SPAWNER))).toBe(IDLE_TIPS.spawner('3/5'));
        expect(tipOf(idleCell(CELL.TIMER))).toMatch(/^Grows into .* in 0:30$/);
        expect(tipOf(bubble(container, 'disallow'))).toBe(BUBBLE_TIPS.disallow);
    });

    it('⭐ pressing the plate or a mark reaches the Token’s drag handle', () => {
        const onPointerDown = vi.fn();
        const { container } = mount(idleBub({
            token: worked({ heroId: null, usesRemaining: 4, alert: ALERT.INPUTS }), disallowed: true,
            spawner: { count: 3, cap: 5 },
            quest: { currentCount: 1, requiredCount: 4 },
            dragProps: { onPointerDown }
        }));
        for (const kind of [CELL.CHARGES, CELL.QUEST, CELL.SPAWNER]) {
            onPointerDown.mockClear();
            fireEvent.pointerDown(idleCell(kind));
            expect(onPointerDown, kind).toHaveBeenCalledTimes(1);
        }
        onPointerDown.mockClear();
        fireEvent.pointerDown(bubble(container, 'disallow'));
        expect(onPointerDown).toHaveBeenCalledTimes(1);
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

    it('⭐ a spawner at 3 of 5: nothing at rest; hovered, its 3/5 on a plate under it, over the loot, the name below the plate', () => {
        vi.useFakeTimers();
        const forest = put('fixture_b13_forest');
        put('fixture_b13_sapling', { x: 1200, y: 520 });
        put('fixture_b13_sapling', { x: 1400, y: 300 });
        put('fixture_b13_sapling', { x: 1400, y: 800 });
        const { container } = mount(h(MatBoard));
        const o = container.querySelector(`[data-token-overlay="${forest.id}"]`);
        const host = container.querySelector('[data-idle-plates]');
        expect(Number(host.style.zIndex)).toBe(MAT_Z.WORK_PLATE);
        expect(o.querySelector('[data-ring]')).toBeNull();
        expect(o.querySelector('[data-bubble-row]')).toBeNull();
        expect(host.querySelector('[data-idle-plate]')).toBeNull();

        hover(container, forest);
        const plate = host.querySelector(`[data-idle-plate="${forest.id}"]`);
        expect(plate.querySelector('[data-plate-cell="spawner"]').textContent).toBe('3/5');
        expect(o.querySelector('[data-ring]')).toBeNull();
        const slot = host.querySelector('[data-idle-plate-slot]');
        expect(parseFloat(slot.style.left) + parseFloat(slot.style.width) / 2).toBe(forest.x);
        expect(parseFloat(slot.style.top)).toBeGreaterThan(forest.y);
        // The name sits under the box, dropped past the plate.
        const name = o.querySelector('[data-token-name]');
        expect(name.style.top).toContain('100%');
        expect(name.style.top).not.toBe('calc(100% + 4px)');
    });

    it('⭐ a Sapling-like grower shows its growth time on its plate only when hovered', () => {
        vi.useFakeTimers();
        const g = put('fixture_bub_grower');
        const { container } = mount(h(MatBoard));
        const host = container.querySelector('[data-idle-plates]');
        expect(host.querySelector('[data-idle-plate]')).toBeNull();
        hover(container, g);
        const cell = host.querySelector(`[data-idle-plate="${g.id}"] [data-plate-cell="timer"]`);
        expect(cell.textContent).toMatch(/^\d+:\d\d$/);
        expect(container.querySelector('[data-ring]')).toBeNull();
    });

    it('⭐ the name steps down past the idle plate; with nothing to say, no plate and the name where it was', () => {
        vi.useFakeTimers();
        const t = put('fixture_producer');
        const bare = put('fixture_b13_sapling', { x: 1200, y: 520 });
        const { container } = mount(h(MatBoard));
        const nameTop = (tok) => container.querySelector(`[data-token-overlay="${tok.id}"] [data-token-name]`).style.top;
        hover(container, t);
        expect(container.querySelector(`[data-idle-plate="${t.id}"]`)).not.toBeNull();
        expect(nameTop(t)).not.toBe('calc(100% + 4px)');
        hover(container, bare);
        expect(container.querySelector('[data-idle-plate]')).toBeNull();
        expect(nameTop(bare)).toBe('calc(100% + 4px)');
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

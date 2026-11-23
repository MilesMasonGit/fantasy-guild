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
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import {
    cycleSecondsText, chargesFraction, ringCount, RING_D_U, RING_STROKE_U, GLIDING_RINGS
} from '../ui/components/board/ringRow.js';
import { WorkBarTrack } from '../ui/components/board/WorkBarLayer.jsx';
import { BAR, nameFootOf, barPlace } from '../ui/components/board/matMarks.js';
import { bubbleOutputOf } from '../ui/components/board/RecipeBubble.jsx';
import { isCapSeen, resetCapSeen } from '../ui/components/board/capSeen.js';
import { PROBLEM_SPRITE, SEVERITY } from '../ui/components/board/problemMark.js';
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
 * ⭐ The marks on a Token (brief 830 D3, concept_playmat_declutter §3, §11, §12, §15): at rest a
 * Token shows what is wrong (one still '!' in its centre) and nothing else; no plate, no timers,
 * no charges, no tooltip anywhere. On hover: its name, the gear in its centre (a Token that takes
 * a recipe), and, resting on a station with a recipe chosen, that recipe's output in a speech
 * bubble. A worked Token's cycle is its work bar (`WorkBar.test.js`): its own box draws none of
 * it, but it keeps the bar's model, which the bar draws (here: `WorkBarTrack` beside it).
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
/** The Token's bubbles with its work bar beside them, as on the mat. */
const withFill = (props, blocked = false) => [
    h(TokenBubbles, { key: 'b', instanceId: 'tok_r', boxPx: 128, ...props }),
    h(WorkBarTrack, { key: 'f', instanceId: 'tok_r', blocked })
];
const bar = (c) => c.querySelector('[data-work-bar]');
const mark = (c) => c.querySelector('[data-problem-mark]');
const centre = (c) => c.querySelector('[data-bubble-row="centre"]');
const progress = (p) => act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_r', ...p }); });
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
/** Past the next step of the shared step clock (its timer, then its frame). */
const step = () => advance(STEP_MS + 20);
/** Every element the Token's bubbles drew (dnd-kit's own announcer left out). */
const drawn = (c) => [...c.querySelector('[data-under-test]').querySelectorAll('*')];
const say = (alert, needs = []) => act(() => {
    EventBus.publish(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, { instanceId: 'tok_r', alert, needs });
});

beforeEach(() => resetCapSeen());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

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

    it('a recipe’s bubble shows its anchored output, else its first; a building recipe its Token', () => {
        expect(bubbleOutputOf({ outputs: [{ itemId: 'a' }, { itemId: 'b', anchor: true }] })).toBe('b');
        expect(bubbleOutputOf({ outputs: [{ itemId: 'a' }, { itemId: 'b' }] })).toBe('a');
        expect(bubbleOutputOf({ outputs: [{ tokenId: 'token_x' }] })).toBe('token_x');
        expect(bubbleOutputOf({ outputs: [] })).toBeNull();
        expect(bubbleOutputOf(null)).toBeNull();
    });
});

describe('⭐ at rest: the marks, nothing else', () => {
    it('⭐ not worked, nothing wrong: nothing at all', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, usesRemaining: 5 }) }));
        expect(drawn(container)).toEqual([]);
    });

    it('⭐ a worked Token draws nothing in its own box: its bar is in the bar layer, and no charges anywhere', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: 5 }) }));
        expect(drawn(container)).toEqual([]);
    });

    it('⭐ hovered, a Token with nothing wrong and nothing to choose: still nothing in its box (no plate, no timer)', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, usesRemaining: 5 }), isHovered: true, pointerOn: true }));
        expect(drawn(container)).toEqual([]);
    });

    it('⭐ a worked Token with a problem: one mark in its centre, as nobody working it would', () => {
        const { container } = mount(bub({ token: worked({ alert: ALERT.INPUTS }) }));
        expect(container.querySelectorAll('[data-bubble-row="centre"] [data-problem-mark]')).toHaveLength(1);
    });

    it('nothing while the Token is dragged', () => {
        const { container } = mount(bub({
            token: worked({ heroId: null, alert: ALERT.NO_ROOM, usesRemaining: 4 }), isDragging: true, isHovered: true, marked: true,
            gear: { show: true, pulsing: true, recipe: null }
        }));
        expect(drawn(container)).toEqual([]);
    });
});

describe('the work bar', () => {
    const fillOf = (c) => Number(bar(c).getAttribute('data-work-bar-fill'));

    const W = BAR.W;

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

    it('⭐ the bar is the work green with a lighter top row and a darker foot row; grey while blocked (tailwind.css)', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const css = fs.readFileSync(path.resolve(__dirname, '../tailwind.css'), 'utf8');
        expect(css).toMatch(/--color-work-bar: var\(--color-gi-success\);/);
        expect(css).toMatch(/\.gi-work-bar::after\s*\{[^}]*linear-gradient\(to bottom, var\(--color-work-bar-hi\) 0 25%, var\(--color-work-bar\) 25% 75%, var\(--color-work-bar-lo\) 75% 100%\)/);
        expect(css).toMatch(/\.gi-work-bar\[data-work-bar-blocked\]::after\s*\{\s*background: linear-gradient\(to bottom, var\(--color-work-bar-blocked-hi\)/);
        expect(css).toMatch(/\.gi-work-bar::after\s*\{[^}]*transform: scaleX\(var\(--work-bar-fill, 0\)\);/);
    });

    it('⭐ in a fight: no bar; the enemy health bar instead', () => {
        const { container } = mount(bub({ token: worked({ usesRemaining: 4 }) }));
        progress({ percent: 25, combat: true, enemyHp: 30, enemyMaxHp: 40 });
        expect(bar(container)).toBeNull();
        const hb = container.querySelector('[data-health-bar="enemy"]');
        expect(hb.getAttribute('data-health-text')).toBe('30/40');
        progress({ percent: 75, combat: true, enemyHp: 10, enemyMaxHp: 40 });
        expect(container.querySelector('[data-health-bar="enemy"]').getAttribute('data-health-text')).toBe('10/40');
    });

    it('the bar is drawn in the bar layer, not in the Token box', () => {
        const { container } = mount(bub({ token: worked() }));
        expect(bar(container)).toBeNull();
    });
});


describe('⭐ the centre: one thing at a time', () => {
    const unset = (extra = {}) => ({ show: true, pulsing: true, recipe: null, onClick: vi.fn(), ...extra });
    const chosen = (extra = {}) => ({ show: true, pulsing: false, recipe: { name: 'R', outputs: [{ itemId: 'fixture_glowcap' }] }, onClick: vi.fn(), ...extra });

    it('⭐ the \'!\' is in the Token\'s centre, still, at the Token\'s art-pixel size, with a hard shadow', () => {
        vi.useFakeTimers();
        const { container } = mount(bub({ token: worked({ heroId: null, alert: ALERT.INPUTS }), artUnit: 2 }));
        const row = centre(container);
        expect(parseFloat(row.style.width)).toBe(128);
        expect(parseFloat(row.style.top)).toBe(64);
        expect(row.style.transform).toContain('translateY(-50%)');
        expect(row.firstElementChild).toBe(mark(container));
        expect(mark(container).style.width).toBe('32px');
        expect(mark(container).style.filter).toBe('drop-shadow(2px 2px 0 #000)');
        // Still: nothing moves it, and nothing is scheduled to.
        advance(3000);
        expect(mark(container).style.transform).toBe('');
        expect(vi.getTimerCount()).toBe(0);
        expect(container.querySelector('[data-bubble-row="above"]')).toBeNull();
    });

    it('⭐ the pointer on a Token that takes a recipe: the gear in the centre at once, in place of any \'!\', the \'!\' again after', () => {
        for (const [gear, alert] of [[unset(), null], [unset({ isFoundation: true }), null], [chosen(), ALERT.INPUTS], [chosen(), ALERT.NO_ROOM], [chosen(), null]]) {
            const token = worked({ heroId: null, alert });
            const { container, rerender } = mount(bub({ token, gear, artUnit: 2 }));
            const atRest = mark(container)?.getAttribute('data-problem-mark') ?? null;
            expect(container.querySelector('[data-station-gear]')).toBeNull();
            // The bare hover, not the rest: the swap does not wait.
            rerender(tree(bub({ token, gear, artUnit: 2, pointerOn: true })));
            expect(mark(container)).toBeNull();
            expect(container.querySelectorAll('[data-station-gear]')).toHaveLength(1);
            expect(centre(container).querySelector('[data-station-gear]')).not.toBeNull();
            expect(container.querySelector('[data-station-gear]').getAttribute('data-station-gear')).toBe(gear.pulsing ? 'unset' : 'set');
            // Drawn the mark's size: its 16 art pixels at the Token's art pixel, 32.
            const button = container.querySelector('[data-station-gear] button');
            expect(button.getAttribute('data-gear-px')).toBe('32');
            rerender(tree(bub({ token, gear, artUnit: 2 })));
            expect(mark(container)?.getAttribute('data-problem-mark') ?? null).toBe(atRest);
            cleanup();
        }
    });

    it('⭐ a click on the gear does what a right-click does (the card opens: `gear.onClick`), and a press grabs the Token', () => {
        const grab = vi.fn();
        for (const gear of [unset(), chosen()]) {
            const { container } = mount(bub({ token: worked({ heroId: null }), gear, pointerOn: true, dragProps: { onPointerDown: grab } }));
            const button = container.querySelector('[data-station-gear] button');
            fireEvent.click(button);
            expect(gear.onClick).toHaveBeenCalledTimes(1);
            grab.mockClear();
            fireEvent.pointerDown(button);
            expect(grab).toHaveBeenCalledTimes(1);
            cleanup();
        }
    });

    it('the gear follows the Token’s art-pixel size, as the mark does', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }), gear: unset(), artUnit: 3, isHovered: true }));
        expect(container.querySelector('[data-station-gear] button').getAttribute('data-gear-px')).toBe('48');
    });

    it('⭐ marked for demolition: its badge in the centre the whole time, over any \'!\', and no gear', () => {
        const { container, rerender } = mount(bub({ token: worked({ heroId: null, alert: ALERT.NO_ROOM }), marked: true, gear: unset() }));
        expect(centre(container).querySelector('[data-demolish-badge]')).not.toBeNull();
        expect(mark(container)).toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null, alert: ALERT.NO_ROOM }), marked: true, gear: unset(), isHovered: true, pointerOn: true })));
        expect(centre(container).querySelector('[data-demolish-badge]')).not.toBeNull();
        expect(container.querySelector('[data-station-gear]')).toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }) })));
        expect(container.querySelector('[data-demolish-badge]')).toBeNull();
    });

    it('⭐ an enemy’s health bar and its \'!\' show together: the bar no longer hides the mark', () => {
        const enemy = { typeId: 'fixture_enemy', instanceId: 'tok_r', heroId: null, alert: ALERT.NO_ROOM, usesRemaining: 3 };
        const { container } = mount(bub({ token: enemy, isHovered: true, artUnit: 2 }));
        expect(container.querySelector('[data-health-bar="enemy"]')).not.toBeNull();
        expect(mark(container)).not.toBeNull();
    });

    it('an engine choose alert with no gear (nothing to pick from): the mark stays on hover', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, alert: ALERT.CHOOSE_RECIPE }), isHovered: true, pointerOn: true }));
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_RECIPE);
    });
});

describe('⭐ the problem mark on a Token', () => {
    beforeAll(() => {
        registerItems({
            fixture_stuck_seed: { id: 'fixture_stuck_seed', name: 'Fixture Seed', type: 'resource' },
            fixture_stuck_water: { id: 'fixture_stuck_water', name: 'Fixture Water', type: 'resource' }
        });
    });

    it('⭐ no tooltip: hovering the mark shows nothing', () => {
        const { container } = mount(bub({ token: worked({ heroId: null, alert: ALERT.NO_ROOM }) }));
        fireEvent.pointerEnter(mark(container));
        fireEvent.mouseEnter(mark(container));
        expect(document.body.querySelector('[data-tooltip]')).toBeNull();
        expect(document.body.querySelector('[data-bubble-tip]')).toBeNull();
        expect(mark(container).getAttribute('title')).toBeNull();
    });

    it('a spawner short of items: a yellow mark; red with no room; yellow at a full Token cap', () => {
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        expect(mark(container)).toBeNull();
        say(ALERT.SPAWN_NEEDS_ITEM, ['fixture_stuck_seed', 'fixture_stuck_water']);
        expect(mark(container).getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        expect(mark(container).getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.WAITING]);
        say(ALERT.SPAWN_NO_ROOM);
        expect(mark(container).getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.CANT]);
        say(ALERT.SPAWN_MAT_FULL);
        expect(mark(container).getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        expect(mark(container).getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.WAITING]);
        say(null);
        expect(mark(container)).toBeNull();
    });

    it('⭐ a full Token cap’s \'!\' goes once the pointer rests on that spawner, and comes back only after the cap frees and fills again', () => {
        const props = { token: worked({ heroId: null }) };
        const { container, rerender } = mount(bub(props));
        say(ALERT.SPAWN_MAT_FULL);
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.SPAWN_MAT_FULL);
        // The bare hover is not enough: the rest is.
        rerender(tree(bub({ ...props, pointerOn: true })));
        expect(mark(container)).not.toBeNull();
        rerender(tree(bub({ ...props, pointerOn: true, isHovered: true })));
        expect(mark(container)).toBeNull();
        expect(isCapSeen('tok_r')).toBe(true);
        // Gone after the pointer leaves, and still gone when remounted (a drag, a redraw).
        rerender(tree(bub(props)));
        expect(mark(container)).toBeNull();
        cleanup();
        const again = mount(bub(props));
        expect(mark(again.container)).toBeNull();
        // Another spawner at the same cap still shows its '!'.
        const other = mount(h(TokenBubbles, { instanceId: 'tok_other', boxPx: 128, token: { ...props.token, instanceId: 'tok_other' } }));
        act(() => { EventBus.publish(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, { instanceId: 'tok_other', alert: ALERT.SPAWN_MAT_FULL, needs: [] }); });
        expect(mark(other.container)).not.toBeNull();
        // The cap frees: nothing to show; it fills again: the '!' is back.
        say(null);
        expect(mark(again.container)).toBeNull();
        expect(isCapSeen('tok_r')).toBe(false);
        say(ALERT.SPAWN_MAT_FULL);
        expect(mark(again.container).getAttribute('data-problem-mark')).toBe(ALERT.SPAWN_MAT_FULL);
    });

    it('a seen cap does not hide another problem: a spawner short of items still shows', () => {
        const props = { token: worked({ heroId: null }) };
        const { container, rerender } = mount(bub(props));
        say(ALERT.SPAWN_MAT_FULL);
        rerender(tree(bub({ ...props, isHovered: true })));
        expect(mark(container)).toBeNull();
        say(ALERT.SPAWN_NEEDS_ITEM, ['fixture_stuck_seed']);
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.SPAWN_NEEDS_ITEM);
    });

    it('⭐ a Stump with no Forest in reach, or stopped for want of a seedling: a yellow mark (brief 230 S2a)', () => {
        const grow = (alert, needs = []) => act(() => {
            EventBus.publish(BOARD_EVENTS.GROWTH_ALERT_CHANGED, { instanceId: 'tok_r', alert, needs });
        });
        const { container } = mount(bub({ token: worked({ heroId: null }) }));
        grow(ALERT.GROW_NEEDS_NEARBY, ['fixture_b13_forest']);
        expect(mark(container).getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        grow(ALERT.GROW_NEEDS_ITEM, ['fixture_stuck_seed']);
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.GROW_NEEDS_ITEM);
        grow(null);
        expect(mark(container)).toBeNull();
    });

    it('⭐ an unset station or Foundation: the yellow mark says choose, and a click on it opens the card', () => {
        const onClick = vi.fn();
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), gear: { show: true, pulsing: true, recipe: null, onClick } }));
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_RECIPE);
        expect(mark(container).getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        fireEvent.click(mark(container));
        expect(onClick).toHaveBeenCalledTimes(1);
        rerender(tree(bub({ token: worked({ heroId: null }), gear: { show: true, pulsing: true, recipe: null, isFoundation: true, onClick } })));
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_BUILD);
        rerender(tree(bub({ token: worked({ heroId: null }), gear: { show: true, pulsing: false, recipe: { name: 'R' }, onClick } })));
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
        say(ALERT.SPAWN_NO_ROOM);
        expect(container.querySelectorAll('[data-problem-mark]')).toHaveLength(1);
        expect(mark(container).getAttribute('data-problem-mark')).toBe(ALERT.SPAWN_NO_ROOM);
    });
});

describe('⭐ the recipe bubble', () => {
    const chosen = { show: true, pulsing: false, recipe: { name: 'R', outputs: [{ itemId: 'fixture_glowcap' }] }, onClick: vi.fn() };

    it('⭐ resting on a station with a recipe chosen: its output in a speech bubble over the art; never at rest', () => {
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), gear: chosen, artPx: 128, artUnit: 2 }));
        expect(container.querySelector('[data-recipe-bubble]')).toBeNull();
        // The bare hover is not the rest: a sweep shows none.
        rerender(tree(bub({ token: worked({ heroId: null }), gear: chosen, artPx: 128, artUnit: 2, pointerOn: true })));
        expect(container.querySelector('[data-recipe-bubble]')).toBeNull();
        rerender(tree(bub({ token: worked({ heroId: null }), gear: chosen, artPx: 128, artUnit: 2, pointerOn: true, isHovered: true })));
        const bubble = container.querySelector('[data-recipe-bubble]');
        expect(bubble.getAttribute('data-recipe-bubble')).toBe('fixture_glowcap');
        // The hero speech bubble's frame, with its tail.
        expect(bubble.querySelector('[data-speech-tone]')).not.toBeNull();
        expect(bubble.querySelector('[data-speech-tail]')).not.toBeNull();
        expect(bubble.querySelector('img')).not.toBeNull();
        expect(bubble.className).toContain('pointer-events-none');
        expect(bubble.style.transform).toContain('translateY(-100%)');
    });

    it('none with nothing chosen, for a Foundation, or while marked for demolition', () => {
        for (const props of [
            { gear: { ...chosen, recipe: null, pulsing: true } },
            { gear: { ...chosen, isFoundation: true } },
            { gear: chosen, marked: true },
            {}
        ]) {
            const { container } = mount(bub({ token: worked({ heroId: null }), isHovered: true, ...props }));
            expect(container.querySelector('[data-recipe-bubble]')).toBeNull();
            cleanup();
        }
    });
});

describe('no charge number floats', () => {
    it('⭐ a charge spent or restocked draws nothing, worked or not', () => {
        for (const token of [worked({ usesRemaining: 4 }), worked({ heroId: null, usesRemaining: 4 })]) {
            const { container, unmount } = mount(bub({ token }));
            act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: -1, remaining: 3 }); });
            act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: 50, remaining: 53 }); });
            expect(drawn(container)).toEqual([]);
            unmount();
        }
    });
});

describe('⭐ no tooltips, and grabbing', () => {
    it('⭐ hovering the demolition mark shows no tooltip; pressing it or the mark reaches the Token’s drag handle', () => {
        const onPointerDown = vi.fn();
        const { container, rerender } = mount(bub({ token: worked({ heroId: null }), marked: true, dragProps: { onPointerDown } }));
        const badge = container.querySelector('[data-bubble="marked"]');
        fireEvent.pointerEnter(badge);
        expect(document.body.querySelector('[data-bubble-tip]')).toBeNull();
        expect(document.body.querySelector('[data-tooltip]')).toBeNull();
        expect(container.querySelector('[title]')).toBeNull();
        fireEvent.pointerDown(badge);
        expect(onPointerDown).toHaveBeenCalledTimes(1);
        rerender(tree(bub({ token: worked({ heroId: null, alert: ALERT.INPUTS }), dragProps: { onPointerDown } })));
        onPointerDown.mockClear();
        fireEvent.pointerDown(mark(container));
        expect(onPointerDown).toHaveBeenCalledTimes(1);
    });

    it('⭐ hovering the gear shows no recipe preview', () => {
        const { container } = mount(bub({
            token: worked({ heroId: null }), pointerOn: true,
            gear: { show: true, pulsing: false, recipe: { name: 'Glow Stew', outputs: [{ itemId: 'fixture_glowcap', quantity: 1 }] }, onClick: vi.fn() }
        }));
        const gear = container.querySelector('[data-station-gear]');
        fireEvent.pointerEnter(gear);
        fireEvent.mouseEnter(gear);
        expect(document.body.querySelector('[data-tooltip]')).toBeNull();
        expect(document.body.textContent).not.toContain('Glow Stew');
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

    /** Where a Token's name's bottom stands, in mat units: its box's top plus the name's height. */
    function nameFoot(container, tok) {
        const o = container.querySelector(`[data-token-overlay="${tok.id}"]`);
        const name = o.querySelector('[data-token-name]');
        expect(name.style.top).toBe('0px');
        return tok.y - parseFloat(o.style.width) / 2 + parseFloat(name.style.height);
    }

    function hover(container, tok) {
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({
            left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0
        });
        fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
        restHover();
    }

    it('⭐ a spawner at 3 of 5 or a growing Token: nothing at rest; hovered, its name alone, no count, no timer, no plate', () => {
        vi.useFakeTimers();
        const forest = put('fixture_b13_forest');
        put('fixture_b13_sapling', { x: 700, y: 520 });
        const g = put('fixture_bub_grower', { x: 1200, y: 520 });
        const { container } = mount(h(MatBoard));
        for (const tok of [forest, g]) {
            const o = container.querySelector(`[data-token-overlay="${tok.id}"]`);
            expect(o.querySelector('[data-bubble-row]')).toBeNull();
            hover(container, tok);
            expect(o.querySelector('[data-token-name]').textContent).toBe(tok === forest ? 'Fixture B1.3 Forest' : 'Fixture Grower');
            expect(o.querySelector('[data-bubble-row]')).toBeNull();
            expect(container.querySelector('[data-idle-plate], [data-plate-cell]')).toBeNull();
        }
    });

    it('⭐ the name sits over the Token’s bottom edge, just above where its work bar stands, on its see-through backing', () => {
        vi.useFakeTimers();
        const t = put('fixture_consumer');
        t.alert = ALERT.INPUTS;
        const { container } = mount(h(MatBoard));
        hover(container, t);
        expect(nameFoot(container, t)).toBe(t.y + nameFootOf(t.typeId, 1));
        expect(nameFoot(container, t)).toBeLessThan(t.y + 64);
        expect(nameFoot(container, t)).toBeLessThan(barPlace({ x: t.x, y: t.y, typeId: t.typeId, fit: 1 }).top);
        const label = container.querySelector(`[data-token-overlay="${t.id}"] [data-token-name] span`);
        expect(label.className).toContain('gi-name-backing');
        expect(label.className).not.toContain('gi-name-shimmer');
    });

    it('⭐ the mark is drawn in the centre at the Token’s own art-pixel size', () => {
        const station = put('fixture_consumer');
        station.alert = ALERT.INPUTS;
        const { container } = mount(h(MatBoard));
        const o = container.querySelector(`[data-token-overlay="${station.id}"]`);
        const m = o.querySelector('[data-bubble-row="centre"] [data-problem-mark]');
        expect(m.getAttribute('data-problem-severity')).toBe(SEVERITY.WAITING);
        expect(parseFloat(m.style.width)).toBe(16 * boardScaleAt(1));
        expect(parseFloat(m.style.height)).toBe(16 * boardScaleAt(1));
        expect(m.style.imageRendering).toBe('pixelated');
    });

    it('⭐ resting on a Token: no title text and no tooltip anywhere on the mat', () => {
        vi.useFakeTimers();
        const t = put('fixture_consumer');
        t.alert = ALERT.INPUTS;
        const { container } = mount(h(MatBoard));
        hover(container, t);
        expect(container.querySelector('[data-token-art][title]')).toBeNull();
        expect(document.body.querySelector('[data-tooltip], [data-bubble-tip], [data-enemy-card-tip], [data-flag-tooltip]')).toBeNull();
    });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { tokenStartingUses, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenBadgeRow } from '../ui/components/board/TokenBadgeRow.jsx';
import { HERO_HIT_PX, TOKEN_BAR_GAP_U } from '../ui/components/board/boardConstants.js';
import { drawnPoint } from './fixtures/drawnPoint.js';
import {
    ringRowOffset, cycleSecondsText, chargesFraction, ringCount, RING_D_U, RING_STROKE_U,
    spawnerRing, RING_COLOUR
} from '../ui/components/board/ringRow.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback **B1.2 — the ring row**.
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
    }
});

const h = React.createElement;
const tree = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));
const mount = (el) => render(tree(el));

const worked = (extra = {}) => ({ typeId: 'fixture_producer', instanceId: 'tok_r', heroId: 'hero_1', alert: null, usesRemaining: null, ...extra });
const row = (props) => h(TokenBadgeRow, { instanceId: 'tok_r', ...props });
const ring = (c, kind) => c.querySelector(`[data-ring="${kind}"]`);
const progress = (p) => act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_r', ...p }); });

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

    it('no hero: centred under the Token, just below it', () => {
        expect(ringRowOffset({ x: 500, half: 64 })).toEqual({ dx: 0, dy: 64 + TOKEN_BAR_GAP_U });
    });

    it('⭐ a hero on the RIGHT: centred on the pair, shifted right', () => {
        const heroX = 500 + 64 + HeroMotion.STAND_GAP;
        const { dx } = ringRowOffset({ x: 500, half: 64, heroX });
        const left = 500 - 64;
        const right = heroX + HERO_HIT_PX / 2;
        expect(500 + dx).toBe((left + right) / 2);
        expect(dx).toBeGreaterThan(0);
    });

    it('⭐ a hero on the LEFT: centred on the pair, shifted left', () => {
        const heroX = 500 - 64 - HeroMotion.STAND_GAP;
        const { dx } = ringRowOffset({ x: 500, half: 64, heroX });
        const left = heroX - HERO_HIT_PX / 2;
        const right = 500 + 64;
        expect(500 + dx).toBe((left + right) / 2);
        expect(dx).toBeLessThan(0);
    });

    it('below the lower of the Token and the hero’s feet', () => {
        // A small Token: the hero's feet (64 u below the centre) are lower.
        expect(ringRowOffset({ x: 0, half: 40, heroX: 80 }).dy).toBe(64 + TOKEN_BAR_GAP_U);
        // A 2×2: its art is lower.
        expect(ringRowOffset({ x: 0, half: 144, heroX: 200 }).dy).toBe(144 + TOKEN_BAR_GAP_U);
    });
});

describe('which rings show', () => {
    it('no hero and no hover: no row at all', () => {
        const { container } = mount(row({ token: worked({ heroId: null, usesRemaining: 5 }) }));
        expect(container.querySelector('[data-ring-row]')).toBeNull();
    });

    it('⭐ a worked Token shows the cycle ring with seconds left, and resets on CYCLE_COMPLETE', () => {
        const { container } = mount(row({ token: worked() }));
        const cycle = ring(container, 'cycle');
        expect(cycle).not.toBeNull();
        expect(cycle.getAttribute('data-ring-greyed')).toBeNull();

        progress({ percent: 20, elapsedMs: 600, cycleTimeMs: 3000 });
        expect(cycle.getAttribute('data-ring-text')).toBe('3s');
        progress({ percent: 50, elapsedMs: 1500, cycleTimeMs: 3000 });
        expect(cycle.getAttribute('data-ring-text')).toBe('2s');
        expect(Number(cycle.getAttribute('data-ring-fraction'))).toBeCloseTo(0.5, 2);
        progress({ percent: 90, elapsedMs: 2700, cycleTimeMs: 3000 });
        expect(cycle.getAttribute('data-ring-text')).toBe('1s');
        expect(cycle.querySelector('[data-ring-label]').textContent).toBe('1s');

        act(() => { EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: 'tok_r' }); });
        expect(Number(cycle.getAttribute('data-ring-fraction'))).toBeLessThan(0.05);
        expect(cycle.getAttribute('data-ring-text')).toBe('3s');
    });

    it('the cycle ring fills between ticks on animation frames, and runs none when idle', () => {
        const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
        const { container, rerender } = mount(row({ token: worked({ heroId: null }) }));
        expect(raf).not.toHaveBeenCalled();

        rerender(tree(row({ token: worked() })));
        expect(raf).not.toHaveBeenCalled();           // nothing live until the engine says so
        progress({ percent: 10, elapsedMs: 300, cycleTimeMs: 3000 });
        expect(raf).toHaveBeenCalled();
        expect(ring(container, 'cycle')).not.toBeNull();

        // The hero leaves: the loop stops.
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
        rerender(tree(row({ token: worked({ heroId: null }) })));
        expect(cancel).toHaveBeenCalled();
        expect(container.querySelector('[data-ring-row]')).toBeNull();
        raf.mockRestore();
        cancel.mockRestore();
    });

    it('greys, freezes and hides its number while blocked (B1.1’s workedAlertOf)', () => {
        const { container, rerender } = mount(row({ token: worked() }));
        progress({ percent: 50, elapsedMs: 1500, cycleTimeMs: 3000 });
        rerender(tree(row({ token: worked({ alert: ALERT.INPUTS }) })));
        const cycle = ring(container, 'cycle');
        expect(cycle.getAttribute('data-ring-greyed')).toBe('true');
        expect(cycle.getAttribute('data-ring-text')).toBe('');
        expect(cycle.querySelector('[data-ring-label]').style.visibility).toBe('hidden');
        const frozen = cycle.getAttribute('data-ring-fraction');
        expect(Number(frozen)).toBeCloseTo(0.5, 1);
        progress({ percent: 90, elapsedMs: 2700, cycleTimeMs: 3000 });
        expect(cycle.getAttribute('data-ring-fraction')).toBe(frozen);
    });

    it('⭐ charges: with a hero, and on hover without one; the fraction is left over starting', () => {
        const start = tokenStartingUses('fixture_producer');
        const { container, rerender } = mount(row({ token: worked({ usesRemaining: start / 2 }) }));
        const charges = ring(container, 'charges');
        expect(charges).not.toBeNull();
        expect(charges.getAttribute('data-ring-text')).toBe(ringCount(start / 2));
        expect(Number(charges.getAttribute('data-ring-fraction'))).toBeCloseTo(0.5, 2);

        rerender(tree(row({ token: worked({ heroId: null, usesRemaining: 3 }), isHovered: false })));
        expect(container.querySelector('[data-ring-row]')).toBeNull();
        rerender(tree(row({ token: worked({ heroId: null, usesRemaining: 3 }), isHovered: true })));
        expect(ring(container, 'charges').getAttribute('data-ring-text')).toBe('3');
        expect(ring(container, 'cycle')).toBeNull();
    });

    it('unlimited charges draw no charges ring, worked or hovered', () => {
        const { container, rerender } = mount(row({ token: worked({ usesRemaining: null }), isHovered: true }));
        expect(ring(container, 'charges')).toBeNull();
        expect(ring(container, 'cycle')).not.toBeNull();
        rerender(tree(row({ token: worked({ heroId: null, usesRemaining: null }), isHovered: true })));
        expect(container.querySelector('[data-ring-row]')).toBeNull();
    });

    it('order is fixed: cycle, then charges', () => {
        const { container } = mount(row({ token: worked({ usesRemaining: 4 }) }));
        const kinds = [...container.querySelectorAll('[data-ring]')].map(e => e.getAttribute('data-ring'));
        expect(kinds).toEqual(['cycle', 'charges']);
    });

    it('⭐ in combat: an HP ring that empties, and no cycle ring', () => {
        const { container } = mount(row({ token: worked({ usesRemaining: 4 }) }));
        progress({ percent: 25, combat: true, enemyHp: 30, enemyMaxHp: 40 });
        expect(ring(container, 'cycle')).toBeNull();
        const hp = ring(container, 'hp');
        expect(hp.getAttribute('data-ring-text')).toBe('30');
        expect(Number(hp.getAttribute('data-ring-fraction'))).toBeCloseTo(0.75, 2);
        progress({ percent: 75, combat: true, enemyHp: 10, enemyMaxHp: 40 });
        expect(ring(container, 'hp').getAttribute('data-ring-text')).toBe('10');
        const kinds = [...container.querySelectorAll('[data-ring]')].map(e => e.getAttribute('data-ring'));
        expect(kinds).toEqual(['charges', 'hp']);
    });

    it('the -1 floater rides above the charges ring when there is one', () => {
        const { container } = mount(row({ token: worked({ usesRemaining: 4 }) }));
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: 'tok_r', delta: -1, remaining: 3 }); });
        const floater = container.querySelector('[data-charge-floater]');
        expect(floater.getAttribute('data-charge-floater')).toBe('ring');
        expect(ring(container, 'charges').contains(floater)).toBe(true);
    });

    it('B1.3 can add rings after the Token’s own', () => {
        const { container } = mount(row({
            token: worked({ usesRemaining: 4 }),
            extraRings: [{ kind: 'spawner', fraction: 0.6, text: '3/5' }]
        }));
        const kinds = [...container.querySelectorAll('[data-ring]')].map(e => e.getAttribute('data-ring'));
        expect(kinds).toEqual(['cycle', 'charges', 'spawner']);
    });
});

describe('standing rings (B1.3)', () => {
    const kindsOf = (c) => [...c.querySelectorAll('[data-ring]')].map(e => e.getAttribute('data-ring'));
    const turnRead = () => ({ inMs: 30000, chance: 30, back: false, everyMs: 60000 });

    it('spawner: n/cap, filling to the cap', () => {
        expect(spawnerRing({ count: 3, cap: 5 })).toMatchObject({ kind: 'spawner', text: '3/5', fraction: 0.6 });
        expect(spawnerRing({ count: 5, cap: 5 }).fraction).toBe(1);
        expect(spawnerRing(null)).toBeNull();
        expect(RING_COLOUR.spawner).toBe('#86efac');
        expect(RING_COLOUR.turn).toBe('#7dd3fc');
    });

    it('⭐ a spawner shows its green ring with no hero and no hover', () => {
        const { container } = mount(row({
            token: worked({ heroId: null, usesRemaining: null }),
            extraRings: [spawnerRing({ count: 3, cap: 5 })]
        }));
        expect(container.querySelector('[data-ring-row]')).not.toBeNull();
        expect(kindsOf(container)).toEqual(['spawner']);
        const r = ring(container, 'spawner');
        expect(r.getAttribute('data-ring-text')).toBe('3/5');
        expect(Number(r.getAttribute('data-ring-fraction'))).toBeCloseTo(0.6, 3);
        expect(r.querySelector('[data-ring-arc]').getAttribute('stroke')).toBe(RING_COLOUR.spawner);
    });

    it('a turning Token shows its sky ring with no hero and no hover', () => {
        const { container } = mount(row({ token: worked({ heroId: null }), readTurn: turnRead }));
        expect(kindsOf(container)).toEqual(['turn']);
        expect(ring(container, 'turn').getAttribute('data-ring-text')).toBe('0:30');
        expect(ring(container, 'turn').querySelector('[data-ring-arc]').getAttribute('stroke')).toBe(RING_COLOUR.turn);
    });

    it('⭐ order with a hero at work: cycle, charges, then the standing ring last', () => {
        const { container, rerender } = mount(row({
            token: worked({ usesRemaining: 4 }),
            extraRings: [spawnerRing({ count: 3, cap: 5 })]
        }));
        expect(kindsOf(container)).toEqual(['cycle', 'charges', 'spawner']);
        rerender(tree(row({ token: worked({ usesRemaining: 4 }), readTurn: turnRead })));
        expect(kindsOf(container)).toEqual(['cycle', 'charges', 'turn']);
    });

    it('no standing ring while dragged', () => {
        const { container } = mount(row({
            token: worked({ heroId: null }),
            isDragging: true,
            extraRings: [spawnerRing({ count: 3, cap: 5 })],
            readTurn: turnRead
        }));
        expect(container.querySelector('[data-ring-row]')).toBeNull();
        expect(container.querySelector('[data-ring]')).toBeNull();
    });
});

describe('on the mat: centred under the pair (MatToken)', () => {
    const AT = { x: 560, y: 520 };

    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        resetMatTuning();
        setMatTuning('flagRadius', 400);
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

    /** The row's centre and top in mat units, from its overlay box. */
    function rowAt(container, tok) {
        const o = container.querySelector(`[data-token-overlay="${tok.id}"]`);
        const r = o.querySelector('[data-ring-row]');
        if (!r) return null;
        return {
            x: drawnPoint(o).x + drawnPoint(r).x,
            y: drawnPoint(o).y + drawnPoint(r).y
        };
    }

    const workOn = (tok, side) => {
        BoardState.setClaim('hero_1', { instanceId: tok.id, typeId: tok.typeId, x: tok.x, y: tok.y });
        HeroMotion.restoreAtWork('hero_1', tok, side);
        expect(BoardState.workerOf(tok.id)).toBe('hero_1');
    };

    it('no hero and no hover: no row', () => {
        const tok = put('fixture_producer');
        const { container } = mount(h(MatBoard));
        expect(rowAt(container, tok)).toBeNull();
    });

    it('⭐ B1.3: a spawner at 3 of 5 stands a green 3/5 ring under itself, no hero, no hover, no corner badge', () => {
        const forest = put('fixture_b13_forest');
        put('fixture_b13_sapling', { x: 1200, y: 520 });
        put('fixture_b13_sapling', { x: 1400, y: 300 });
        put('fixture_b13_sapling', { x: 1400, y: 800 });
        const { container } = mount(h(MatBoard));
        const at = rowAt(container, forest);
        expect(at).not.toBeNull();
        expect(at.x).toBeCloseTo(forest.x, 5);          // centred under the Token alone
        const o = container.querySelector(`[data-token-overlay="${forest.id}"]`);
        const r = o.querySelector('[data-ring-row] [data-ring="spawner"]');
        expect(r.getAttribute('data-ring-text')).toBe('3/5');
        expect(Number(r.getAttribute('data-ring-fraction'))).toBeCloseTo(0.6, 3);
        expect(o.querySelectorAll('[data-ring]').length).toBe(1);
        expect(o.querySelector('[data-spawner-count], [data-turn-countdown]')).toBeNull();
    });

    for (const [name, side] of [['RIGHT', 1], ['LEFT', -1]]) {
        it(`⭐ a hero on the ${name}: the row's centre is the pair's midpoint`, () => {
            const tok = put('fixture_producer');
            workOn(tok, side);
            const { container } = mount(h(MatBoard));
            const at = rowAt(container, tok);
            expect(at).not.toBeNull();

            const o = container.querySelector(`[data-token-overlay="${tok.id}"]`);
            const half = parseFloat(o.style.width) / 2;
            const heroX = HeroMotion.standingSpot(tok.typeId, tok, side).x;
            expect(Math.sign(heroX - tok.x)).toBe(side);
            const left = Math.min(tok.x - half, heroX - HERO_HIT_PX / 2);
            const right = Math.max(tok.x + half, heroX + HERO_HIT_PX / 2);
            expect(at.x).toBeCloseTo((left + right) / 2, 5);
            expect(Math.sign(at.x - tok.x)).toBe(side);
            expect(at.y).toBeCloseTo(tok.y + Math.max(half, 64) + TOKEN_BAR_GAP_U, 5);
        });
    }
});

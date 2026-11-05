// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MAT_Z, STACK_PLACES, placeZ, matStackOrder, createMatStack, heroZ } from '../ui/components/board/matLayers.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback, slice **Q3 — layering**.
 */

const h = React.createElement;
const mount = (el) => render(
    h(DndContext, null, el)
);
const zOfToken = (c, id) => Number(c.querySelector(`[data-token-id="${id}"][data-token-art]`).style.zIndex);
const zOfBadges = (c, id) => Number(c.querySelector(`[data-token-overlay="${id}"]`).style.zIndex);
const zOfFlag = (c, heroId) => Number(c.querySelector(`[data-flag="${heroId}"]`).style.zIndex);
const zOfHero = (c, heroId) => Number(c.querySelector(`[data-board-hero="${heroId}"]`).style.zIndex);

function hero(id) {
    return { id, name: id, status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } };
}

// ---------------------------------------------------------------------------
// The order, pure
// ---------------------------------------------------------------------------

describe('matStackOrder — the rule', () => {
    it('FB-1: Tokens and flags sort together, lower on the mat in front', () => {
        const { tokenZ: tz, flagZ: fz } = matStackOrder({
            tokens: [{ id: 'a', y: 500 }, { id: 'b', y: 300 }],
            flags: [{ heroId: 'h1', y: 400 }, { heroId: 'h2', y: 600 }]
        });
        // b (300) < h1 (400) < a (500) < h2 (600)
        expect(tz.get('b')).toBeLessThan(fz.get('h1'));
        expect(fz.get('h1')).toBeLessThan(tz.get('a'));
        expect(tz.get('a')).toBeLessThan(fz.get('h2'));
    });

    it('each takes two slots, so a Token\'s badges (+1) fit between neighbours', () => {
        const { tokenZ: tz, flagZ: fz } = matStackOrder({
            tokens: [{ id: 'a', y: 100 }], flags: [{ heroId: 'h1', y: 200 }]
        });
        expect(fz.get('h1') - tz.get('a')).toBeGreaterThanOrEqual(2);
        expect((fz.get('h1') - tz.get('a')) % 2).toBe(0);
        expect(tz.get('a')).toBeGreaterThanOrEqual(MAT_Z.TOKEN_BASE);
    });

    it('ties: a flag in front of a Token on the same line; earlier placed or planted behind', () => {
        const { tokenZ: tz, flagZ: fz } = matStackOrder({
            tokens: [{ id: 'late', y: 300, placedAt: 9 }, { id: 'early', y: 300, placedAt: 1 }],
            flags: [{ heroId: 'first', y: 300 }, { heroId: 'second', y: 300 }]
        });
        expect(tz.get('early')).toBeLessThan(tz.get('late'));
        expect(tz.get('late')).toBeLessThan(fz.get('first'));
        expect(fz.get('first')).toBeLessThan(fz.get('second'));
    });

    it('FB-2: a worked Token rises above every Token and flag at rest, however high it stands', () => {
        const { tokenZ: tz, flagZ: fz } = matStackOrder({
            tokens: [{ id: 'worked', y: 100 }, { id: 'front', y: 900 }, { id: 'worked2', y: 50 }],
            flags: [{ heroId: 'h1', y: 950 }],
            workedIds: new Set(['worked', 'worked2'])
        });
        expect(tz.get('worked')).toBeGreaterThan(tz.get('front'));
        expect(tz.get('worked')).toBeGreaterThan(fz.get('h1'));
        // Among worked Tokens the usual rule holds.
        expect(tz.get('worked')).toBeGreaterThan(tz.get('worked2'));
    });

    it('the hovered Token is frontmost, even over a worked one', () => {
        const { tokenZ: tz } = matStackOrder({
            tokens: [{ id: 'worked', y: 500 }, { id: 'hovered', y: 100 }],
            workedIds: ['worked'],
            hoveredId: 'hovered'
        });
        expect(tz.get('hovered')).toBeGreaterThan(tz.get('worked'));
    });

    it('stays below every hero, however many things are on the mat', () => {
        const tokens = Array.from({ length: 400 }, (_, i) => ({ id: `t${i}`, y: i }));
        const { tokenZ: tz } = matStackOrder({ tokens, workedIds: ['t0'], hoveredId: 't1' });
        const top = Math.max(...tz.values());
        expect(top + 1).toBeLessThan(MAT_Z.STANDING_HERO);
        // The last place there is, and its badges, still sit below.
        expect(placeZ(STACK_PLACES - 1) + 1).toBeLessThan(MAT_Z.STANDING_HERO);
    });
});

describe('⭐ CR3-354: a busy mat (S3 size) keeps worked and hovered Tokens in front', () => {
    // R6's S3 probe: 314 Tokens and 2 flags gave only 220 distinct z values,
    // with all 7 worked Tokens tied with 95 resting ones at the top.
    const tokens = Array.from({ length: 310 }, (_, i) => ({ id: `t${i}`, y: i * 3, placedAt: i }));
    const flags = [{ heroId: 'h1', y: 400 }, { heroId: 'h2', y: 900 }];
    const workedIds = ['t5', 't40', 't120', 't200', 't250', 't290', 't305'];
    const { tokenZ: tz, flagZ: fz } = matStackOrder({ tokens, flags, workedIds, hoveredId: 't300' });
    const restingZ = [...tokens.filter(t => !workedIds.includes(t.id) && t.id !== 't300').map(t => tz.get(t.id)), ...fz.values()];

    it('every worked Token is above every resting Token and flag, each at its own z', () => {
        const worked = workedIds.map(id => tz.get(id));
        expect(Math.min(...worked)).toBeGreaterThan(Math.max(...restingZ) + 1);
        expect(new Set(worked).size).toBe(workedIds.length);
        // Among themselves, the usual back-to-front rule.
        expect([...worked].sort((a, b) => a - b)).toEqual(worked);
    });

    it('the lifted Token is above them all, and the whole stack stays below every hero', () => {
        const top = tz.get('t300');
        expect(top).toBeGreaterThan(Math.max(...workedIds.map(id => tz.get(id))));
        expect(top + 1).toBeLessThan(MAT_Z.STANDING_HERO);
    });

    it('no Token or flag shares a z: nothing is clamped, so page order never decides', () => {
        expect(new Set([...tz.values(), ...fz.values()]).size).toBe(tokens.length + flags.length);
    });

    it('a hero starting work moves only the Token it works (no mass redraw)', () => {
        const stack = createMatStack();
        const before = stack.order({ tokens, flags, workedIds, hoveredId: 't300' });
        const after = stack.order({ tokens, flags, workedIds: [...workedIds, 't10'], hoveredId: 't300' });
        const moved = tokens.filter(t => after.tokenZ.get(t.id) !== before.tokenZ.get(t.id)).map(t => t.id);
        expect(moved).toEqual(['t10']);
        expect(after.flagZ).toBe(before.flagZ);
        expect(after.tokenZ.get('t10')).toBeGreaterThan(Math.max(...restingZ) + 1);
    });
});

describe('heroZ — where each hero goes', () => {
    it('⭐ a standing hero is above the very last place in the stack, wherever they stand', () => {
        const top = placeZ(STACK_PLACES - 1) + 1;
        for (const y of [0, 500, 1040, 2560]) {
            expect(heroZ({ y, moving: false })).toBeGreaterThan(top);
            expect(heroZ({ y, moving: false })).toBeLessThan(MAT_Z.WALKING_HERO);
        }
    });

    it('standing heroes sort among themselves: lower on the mat in front', () => {
        expect(heroZ({ y: 600, moving: false })).toBeGreaterThan(heroZ({ y: 599, moving: false }));
    });

    it('a hero on the move is above the standing ones, strolling or walking', () => {
        expect(heroZ({ y: null, moving: true })).toBe(MAT_Z.WALKING_HERO);
        expect(heroZ({ y: 900, moving: true })).toBe(MAT_Z.WALKING_HERO);
    });

    it('a hovered Token\'s badges are over every hero; everything else keeps its place: rings, loot, callouts, bubbles', () => {
        expect(MAT_Z.HOVERED_BADGES).toBeGreaterThan(MAT_Z.WALKING_HERO);
        expect(MAT_Z.HOVERED_BADGES).toBeLessThan(MAT_Z.RINGS);
        expect(MAT_Z.WALKING_HERO).toBeLessThan(MAT_Z.RINGS);
        expect(MAT_Z.RINGS).toBeLessThan(MAT_Z.LOOT);
        expect(MAT_Z.LOOT).toBeLessThan(MAT_Z.CALLOUT);
        expect(MAT_Z.CALLOUT).toBeLessThan(MAT_Z.HERO_BUBBLE);
    });
});

// ---------------------------------------------------------------------------
// On the mat
// ---------------------------------------------------------------------------

describe('on the mat', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => cleanup());

    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        // A flag drawn over a Token 170 u away, its hero idle: outside a 164 u reach.
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [hero('h1'), hero('h2')];
    });

    it('FB-1: a flag higher on the mat than a Token draws behind it; one lower draws in front', () => {
        const tok = placeAt('fixture_producer', 600, 600);
        // 170 u away: past the flag radius set above, so both heroes stay idle.
        Orders.orderAt('h1', { x: 600, y: 430 });
        Orders.orderAt('h2', { x: 600, y: 770 });
        expect(Flags.statusOf('h1').state).toBe('idle');
        expect(Flags.statusOf('h2').state).toBe('idle');

        const { container } = mount(h(MatBoard));
        expect(zOfFlag(container, 'h1')).toBeLessThan(zOfToken(container, tok.id));
        expect(zOfFlag(container, 'h2')).toBeGreaterThan(zOfBadges(container, tok.id));
        // Both idle heroes are over the Token, the one standing higher on the mat too.
        expect(zOfHero(container, 'h1')).toBeGreaterThan(zOfBadges(container, tok.id));
        expect(zOfHero(container, 'h2')).toBeGreaterThan(zOfBadges(container, tok.id));
        expect(zOfHero(container, 'h1')).toBeGreaterThan(zOfFlag(container, 'h2'));
        // ⚠️ The flags' box has no z-index of its own — with one, every flag
        // would sit above or below every Token together.
        expect(container.querySelector('[data-flag-layer]').style.zIndex).toBe('');
    });

    it('FB-2: a worked Token draws above a lower neighbour, and its hero above both; when work stops, the order is normal again', async () => {
        const worked = placeAt('fixture_producer', 600, 500);
        const front = placeAt('fixture_producer', 660, 560);       // lower: normally in front
        Orders.orderAt('h1', { x: 600, y: 500 });
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'working', instanceId: worked.id });

        const { container } = mount(h(MatBoard));
        expect(zOfToken(container, worked.id)).toBeGreaterThan(zOfBadges(container, front.id));
        expect(zOfHero(container, 'h1')).toBeGreaterThan(zOfBadges(container, worked.id));
        expect(zOfBadges(container, worked.id)).toBe(zOfToken(container, worked.id) + 1);

        // The hook batches its reads in a microtask, hence the async act.
        await act(async () => { Flags.furl('h1'); });
        expect(zOfToken(container, worked.id)).toBeLessThan(zOfToken(container, front.id));
    });

    it('⭐ heroes on top: a hero working a Token draws over a worked Token lower on the mat, and over one higher', () => {
        const high = placeAt('fixture_producer', 600, 300);
        const mid = placeAt('fixture_producer', 900, 500);
        const low = placeAt('fixture_producer', 1200, 800);
        Orders.orderAt('h1', { x: mid.x, y: mid.y });
        Orders.orderAt('h2', { x: low.x, y: low.y });
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'working', instanceId: mid.id });
        expect(Flags.statusOf('h2')).toMatchObject({ state: 'working', instanceId: low.id });

        const { container } = mount(h(MatBoard));
        for (const t of [high, mid, low]) {
            expect(zOfHero(container, 'h1')).toBeGreaterThan(zOfBadges(container, t.id));
            expect(zOfHero(container, 'h2')).toBeGreaterThan(zOfBadges(container, t.id));
        }
    });

    it('a worked Token also rises above a flag standing lower on the mat', () => {
        const worked = placeAt('fixture_producer', 600, 500);
        Orders.orderAt('h1', { x: 600, y: 500 });
        Orders.orderAt('h2', { x: 900, y: 700 });                      // lower, and far enough to stay idle
        expect(Flags.statusOf('h2').state).toBe('idle');

        const { container } = mount(h(MatBoard));
        expect(zOfToken(container, worked.id)).toBeGreaterThan(zOfFlag(container, 'h2') + 1);
    });

    /**
     * ⛔ Reversed by B5: this used to pin that a flag in front of a Token kept
     * the pointer — "the pointer on a flag raises no Token over it". Flags have
     * no hitbox over Tokens now: a point on a Token's art circle is the
     * Token's, wherever the event lands.
     */
    it('FB-44: the pointer on a flag over a Token hovers the Token, and every flag lets it through', () => {
        const tok = placeAt('fixture_producer', 600, 600);
        // A spot order just below the Token; the hero's panel is open, so the spot's flag stays shown.
        Orders.orderAt('h1', { x: 600, y: 770 });
        const { container } = mount(h(MatBoard, { inspectedHeroId: 'h1' }));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });

        const flagEl = container.querySelector('[data-flag="h1"]');
        expect(zOfFlag(container, 'h1')).toBeGreaterThan(zOfToken(container, tok.id));
        expect(flagEl.className).toContain('pointer-events-auto');

        // A point inside the Token's art circle, though the event lands on the flag.
        fireEvent.pointerMove(flagEl, { clientX: 600, clientY: 640 });
        expect(container.querySelector(`[data-token-art][data-token-id="${tok.id}"]`).getAttribute('data-outline')).toBe('hover');
        expect(flagEl.className).toContain('pointer-events-none');

        // Off the Token, on the flag's cloth over bare mat: the flag has the pointer again.
        fireEvent.pointerMove(flagEl, { clientX: 640, clientY: 700 });
        expect(flagEl.className).toContain('pointer-events-auto');
        expect(zOfFlag(container, 'h1')).toBeGreaterThan(zOfToken(container, tok.id));
    });

    describe('⭐ hovering a Token', () => {
        const scene = () => {
            const behind = placeAt('fixture_producer', 600, 500);
            const front = placeAt('fixture_producer', 660, 540);
            const { container } = mount(h(MatBoard));
            const root = container.querySelector('[data-mat-board]');
            root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
            return { behind, front, container, root };
        };

        it('leaves it where it stands, but brings its badges up over the Token in front', () => {
            const { behind, front, container, root } = scene();
            const before = [zOfToken(container, behind.id), zOfToken(container, front.id)];
            fireEvent.pointerMove(root, { clientX: 590, clientY: 500 });
            expect([zOfToken(container, behind.id), zOfToken(container, front.id)]).toEqual(before);
            expect(zOfToken(container, behind.id)).toBeLessThan(zOfToken(container, front.id));
            expect(zOfBadges(container, behind.id)).toBe(MAT_Z.HOVERED_BADGES);
            expect(zOfBadges(container, front.id)).toBe(zOfToken(container, front.id) + 1);
        });

        it('with the Mat Tuner\'s hover lift on, jumps in front, still under the heroes', () => {
            setMatTuning('hoverLift', 1);
            const { behind, front, container, root } = scene();
            fireEvent.pointerMove(root, { clientX: 590, clientY: 500 });
            expect(zOfToken(container, behind.id)).toBeGreaterThan(zOfToken(container, front.id));
            expect(zOfToken(container, behind.id)).toBeLessThan(MAT_Z.STANDING_HERO);
        });

        it('⭐ the pointer on a hero\'s drawn pixel lights no Token behind them, only their own', () => {
            const job = placeAt('fixture_producer', 900, 500);
            const other = placeAt('fixture_producer', 1300, 500);
            Orders.orderAt('h1', { x: job.x, y: job.y });
            expect(Flags.statusOf('h1')).toMatchObject({ state: 'working', instanceId: job.id });
            const { container } = mount(h(MatBoard));
            const root = container.querySelector('[data-mat-board]');
            root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
            const heroEl = container.querySelector('[data-board-hero="h1"]');
            const outline = (t) => container.querySelector(`[data-token-art][data-token-id="${t.id}"]`).getAttribute('data-outline');

            fireEvent.pointerMove(heroEl, { clientX: other.x, clientY: other.y });
            expect(outline(other)).not.toBe('hover');

            fireEvent.pointerMove(root, { clientX: other.x, clientY: other.y });
            expect(outline(other)).toBe('hover');

            fireEvent.pointerMove(heroEl, { clientX: job.x, clientY: job.y });
            expect(outline(job)).toBe('hover');
        });
    });
});

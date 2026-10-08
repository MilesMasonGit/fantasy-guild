// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MAT_Z, TOKEN_SPAN, tokenZ, matStackOrder, heroZ } from '../ui/components/board/matLayers.js';
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
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);
const zOfToken = (c, id) => Number(c.querySelector(`[data-token-id="${id}"][data-token-art]`).style.zIndex);
const zOfBadges = (c, id) => Number(c.querySelector(`[data-token-overlay="${id}"]`).style.zIndex);
const zOfFlag = (c, heroId) => Number(c.querySelector(`[data-flag="${heroId}"]`).style.zIndex);
const zOfHero = (c, heroId) => Number(c.querySelector(`[data-board-hero="${heroId}"]`).style.zIndex);

function hero(id) {
    return { id, name: id, status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } };
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

    it('each takes three slots, so a hero (+1) and badges or a gear (+2) fit between neighbours', () => {
        const { tokenZ: tz, flagZ: fz } = matStackOrder({
            tokens: [{ id: 'a', y: 100 }], flags: [{ heroId: 'h1', y: 200 }]
        });
        expect(fz.get('h1') - tz.get('a')).toBe(3);
        expect(tz.get('a')).toBe(MAT_Z.TOKEN_BASE);
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

    it('stays below the heroes-on-the-move band, however many things are on the mat', () => {
        const tokens = Array.from({ length: TOKEN_SPAN + 20 }, (_, i) => ({ id: `t${i}`, y: i }));
        const { tokenZ: tz } = matStackOrder({ tokens, workedIds: ['t0'], hoveredId: 't1' });
        const top = Math.max(...tz.values());
        expect(top + 2).toBeLessThan(MAT_Z.WAITING_HERO);
        expect(tokenZ(1e6)).toBe(top);
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
        expect(Math.min(...worked)).toBeGreaterThan(Math.max(...restingZ) + 2);
        expect(new Set(worked).size).toBe(workedIds.length);
        // Among themselves, the usual back-to-front rule.
        expect([...worked].sort((a, b) => a - b)).toEqual(worked);
    });

    it('the hovered Token is above them all, and the whole stack stays below the walking heroes', () => {
        const top = tz.get('t300');
        expect(top).toBeGreaterThan(Math.max(...workedIds.map(id => tz.get(id))));
        expect(top + 2).toBeLessThan(MAT_Z.WAITING_HERO);
    });

    it('a hero starting work does not re-rank the Tokens tied at the clamp (no mass redraw)', () => {
        const more = matStackOrder({ tokens, flags, workedIds: [...workedIds, 't10'], hoveredId: 't300' });
        const clamped = tokens.filter(t => tz.get(t.id) === Math.max(...restingZ) && t.id !== 't10');
        expect(clamped.length).toBeGreaterThan(50);
        // Only the one at the clamp's edge steps down into the rank t10 left.
        const moved = clamped.filter(t => more.tokenZ.get(t.id) !== tz.get(t.id));
        expect(moved.length).toBeLessThanOrEqual(1);
    });

    it('under the cap, every z is exactly what it was (dense ranks)', () => {
        const small = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, y: i }));
        const { tokenZ: sz } = matStackOrder({ tokens: small, workedIds: ['s3'], hoveredId: 's7' });
        const ranksOf = (id) => (sz.get(id) - MAT_Z.TOKEN_BASE) / 3;
        expect(ranksOf('s0')).toBe(0);
        expect(ranksOf('s49')).toBe(47);   // 48 resting: 0…47
        expect(ranksOf('s3')).toBe(48);    // then the worked one
        expect(ranksOf('s7')).toBe(49);    // then the hovered one
    });
});

describe('heroZ — where each hero goes', () => {
    const order = matStackOrder({
        tokens: [{ id: 'tok', y: 500 }, { id: 'other', y: 900 }],
        flags: [{ heroId: 'idler', y: 300 }],
        workedIds: ['tok']
    });

    it('a working hero is one above their Token, so both rise together (FB-2)', () => {
        const z = heroZ({ heroId: 'w', state: 'working', tokenId: 'tok', moving: false }, order);
        expect(z).toBe(order.tokenZ.get('tok') + 1);
        expect(z).toBeGreaterThan(order.tokenZ.get('other') + 2);
    });

    it('an idle hero is one above their flag, strolling or not (FP-84)', () => {
        expect(heroZ({ heroId: 'idler', state: 'idle', moving: false }, order)).toBe(order.flagZ.get('idler') + 1);
        expect(heroZ({ heroId: 'idler', state: 'idle', moving: true }, order)).toBe(order.flagZ.get('idler') + 1);
    });

    it('a walking hero is above every Token and flag; a hero with nowhere to stand just below them (HM-3)', () => {
        expect(heroZ({ heroId: 'x', state: 'walking', moving: true }, order)).toBe(MAT_Z.WALKING_HERO);
        expect(heroZ({ heroId: 'x', state: 'working', tokenId: 'tok', moving: true }, order)).toBe(MAT_Z.WALKING_HERO);
        expect(heroZ({ heroId: 'x', state: 'walking', moving: false }, order)).toBe(MAT_Z.WAITING_HERO);
    });

    it('everything above the Tokens keeps its place: rings, loot, callouts, bubbles', () => {
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
        // 170 u away: past the 164 u flag radius, so both heroes stay idle.
        Flags.plant('h1', { x: 600, y: 430 });
        Flags.plant('h2', { x: 600, y: 770 });
        expect(Flags.statusOf('h1').state).toBe('idle');
        expect(Flags.statusOf('h2').state).toBe('idle');

        const { container } = mount(h(MatBoard));
        expect(zOfFlag(container, 'h1')).toBeLessThan(zOfToken(container, tok.id));
        expect(zOfFlag(container, 'h2')).toBeGreaterThan(zOfBadges(container, tok.id));
        // Each idle hero stands just in front of their own flag.
        expect(zOfHero(container, 'h1')).toBe(zOfFlag(container, 'h1') + 1);
        expect(zOfHero(container, 'h2')).toBe(zOfFlag(container, 'h2') + 1);
        // ⚠️ The pennants' box has no z-index of its own — with one, every flag
        // would sit above or below every Token together.
        expect(container.querySelector('[data-flag-pennants]').style.zIndex).toBe('');
    });

    it('FB-2: a worked Token and its hero draw above a lower neighbour; when work stops, the order is normal again', async () => {
        const worked = placeAt('fixture_producer', 600, 500);
        const front = placeAt('fixture_producer', 660, 560);       // lower: normally in front
        Flags.plant('h1', { x: 600, y: 500 });
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'working', instanceId: worked.id });

        const { container } = mount(h(MatBoard));
        expect(zOfToken(container, worked.id)).toBeGreaterThan(zOfBadges(container, front.id));
        expect(zOfHero(container, 'h1')).toBe(zOfToken(container, worked.id) + 1);
        expect(zOfBadges(container, worked.id)).toBe(zOfToken(container, worked.id) + 2);

        // The hook batches its reads in a microtask, hence the async act.
        await act(async () => { Flags.furl('h1'); });
        expect(zOfToken(container, worked.id)).toBeLessThan(zOfToken(container, front.id));
    });

    it('a worked Token also rises above a flag standing lower on the mat', () => {
        const worked = placeAt('fixture_producer', 600, 500);
        Flags.plant('h1', { x: 600, y: 500 });
        Flags.plant('h2', { x: 900, y: 700 });                      // lower, and far enough to stay idle
        expect(Flags.statusOf('h2').state).toBe('idle');

        const { container } = mount(h(MatBoard));
        expect(zOfToken(container, worked.id)).toBeGreaterThan(zOfFlag(container, 'h2') + 2);
    });

    /**
     * ⛔ Reversed by B5: this used to pin that a flag in front of a Token kept
     * the pointer — "the pointer on a flag raises no Token over it". Flags have
     * no hitbox over Tokens now: a point on a Token's art circle is the
     * Token's, wherever the event lands.
     */
    it('FB-44: the pointer on a flag over a Token hovers the Token, and every flag lets it through', () => {
        const tok = placeAt('fixture_producer', 600, 600);
        Flags.plant('h1', { x: 600, y: 770 });
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });

        const flagEl = container.querySelector('[data-flag="h1"]');
        expect(zOfFlag(container, 'h1')).toBeGreaterThan(zOfToken(container, tok.id));
        expect(flagEl.className).toContain('pointer-events-auto');

        // A point inside the Token's art circle, though the event lands on the flag.
        fireEvent.pointerMove(flagEl, { clientX: 600, clientY: 640 });
        expect(zOfToken(container, tok.id)).toBeGreaterThan(zOfFlag(container, 'h1'));
        expect(flagEl.className).toContain('pointer-events-none');

        // Off the Token, on the flag's cloth over bare mat: the flag has the pointer again.
        fireEvent.pointerMove(flagEl, { clientX: 640, clientY: 700 });
        expect(flagEl.className).toContain('pointer-events-auto');
        expect(zOfFlag(container, 'h1')).toBeGreaterThan(zOfToken(container, tok.id));
    });
});

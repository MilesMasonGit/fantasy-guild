import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { summariseMat, groupNote, groupLabel } from '../systems/board/MatSummary.js';
import { MatTopBar, showsMatTopBar, MAT_TOP_BAR_PX } from '../ui/components/board/MatTopBar.jsx';
import { MatCapBadge, hasLiveProblem, liveMatSummary } from '../ui/components/board/MatCapBadge.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Token Lifecycle feedback **B2.1** — the mat's top bar and the Token cap
 * badge (FB-28, FB-31, SP-67).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const tokenDef = (id, name, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature', ...extra
});
registerTokenTypes({
    fixture_mb_oak: tokenDef('fixture_mb_oak', 'Bar Oak Forest'),
    fixture_mb_bench: tokenDef('fixture_mb_bench', 'Bar Workbench'),
    fixture_mb_tree: tokenDef('fixture_mb_tree', 'Bar Tree'),
    fixture_mb_vein: tokenDef('fixture_mb_vein', 'Bar Vein'),
    fixture_mb_hall: tokenDef('fixture_mb_hall', 'Bar Hall', { isGuildHall: true })
});

// --- The pure summary --------------------------------------------------------

const t = (typeId, extra = {}) => ({ id: `${typeId}_${Math.random()}`, typeId, ...extra });
const readers = {
    nameOf: (id) => ({ oak: 'Oak Forest', bench: 'Workbench', tree: 'Oak Tree', vein: 'Iron Vein', hall: 'Guild Hall' }[id] || id),
    isGuildHall: (i) => i.typeId === 'hall',
    isBlocked: (i) => !!i.blocked,
    isOff: (i) => !!i.disallowed
};

describe('summariseMat (FB-31)', () => {
    it('groups placed Tokens by type with counts, most first, then by name', () => {
        const s = summariseMat([t('bench'), t('oak'), t('oak'), t('vein')], readers);
        expect(s.placed.count).toBe(4);
        expect(s.placed.groups.map(g => [g.name, g.count])).toEqual([
            ['Oak Forest', 2], ['Iron Vein', 1], ['Workbench', 1]
        ]);
        expect(groupLabel(s.placed.groups[0])).toBe('Oak Forest ×2');
    });

    it('⭐ leaves the Guild Hall out entirely (SP-67)', () => {
        const s = summariseMat([t('hall'), t('oak')], readers);
        expect(s.placed.count).toBe(1);
        expect(s.spawned.count).toBe(0);
        expect(s.placed.groups.some(g => g.typeId === 'hall')).toBe(false);
    });

    it('⭐ keeps spawned Tokens apart and out of the placed count (SP-67)', () => {
        const s = summariseMat([
            t('oak'), t('tree', { origin: 'spawned' }), t('tree', { origin: 'spawned' }), t('vein', { origin: 'spawned' })
        ], readers);
        expect(s.placed.count).toBe(1);
        expect(s.spawned.count).toBe(3);
        expect(s.spawned.groups.map(groupLabel)).toEqual(['Oak Tree ×2', 'Iron Vein ×1']);
    });

    it('counts blocked and off copies per placed type, for the red note', () => {
        const s = summariseMat([
            t('oak', { blocked: true }), t('oak'), t('oak', { disallowed: true }), t('bench')
        ], readers);
        const oak = s.placed.groups.find(g => g.typeId === 'oak');
        expect(oak).toMatchObject({ count: 3, blocked: 1, off: 1 });
        expect(groupNote(oak)).toBe('1 blocked, 1 off');
        expect(groupNote(s.placed.groups.find(g => g.typeId === 'bench'))).toBeNull();
    });

    it('a disallowed Token reads as off, not also blocked', () => {
        const s = summariseMat([t('oak', { blocked: true, disallowed: true })], readers);
        expect(s.placed.groups[0]).toMatchObject({ blocked: 0, off: 1 });
    });
});

describe('hasLiveProblem — what counts as blocked (B1.1, TL-22)', () => {
    it('a real engine alert blocks', () => {
        expect(hasLiveProblem({ id: 'x', alert: ALERT.INPUTS })).toBe(true);
    });
    it('⚠️ a gear-only alert does not (a station waiting for a choice is not broken)', () => {
        expect(hasLiveProblem({ id: 'x', alert: ALERT.CHOOSE_RECIPE })).toBe(false);
        expect(hasLiveProblem({ id: 'x', alert: ALERT.CHOOSE_BUILD })).toBe(false);
    });
    it('no alert, no problem', () => {
        expect(hasLiveProblem({ id: 'x' })).toBe(false);
    });
});

// --- The bar and the badge ---------------------------------------------------

const badgeText = (c) => c.querySelector('[data-mat-cap-text]').textContent.replace(/\s+/g, ' ').trim();
const popover = () => document.body.querySelector('[data-mat-cap-popover]');

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
    clearMat();
    setMatTuning('matCap', 12);
});

afterEach(() => {
    cleanup();
    resetMatTuning();
});

describe('MatTopBar (FB-28)', () => {
    it('is a slim strip with left, middle and right slots', () => {
        const { container } = render(React.createElement(MatTopBar, {
            left: React.createElement('span', { 'data-l': true }, 'L'),
            right: React.createElement('span', { 'data-r': true }, 'R')
        }));
        const bar = container.querySelector('[data-mat-top-bar]');
        expect(bar.style.height).toBe(`${MAT_TOP_BAR_PX}px`);
        expect(bar.querySelector('[data-mat-top-bar-left] [data-l]')).not.toBeNull();
        expect(bar.querySelector('[data-mat-top-bar-right] [data-r]')).not.toBeNull();
        expect(bar.querySelector('[data-mat-top-bar-middle]')).not.toBeNull();
    });

    it('is drawn on the playmat and not on the Guild Hall upgrade screen', () => {
        expect(showsMatTopBar(null)).toBe(true);
        expect(showsMatTopBar(undefined)).toBe(true);
        expect(showsMatTopBar('guild')).toBe(false);
    });
});

describe('⭐ MatCapBadge (FB-31, SP-67)', () => {
    it('shows placed Tokens against the cap, the Guild Hall and spawned Tokens not counted', () => {
        placeAt('fixture_mb_hall', 800, 500);
        placeAt('fixture_mb_oak', 160, 160);
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 320, 160);
        const { container } = render(React.createElement(MatCapBadge));
        expect(badgeText(container)).toBe('Tokens 1/12');
    });

    it('updates live when a Token is placed or removed', () => {
        const { container } = render(React.createElement(MatCapBadge));
        expect(badgeText(container)).toBe('Tokens 0/12');

        const oak = placeAt('fixture_mb_oak', 160, 160);
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: oak.id, typeId: oak.typeId }); });
        expect(badgeText(container)).toBe('Tokens 1/12');

        BoardState.removeToken(oak.id);
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: oak.id, x: 160, y: 160, typeId: null }); });
        expect(badgeText(container)).toBe('Tokens 0/12');
    });

    it('updates live when the Mat Tuner changes the cap', () => {
        const { container } = render(React.createElement(MatCapBadge));
        act(() => { setMatTuning('matCap', 20); });
        expect(badgeText(container)).toBe('Tokens 0/20');
    });

    it('hover opens the summary: heading, types with counts and red notes, spawned not counted', () => {
        placeAt('fixture_mb_hall', 800, 500);
        placeAt('fixture_mb_oak', 160, 160);
        const blocked = placeAt('fixture_mb_oak', 320, 160);
        blocked.alert = ALERT.INPUTS;
        const off = placeAt('fixture_mb_bench', 480, 160);
        off.disallowed = true;
        const gear = placeAt('fixture_mb_bench', 640, 160);
        gear.alert = ALERT.CHOOSE_RECIPE;
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 160, 480);
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 320, 480);
        placeAt(BoardState.createTokenInstance('fixture_mb_vein', null, null, BoardState.ORIGIN.SPAWNED), 480, 480);

        const { container } = render(React.createElement(MatCapBadge));
        expect(popover()).toBeNull();
        fireEvent.mouseEnter(container.querySelector('[data-mat-cap-badge]'));

        const tip = popover();
        expect(tip).not.toBeNull();
        expect(tip.className).toContain('pointer-events-none');
        expect(tip.textContent).toContain('Placed 4 of 12');
        const oak = tip.querySelector('[data-mat-cap-group="fixture_mb_oak"]');
        expect(oak.textContent).toContain('Bar Oak Forest ×2');
        expect(oak.querySelector('[data-mat-cap-note]').textContent).toBe('1 blocked');
        // The gear-only bench is not blocked; the disallowed one is off.
        const bench = tip.querySelector('[data-mat-cap-group="fixture_mb_bench"]');
        expect(bench.querySelector('[data-mat-cap-note]').textContent).toBe('1 off');
        expect(tip.querySelector('[data-mat-cap-group="fixture_mb_hall"]')).toBeNull();
        const spawned = tip.querySelector('[data-mat-cap-spawned]');
        expect(spawned.textContent).toContain('Spawned 3 (not counted)');
        expect(spawned.textContent).toContain('Bar Tree ×2, Bar Vein ×1');

        fireEvent.mouseLeave(container.querySelector('[data-mat-cap-badge]'));
        expect(popover()).toBeNull();
    });

    it('the open popover redraws when a Token\'s problem clears', () => {
        const oak = placeAt('fixture_mb_oak', 160, 160);
        oak.alert = ALERT.INPUTS;
        const { container } = render(React.createElement(MatCapBadge));
        fireEvent.mouseEnter(container.querySelector('[data-mat-cap-badge]'));
        expect(popover().querySelector('[data-mat-cap-note]')).not.toBeNull();
        oak.alert = null;
        act(() => { EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: oak.id, alert: null }); });
        expect(popover().querySelector('[data-mat-cap-note]')).toBeNull();
    });

    it('the live summary agrees with MatCap on the placed count', () => {
        placeAt('fixture_mb_hall', 800, 500);
        placeAt('fixture_mb_oak', 160, 160);
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 320, 160);
        const s = liveMatSummary();
        expect(s.placed.count).toBe(1);
        expect(s.spawned.count).toBe(1);
    });
});

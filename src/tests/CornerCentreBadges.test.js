// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import * as TokenBadges from '../ui/components/board/TokenBadges.jsx';
import { StationGearBadge, DisallowBadge } from '../ui/components/board/TokenBadges.jsx';
import {
    spawnerCountText, gearStateOf, isGearOnlyAlert
} from '../ui/components/board/centreAlert.js';
import { matW, matH } from '../config/matGeometry.js';
import { restHover } from './fixtures/hoverRest.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback, slice **Q2 — corner and centre badges**.
 */

registerItems({
    fixture_q2_seed: {
        id: 'fixture_q2_seed', name: 'Fixture Q2 Seed', type: 'material', sprite: 'i_wood_oak',
        description: '', tags: [], stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
    }
});

registerTokenTypes({
    fixture_q2_bench: {
        id: 'fixture_q2_bench', name: 'Fixture Q2 Bench', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: null,
        config: { skill: 'fixture_q2_skill', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_fixture_q2_bench', keyword: KEYWORD.STATION, payload: { skill: 'fixture_q2_skill' } }]
    },
    fixture_q2_empty_station: {
        id: 'fixture_q2_empty_station', name: 'Fixture Q2 Empty Station', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: null,
        config: { skill: 'fixture_q2_none', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_fixture_q2_empty', keyword: KEYWORD.STATION, payload: { skill: 'fixture_q2_none' } }]
    },
    fixture_q2_foundation: {
        id: 'fixture_q2_foundation', name: 'Fixture Q2 Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'wood', skill: 'fixture_q2_build' }
    },
    fixture_q2_sapling: {
        id: 'fixture_q2_sapling', name: 'Fixture Q2 Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature'
    },
    fixture_q2_forest: {
        id: 'fixture_q2_forest', name: 'Fixture Q2 Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
        spawner: {
            spawns: [{ typeId: 'fixture_q2_sapling', weight: 1 }],
            allowance: 5, intervalMs: 1000,
            upkeep: [{ itemId: 'fixture_q2_seed', quantity: 1 }]
        }
    }
});

registerRecipePools({
    fixture_q2_skill: [{
        id: 'fixture_q2_make', name: 'Make Coal', levelRequirement: 1,
        inputs: [], outputs: [{ itemId: 'item_coal', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 2000, xp: 1
    }],
    fixture_q2_build: [{
        id: 'fixture_q2_build_bench', name: 'Build Bench', levelRequirement: 1,
        foundationKinds: ['wood'], inputs: [],
        outputs: [{ tokenId: 'fixture_q2_bench', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 1000, xp: 1
    }]
});

const AT = { x: 560, y: 520 };
const FAR = { x: 1200, y: 520 };
const h = React.createElement;

function put(typeId, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const mount = (el) => render(
    h(DndContext, null, el)
);
const overlay = (container, id) => container.querySelector(`[data-token-overlay="${id}"]`);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    SpawnerSystem.resetAlerts();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
});

// ---------------------------------------------------------------------------
// The rules, pure
// ---------------------------------------------------------------------------

describe('gear alerts', () => {
    it('nothing chosen is a choice waiting, not a fault (the Token summary does not count it blocked)', () => {
        expect(isGearOnlyAlert(ALERT.CHOOSE_RECIPE)).toBe(true);
        expect(isGearOnlyAlert(ALERT.CHOOSE_BUILD)).toBe(true);
        for (const a of [ALERT.INPUTS, ALERT.NO_RECIPE, ALERT.CHARGES, ALERT.NO_ROOM, ALERT.ACCESS, ALERT.UNSKILLED]) {
            expect(isGearOnlyAlert(a)).toBe(false);
        }
    });
});

describe('gear visibility (FB-7)', () => {
    it('shows on a station with a pool, and on a Foundation; pulses only with nothing chosen', () => {
        expect(gearStateOf({ stationSkill: 's', hasPool: true, recipe: null })).toEqual({ show: true, pulsing: true });
        expect(gearStateOf({ stationSkill: 's', hasPool: true, recipe: { id: 'r' } })).toEqual({ show: true, pulsing: false });
        expect(gearStateOf({ stationSkill: 's', isFoundation: true, hasPool: false })).toEqual({ show: true, pulsing: true });
    });

    it('does not show on a station with an empty pool, or on a plain Token', () => {
        expect(gearStateOf({ stationSkill: 's', hasPool: false })).toEqual({ show: false, pulsing: false });
        expect(gearStateOf({})).toEqual({ show: false, pulsing: false });
    });
});

describe('spawner count text (FB-5)', () => {
    it('reads count/cap', () => {
        expect(spawnerCountText({ count: 3, cap: 5 })).toBe('3/5');
        expect(spawnerCountText({ count: 0, cap: 10 })).toBe('0/10');
        expect(spawnerCountText(null)).toBeNull();
    });

    it('SpawnerSystem.spawnerCounts follows the mat', () => {
        const forest = put('fixture_q2_forest');
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 0, cap: 5 });
        put('fixture_q2_sapling', FAR);
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 1, cap: 5 });
        const bench = put('fixture_q2_bench', FAR);
        expect(SpawnerSystem.spawnerCounts(bench.id)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The spawn callout's event
// ---------------------------------------------------------------------------

describe('a spawner announces the Token it just spawned', () => {
    const spawns = () => {
        const seen = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => seen.push(p));
        return { seen, unsub };
    };

    it('names the spawner, the new Token and its name', () => {
        InventoryManager.addItem('fixture_q2_seed', 5);
        const forest = put('fixture_q2_forest');
        const { seen, unsub } = spawns();
        for (let t = 0; t < 1200; t += 100) BoardRunner.tick(100);
        unsub();
        const [sapling] = BoardState.tokens().filter(t => t.typeId === 'fixture_q2_sapling');
        expect(sapling).toBeTruthy();
        expect(seen).toEqual([{
            spawnerId: forest.id, instanceId: sapling.id, typeId: 'fixture_q2_sapling', name: 'Fixture Q2 Sapling'
        }]);
    });
});

describe('the badges on their own', () => {
    it('the gear is the gear sprite, pulsing only when unset', () => {
        const unset = mount(h(StationGearBadge, { isDragging: false, recipe: null, pulsing: true, onClick: () => {} })).container;
        const gear = unset.querySelector('[data-station-gear]');
        expect(gear.getAttribute('data-station-gear')).toBe('unset');
        expect(gear.querySelector('img').getAttribute('src')).toBe('/assets/ui/u_gear.png');
        expect(gear.querySelector('img').style.imageRendering).toBe('pixelated');
        expect(gear.querySelectorAll('.gi-gear-alert').length).toBe(4);
        cleanup();

        const set = mount(h(StationGearBadge, { isDragging: false, recipe: { id: 'r', name: 'R' }, pulsing: false, onClick: () => {} })).container;
        expect(set.querySelector('[data-station-gear]').getAttribute('data-station-gear')).toBe('set');
        expect(set.querySelectorAll('.gi-gear-alert').length).toBe(0);
    });

    it('disallow badge renders, and hides while dragging; the corner count badges are gone (B1.3)', () => {
        expect(mount(h(DisallowBadge, { isDragging: false })).container.querySelector('img').getAttribute('src')).toBe('/assets/ui/u_disallow_red.png');
        cleanup();
        expect(mount(h(DisallowBadge, { isDragging: true })).container.querySelector('[data-tile-disallowed]')).toBeNull();
        expect(TokenBadges.SpawnerCountBadge).toBeUndefined();
        expect(TokenBadges.TurnCountdownBadge).toBeUndefined();
    });
});

const hoverAt = (container, tok) => {
    const root = container.querySelector('[data-mat-board]');
    root.getBoundingClientRect = () => ({
        left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0
    });
    fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
    restHover();
};

describe('on the mat', () => {
    it('FB-6: no Token carries the green assign-a-hero plus', () => {
        put('fixture_producer');
        put('fixture_q2_bench', FAR);
        const { container } = mount(h(MatBoard));
        expect(container.querySelector('[aria-label="Assign Hero"]')).toBeNull();
        expect(container.querySelector('img[src*="u_add_"]')).toBeNull();
    });

    it('an unset station shows the yellow "choose" mark at rest (brief 120, no longer the pulsing gear); the mark and the hovered gear open the picker', () => {
        vi.useFakeTimers();
        const bench = put('fixture_q2_bench');
        const onOpenRecipes = vi.fn();
        const { container } = mount(h(MatBoard, { onOpenRecipes }));
        const o = overlay(container, bench.id);

        expect(o.querySelector('[data-station-gear]')).toBeNull();
        const mark = o.querySelector('[data-problem-mark]');
        expect(mark.getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_RECIPE);
        expect(mark.getAttribute('data-problem-severity')).toBe('waiting');
        expect(o.querySelector('[data-alert-kind]')).toBeNull();
        // No words on the mat, not even the name until the pointer rests on it.
        expect(o.querySelector('[data-token-name]')).toBeNull();
        expect(o.textContent).toBe('');

        fireEvent.click(mark);
        expect(onOpenRecipes).toHaveBeenCalledWith(bench.id);
        hoverAt(container, bench);
        fireEvent.click(o.querySelector('[data-station-gear="unset"] button'));
        expect(onOpenRecipes).toHaveBeenCalledTimes(2);
    });

    it('a blocked Token draws one red mark and no words; worked, the mark is on its plate instead', () => {
        const bench = put('fixture_q2_bench');
        const token = (alert, heroId) => ({ typeId: bench.typeId, instanceId: bench.id, heroId, alert });
        const idle = mount(h(TokenBubbles, { instanceId: bench.id, token: token(ALERT.NO_ROOM, null) })).container;
        expect(idle.textContent).not.toContain('No room');
        expect(idle.querySelector('[data-alert-kind]')).toBeNull();
        expect(idle.querySelectorAll('[data-problem-mark]')).toHaveLength(1);
        expect(idle.querySelector('[data-problem-mark]').getAttribute('data-problem-severity')).toBe('cant');
        cleanup();
        const worked = mount(h(TokenBubbles, { instanceId: bench.id, token: token(ALERT.NO_ROOM, 'h1') })).container;
        expect(worked.textContent).not.toContain('No room');
        expect(worked.querySelector('[data-problem-mark]')).toBeNull();
        expect(worked.querySelector('[data-work-bar]')).toBeNull();
    });

    it('⭐ a Foundation hovered: the gear stands where its mark was, and stays put while the pointer crosses it (no flicker)', () => {
        vi.useFakeTimers();
        const f = put('fixture_q2_foundation');
        const onOpenRecipes = vi.fn();
        const { container } = mount(h(MatBoard, { onOpenRecipes }));
        const o = overlay(container, f.id);
        expect(o.querySelector('[data-problem-mark]')).not.toBeNull();
        hoverAt(container, f);
        const gear = o.querySelector('[data-gear-in-mark]');
        expect(gear).not.toBeNull();
        expect(o.querySelector('[data-problem-mark]')).toBeNull();
        // The pointer crosses the gear from edge to edge, landing on it: the same gear the whole way.
        const root = container.querySelector('[data-mat-board]');
        const button = gear.querySelector('button');
        for (const dx of [-30, -16, 0, 16, 30]) {
            for (const dy of [-30, 0, 30]) {
                fireEvent.pointerMove(button, { clientX: f.x + dx, clientY: f.y + dy });
                act(() => { vi.advanceTimersByTime(50); });
                expect(o.querySelector('[data-gear-in-mark]')).toBe(gear);
                expect(o.querySelector('[data-problem-mark]')).toBeNull();
            }
        }
        fireEvent.click(button);
        expect(onOpenRecipes).toHaveBeenCalledWith(f.id);
        // Off the Token, the mark comes back.
        fireEvent.pointerMove(root, { clientX: 40, clientY: 40 });
        restHover();
        expect(o.querySelector('[data-gear-in-mark]')).toBeNull();
        expect(o.querySelector('[data-problem-mark]')).not.toBeNull();
    });

    it('⭐ the yellow mark becomes the gear the moment the pointer reaches the Token, before the rest brings the name', () => {
        vi.useFakeTimers();
        const bench = put('fixture_q2_bench');
        const f = put('fixture_q2_foundation', FAR);
        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({
            left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0
        });
        for (const tok of [bench, f]) {
            const o = overlay(container, tok.id);
            expect(o.querySelector('[data-problem-mark]')).not.toBeNull();
            // Arrived, no time passed: the gear is in the mark's spot; the name still waits.
            fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
            expect(o.querySelector('[data-gear-in-mark]')).not.toBeNull();
            expect(o.querySelector('[data-problem-mark]')).toBeNull();
            expect(o.querySelector('[data-token-name]')).toBeNull();
            const gear = o.querySelector('[data-gear-in-mark]');
            restHover();
            // Rested: the same gear, and now the name.
            expect(o.querySelector('[data-gear-in-mark]')).toBe(gear);
            expect(o.querySelector('[data-token-name]')).not.toBeNull();
            // Off it, the mark is back at once.
            fireEvent.pointerMove(root, { clientX: 40, clientY: 40 });
            expect(o.querySelector('[data-gear-in-mark]')).toBeNull();
            expect(o.querySelector('[data-problem-mark]')).not.toBeNull();
            restHover();
        }
    });

    it('⭐ one gear size on every Token: a Foundation, an unset station and a chosen recipe all draw it at the mark size', () => {
        vi.useFakeTimers();
        const f = put('fixture_q2_foundation');
        const unsetBench = put('fixture_q2_bench', FAR);
        const setBench = put('fixture_q2_bench', { x: 1400, y: 300 });
        StationRecipe.setSelectedRecipe(setBench, 'fixture_q2_make');
        const { container } = mount(h(MatBoard));
        const markPx = parseFloat(overlay(container, f.id).querySelector('[data-problem-mark]').style.width);
        expect(markPx).toBe(32);
        const sizes = [];
        for (const tok of [f, unsetBench, setBench]) {
            hoverAt(container, tok);
            const button = overlay(container, tok.id).querySelector('[data-station-gear] button');
            sizes.push([button.getAttribute('data-gear-px'), button.style.width, button.querySelector('img').style.width]);
        }
        expect(sizes).toEqual(Array(3).fill(['32', '32px', '32px']));
    });

    it('FB-7: a chosen recipe keeps the gear, still, shown on hover', () => {
        vi.useFakeTimers();
        const bench = put('fixture_q2_bench');
        StationRecipe.setSelectedRecipe(bench, 'fixture_q2_make');
        const { container } = mount(h(MatBoard));
        expect(overlay(container, bench.id).querySelector('[data-station-gear]')).toBeNull();
        hoverAt(container, bench);
        expect(overlay(container, bench.id).querySelector('[data-station-gear="set"]')).not.toBeNull();
    });

    it('FB-7: a Foundation gets the gear (on hover) and the "choose what to build" mark; a station with an empty pool gets neither', () => {
        vi.useFakeTimers();
        const f = put('fixture_q2_foundation');
        const empty = put('fixture_q2_empty_station', FAR);
        const { container } = mount(h(MatBoard));
        expect(overlay(container, f.id).querySelector('[data-problem-mark]').getAttribute('data-problem-mark')).toBe(ALERT.CHOOSE_BUILD);
        hoverAt(container, f);
        expect(overlay(container, f.id).querySelector('[data-station-gear="unset"]')).not.toBeNull();
        expect(overlay(container, f.id).querySelector('[data-choose-build]')).toBeNull();
        expect(overlay(container, empty.id).querySelector('[data-station-gear]')).toBeNull();
        expect(overlay(container, empty.id).querySelector('[data-problem-mark]')).toBeNull();
    });

    it('FB-5 / B1.3: a spawner shows its count against its cap on its plate when hovered, never as a ring', () => {
        vi.useFakeTimers();
        const forest = put('fixture_q2_forest');
        put('fixture_q2_sapling', FAR);
        put('fixture_q2_sapling', { x: 1400, y: 300 });
        const { container } = mount(h(MatBoard));
        const o = overlay(container, forest.id);
        const cell = () => container.querySelector(`[data-idle-plate="${forest.id}"] [data-plate-cell="spawner"]`);
        expect(cell()).toBeNull();          // quiet at rest
        hoverAt(container, forest);
        expect(cell().textContent).toBe('2/5');
        expect(container.querySelector('[data-ring]')).toBeNull();
        expect(o.querySelector('[data-spawner-count]')).toBeNull();
    });

    it('a spawner that needs an item draws one yellow problem mark in its middle row, and nothing else', () => {
        vi.useFakeTimers();
        const forest = put('fixture_q2_forest');
        SpawnerSystem.syncAlerts();
        const { container } = mount(h(MatBoard));
        expect(SpawnerSystem.spawnerAlertOf(forest.id)?.alert).toBe(ALERT.SPAWN_NEEDS_ITEM);
        expect(container.querySelector('[data-spawner-alert], [data-worked-alert], [data-alert-kind], [data-token-notice]')).toBeNull();
        const o = container.querySelector(`[data-token-overlay="${forest.id}"]`);
        const mark = o.querySelector('[data-bubble-row="middle"] [data-problem-mark]');
        expect(mark.getAttribute('data-problem-mark')).toBe(ALERT.SPAWN_NEEDS_ITEM);
        expect(mark.getAttribute('src')).toContain('u_alert_yellow');
        expect(container.querySelectorAll('img[src*="u_alert"]').length).toBe(1);
    });
});

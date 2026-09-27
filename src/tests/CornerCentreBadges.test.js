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
import * as TokenNotices from '../systems/board/TokenNotices.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenCentreAlert } from '../ui/components/board/TokenEventAlert.jsx';
import { TokenBadgeRow } from '../ui/components/board/TokenBadgeRow.jsx';
import * as TokenBadges from '../ui/components/board/TokenBadges.jsx';
import { StationGearBadge, DisallowBadge } from '../ui/components/board/TokenBadges.jsx';
import {
    ALERT_KIND, alertKindOf, alertFades, pickCentreAlert, spawnerCountText, gearStateOf, isGearOnlyAlert
} from '../ui/components/board/centreAlert.js';
import { MatPointAlerts } from '../ui/components/board/MatPointAlerts.jsx';
import { TimeBankManager } from '../systems/core/TimeBankManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Token Lifecycle feedback, slice **Q2 — corner and centre badges**.
 *
 * * FB-6: no green plus on a workable Token.
 * * FB-7: the gear, top-left, on a Token with something to choose; with
 *   nothing chosen it pulses and nothing else (no red alert, no button).
 * * FB-33: a disallowed Token shows the red disallow sprite top-right.
 * * FB-8 / TL-14: alerts at the centre; problems stay, green notices fade.
 * * FB-48: a freshly spawned Token shows a green notice for ~10 s.
 * * FB-5: a spawner shows its live count against its cap — since B1.3 as a
 *   green ring in the row under it (TL-22), not a corner badge.
 */

registerItems({
    fixture_q2_seed: {
        id: 'fixture_q2_seed', name: 'Fixture Q2 Seed', type: 'material', sprite: 'wood_oak',
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
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature'
    },
    fixture_q2_forest: {
        id: 'fixture_q2_forest', name: 'Fixture Q2 Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature', requiresHero: false,
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
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);
const overlay = (container, id) => container.querySelector(`[data-token-overlay="${id}"]`);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    SpawnerSystem.resetAlerts();
    TokenNotices.resetNotices();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
});

// ---------------------------------------------------------------------------
// The rules, pure
// ---------------------------------------------------------------------------

describe('alert classification (TL-14)', () => {
    it('every alert kind the mat can be sent is a problem, a notice or spoken by a hero', () => {
        // News of a problem: red or yellow, at the centre.
        expect(alertKindOf({ severity: 'red', type: 'token_exhausted' })).toBe(ALERT_KIND.PROBLEM);
        expect(alertKindOf({ severity: 'disallow', type: 'drop_rejected' })).toBe(ALERT_KIND.PROBLEM);
        expect(alertKindOf({ severity: 'yellow', type: 'anything_else' })).toBe(ALERT_KIND.PROBLEM);
        // Green: a notice that fades.
        expect(alertKindOf({ severity: 'green', type: 'token_restocked' })).toBe(ALERT_KIND.NOTICE);
        // Said by the hero in a speech bubble (SB-2), never drawn on the Token.
        for (const type of ['out_of_item', 'out_of_token', 'out_of_charges', 'hero_level_up']) {
            expect(alertKindOf({ severity: 'yellow', type })).toBe(ALERT_KIND.SPOKEN);
        }
        expect(alertKindOf({ severity: 'upgrade', type: 'x' })).toBe(ALERT_KIND.SPOKEN);
        expect(alertKindOf(null)).toBeNull();
    });

    it('news of a problem that cannot be fixed fades; other problems and notices do not use this clock (after Q2)', () => {
        expect(alertFades({ severity: 'red', type: 'token_exhausted' })).toBe(true);
        expect(alertFades({ severity: 'disallow', type: 'drop_rejected' })).toBe(true);
        expect(alertFades({ severity: 'yellow', type: 'anything_else' })).toBe(false);
        expect(alertFades({ severity: 'green', type: 'token_restocked' })).toBe(false);   // a notice, faded by TokenNotices
        expect(alertFades({ severity: 'yellow', type: 'out_of_item' })).toBe(false);      // spoken by the hero
        expect(alertFades(null)).toBe(false);
    });

    it('nothing chosen is the gear\'s to say, not a problem', () => {
        expect(isGearOnlyAlert(ALERT.CHOOSE_RECIPE)).toBe(true);
        expect(isGearOnlyAlert(ALERT.CHOOSE_BUILD)).toBe(true);
        for (const a of [ALERT.INPUTS, ALERT.NO_RECIPE, ALERT.CHARGES, ALERT.NO_ROOM, ALERT.ACCESS, ALERT.UNSKILLED]) {
            expect(isGearOnlyAlert(a)).toBe(false);
        }
    });

    it('a problem always wins the centre over a notice', () => {
        const notice = { title: 'New' };
        expect(pickCentreAlert({ live: { a: 1 }, event: { b: 1 }, notice })).toBe('live');
        expect(pickCentreAlert({ event: { b: 1 }, notice })).toBe('event');
        expect(pickCentreAlert({ notice })).toBe('notice');
        expect(pickCentreAlert({})).toBeNull();
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
// Notices (FB-48)
// ---------------------------------------------------------------------------

describe('TokenNotices — the ten-second notice', () => {
    it('is up for NOTICE_MS of wall-clock time, then gone', () => {
        TokenNotices.raiseNotice('tok_1', { title: 'New Sapling' }, 1000);
        expect(TokenNotices.noticeOf('tok_1', 1000)).toMatchObject({ title: 'New Sapling', remainingMs: TokenNotices.NOTICE_MS });
        expect(TokenNotices.noticeOf('tok_1', 1000 + TokenNotices.NOTICE_MS - 1).remainingMs).toBe(1);
        expect(TokenNotices.noticeOf('tok_1', 1000 + TokenNotices.NOTICE_MS)).toBeNull();
        expect(TokenNotices.NOTICE_MS).toBe(10000);
    });

    it('a second notice replaces the first and restarts the clock; clearing takes it down', () => {
        TokenNotices.raiseNotice('tok_1', { title: 'A' }, 0);
        TokenNotices.raiseNotice('tok_1', { title: 'B' }, 8000);
        expect(TokenNotices.noticeOf('tok_1', 15000)).toMatchObject({ title: 'B' });
        TokenNotices.clearNotice('tok_1');
        expect(TokenNotices.noticeOf('tok_1', 15000)).toBeNull();
    });

    it('announces itself, and ignores a notice with no Token or no words', () => {
        const seen = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.NOTICE_CHANGED, (p) => seen.push(p.instanceId));
        TokenNotices.raiseNotice('tok_2', { title: 'Hi' });
        TokenNotices.raiseNotice(null, { title: 'Hi' });
        TokenNotices.raiseNotice('tok_3', {});
        unsub();
        expect(seen).toEqual(['tok_2']);
        expect(TokenNotices.noticeOf('tok_3')).toBeNull();
    });

    it('a spawner puts a notice on the Token it just spawned', () => {
        InventoryManager.addItem('fixture_q2_seed', 5);
        const forest = put('fixture_q2_forest');
        for (let t = 0; t < 1200; t += 100) BoardRunner.tick(100);
        const [sapling] = BoardState.tokens().filter(t => t.typeId === 'fixture_q2_sapling');
        expect(sapling).toBeTruthy();
        expect(TokenNotices.noticeOf(sapling.id)).toMatchObject({
            type: 'token_spawned', title: 'New Fixture Q2 Sapling', rulesText: 'Spawned by Fixture Q2 Forest'
        });
        expect(TokenNotices.noticeOf(forest.id)).toBeNull();
    });

    it('after Q2: no notice while the time bank replays time away; one again afterwards', () => {
        InventoryManager.addItem('fixture_q2_seed', 5);
        put('fixture_q2_forest');
        TimeBankManager.isSpending = true;
        try {
            for (let t = 0; t < 1200; t += 100) BoardRunner.tick(100);
        } finally {
            TimeBankManager.isSpending = false;
        }
        const quiet = BoardState.tokens().filter(t => t.typeId === 'fixture_q2_sapling');
        expect(quiet.length).toBe(1);
        expect(TokenNotices.noticeOf(quiet[0].id)).toBeNull();

        for (let t = 0; t < 1200; t += 100) BoardRunner.tick(100);
        const next = BoardState.tokens().filter(t => t.typeId === 'fixture_q2_sapling' && t.id !== quiet[0].id);
        expect(next.length).toBe(1);
        expect(TokenNotices.noticeOf(next[0].id)).toMatchObject({ type: 'token_spawned' });
    });
});

describe('the spot a used-up Token stood on (after Q2)', () => {
    it('its red alert goes on its own after ten seconds', () => {
        vi.useFakeTimers();
        const { container } = mount(h(MatPointAlerts));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: 'gone_1', x: 400, y: 400, severity: 'red', type: 'token_exhausted', name: 'Oak', message: 'Token Exhausted: Oak'
            });
        });
        const mark = container.querySelector('[data-mat-point-alert] [data-alert-kind="problem"]');
        expect(mark).not.toBeNull();
        expect(mark.getAttribute('data-alert-fades')).toBe('true');
        expect(mark.querySelector('img').getAttribute('src')).toBe('/assets/ui/ui_alert_red.png');

        act(() => { vi.advanceTimersByTime(8000); });
        expect(container.querySelector('[data-mat-point-alert]')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(2100); });
        expect(container.querySelector('[data-mat-point-alert]')).toBeNull();
    });
});

describe('TokenCentreAlert — one mark at the centre', () => {
    it('draws a notice green at the centre and lets it go after ~10 s', () => {
        vi.useFakeTimers();
        TokenNotices.raiseNotice('tok_c', { title: 'New Sapling', type: 'token_spawned' });
        const { container } = mount(h(TokenCentreAlert, { instanceId: 'tok_c' }));

        const mark = container.querySelector('[data-alert-kind="notice"]');
        expect(mark).not.toBeNull();
        expect(mark.className).toContain('left-1/2');
        expect(mark.className).toContain('top-1/2');
        expect(mark.querySelector('img').getAttribute('src')).toBe('/assets/ui/ui_alert_green.png');

        act(() => { vi.advanceTimersByTime(9000); });
        expect(container.querySelector('[data-alert-kind="notice"]')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(1100); });
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
    });

    it('turns a green event (a restock) into a notice', () => {
        const { container } = mount(h(TokenCentreAlert, { instanceId: 'tok_r' }));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: 'tok_r', severity: 'green', type: 'token_restocked', title: 'Restocked from X', message: 'Restocked from X'
            });
        });
        expect(container.querySelector('[data-token-notice="token_restocked"]')).not.toBeNull();
        expect(TokenNotices.noticeOf('tok_r')).toMatchObject({ title: 'Restocked from X' });
    });

    it('a problem covers a notice; problem news that can be read stays until read', () => {
        vi.useFakeTimers();
        TokenNotices.raiseNotice('tok_p', { title: 'New Sapling' });
        const { container } = mount(h(TokenCentreAlert, { instanceId: 'tok_p' }));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: 'tok_p', severity: 'yellow', type: 'fixture_problem', name: 'X', message: 'Something: X'
            });
        });
        const mark = container.querySelector('[data-alert-kind]');
        expect(mark.getAttribute('data-alert-kind')).toBe('problem');
        expect(mark.className).toContain('top-1/2');
        expect(mark.getAttribute('data-alert-fades')).toBeNull();

        act(() => { vi.advanceTimersByTime(60000); });
        expect(container.querySelector('[data-alert-kind="problem"]')).not.toBeNull();
        expect(container.querySelector('[data-alert-kind="problem"]').style.opacity).toBe('1');
    });

    it('after Q2: a refused drop on a Token stays red, then fades after ten seconds, hovered or not', () => {
        vi.useFakeTimers();
        const { container } = mount(h(TokenCentreAlert, { instanceId: 'tok_d' }));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                instanceId: 'tok_d', severity: 'disallow', type: 'drop_rejected', name: 'X', message: 'Drop Rejected: X'
            });
        });
        const mark = container.querySelector('[data-alert-kind="problem"]');
        expect(mark.getAttribute('data-alert-fades')).toBe('true');
        expect(mark.querySelector('img').getAttribute('src')).toBe('/assets/ui/ui_disallow_red.png');

        // Reading it does not stop the clock.
        fireEvent.mouseEnter(mark);
        fireEvent.mouseLeave(mark);
        act(() => { vi.advanceTimersByTime(TokenNotices.NOTICE_MS - 2000); });
        expect(container.querySelector('[data-alert-kind="problem"]').style.opacity).toBe('1');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(container.querySelector('[data-alert-kind="problem"]').style.opacity).toBe('0');
        act(() => { vi.advanceTimersByTime(1100); });
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
    });

    it('a hero-spoken alert draws nothing', () => {
        const { container } = mount(h(TokenCentreAlert, { instanceId: 'tok_s' }));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, { instanceId: 'tok_s', severity: 'yellow', type: 'out_of_item', message: 'Out of item: X' });
        });
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The badges, drawn
// ---------------------------------------------------------------------------

describe('the badges on their own', () => {
    it('the gear is the gear sprite, top-left, pulsing only when unset', () => {
        const unset = mount(h(StationGearBadge, { isDragging: false, recipe: null, pulsing: true, onClick: () => {} })).container;
        const gear = unset.querySelector('[data-station-gear]');
        expect(gear.getAttribute('data-station-gear')).toBe('unset');
        expect(gear.className).toContain('left-1');
        expect(gear.className).toContain('top-1');
        expect(gear.querySelector('img').getAttribute('src')).toBe('/assets/ui/ui_gear.png');
        expect(gear.querySelector('img').style.imageRendering).toBe('pixelated');
        expect(gear.querySelector('button').className).toContain('gi-gear-pulse');
        cleanup();

        const set = mount(h(StationGearBadge, { isDragging: false, recipe: { id: 'r', name: 'R' }, pulsing: false, onClick: () => {} })).container;
        expect(set.querySelector('[data-station-gear]').getAttribute('data-station-gear')).toBe('set');
        expect(set.querySelector('button').className).not.toContain('gi-gear-pulse');
    });

    it('disallow badge renders, and hides while dragging; the corner count badges are gone (B1.3)', () => {
        expect(mount(h(DisallowBadge, { isDragging: false })).container.querySelector('img').getAttribute('src')).toBe('/assets/ui/ui_disallow_red.png');
        cleanup();
        expect(mount(h(DisallowBadge, { isDragging: true })).container.querySelector('[data-tile-disallowed]')).toBeNull();
        expect(TokenBadges.SpawnerCountBadge).toBeUndefined();
        expect(TokenBadges.TurnCountdownBadge).toBeUndefined();
    });
});

describe('on the mat', () => {
    it('FB-6: no Token carries the green assign-a-hero plus', () => {
        put('fixture_producer');
        put('fixture_q2_bench', FAR);
        const { container } = mount(h(MatBoard));
        expect(container.querySelector('[aria-label="Assign Hero"]')).toBeNull();
        expect(container.querySelector('img[src*="ui_add_"]')).toBeNull();
    });

    it('FB-7: an unset station shows a pulsing gear and no alert, button or red bar; the gear opens the picker', () => {
        const bench = put('fixture_q2_bench');
        const onOpenRecipes = vi.fn();
        const { container } = mount(h(MatBoard, { onOpenRecipes }));
        const o = overlay(container, bench.id);

        expect(o.querySelector('[data-station-gear="unset"]')).not.toBeNull();
        expect(o.querySelector('[data-choose-recipe]')).toBeNull();
        expect(o.querySelector('[data-alert-kind]')).toBeNull();
        expect(o.textContent).not.toContain('Choose a recipe');

        fireEvent.click(o.querySelector('[data-station-gear] button'));
        expect(onOpenRecipes).toHaveBeenCalledWith(bench.id);
    });

    it('FB-7: a staffed unset station draws no red Choose Recipe mark; a real problem still does (B1.1: at the centre)', () => {
        const bench = put('fixture_q2_bench');
        const token = (alert) => ({ typeId: bench.typeId, instanceId: bench.id, heroId: 'h1', alert });
        const centre = (alert) => h(TokenCentreAlert, { instanceId: bench.id, token: token(alert) });
        const { container, rerender } = mount(centre(ALERT.CHOOSE_RECIPE));
        const again = (el) => rerender(h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el)));
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
        again(centre(ALERT.CHOOSE_BUILD));
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
        again(centre(ALERT.NO_ROOM));
        const mark = container.querySelector('[data-worked-alert="no_room"] [data-alert-kind="problem"]');
        expect(mark.getAttribute('data-alert-severity')).toBe('red');
        // And the ring row says none of it: its cycle ring just greys (B1.2).
        cleanup();
        const row = mount(h(TokenBadgeRow, { instanceId: bench.id, token: token(ALERT.NO_ROOM) })).container;
        expect(row.textContent).not.toContain('No Room');
        expect(row.querySelector('[data-ring="cycle"]').getAttribute('data-ring-greyed')).toBe('true');
    });

    it('B1.1: a spawner’s live problem wins over a worked one', () => {
        const forest = put('fixture_q2_forest');
        SpawnerSystem.syncAlerts();
        const token = { typeId: forest.typeId, instanceId: forest.id, heroId: 'h1', alert: ALERT.ACCESS };
        const { container } = mount(h(TokenCentreAlert, { instanceId: forest.id, isSpawner: true, token }));
        expect(container.querySelector('[data-spawner-alert]').getAttribute('data-spawner-alert')).toBe(ALERT.SPAWN_NEEDS_ITEM);
        expect(container.querySelector('[data-worked-alert]')).toBeNull();
        expect(container.querySelectorAll('[data-alert-kind]').length).toBe(1);
    });

    it('FB-7: a chosen recipe keeps the gear, still', () => {
        const bench = put('fixture_q2_bench');
        StationRecipe.setSelectedRecipe(bench, 'fixture_q2_make');
        const { container } = mount(h(MatBoard));
        expect(overlay(container, bench.id).querySelector('[data-station-gear="set"]')).not.toBeNull();
    });

    it('FB-7: a Foundation gets the gear; a station with an empty pool does not', () => {
        const f = put('fixture_q2_foundation');
        const empty = put('fixture_q2_empty_station', FAR);
        const { container } = mount(h(MatBoard));
        expect(overlay(container, f.id).querySelector('[data-station-gear="unset"]')).not.toBeNull();
        expect(overlay(container, f.id).querySelector('[data-choose-build]')).toBeNull();
        expect(overlay(container, empty.id).querySelector('[data-station-gear]')).toBeNull();
    });

    it('FB-5 / B1.3: a spawner shows its count against its cap as a ring in its row, not in a corner', () => {
        const forest = put('fixture_q2_forest');
        put('fixture_q2_sapling', FAR);
        put('fixture_q2_sapling', { x: 1400, y: 300 });
        const { container } = mount(h(MatBoard));
        const o = overlay(container, forest.id);
        const ring = o.querySelector('[data-ring-row] [data-ring="spawner"]');
        expect(ring.getAttribute('data-ring-text')).toBe('2/5');
        expect(Number(ring.getAttribute('data-ring-fraction'))).toBeCloseTo(0.4, 3);
        expect(o.querySelector('[data-spawner-count]')).toBeNull();
    });

    it('FB-8: a spawner that needs an item says so at its centre, and it stays', () => {
        vi.useFakeTimers();
        const forest = put('fixture_q2_forest');
        SpawnerSystem.syncAlerts();
        const { container } = mount(h(MatBoard));
        const alert = overlay(container, forest.id).querySelector('[data-spawner-alert]');
        expect(alert.getAttribute('data-spawner-alert')).toBe(ALERT.SPAWN_NEEDS_ITEM);
        expect(alert.querySelector('[data-alert-kind="problem"]').className).toContain('top-1/2');
        act(() => { vi.advanceTimersByTime(30000); });
        expect(overlay(container, forest.id).querySelector('[data-spawner-alert]')).not.toBeNull();
    });
});

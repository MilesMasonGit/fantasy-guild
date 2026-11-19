// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as Growth from '../systems/board/Growth.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';
import { subscribeEvery } from '../ui/components/board/tokenEvents.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A Token's "!" after a catch-up (a PC sleep): the catch-up plays on a quiet bus, so the
 * spawner's and the growth's alert changes are never heard by the Token's drawing, and the engine
 * says an alert only when it changes. The catch-up's end says `GAME_RESET`; the mark is re-read
 * then, both ways: a stall that began during the catch-up shows, one that ended goes.
 */

const SEED = 'fixture_cu_seed';
registerItems({ [SEED]: { id: SEED, name: 'Fixture Cu Seed', type: 'resource' } });
registerTokenTypes({
    fixture_cu_sapling: {
        id: 'fixture_cu_sapling', name: 'Fixture Cu Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature'
    },
    fixture_cu_orchard: {
        id: 'fixture_cu_orchard', name: 'Fixture Cu Orchard', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: {
            spawns: [{ typeId: 'fixture_cu_sapling', weight: 1 }], allowance: 3, intervalMs: 5000,
            upkeep: [{ itemId: SEED, quantity: 1 }]
        }
    }
});

const h = React.createElement;
const mount = (token) => render(h(DndContext, null, h('div', null,
    h(TokenBubbles, { instanceId: token.id, boxPx: 128, token: { typeId: token.typeId, instanceId: token.id, heroId: null, alert: null, usesRemaining: null } })
)));
const mark = (c) => c.querySelector('[data-problem-mark]');

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
/** Engine work with nothing on screen hearing it, as a catch-up plays; then what its end says. */
const catchUp = (work) => {
    EventBus.setQuiet(true);
    try { work(); } finally { EventBus.setQuiet(false); }
    act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'catch_up' }); });
};

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
    SpawnerSystem.resetAlerts();
    Growth.resetGrowthAlerts();
});
afterEach(() => {
    cleanup();
    EventBus.setQuiet(false);
    TriggerSystem.teardown();
    TileModifiers.teardown();
    resetMatTuning();
});

describe('⭐ a spawner\'s "!" is right after a catch-up', () => {
    it('a spawner that ran out of upkeep during the catch-up wears its mark; given it again, the mark goes', () => {
        InventoryManager.addItem(SEED, 1);
        const orchard = placeAt('fixture_cu_orchard', 800, 500);
        const view = mount(orchard);
        expect(mark(view.container)).toBeNull();

        catchUp(() => run(20000));
        expect(SpawnerSystem.spawnerAlertOf(orchard.id)?.alert).toBe(ALERT.SPAWN_NEEDS_ITEM);
        expect(mark(view.container)?.getAttribute('data-problem-mark')).toBe(ALERT.SPAWN_NEEDS_ITEM);

        catchUp(() => { InventoryManager.addItem(SEED, 5); run(6000); });
        expect(SpawnerSystem.spawnerAlertOf(orchard.id)).toBeNull();
        expect(mark(view.container)).toBeNull();
    });
});

describe('⭐ a growing Token\'s "!" is right after a catch-up', () => {
    it('a growth stall that began during the catch-up shows; one that ended goes', () => {
        const stump = placeAt('fixture_cu_sapling', 400, 300);
        const view = mount(stump);
        expect(mark(view.container)).toBeNull();

        catchUp(() => Growth.setGrowthAlert(stump.id, ALERT.GROW_NEEDS_ITEM, [SEED]));
        expect(mark(view.container)?.getAttribute('data-problem-mark')).toBe(ALERT.GROW_NEEDS_ITEM);

        catchUp(() => Growth.setGrowthAlert(stump.id, null));
        expect(mark(view.container)).toBeNull();
    });
});

describe('the reset route: one bus subscription however many Tokens listen', () => {
    it('opens one subscription for the first listener, closes it with the last, and tells each', () => {
        const EVT = 'fixture_cu_broadcast';
        const subs = () => EventBus.subscribers.get(EVT)?.size ?? 0;
        const heard = [];
        const offA = subscribeEvery(EVT, (p) => heard.push(['a', p.n]));
        const offB = subscribeEvery(EVT, (p) => heard.push(['b', p.n]));
        expect(subs()).toBe(1);
        EventBus.publish(EVT, { n: 1 });
        expect(heard).toEqual([['a', 1], ['b', 1]]);
        offA();
        expect(subs()).toBe(1);
        offB();
        expect(subs()).toBe(0);
        EventBus.publish(EVT, { n: 2 });
        expect(heard).toHaveLength(2);
    });

    it('the Token bubbles of many Tokens share it', () => {
        const before = EventBus.subscribers.get(ENGINE_EVENTS.GAME_RESET)?.size ?? 0;
        const tokens = [100, 300, 500].map(x => placeAt('fixture_cu_sapling', x, 300));
        const views = tokens.map(mount);
        expect(EventBus.subscribers.get(ENGINE_EVENTS.GAME_RESET)?.size ?? 0).toBeLessThanOrEqual(before + 1);
        views.forEach(v => v.unmount());
    });
});

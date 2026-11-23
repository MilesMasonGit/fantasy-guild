// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as TokenGlows from '../systems/board/TokenGlows.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { CALLOUT_MS } from '../ui/components/board/callouts.js';
import { clearBubbles, dismissBubble, hasBubble, bubblesOf } from '../ui/components/board/speechBubbles.js';
import {
    RECOVERED_KEY, recoveredSpec, needsItemKey, needsItemSpec, raiseNeedsItem
} from '../ui/components/board/heroNeeds.js';
import { SPEECH_TONE } from '../ui/components/board/speechTone.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The moments that were silent speak: a hero back from a wound (a waiting bubble until they start
 * work), a Token run dry and resting (a popup over it), a Token that has just become another (its
 * new name over it, with the glow), and a hero whose work stops for want of an item ("Needs Coal",
 * a waiting bubble until it is within reach again, rebuilt on a load while the need stands).
 */

registerTokenTypes({
    sm_vein: {
        id: 'sm_vein', name: 'Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 2,
        sprite: 's_nature', requiresHero: true, respawn: { mode: 'refill', afterMs: 20000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
            outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] }
    },
    sm_furnace: {
        id: 'sm_furnace', name: 'Test Furnace', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: true,
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
            inputs: [{ itemId: 'item_coal', quantity: 2 }],
            outputs: [{ itemId: 'item_copper_ingot', chance: 100, minQty: 1, maxQty: 1 }] }
    },
    sm_stump: {
        id: 'sm_stump', name: 'Test Stump', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false, config: { cycleTimeMs: 1000, inputs: [], outputs: [] }
    },
    sm_oak: {
        id: 'sm_oak', name: 'Test Oak Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 3,
        sprite: 's_nature', requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
            outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

const h = React.createElement;

function heroRecord(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 }, equipment: [null, null] };
}

function put(typeId, x, y) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, { x, y });
    expect(res?.success, res?.reason).not.toBe(false);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const callouts = (container) => [...container.querySelectorAll('[data-callout]')].map(n => n.textContent);
const stack = (container, id) => [...container.querySelectorAll(`[data-hero-bubble-stack="${id}"] [data-hero-bubble]`)]
    .map(n => n.textContent);
const onMat = (id, x = 800, y = 500) => ({ heroId: id, state: 'idle', x, y, moving: false, tokenId: null, alert: null });

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    TokenGlows.resetGlows();
    clearBubbles();
    GameState.state.heroes = [heroRecord('miner', { mining: 10 }), heroRecord('smith', { mining: 10, smithing: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    cleanup();
    clearBubbles();
    vi.useRealTimers();
});

describe('back from a wound: "Recovered, ready to work!" waits over the hero', () => {
    const mount = () => {
        const view = render(h(HeroBubbleLayer, { heroes: [onMat('miner')] }));
        act(() => { vi.advanceTimersByTime(10); });
        return view;
    };
    const recover = () => act(() => {
        EventBus.publish(ENGINE_EVENTS.HERO_RECOVERED, { heroId: 'miner', heroName: 'miner', recoveredHp: 50 });
    });

    it('in gold, still there long after a moment would have gone', () => {
        const { container } = mount();
        recover();
        const bubble = container.querySelector('[data-hero-bubble="recovered"]');
        expect(bubble.textContent).toBe('Recovered, ready to work!');
        expect(bubble.getAttribute('data-hero-bubble-kind')).toBe('waiting');
        expect(bubble.getAttribute('data-speech-tone')).toBe(SPEECH_TONE.ATTENTION);
        act(() => { vi.advanceTimersByTime(60 * 1000); });
        expect(stack(container, 'miner')).toEqual(['Recovered, ready to work!']);
    });

    it('hovering or clicking it dismisses it', () => {
        const { container } = mount();
        recover();
        fireEvent.pointerEnter(container.querySelector('[data-hero-bubble="recovered"]'));
        expect(stack(container, 'miner')).toEqual([]);
        recover();
        fireEvent.click(container.querySelector('[data-hero-bubble="recovered"]'));
        expect(stack(container, 'miner')).toEqual([]);
    });

    it('clears itself once the hero starts work', () => {
        put('sm_vein', 800, 500);
        const { container } = mount();
        recover();
        expect(stack(container, 'miner')).toEqual(['Recovered, ready to work!']);
        let started = false;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_START, (p) => { if (p?.heroId === 'miner') started = true; });
        try {
            act(() => {
                Orders.orderAt('miner', { x: 800, y: 500 });
                run(1500);
            });
        } finally { off(); }
        expect(started).toBe(true);
        expect(hasBubble('miner', RECOVERED_KEY)).toBe(false);
        expect(stack(container, 'miner')).toEqual([]);
    });

    it('stands while the hero is not working; gone if they are wounded again or leave', () => {
        const spec = recoveredSpec('miner');
        expect(spec.holds()).toBe(true);
        GameState.state.heroes[0].status = 'wounded';
        expect(spec.holds()).toBe(false);
        GameState.state.heroes[0].status = 'idle';
        GameState.state.heroes = GameState.state.heroes.filter(x => x.id !== 'miner');
        expect(spec.holds()).toBe(false);
    });
});

describe('a Token run dry and resting: a popup over it', () => {
    it('"Copper Vein exhausted" over the vein as it rests, gone by itself', () => {
        const vein = put('sm_vein', 800, 500);
        const { container } = render(h(CalloutLayer));
        act(() => {
            Orders.orderAt('miner', { x: 800, y: 500 });
            run(6000);
        });
        expect(vein.usesRemaining).toBe(0);
        expect(BoardState.getTokenById(vein.id)).toBeTruthy();
        expect(callouts(container)).toContain('Copper Vein exhausted');
        expect(callouts(container)).not.toContain('Copper Vein used up');
        act(() => { vi.advanceTimersByTime(CALLOUT_MS + 10); });
        expect(callouts(container)).toEqual([]);
    });
});

describe('a Token that has just become another: its new name over it, with the glow', () => {
    it('a growth, a regrow or a turn says the new name', () => {
        const stump = put('sm_stump', 800, 500);
        const { container } = render(h(CalloutLayer));
        let oak;
        act(() => { oak = EffectActions.transformInstance(stump, 'sm_oak', { fixPlaced: true, cause: 'grow' }); });
        expect(oak).toBeTruthy();
        expect(callouts(container)).toEqual(['Test Oak Tree']);
        expect(TokenGlows.glowOf(oak.id)).not.toBeNull();
        act(() => { vi.advanceTimersByTime(CALLOUT_MS + 10); });
        expect(callouts(container)).toEqual([]);
    });

    it('a build says "{name} built"', () => {
        const { container } = render(h(CalloutLayer));
        const oak = put('sm_oak', 800, 500);
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_TRANSFORMED, { fromId: 'x', fromTypeId: 'sm_stump', instanceId: oak.id, typeId: 'sm_oak', cause: 'build' });
        });
        expect(callouts(container)).toEqual(['Test Oak Tree built']);
    });
});

describe('running out of what the work needs: "Needs {item}" waits over the hero', () => {
    it('raised once per item, however often the engine says it; a dismissed one stays dismissed', () => {
        expect(raiseNeedsItem('smith', 'item_coal')).toBe(true);
        expect(bubblesOf('smith').map(b => b.text)).toEqual(['Needs Coal']);
        expect(raiseNeedsItem('smith', 'item_coal')).toBe(false);
        dismissBubble('smith', needsItemKey('item_coal'));
        expect(raiseNeedsItem('smith', 'item_coal')).toBe(false);
        expect(bubblesOf('smith')).toEqual([]);
        expect(hasBubble('smith', needsItemKey('item_coal'))).toBe(true);
    });

    it('one bubble per item: another item missing is another line', () => {
        raiseNeedsItem('smith', 'item_coal');
        raiseNeedsItem('smith', 'item_copper_ore');
        expect(bubblesOf('smith').map(b => b.text)).toEqual(['Needs Coal', 'Needs Copper Ore']);
    });

    it('clears once the Bank holds as many as the work takes; met, the next run-out is news again', () => {
        raiseNeedsItem('smith', 'item_coal', { quantity: 2 });
        act(() => { InventoryManager.addItem('item_coal', 1); });
        expect(hasBubble('smith', needsItemKey('item_coal'))).toBe(true);
        act(() => { InventoryManager.addItem('item_coal', 1); });
        expect(hasBubble('smith', needsItemKey('item_coal'))).toBe(false);
        act(() => { InventoryManager.removeItem('item_coal', 2); });
        expect(raiseNeedsItem('smith', 'item_coal', { quantity: 2 })).toBe(true);
    });

    it('is not raised while the item is within reach, and goes with a hero who leaves', () => {
        InventoryManager.addItem('item_coal', 1);
        expect(raiseNeedsItem('smith', 'item_coal')).toBe(false);
        const spec = needsItemSpec('miner', 'item_copper_ore');
        expect(spec.holds()).toBe(true);
        GameState.state.heroes = GameState.state.heroes.filter(x => x.id !== 'miner');
        expect(spec.holds()).toBe(false);
    });

    it('clears once the hero is given another job, or sent home (a knock-out too)', () => {
        BoardState.setFlag('smith', { x: 10, y: 10, spot: true, plantedAt: 1 });
        BoardState.setFlag('miner', { x: 10, y: 10, spot: true, plantedAt: 2 });
        raiseNeedsItem('smith', 'item_coal');
        raiseNeedsItem('miner', 'item_coal');
        act(() => {
            BoardState.setFlag('smith', { x: 20, y: 20, spot: true, plantedAt: 3 });
            EventBus.publish(ENGINE_EVENTS.HERO_DEPLOYED, { heroId: 'smith', instanceId: null, typeId: null });
        });
        expect(hasBubble('smith', needsItemKey('item_coal'))).toBe(false);
        act(() => {
            BoardState.setFlag('miner', null);
            EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'miner', instanceId: null, reason: 'home' });
        });
        expect(hasBubble('miner', needsItemKey('item_coal'))).toBe(false);
    });

    it('going idle with "Needs Coal" up says nothing more', () => {
        const busy = [{ ...onMat('smith'), state: 'working' }, { ...onMat('miner', 300, 500), state: 'working' }];
        const { container, rerender } = render(h(HeroBubbleLayer, { heroes: busy }));
        act(() => { vi.advanceTimersByTime(10); });
        act(() => { raiseNeedsItem('smith', 'item_coal'); });
        rerender(h(HeroBubbleLayer, { heroes: busy.map(x => ({ ...x, state: 'idle' })) }));
        expect(stack(container, 'smith')).toEqual(['Needs Coal']);
        expect(stack(container, 'miner')).toEqual(['Nothing to work here.']);
    });

    it('a station run dry: the hero at it says "Needs Coal"', () => {
        const furnace = put('sm_furnace', 800, 500);
        InventoryManager.addItem('item_coal', 2);
        const { container } = render(h(HeroBubbleLayer, { heroes: [{ ...onMat('smith'), state: 'working', tokenId: furnace.id }] }));
        act(() => {
            Orders.orderAt('smith', { x: 800, y: 500 });
            run(6000);
        });
        expect(BoardState.workerOf(furnace.id)).toBe('smith');
        expect(InventoryManager.getItemCount('item_coal')).toBe(0);
        expect(stack(container, 'smith')).toEqual(['Needs Coal']);
    });

    it('a station never stocked: the hero says "Needs Coal", red, hover hides it, Coal in the Bank clears it', () => {
        put('sm_furnace', 800, 500);
        const { container } = render(h(HeroBubbleLayer, { heroes: [onMat('smith')] }));
        act(() => {
            Orders.orderAt('smith', { x: 800, y: 500 });
            run(3000);
        });
        const bubble = container.querySelector('[data-hero-bubble="needs:item_coal"]');
        expect(bubble.textContent).toBe('Needs Coal');
        expect(bubble.getAttribute('data-speech-tone')).toBe(SPEECH_TONE.CANT);
        fireEvent.pointerEnter(bubble);
        expect(stack(container, 'smith')).toEqual([]);
        // Still stopped, the engine says it again: the dismissed bubble stays dismissed.
        act(() => { run(3000); });
        expect(stack(container, 'smith')).toEqual([]);
        expect(hasBubble('smith', needsItemKey('item_coal'))).toBe(true);
        act(() => { InventoryManager.addItem('item_coal', 2); });
        expect(hasBubble('smith', needsItemKey('item_coal'))).toBe(false);
    });
});

describe('"Needs Coal" rebuilt on a load, not saved', () => {
    const orderOnFurnace = () => {
        const furnace = put('sm_furnace', 800, 500);
        BoardState.setFlag('smith', { x: furnace.x, y: furnace.y, pinnedTo: furnace.id, plantedAt: 1 });
        return furnace;
    };

    it('a hero still ordered onto a station short of an input says so again', () => {
        orderOnFurnace();
        const { container } = render(h(HeroBubbleLayer, { heroes: [onMat('smith')] }));
        act(() => { vi.advanceTimersByTime(10); });
        expect(stack(container, 'smith')).toEqual(['Needs Coal']);
        expect(JSON.stringify(GameState.state)).not.toContain('Needs Coal');
    });

    it('a load rebuilds it; nothing is rebuilt once the Bank holds enough', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes: [onMat('smith')] }));
        act(() => { vi.advanceTimersByTime(10); });
        expect(stack(container, 'smith')).toEqual([]);
        orderOnFurnace();
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
        expect(stack(container, 'smith')).toEqual(['Needs Coal']);
        InventoryManager.addItem('item_coal', 2);
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
        expect(stack(container, 'smith')).toEqual([]);
    });

    it('a recovery is not rebuilt: it is news of a moment', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes: [onMat('miner')] }));
        act(() => { vi.advanceTimersByTime(10); });
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
        expect(stack(container, 'miner')).toEqual([]);
    });
});

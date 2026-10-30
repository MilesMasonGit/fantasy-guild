// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
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
import { LootSystem } from '../systems/combat/LootSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { flagStatusLine, dockStatusLine, waitingTypeOf } from '../ui/components/board/flagText.js';
import { idleMomentOf, momentText } from '../ui/components/board/heroSpeech.js';
import { calloutText, INPUT_CALLOUT_GAP_MS } from '../ui/components/board/callouts.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { platePlace } from '../ui/components/board/workPlate.js';
import { matH } from '../config/matGeometry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Brief 230 S1b (owner rulings 2026-10-24):
 * - a gatherer with nothing ready in reach waits silently: no bubble, no idle mark, "Waiting for
 *   Copper Vein" on the flag and in the Dock, and works the node the moment it is back;
 * - a station out of an input stops and says what is missing ("Needs Coal", the "Needs Pickaxe"
 *   callout's look); its hero waits there unless other work in the flag's reach can run.
 */

registerTokenTypes({
    sw_vein: {
        id: 'sw_vein', name: 'Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 2,
        sprite: 's_nature', requiresHero: true, respawn: { mode: 'refill', afterMs: 20000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
            outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] }
    },
    sw_coal_vein: {
        id: 'sw_coal_vein', name: 'Coal Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 2,
        sprite: 's_nature', requiresHero: true, respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
            outputs: [{ itemId: 'item_coal', chance: 100, minQty: 1, maxQty: 1 }] }
    },
    sw_furnace: {
        id: 'sw_furnace', name: 'Test Furnace', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: true,
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
            inputs: [{ itemId: 'item_coal', quantity: 1 }],
            outputs: [{ itemId: 'item_copper_ingot', chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, x, y) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, { x, y });
    expect(res?.success, res?.reason).not.toBe(false);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

/** Count the cycles a Token finishes while `fn` runs. */
function cyclesOf(instance, fn) {
    let n = 0;
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.instanceId === instance.id) n++; });
    try { fn(); } finally { off(); }
    return n;
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
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
    GameState.state.heroes = [hero('miner', { mining: 10 }), hero('smith', { mining: 10, smithing: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

describe('a gatherer whose only vein rests waits silently', () => {
    function restedVein() {
        const vein = put('sw_vein', 800, 500);
        Orders.orderAt('miner', { x: 800, y: 500 });
        run(6000);
        expect(vein.usesRemaining).toBe(0);
        return vein;
    }

    it('reads as waiting for that vein, not idle: the flag and the Dock name it', () => {
        const vein = restedVein();
        expect(Flags.statusOf('miner').state).toBe('idle');
        expect(Flags.waitingFor('miner')).toBe(vein.id);
        expect(Flags.waitingOf('miner')).toEqual({ instanceId: vein.id, kind: 'node' });
        expect(flagStatusLine('miner')).toBe('Waiting for Copper Vein');
        expect(waitingTypeOf('miner')).toBe('sw_vein');
        expect(dockStatusLine({ state: 'idle', waitingFor: waitingTypeOf('miner') })).toBe('Waiting for Copper Vein');
    });

    it('carries no yellow idle mark', () => {
        restedVein();
        expect(BoardRunner.isHeroIdle('miner')).toBe(false);
    });

    it('says nothing over their head', () => {
        const vein = restedVein();
        expect(idleMomentOf(Flags.waitingOf('miner'), vein.typeId)).toBeNull();
    });

    it('works the vein again the moment it refills', () => {
        const vein = restedVein();
        const restLeft = 20000 - vein.clocks.respawnMs;
        run(restLeft - 500);
        expect(Flags.waitingFor('miner')).toBe(vein.id);
        run(1000);
        expect(Flags.statusOf('miner').instanceId).toBe(vein.id);
        expect(Flags.waitingFor('miner')).toBeNull();
        expect(BoardRunner.isHeroIdle('miner')).toBe(false);
    });

    it('a pinned miner waits by the vein the same way', () => {
        const vein = put('sw_vein', 800, 500);
        Orders.orderAt('miner', { x: 800, y: 500 });
        expect(BoardState.flagOf('miner').pinnedTo).toBe(vein.id);
        run(6000);
        expect(Flags.waitingOf('miner')).toEqual({ instanceId: vein.id, kind: 'node' });
        expect(BoardRunner.isHeroIdle('miner')).toBe(false);
    });

    it('a hero sent to bare ground waits for nothing and is idle there', () => {
        Orders.orderAt('miner', { x: 800, y: 500 });
        run(1000);
        expect(Flags.waitingOf('miner')).toBeNull();
        expect(BoardRunner.isHeroIdle('miner')).toBe(true);
        expect(flagStatusLine('miner')).toBe('Idle here');
        expect(idleMomentOf(null)).toEqual({ kind: 'idle', key: 'idle', text: momentText.idle() });
    });

    it('a busy fight still says "Waiting for Goblin." out loud (combat C5 is unchanged)', () => {
        expect(idleMomentOf({ instanceId: 'x', kind: 'fight' }, 'Goblin'))
            .toEqual({ kind: 'waiting', key: 'idle', text: 'Waiting for Goblin.' });
    });
});

describe('a station out of an input', () => {
    it('with no other work in reach: the hero stays, the station says "Needs Coal" now and then', () => {
        const furnace = put('sw_furnace', 800, 500);
        InventoryManager.addItem('item_coal', 1);
        const said = [];
        const off = EventBus.subscribe(BOARD_EVENTS.INPUT_NEEDED, (p) => said.push(p));
        let smelted = 0;
        try {
            smelted = cyclesOf(furnace, () => {
                Orders.orderAt('smith', { x: 800, y: 500 });
                run(8000);
            });
        } finally { off(); }
        expect(smelted).toBe(1);
        expect(BoardState.workerOf(furnace.id)).toBe('smith');
        expect(furnace.alert).toBe(ALERT.INPUTS);
        expect(said.length).toBeGreaterThan(0);
        expect(said[0]).toEqual({ instanceId: furnace.id, heroId: 'smith', itemId: 'item_coal' });
        // A reminder, not a flood: the flag looks again about once a second.
        expect(said.length).toBeLessThanOrEqual(8);
        expect(calloutText.needsInput('Coal')).toBe('Needs Coal');
    });

    it('one hero per link: the smith stays at the furnace while a miner on the vein feeds it', () => {
        const furnace = put('sw_furnace', 800, 500);
        InventoryManager.addItem('item_coal', 1);
        Orders.orderAt('smith', { x: 800, y: 500 });
        run(3000);
        expect(furnace.alert).toBe(ALERT.INPUTS);
        const vein = put('sw_coal_vein', 950, 500);
        run(1000);
        // The smith never leaves their order for the vein.
        expect(BoardState.workerOf(furnace.id)).toBe('smith');
        expect(BoardState.workerOf(vein.id)).toBeNull();
        // Two coal mined by the miner, the vein rests, and the smith smelts them.
        Orders.orderAt('miner', { x: 950, y: 500 });
        const smelted = cyclesOf(furnace, () => run(15000));
        expect(vein.usesRemaining).toBe(0);
        expect(smelted).toBe(2);
        expect(BoardState.workerOf(furnace.id)).toBe('smith');
    });
});

describe('the mat says it', () => {
    const h = React.createElement;
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => { cleanup(); vi.useRealTimers(); });

    it('"Needs Coal" over the station, in the "Needs Pickaxe" look, spaced like it', () => {
        const furnace = put('sw_furnace', 800, 500);
        const { container } = render(h(CalloutLayer));
        const say = () => act(() => {
            EventBus.publish(BOARD_EVENTS.INPUT_NEEDED, { instanceId: furnace.id, heroId: 'smith', itemId: 'item_coal' });
        });
        say();
        const bubble = container.querySelector('[data-callout]');
        expect(bubble.textContent).toBe('Needs Coal');
        // The same red "can't" frame as "Needs Pickaxe".
        expect(bubble.getAttribute('data-speech-tone')).toBe('cant');
        act(() => { vi.advanceTimersByTime(3000); });
        say();
        expect(container.querySelector('[data-callout]')).toBeNull();
        act(() => { vi.advanceTimersByTime(INPUT_CALLOUT_GAP_MS); });
        say();
        expect(container.querySelector('[data-callout]').textContent).toBe('Needs Coal');
    });

    it('near the foot of the mat, where the work plate rides over the station, "Needs Coal" goes above the plate', () => {
        const y = matH() - 80;
        const furnace = put('sw_furnace', 800, y);
        InventoryManager.addItem('item_coal', 10);
        Orders.orderAt('smith', { x: 800, y });
        run(3000);
        expect(BoardState.workerOf(furnace.id)).toBe('smith');
        const plateTop = platePlace({ x: 800, y, typeId: 'sw_furnace', fit: 1, matH: matH() }).top;
        expect(plateTop).toBeLessThan(y);
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.INPUT_NEEDED, { instanceId: furnace.id, heroId: 'smith', itemId: 'item_coal' });
        });
        const column = container.querySelector('[data-callout]').parentElement;
        const top = Number(/translate\([^,]+,\s*([-\d.]+)px\)/.exec(column.style.transform)[1]);
        expect(top).toBeLessThan(plateTop);
    });

    it('a waiting miner going idle says nothing; a hero with nothing in reach still does', () => {
        const vein = put('sw_vein', 800, 500);
        Orders.orderAt('miner', { x: 800, y: 500 });
        run(6000);
        expect(Flags.waitingOf('miner')?.instanceId).toBe(vein.id);
        const busy = [
            { heroId: 'miner', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null },
            { heroId: 'smith', state: 'working', x: 700, y: 500, moving: false, tokenId: null, alert: null }
        ];
        const { container, rerender } = render(h(HeroBubbleLayer, { heroes: busy }));
        act(() => { vi.advanceTimersByTime(10); });
        rerender(h(HeroBubbleLayer, { heroes: busy.map(x => ({ ...x, state: 'idle' })) }));
        const stack = (id) => [...container.querySelectorAll(`[data-hero-bubble-stack="${id}"] [data-hero-bubble]`)].map(n => n.textContent);
        expect(stack('miner')).toEqual([]);
        expect(stack('smith')).toEqual(['Nothing to work here.']);
    });
});

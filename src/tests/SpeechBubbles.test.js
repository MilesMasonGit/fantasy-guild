// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { markHeld } from '../systems/equipment/heldCopies.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import {
    raiseBubble, dismissBubble, bubblesOf, hasBubble, recheck, rebuild, registerRebuild, clearBubbles
} from '../ui/components/board/speechBubbles.js';
import { addMoment, stackOf, MAX_BUBBLES, MOMENT_TTL_MS } from '../ui/components/board/heroSpeech.js';
import { GEAR_BROKE_KEY, gearBrokeSpec, gearBrokeSpecOf } from '../ui/components/board/heroNeeds.js';
import { SPEECH_TONE } from '../ui/components/board/speechTone.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Two kinds of message: a moment goes by itself; a waiting speech bubble stays until hovered,
 * clicked or no longer needed, is never pushed out by a moment, and is rebuilt on a load from the
 * game's state where its need still stands. Gear that broke is the first waiting bubble.
 */

const h = React.createElement;
const AXE = 'sb_axe';
const SWORD = 'sb_sword';
registerItems({
    [AXE]: { id: AXE, name: 'Test Brittle Axe', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_woodaxe_copper', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 25 },
    [SWORD]: { id: SWORD, name: 'Test Brittle Sword', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_longsword_copper', styles: ['melee'], damage: 2, breakChance: 1 }
});
registerTokenTypes({
    sb_axe_oak: {
        id: 'sb_axe_oak', name: 'Test Axe Oak', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: true, needsTool: { kind: 'woodaxe', minTier: 1 },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 500, xp: 1, inputs: [], outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

const TEST_EVENT = 'test:speech_bubbles_check';

const heroRecord = (id) => ({
    id, name: id, status: 'idle', hp: { current: 10, max: 10 }, equipment: [null, null],
    skills: { forestry: { level: 10, xp: 0 } }
});
const hero = (id) => GameState.state.heroes.find(x => x.id === id);
/** Put a copy of `itemId` in `id`'s first hand and say so, as equipping does. */
function equip(id, itemId) {
    hero(id).equipment[0] = itemId;
    markHeld(hero(id), 0, true);
    EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId: id, slot: 0, itemId, action: 'equip' });
}

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    clearMat();
    clearBubbles();
    GameState.state.heroes = ['kira', 'bram'].map(heroRecord);
});
afterEach(() => {
    cleanup();
    clearBubbles();
    vi.useRealTimers();
});

describe('the waiting bubble store', () => {
    it('stays until its need is met, asked again only on the events it names', () => {
        let need = true;
        expect(raiseBubble('kira', { key: 'k', text: 'Help', holds: () => need, checkOn: [TEST_EVENT] })).toBe(true);
        expect(bubblesOf('kira').map(b => b.text)).toEqual(['Help']);
        vi.advanceTimersByTime(60 * 60 * 1000);
        expect(bubblesOf('kira').map(b => b.text)).toEqual(['Help']);
        need = false;
        // Nothing polls: the need is met but nobody has said so yet.
        expect(hasBubble('kira', 'k')).toBe(true);
        EventBus.publish('test:some_other_event', {});
        expect(hasBubble('kira', 'k')).toBe(true);
        EventBus.publish(TEST_EVENT, {});
        expect(hasBubble('kira', 'k')).toBe(false);
        expect(bubblesOf('kira')).toEqual([]);
    });

    it('is not raised when its need is already met', () => {
        expect(raiseBubble('kira', { key: 'k', text: 'Help', holds: () => false })).toBe(false);
        expect(bubblesOf('kira')).toEqual([]);
    });

    it('a dismissed bubble is no longer drawn, but still watched; a rebuild leaves it dismissed; met, it is forgotten', () => {
        let need = true;
        const spec = { key: 'k', text: 'Help', holds: () => need, checkOn: [TEST_EVENT] };
        raiseBubble('kira', spec);
        dismissBubble('kira', 'k');
        expect(bubblesOf('kira')).toEqual([]);
        expect(hasBubble('kira', 'k')).toBe(true);
        const off = registerRebuild((raise) => raise('kira', spec));
        rebuild();
        expect(bubblesOf('kira')).toEqual([]);
        need = false;
        recheck();
        expect(hasBubble('kira', 'k')).toBe(false);
        // The same need met with again, later, is news again.
        need = true;
        rebuild();
        expect(bubblesOf('kira').map(b => b.text)).toEqual(['Help']);
        off();
    });

    it('raised again live, a dismissed bubble shows again', () => {
        const spec = { key: 'k', text: 'Help', holds: () => true };
        raiseBubble('kira', spec);
        dismissBubble('kira', 'k');
        raiseBubble('kira', { ...spec, text: 'Help again' });
        expect(bubblesOf('kira').map(b => b.text)).toEqual(['Help again']);
    });
});

describe('the stack: never more than three, a waiting bubble never gives way to a moment', () => {
    const waiting = (n) => Array.from({ length: n }, (_, i) => ({ key: `w${i}`, text: `W${i}`, at: 100 + i }));
    const moments = (n) => {
        let list = [];
        for (let i = 0; i < n; i++) list = addMoment(list, { key: `m${i}`, text: `M${i}` }, 200 + i);
        return list;
    };

    it('moments fill only the rows the waiting bubbles leave, newest first, all in the order said', () => {
        const stack = stackOf(moments(3), 300, waiting(2));
        expect(stack).toHaveLength(MAX_BUBBLES);
        expect(stack.map(b => b.text)).toEqual(['W0', 'W1', 'M2']);
        expect(stack.map(b => b.kind)).toEqual(['waiting', 'waiting', 'moment']);
    });

    it('three waiting bubbles leave no room for a moment', () => {
        expect(stackOf(moments(2), 300, waiting(3)).map(b => b.text)).toEqual(['W0', 'W1', 'W2']);
    });

    it('past three waiting bubbles, the oldest waiting one gives way', () => {
        expect(stackOf([], 300, waiting(4)).map(b => b.text)).toEqual(['W1', 'W2', 'W3']);
    });

    it('a moment said before a waiting bubble sits above it', () => {
        const list = addMoment([], { key: 'm', text: 'M' }, 50);
        expect(stackOf(list, 60, waiting(1)).map(b => b.text)).toEqual(['M', 'W0']);
    });
});

describe('gear broke: a waiting bubble over the hero', () => {
    const busy = [
        { heroId: 'kira', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null },
        { heroId: 'bram', state: 'working', x: 700, y: 500, moving: false, tokenId: null, alert: null }
    ];
    const stack = (container, id) => [...container.querySelectorAll(`[data-hero-bubble-stack="${id}"] [data-hero-bubble]`)]
        .map(n => ({ text: n.textContent, kind: n.getAttribute('data-hero-bubble-kind'), tone: n.getAttribute('data-speech-tone') }));
    const mount = () => {
        const view = render(h(HeroBubbleLayer, { heroes: busy }));
        act(() => { vi.advanceTimersByTime(10); });
        return view;
    };
    const breakAxe = (heroId = 'kira') => act(() => {
        EventBus.publish(BOARD_EVENTS.GEAR_BROKE, { heroId, itemId: AXE, use: 'work' });
    });

    it('"My Test Brittle Axe broke!" in gold, still there long after a moment would have gone', () => {
        const { container } = mount();
        breakAxe();
        expect(stack(container, 'kira')).toEqual([{ text: 'My Test Brittle Axe broke!', kind: 'waiting', tone: SPEECH_TONE.ATTENTION }]);
        act(() => { vi.advanceTimersByTime(MOMENT_TTL_MS * 4); });
        expect(stack(container, 'kira').map(b => b.text)).toEqual(['My Test Brittle Axe broke!']);
    });

    it('hovering it dismisses it, while the need stands (going idle after still says nothing)', () => {
        const { container, rerender } = mount();
        breakAxe();
        fireEvent.pointerEnter(container.querySelector('[data-hero-bubble="gearBroke"]'));
        expect(stack(container, 'kira')).toEqual([]);
        expect(hasBubble('kira', GEAR_BROKE_KEY)).toBe(true);
        rerender(h(HeroBubbleLayer, { heroes: busy.map(x => ({ ...x, state: 'idle' })) }));
        expect(stack(container, 'kira')).toEqual([]);
        expect(stack(container, 'bram').map(b => b.text)).toEqual(['Nothing to work here.']);
    });

    it('clicking it dismisses it too', () => {
        const { container } = mount();
        breakAxe();
        fireEvent.click(container.querySelector('[data-hero-bubble="gearBroke"]'));
        expect(stack(container, 'kira')).toEqual([]);
    });

    it('a moment is not clickable; a waiting bubble takes the pointer', () => {
        const { container } = mount();
        breakAxe();
        expect(container.querySelector('[data-hero-bubble="gearBroke"]').className).toContain('pointer-events-auto');
    });

    it('clears itself once the hero holds a working tool of that kind again', () => {
        const { container } = mount();
        breakAxe();
        act(() => { equip('kira', SWORD); });
        expect(stack(container, 'kira').map(b => b.text)).toEqual(['My Test Brittle Axe broke!']);
        act(() => { equip('kira', AXE); });
        expect(stack(container, 'kira')).toEqual([]);
        expect(hasBubble('kira', GEAR_BROKE_KEY)).toBe(false);
    });

    it('clears itself once the hero is given another job, or sent home', () => {
        BoardState.setFlag('kira', { x: 10, y: 10, spot: true, plantedAt: 1 });
        BoardState.setFlag('bram', { x: 10, y: 10, spot: true, plantedAt: 2 });
        const { container } = mount();
        breakAxe('kira');
        breakAxe('bram');
        act(() => {
            BoardState.setFlag('kira', { x: 20, y: 20, spot: true, plantedAt: 3 });
            EventBus.publish(ENGINE_EVENTS.HERO_DEPLOYED, { heroId: 'kira', instanceId: null, typeId: null });
        });
        expect(stack(container, 'kira')).toEqual([]);
        act(() => {
            BoardState.setFlag('bram', null);
            EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'bram', instanceId: null, reason: 'home' });
        });
        expect(stack(container, 'bram')).toEqual([]);
    });

    it('a broken weapon is answered by any weapon in hand', () => {
        const spec = gearBrokeSpecOf({ heroId: 'kira', itemId: SWORD, use: 'fight' });
        expect(spec.text).toBe('My Test Brittle Sword broke!');
        expect(spec.holds()).toBe(true);
        hero('kira').equipment[0] = SWORD;
        markHeld(hero('kira'), 0, true);
        expect(spec.holds()).toBe(false);
    });

    it('a hero who leaves the guild has nothing left to say', () => {
        const spec = gearBrokeSpec('kira', { kind: 'woodaxe', name: 'Woodaxe' });
        expect(spec.holds()).toBe(true);
        GameState.state.heroes = GameState.state.heroes.filter(x => x.id !== 'kira');
        expect(spec.holds()).toBe(false);
    });
});

describe('rebuilt on a load, not saved', () => {
    const working = [{ heroId: 'kira', state: 'idle', x: 300, y: 500, moving: false, tokenId: null, alert: null }];
    const texts = (container) => [...container.querySelectorAll('[data-hero-bubble-stack="kira"] [data-hero-bubble]')].map(n => n.textContent);
    const orderOnAxeOak = () => {
        const oak = placeAt('sb_axe_oak', 600, 600);
        // An order is refused without the tool: this is the order they had when it broke.
        BoardState.setFlag('kira', { x: oak.x, y: oak.y, pinnedTo: oak.id, plantedAt: 1 });
        return oak;
    };

    it('a hero still ordered onto work they lack the tool for says so again, worded with the tool kind', () => {
        orderOnAxeOak();
        const { container } = render(h(HeroBubbleLayer, { heroes: working }));
        act(() => { vi.advanceTimersByTime(10); });
        expect(texts(container)).toEqual(['My Woodaxe broke!']);
    });

    it('a load forgets the game before and rebuilds; a catch-up keeps a dismissed bubble dismissed', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes: working }));
        act(() => { vi.advanceTimersByTime(10); });
        expect(texts(container)).toEqual([]);
        orderOnAxeOak();
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
        expect(texts(container)).toEqual(['My Woodaxe broke!']);
        act(() => { dismissBubble('kira', GEAR_BROKE_KEY); });
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'catch_up' }); });
        expect(texts(container)).toEqual([]);
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
        expect(texts(container)).toEqual(['My Woodaxe broke!']);
    });

    it('nothing is rebuilt where the need no longer stands (the hero holds an axe)', () => {
        orderOnAxeOak();
        hero('kira').equipment[0] = AXE;
        markHeld(hero('kira'), 0, true);
        const { container } = render(h(HeroBubbleLayer, { heroes: working }));
        act(() => { vi.advanceTimersByTime(10); });
        expect(texts(container)).toEqual([]);
    });

    it('nothing of the bubbles is written into the save', () => {
        orderOnAxeOak();
        render(h(HeroBubbleLayer, { heroes: working }));
        act(() => { vi.advanceTimersByTime(10); });
        expect(hasBubble('kira', GEAR_BROKE_KEY)).toBe(true);
        expect(JSON.stringify(GameState.state)).not.toContain('broke!');
    });
});

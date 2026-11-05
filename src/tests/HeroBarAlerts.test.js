// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { clearAllHeroBubbles } from '../ui/components/dock/heroBarBubbles.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { rosterAlertOf, rosterBubbleLine, ROSTER_ALERT } from '../ui/components/board/flagText.js';
import { SPEECH_TONE } from '../ui/components/board/speechTone.js';
import { PROBLEM_SPRITE, SEVERITY } from '../ui/components/board/problemMark.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The hero bar's alerts and hover bubble, on a real board: yellow only when the player must act, red
 * for a wound, nothing for a normal wait, and the words name the Token and what is in the way.
 */

const felling = { skill: 'forestry', skillRequired: 1, cycleTimeMs: 500, xp: 1, inputs: [],
    outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] };
const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: true, ...extra });
registerTokenTypes({
    hba_oak: plain('hba_oak', 'Test Oak', { config: felling }),
    hba_axe_oak: plain('hba_axe_oak', 'Test Axe Oak', { config: felling, needsTool: { kind: 'woodaxe', minTier: 1 } }),
    hba_anvil: plain('hba_anvil', 'Test Anvil', { config: { ...felling, inputs: [{ itemId: 'item_oak_wood', quantity: 5 }] } }),
    hba_rest: plain('hba_rest', 'Test Berry', { uses: 1, staysPut: true, config: felling, respawn: { mode: 'refill', afterMs: 60000 } }),
    hba_forest: plain('hba_forest', 'Test Forest', { tokenType: 'buff', requiresHero: false, config: null }),
    hba_tree: plain('hba_tree', 'Test Tree', { uses: 1, staysPut: true, config: felling, respawn: { mode: 'regrow', into: 'hba_stump' } }),
    hba_stump: plain('hba_stump', 'Test Stump', { requiresHero: false, grows: { into: 'hba_tree', afterMs: 20000, needsNearby: ['hba_forest'], cost: [{ itemId: 'item_oak_seedling', quantity: 1 }] } })
});

const hero = (id) => ({
    id, name: id, spriteId: 'hn_recruit_por', hp: { current: 100, max: 100 }, status: 'idle', equipment: [],
    skills: { forestry: { level: 10, xp: 0 } }
});
const h = React.createElement;

function put(typeId, x, y) {
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    expect(Placement.placeTokenAt(inst, { x, y }).success).toBe(true);
    return inst;
}
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const send = (heroId, inst) => Orders.orderAt(heroId, { x: inst.x, y: inst.y });
function mountBar() {
    return render(h(DeckDndProvider, null, h(BottomHeroDock, { selectedHeroId: null })));
}
const figure = (view, id) => view.container.querySelector(`[data-dock-hero="${id}"]`);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
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
    Growth.resetGrowthAlerts();
    GameState.state.heroes = ['a', 'b'].map(hero);
    GameState.state.inventory.maxSlots = 50;
    clearAllHeroBubbles();
    setLiveMatFit(1);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

/** The UI's answer and the engine's must be one rule. */
const expectAgreement = (id) => expect(rosterAlertOf(id) === ROSTER_ALERT.ACT).toBe(BoardRunner.isHeroIdle(id));

describe('who wears an alert', () => {
    it('no order: yellow, whatever the word', () => {
        expect(rosterAlertOf('a')).toBe(ROSTER_ALERT.ACT);
        expectAgreement('a');
    });

    it('a spot order: yellow', () => {
        Orders.orderAt('a', { x: 600, y: 600 });
        run(100);
        expect(Flags.statusOf('a').order).toBe('spot');
        expect(rosterAlertOf('a')).toBe(ROSTER_ALERT.ACT);
        expectAgreement('a');
    });

    it('a working hero wears none and the bubble names the Token', () => {
        const oak = put('hba_oak', 600, 600);
        send('a', oak);
        run(30000);
        expect(Flags.statusOf('a')).toMatchObject({ state: 'working', instanceId: oak.id });
        expect(rosterAlertOf('a')).toBeNull();
        expectAgreement('a');
        expect(rosterBubbleLine('a')).toBe('Working: Test Oak');
    });

    it('a missing tool: yellow, and the bubble names the Token and the tool', () => {
        const oak = put('hba_axe_oak', 600, 600);
        // An order is refused without the tool: this is the order they already had when it broke.
        BoardState.setFlag('a', { x: oak.x, y: oak.y, pinnedTo: oak.id, plantedAt: 1 });
        run(1200);
        expect(rosterAlertOf('a')).toBe(ROSTER_ALERT.ACT);
        expectAgreement('a');
        expect(rosterBubbleLine('a')).toMatch(/^Test Axe Oak: Needs .*axe/i);
    });

    it('missing ingredients: yellow once the Token is stuck under them, and the bubble says what', () => {
        const anvil = put('hba_anvil', 600, 600);
        InventoryManager.addItem('item_oak_wood', 5);
        send('a', anvil);
        run(30000);
        expect(Flags.statusOf('a').instanceId).toBe(anvil.id);
        expect(anvil.alert).toBe('inputs');
        expect(rosterAlertOf('a')).toBe(ROSTER_ALERT.ACT);
        expectAgreement('a');
        expect(rosterBubbleLine('a')).toMatch(/^Test Anvil: Needs /);
    });

    it('sent to a Token already short of ingredients: yellow, and the bubble says what', () => {
        const anvil = put('hba_anvil', 600, 600);
        send('a', anvil);
        run(1200);
        expect(Flags.statusOf('a').instanceId).toBeNull();
        expect(rosterAlertOf('a')).toBe(ROSTER_ALERT.ACT);
        expectAgreement('a');
        expect(rosterBubbleLine('a')).toMatch(/^Test Anvil: Needs /);
    });

    it('a Token resting until it comes back: a normal wait, nothing, and the bubble says for what', () => {
        const berry = put('hba_rest', 600, 600);
        send('a', berry);
        run(30000);
        expect(Flags.waitingOf('a')?.kind).toBe('node');
        expect(rosterAlertOf('a')).toBeNull();
        expectAgreement('a');
        expect(rosterBubbleLine('a')).toBe('Waiting for Test Berry');
    });

    it('a wound: red, not yellow', () => {
        GameState.state.heroes[0].status = 'wounded';
        GameState.state.heroes[0].woundedRemainingMs = 65000;
        expect(rosterAlertOf('a')).toBe(ROSTER_ALERT.WOUNDED);
        expect(rosterBubbleLine('a')).toBe('Healing 1:05');
    });

    it('a felled tree growing back: a normal wait, nothing', () => {
        InventoryManager.addItem('item_oak_seedling', 1);
        put('hba_forest', 750, 600);
        send('a', put('hba_tree', 600, 600));
        run(30000);
        expect(rosterAlertOf('a')).toBeNull();
        expectAgreement('a');
        expect(rosterBubbleLine('a')).toBe('Waiting for Test Stump');
    });

    it('a Stump that cannot grow back: yellow, and the bubble says why', () => {
        send('a', put('hba_tree', 600, 600));
        run(30000);
        expect(rosterAlertOf('a')).toBe(ROSTER_ALERT.ACT);
        expectAgreement('a');
        expect(rosterBubbleLine('a')).toMatch(/^Test Stump: Needs a Test Forest nearby to grow$/);
    });

    it('waiting for a Token another hero works: a normal wait, nothing', () => {
        const oak = put('hba_oak', 600, 600);
        send('a', oak);
        run(300);
        send('b', oak);
        run(1200);
        expect(Flags.waitingOf('b')?.kind).toBe('busy');
        expect(rosterAlertOf('b')).toBeNull();
        expectAgreement('b');
        expect(rosterBubbleLine('b')).toBe('Waiting for Test Oak');
    });
});

describe('on the bar', () => {
    it('shows the alert without hovering: yellow for no order, red for a wound, the text cross gone', () => {
        GameState.state.heroes[1].status = 'wounded';
        GameState.state.heroes[1].woundedRemainingMs = 1000;
        const view = mountBar();
        const a = figure(view, 'a').querySelector('[data-dock-alert-mark]');
        const b = figure(view, 'b').querySelector('[data-dock-alert-mark]');
        expect(a.getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.WAITING]);
        expect(b.getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.CANT]);
        expect(figure(view, 'b').querySelector('[data-dock-name]').textContent).toBe('b');
    });

    it('a hero waiting behind another shows no alert', () => {
        const oak = put('hba_oak', 600, 600);
        send('a', oak);
        run(300);
        send('b', oak);
        run(1200);
        const view = mountBar();
        expect(figure(view, 'a').querySelector('[data-dock-alert-mark]')).toBeNull();
        expect(figure(view, 'b').querySelector('[data-dock-alert-mark]')).toBeNull();
    });

    it('the bubble exists only while hovered, in the speech frame, gold when the player must act', () => {
        const view = mountBar();
        const fig = figure(view, 'a');
        expect(fig.querySelector('[data-dock-status-bubble]')).toBeNull();
        fireEvent.mouseEnter(fig);
        const bubble = fig.querySelector('[data-dock-status-bubble]');
        expect(bubble.getAttribute('data-speech-tone')).toBe(SPEECH_TONE.ATTENTION);
        expect(bubble.textContent).toBe('At the Guild Hall');
        fireEvent.mouseLeave(fig);
        expect(fig.querySelector('[data-dock-status-bubble]')).toBeNull();
    });

    it('stands above the level-ups in one column: they keep their tail, and neither moves', () => {
        const view = mountBar();
        const fig = figure(view, 'a');
        act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: 'a', heroName: 'a', skillId: 'forestry', skillName: 'Forestry', oldLevel: 1, newLevel: 2 }); });
        const column = fig.querySelector('[data-dock-speech]');
        const bottom = column.style.bottom;
        const levelUp = column.querySelector('[data-bar-bubble]');
        expect(levelUp.querySelector('[data-speech-tail]')).not.toBeNull();
        fireEvent.mouseEnter(fig);
        const after = fig.querySelector('[data-dock-speech]');
        expect(after).toBe(column);
        expect(after.style.bottom).toBe(bottom);
        const bubble = after.querySelector('[data-dock-status-bubble]');
        expect(after.firstElementChild).toBe(bubble);
        expect(bubble.querySelector('[data-speech-tail]')).toBeNull();
        expect(after.querySelector('[data-bar-bubble]')).toBe(levelUp);
    });

    it('with nothing else to say, the bubble has the tail', () => {
        const view = mountBar();
        const fig = figure(view, 'a');
        fireEvent.mouseEnter(fig);
        expect(fig.querySelector('[data-dock-status-bubble] [data-speech-tail]')).not.toBeNull();
    });

    it('its words stay true while hovered: the healing clock counts down', () => {
        vi.useFakeTimers();
        const me = GameState.state.heroes[0];
        me.status = 'wounded';
        me.woundedRemainingMs = 10000;
        const view = mountBar();
        const fig = figure(view, 'a');
        fireEvent.mouseEnter(fig);
        expect(fig.querySelector('[data-dock-status-bubble]').textContent).toBe('Healing 0:10');
        me.woundedRemainingMs = 5000;
        act(() => { vi.advanceTimersByTime(1000); });
        expect(fig.querySelector('[data-dock-status-bubble]').textContent).toBe('Healing 0:05');
    });

    it('the HP shows its numbers over the bar', () => {
        GameState.state.heroes[0].hp = { current: 37, max: 120 };
        const view = mountBar();
        expect(figure(view, 'a').querySelector('[data-dock-hp] [data-hp-numbers]').textContent).toBe('37/120');
    });
});

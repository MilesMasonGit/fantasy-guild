// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as Flags from '../systems/board/Flags.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { itemTipFacts, ItemTipContent } from '../ui/components/drawer/ItemTip.jsx';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { momentTone, SPEECH_TONE } from '../ui/components/board/speechTone.js';
import { CatchUpOverlay } from '../ui/components/hud/CatchUpOverlay.jsx';

// The summary's undo button asks the catch-up driver; here it is a stand-in.
vi.mock('../systems/core/CatchUp.js', () => ({
    canUndo: vi.fn(() => true),
    undoLast: vi.fn(() => true),
    forgetUndo: vi.fn()
}));

/**
 * Brief 480 L1, tools that break, as the player reads it: the item's tooltip (the Bank's hover, its
 * window and the Encyclopedia's card all draw `ItemTipContent`) says the chance; a hero whose tool
 * breaks says so, in the gold "look here" frame, and that line stands for the idle line after it;
 * the "While you were away" news lists what broke, right after the knock-outs.
 */

const h = React.createElement;
const AXE = 'tbu_axe';
const SWORD = 'tbu_sword';
registerItems({
    [AXE]: { id: AXE, name: 'Test Brittle Axe', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_woodaxe_copper', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 25 },
    [SWORD]: { id: SWORD, name: 'Test Brittle Sword', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_longsword_copper', styles: ['melee'], damage: 2, breakChance: 1 }
});

describe('the tooltip says the chance', () => {
    it('a tool per cycle, a weapon per kill; nothing for an item that never breaks', () => {
        expect(itemTipFacts({ equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 1 }).breaks).toBe('1% chance to break each cycle');
        expect(itemTipFacts({ equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1 }, breakChance: 0.5 }).breaks).toBe('0.5% chance to break each cycle');
        expect(itemTipFacts({ equipSlot: 'hand', styles: ['melee'], breakChance: 3 }).breaks).toBe('3% chance to break each kill');
        expect(itemTipFacts({ equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1 } }).breaks).toBeNull();
        // A shield is never swung, and a hat never works a Token: a chance on them says nothing.
        expect(itemTipFacts({ equipSlot: 'hand', offHand: true, breakChance: 5 }).breaks).toBeNull();
        expect(itemTipFacts({ equipSlot: 'hat', breakChance: 5 }).breaks).toBeNull();
    });

    it('the Bank\'s short hover shows it too (it is one of the item\'s kind lines), under the tool', () => {
        const { container } = render(h(ItemTipContent, { item: { id: AXE, name: 'Test Brittle Axe', type: 'tool', equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 25 }, count: 2, details: false }));
        const lines = [...container.querySelector('[data-item-tip]').children].map(n => n.getAttribute('data-item-tip-tool') !== null ? 'tool' : n.getAttribute('data-item-tip-breaks') !== null ? 'breaks' : null).filter(Boolean);
        expect(lines).toEqual(['tool', 'breaks']);
        expect(container.querySelector('[data-item-tip-breaks]').textContent).toBe('25% chance to break each cycle');
        cleanup();
    });
});

describe('the hero says it, and that is the line for stopping', () => {
    beforeAll(() => Flags.init());
    afterAll(() => Flags.teardown());
    beforeEach(() => {
        vi.useFakeTimers();
        GameState.initNew();
        GameState.state.heroes = ['kira', 'bram'].map(id => ({ id, name: id, status: 'idle', skills: {}, hp: { current: 10, max: 10 }, equipment: [] }));
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    const stack = (container, id) => [...container.querySelectorAll(`[data-hero-bubble-stack="${id}"] [data-hero-bubble]`)]
        .map(n => ({ text: n.textContent, tone: n.getAttribute('data-speech-tone') }));

    it('"Test Brittle Axe broke!" in gold over the hero; going idle after adds nothing, while a hero with no break says the idle line', () => {
        expect(momentTone('gearBroke')).toBe(SPEECH_TONE.ATTENTION);
        const busy = [
            { heroId: 'kira', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null },
            { heroId: 'bram', state: 'working', x: 700, y: 500, moving: false, tokenId: null, alert: null }
        ];
        const { container, rerender } = render(h(HeroBubbleLayer, { heroes: busy }));
        act(() => { vi.advanceTimersByTime(10); });
        act(() => { EventBus.publish(BOARD_EVENTS.GEAR_BROKE, { heroId: 'kira', itemId: AXE, use: 'work' }); });
        expect(stack(container, 'kira')).toEqual([{ text: 'Test Brittle Axe broke!', tone: SPEECH_TONE.ATTENTION }]);

        act(() => { vi.advanceTimersByTime(300); });
        rerender(h(HeroBubbleLayer, { heroes: busy.map(x => ({ ...x, state: 'idle' })) }));
        expect(stack(container, 'kira').map(b => b.text)).toEqual(['Test Brittle Axe broke!']);
        expect(stack(container, 'bram').map(b => b.text)).toEqual(['Nothing to work here.']);
    });
});

describe('"While you were away" lists what broke', () => {
    beforeEach(() => { render(h(CatchUpOverlay)); });
    afterEach(() => cleanup());

    const result = () => ({
        awayMs: 2 * 60 * 60 * 1000, simulatedMs: 2 * 60 * 60 * 1000, droppedMs: 0, steps: 7200, wallMs: 900, show: true,
        summary: {
            items: { gained: {}, spent: {}, net: {}, floor: {} },
            levelUps: [], depleted: { total: 0, byType: {} },
            wounded: [{ heroId: 'h2', heroName: 'Bram', times: 1 }],
            broken: [
                { heroId: 'h1', heroName: 'Aela', itemId: AXE, times: 1 },
                { heroId: 'h2', heroName: 'Bram', itemId: SWORD, times: 1 }
            ],
            fightsWon: { total: 0, byEnemy: {} },
            news: { recipes: [], finds: [], bankFull: [AXE], knockouts: [{ heroId: 'h2', heroName: 'Bram', times: 1, lost: [] }] }
        }
    });

    it('a section of its own, after the knock-outs and before the Bank: each item, and whose hands it broke in', () => {
        act(() => { EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, result()); });
        const sections = [...document.querySelectorAll('[data-summary-column="news"] [data-summary-section]')].map(s => s.getAttribute('data-summary-section'));
        expect(sections).toEqual(['knockouts', 'broken', 'bankFull']);
        const section = document.querySelector('[data-summary-section="broken"]');
        expect(section.querySelector('[data-summary-heading]').textContent).toBe('Broken');
        const rows = [...section.querySelectorAll('[data-broken-item]')];
        expect(rows.map(r => r.getAttribute('data-broken-item'))).toEqual([AXE, SWORD]);
        expect(rows[0].textContent).toContain('Test Brittle Axe');
        expect(rows[0].textContent).toContain('Aela stopped');
        expect(rows[1].textContent).toContain('Bram stopped');
    });

    it('nothing broke: no section', () => {
        act(() => { EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { ...result(), summary: { ...result().summary, broken: [] } }); });
        expect(document.querySelector('[data-summary-section="broken"]')).toBeNull();
    });
});

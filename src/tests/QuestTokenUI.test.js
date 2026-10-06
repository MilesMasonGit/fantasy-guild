import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { resetMatTuning } from '../config/matTuning.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatToken } from '../ui/components/board/MatToken.jsx';
import { questRing, RING_COLOUR } from '../ui/components/board/ringRow.js';
import { questNeedLine } from '../ui/components/board/QuestTooltip.jsx';
import {
    activeTutorialQuest, TUTORIAL_AIDE_EVENTS
} from '../ui/components/base/TutorialAideOverlay.jsx';
import { NotificationColumn } from '../ui/ReactRoot.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
// `Toast.jsx` imports through the `@/` alias, which the test build lacks.
vi.mock('../ui/components/base/ToastContainer.jsx', () => ({
    default: () => null, ToastContainer: () => null
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ B6.2 — the quest Token UI ("noticeboard, click to claim"). A quest Token
 * stands a parchment `3/10` ring under itself, reads on hover
 * (`QuestTooltip`), glows when done and is claimed by a click — never in
 * disallow mode. The notification column lost its Quests section, and the
 * tutorial aide finds its step from the tutorial quest Token.
 */

const HALL = { x: 880, y: 560 };
const h = React.createElement;
const tree = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));
const mount = (el) => render(tree(el));

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), HALL.x, HALL.y);
    QuestManager.init();
}

const hunt = (extra = {}) => ({
    id: 'q_hunt', tutorial: false, title: 'Defeat 3 Goblins', type: 'hunt',
    targetType: 'enemy_hunted', enemyId: 'token_goblin',
    requiredCount: 3, currentCount: 1,
    rewardItems: [{ itemId: 'item_oak_wood', quantity: 5 }],
    done: false, ...extra
});

function spawn(quest) {
    const inst = QuestTokens.spawnQuest(quest);
    expect(inst).toBeTruthy();
    inst.quest.done = inst.quest.currentCount >= inst.quest.requiredCount;
    return inst;
}

const tokenEl = (inst, props = {}) => h(MatToken, {
    id: inst.id, typeId: inst.typeId, x: inst.x, y: inst.y, size: 1, z: 10, ...props
});

const overlay = (c, inst) => c.querySelector(`[data-token-overlay="${inst.id}"]`);
const art = (c, inst) => c.querySelector(`[data-token-art="true"][data-token-id="${inst.id}"]`);
const tooltip = () => document.body.querySelector('[data-quest-tooltip]');

beforeEach(() => {
    resetMatTuning();
    newGame();
});

afterEach(() => {
    cleanup();
    QuestManager.cleanup();
    resetMatTuning();
});

describe('the quest ring, pure (B6.2)', () => {
    it('reads current/required, fills toward done, parchment not charges gold', () => {
        const r = questRing({ currentCount: 3, requiredCount: 10, title: 'Collect 10 Copper Ingot' });
        expect(r.kind).toBe('quest');
        expect(r.text).toBe('3/10');
        expect(r.fraction).toBeCloseTo(0.3, 5);
        expect(RING_COLOUR.quest).toBeTruthy();
        expect(RING_COLOUR.quest).not.toBe(RING_COLOUR.charges);
        expect(questRing({ currentCount: 12, requiredCount: 10 }).fraction).toBe(1);
        expect(questRing(null)).toBeNull();
    });

    it('the need line: an item collection, a hunt, a plain count', () => {
        expect(questNeedLine({ type: 'collection', itemId: 'item_copper_ingot', currentCount: 3, requiredCount: 10 }))
            .toMatch(/^3\/10 Copper Ingot$/);
        expect(questNeedLine(hunt())).toMatch(/^1\/3 .+ defeated$/);
        expect(questNeedLine({ currentCount: 0, requiredCount: 1 })).toBe('0/1');
    });
});

describe('a quest Token on the mat (B6.2)', () => {
    it('⭐ stands its progress ring always: no hero, no hover', () => {
        const q = spawn(hunt());
        const { container } = mount(tokenEl(q));
        const o = overlay(container, q);
        expect(o.getAttribute('data-quest-token')).toBe(q.id);
        expect(o.getAttribute('data-quest-done')).toBe('false');
        const ring = o.querySelector('[data-ring-row] [data-ring="quest"]');
        expect(ring).not.toBeNull();
        expect(ring.getAttribute('data-ring-text')).toBe('1/3');
        expect(Number(ring.getAttribute('data-ring-fraction'))).toBeCloseTo(1 / 3, 3);
        // Unlimited Token: no charges ring beside it.
        expect(o.querySelectorAll('[data-ring]').length).toBe(1);
    });

    it('the ring follows progress (state_changed, no subscription of its own)', async () => {
        const q = spawn(hunt());
        const { container } = mount(tokenEl(q));
        await act(async () => { QuestTokens.reportProgress('enemy_hunted', 1, { enemyId: 'token_goblin' }); });
        const ring = overlay(container, q).querySelector('[data-ring="quest"]');
        expect(ring.getAttribute('data-ring-text')).toBe('2/3');
    });

    it('a plain Token has no quest ring and no quest hooks', () => {
        const inst = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'));
        BoardState.addToken(inst, 300, 300);
        const { container } = mount(tokenEl(inst));
        const o = overlay(container, inst);
        expect(o.getAttribute('data-quest-token')).toBeNull();
        expect(o.querySelector('[data-ring="quest"]')).toBeNull();
    });

    it('glows only when done', () => {
        const open = spawn(hunt());
        const done = spawn(hunt({ id: 'q_done', currentCount: 3 }));
        const { container } = mount([tokenEl(open, { key: 'a' }), tokenEl(done, { key: 'b' })]);
        expect(art(container, open).querySelector('[data-quest-glow]')).toBeNull();
        expect(art(container, done).querySelector('[data-quest-glow]')).not.toBeNull();
        expect(overlay(container, done).getAttribute('data-quest-done')).toBe('true');
    });
});

describe('hover to read (B6.2)', () => {
    it('a bounty: title, what is needed, the reward, no claim line until done', () => {
        const q = spawn(hunt());
        mount(tokenEl(q, { isHovered: true }));
        const tip = tooltip();
        expect(tip).not.toBeNull();
        expect(tip.getAttribute('data-quest-tooltip')).toBe(q.id);
        expect(tip.querySelector('[data-quest-title]').textContent).toBe('Defeat 3 Goblins');
        expect(tip.querySelector('[data-quest-need]').textContent).toMatch(/^1\/3 .+ defeated$/);
        expect(tip.querySelector('[data-quest-reward="item_oak_wood"]').textContent).toContain('5');
        expect(tip.querySelector('[data-quest-tutorial]')).toBeNull();
        expect(tip.querySelector('[data-quest-claim]')).toBeNull();
    });

    it('a done quest says "Click to claim"', () => {
        const q = spawn(hunt({ currentCount: 3 }));
        mount(tokenEl(q, { isHovered: true }));
        expect(tooltip().querySelector('[data-quest-claim]').textContent).toBe('Click to claim');
    });

    it('a tutorial step says "Tutorial" and shows its instruction', () => {
        const tut = QuestTokens.tutorialTokens()[0];
        expect(tut).toBeTruthy();
        mount(tokenEl(tut, { isHovered: true }));
        const tip = tooltip();
        expect(tip.querySelector('[data-quest-tutorial]').textContent).toBe('Tutorial');
        expect(tip.querySelector('[data-quest-instruction]').textContent).toBe(tut.quest.instruction);
        expect(tip.querySelector('[data-quest-need]').textContent).toBe('0/1');
    });

    it('no tooltip unless hovered', () => {
        const q = spawn(hunt());
        mount(tokenEl(q));
        expect(tooltip()).toBeNull();
    });
});

describe('click to claim (B6.2, FB-41)', () => {
    it('⭐ clicking a done quest claims it: the Token goes, the reward floats as loot', async () => {
        const q = spawn(hunt({ currentCount: 3 }));
        const before = SpriteLayer.getSprites().length;
        const onInspectToken = vi.fn();
        const { container } = mount(tokenEl(q, { onInspectToken }));
        await act(async () => { fireEvent.click(art(container, q)); });
        expect(BoardState.getTokenById(q.id)).toBeFalsy();
        expect(SpriteLayer.getSprites().length).toBe(before + 1);
        expect(SpriteLayer.getSprites().some(s => s.refId === 'item_oak_wood' || s.itemId === 'item_oak_wood')).toBe(true);
        expect(onInspectToken).not.toHaveBeenCalled();
    });

    it('clicking a quest not yet done does not claim; it inspects as any Token', () => {
        const q = spawn(hunt());
        const before = SpriteLayer.getSprites().length;
        const onInspectToken = vi.fn();
        const { container } = mount(tokenEl(q, { onInspectToken }));
        act(() => { fireEvent.click(art(container, q)); });
        expect(BoardState.getTokenById(q.id)).toBeTruthy();
        expect(SpriteLayer.getSprites().length).toBe(before);
        expect(onInspectToken).toHaveBeenCalledTimes(1);
    });

    it('disallow mode never claims: the click only flips', () => {
        const q = spawn(hunt({ currentCount: 3 }));
        const onFlipDisallow = vi.fn();
        const { container } = mount(tokenEl(q, { disallowMode: true, onFlipDisallow }));
        act(() => { fireEvent.click(art(container, q)); });
        expect(onFlipDisallow).toHaveBeenCalledWith(q.id);
        expect(BoardState.getTokenById(q.id)).toBeTruthy();
    });
});

describe('MatToken stays cheap (B6.2)', () => {
    it('a quest Token subscribes to the bus exactly as often as a plain Token', () => {
        const count = (el) => {
            let n = 0;
            const real = EventBus.subscribe.bind(EventBus);
            const spy = vi.spyOn(EventBus, 'subscribe').mockImplementation((name, cb) => { n++; return real(name, cb); });
            const r = mount(el);
            spy.mockRestore();
            r.unmount();
            return n;
        };
        const plain = BoardState.createTokenInstance('fixture_producer', null);
        BoardState.addToken(plain, 300, 300);
        const q = spawn(hunt());
        expect(count(tokenEl(q))).toBe(count(tokenEl(plain)));
    });
});

describe('the notification column (B6.2)', () => {
    it('has Notifications and the bin, and no Quests section', () => {
        const { container } = mount(h(NotificationColumn));
        expect(container.textContent).toContain('Notifications');
        expect(container.textContent).not.toMatch(/Quests/);
        expect(container.querySelector('[data-quest-id]')).toBeNull();
    });
});

describe('the tutorial aide reads quest Tokens (B6.2)', () => {
    it('finds the current step from the tutorial quest Token', () => {
        const tut = QuestTokens.tutorialTokens()[0];
        expect(activeTutorialQuest()?.id).toBe(tut.quest.id);
        expect(GameState.state.quests.active).toEqual([]);
        // Done steps are not "current".
        tut.quest.currentCount = tut.quest.requiredCount;
        tut.quest.done = true;
        expect(activeTutorialQuest()).toBeNull();
    });

    it('hovering a tutorial quest Token lights its target; leaving puts it out', () => {
        const tut = QuestTokens.tutorialTokens()[0];
        const events = [];
        const a = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.HOVER, (e) => events.push(['hover', e.questId]));
        const b = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.UNHOVER, () => events.push(['unhover']));
        const { rerender } = mount(tokenEl(tut, { isHovered: true }));
        rerender(tree(tokenEl(tut, { isHovered: false })));
        a(); b();
        expect(events).toEqual([['hover', tut.quest.id], ['unhover']]);
    });
});

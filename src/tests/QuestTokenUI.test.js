// @vitest-environment jsdom
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
import { MatToken } from '../ui/components/board/MatToken.jsx';
import { idlePlateCells } from '../ui/components/board/idlePlate.js';
import { questNeedLine, questRewardsShown } from '../ui/components/board/QuestTooltip.jsx';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ B6.2 — the quest Token UI ("noticeboard, click to claim"). A quest Token
 * stands a parchment `3/10` ring under itself, reads on hover
 * (`QuestTooltip`), glows when done and is claimed by a click — never in
 * a map mode. The notification column lost its Quests section.
 */

const HALL = { x: 880, y: 560 };
const h = React.createElement;
const tree = (el) => h(DndContext, null, el);
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
/** The mat's idle plate host, handed to the rested Token. */
const plateHost = () => {
    let el = document.body.querySelector('[data-test-plate-host]');
    if (!el) {
        el = document.createElement('div');
        el.setAttribute('data-test-plate-host', '');
        document.body.appendChild(el);
    }
    return el;
};
const idlePlate = () => document.body.querySelector('[data-test-plate-host] [data-idle-plate]');
const art = (c, inst) => c.querySelector(`[data-token-art="true"][data-token-id="${inst.id}"]`);
const tooltip = () => document.body.querySelector('[data-quest-tooltip]');

beforeEach(() => {
    resetMatTuning();
    newGame();
});

afterEach(() => {
    cleanup();
    document.body.querySelector('[data-test-plate-host]')?.remove();
    QuestManager.cleanup();
    resetMatTuning();
});

describe('the quest progress, pure (B6.2)', () => {
    it('is never on the idle plate: the plate is for timers and problems', () => {
        expect(idlePlateCells({ quest: { currentCount: 3, requiredCount: 10 } })).toEqual([]);
    });

    it('the need line: an item collection, a hunt, a plain count', () => {
        expect(questNeedLine({ type: 'collection', itemId: 'item_copper_ingot', currentCount: 3, requiredCount: 10 }))
            .toMatch(/^3\/10 Copper Ingot$/);
        expect(questNeedLine(hunt())).toMatch(/^1\/3 .+ defeated$/);
        expect(questNeedLine({ currentCount: 0, requiredCount: 1 })).toBe('0/1');
    });
});

describe('a quest Token on the mat (B6.2)', () => {
    it('⭐ its progress: no plate at rest or hovered (its hover tooltip says it), and no ring', () => {
        const q = spawn(hunt());
        const { container, rerender } = mount(tokenEl(q, { plateHost: plateHost() }));
        const o = overlay(container, q);
        expect(o.getAttribute('data-quest-token')).toBe(q.id);
        expect(o.getAttribute('data-quest-done')).toBe('false');
        expect(idlePlate()).toBeNull();

        rerender(h(DndContext, null, tokenEl(q, { isHovered: true, isRested: true, plateHost: plateHost() })));
        expect(idlePlate()).toBeNull();
        expect(tooltip().querySelector('[data-quest-need]').textContent).toMatch(/^1\/3 /);
        expect(container.querySelector('[data-ring]')).toBeNull();
    });

    it('the tooltip follows progress (quests_updated, no subscription of its own); it shows on hover, not by itself', async () => {
        const q = spawn(hunt());
        const { rerender } = mount(tokenEl(q, { plateHost: plateHost() }));
        await act(async () => { QuestTokens.reportProgress('enemy_hunted', 1, { enemyId: 'token_goblin' }); });
        await act(async () => { await new Promise(r => setTimeout(r, 120)); });
        expect(tooltip()).toBeNull();
        rerender(tree(tokenEl(q, { isHovered: true, isRested: true, plateHost: plateHost() })));
        expect(tooltip().querySelector('[data-quest-need]').textContent).toMatch(/^2\/3 /);
        expect(idlePlate()).toBeNull();
    });

    it('a plain Token has no quest progress and no quest hooks', () => {
        const inst = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'));
        BoardState.addToken(inst, 300, 300);
        const { container } = mount(tokenEl(inst));
        const o = overlay(container, inst);
        expect(o.getAttribute('data-quest-token')).toBeNull();
        expect(tooltip()).toBeNull();
    });

    it('a done quest is marked done and claimable, with no glow behind its art', () => {
        const open = spawn(hunt());
        const done = spawn(hunt({ id: 'q_done', currentCount: 3 }));
        const { container } = mount([tokenEl(open, { key: 'a' }), tokenEl(done, { key: 'b' })]);
        expect(overlay(container, open).getAttribute('data-quest-done')).toBe('false');
        expect(overlay(container, done).getAttribute('data-quest-done')).toBe('true');
        expect(art(container, done).getAttribute('data-quest-claimable')).toBe('true');
        for (const t of [open, done]) expect(art(container, t).querySelector('[data-quest-glow], .gi-quest-ready')).toBeNull();
    });
});

describe('hover to read (B6.2)', () => {
    it('a bounty: title, what is needed, the reward, no claim line until done', () => {
        const q = spawn(hunt());
        mount(tokenEl(q, { isHovered: true, isRested: true }));
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
        mount(tokenEl(q, { isHovered: true, isRested: true }));
        expect(tooltip().querySelector('[data-quest-claim]').textContent).toBe('Click to claim');
    });

    it('a bounty with an instruction shows it, with no Tutorial tag', () => {
        const q = spawn(hunt({ instruction: 'Beat them by the Goblin Camp.' }));
        mount(tokenEl(q, { isHovered: true, isRested: true }));
        const tip = tooltip();
        expect(tip.querySelector('[data-quest-instruction]').textContent).toBe('Beat them by the Goblin Camp.');
        expect(tip.querySelector('[data-quest-tutorial]')).toBeNull();
    });

    it('a bounty has no cartographer\'s line', () => {
        const q = spawn(hunt());
        mount(tokenEl(q, { isHovered: true, isRested: true }));
        expect(tooltip().querySelector('[data-quest-says]')).toBeNull();
    });

    it('a quest shows only its items: the first maps are retired, whatever map items exist', () => {
        const step = { firstMaps: true, rewardItems: [{ itemId: 'item_oak_wood', quantity: 10 }] };
        registerItems({ map_ui_test: { id: 'map_ui_test', name: 'Test Map', type: 'map', cartography: { biome: 'forest', points: 4, nodes: [] } } });
        try {
            expect(questRewardsShown(step)).toEqual([{ itemId: 'item_oak_wood', quantity: 10 }]);
        } finally {
            delete getAllItems().map_ui_test;
        }
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
        // ⚠️ A claimed bounty may also pay a map, drawn on Math.random, once any map is authored: pin the draw to miss so the one sprite is the reward.
        const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            await act(async () => { fireEvent.click(art(container, q)); });
        } finally {
            random.mockRestore();
        }
        expect(BoardState.getTokenById(q.id)).toBeFalsy();
        expect(SpriteLayer.getSprites().length).toBe(before + 1);
        expect(SpriteLayer.getSprites().some(s => s.refId === 'item_oak_wood' || s.itemId === 'item_oak_wood')).toBe(true);
        expect(onInspectToken).not.toHaveBeenCalled();
    });

    it('clicking a quest not yet done does not claim; a double-click inspects it as any Token', () => {
        const q = spawn(hunt());
        const before = SpriteLayer.getSprites().length;
        const onInspectToken = vi.fn();
        const { container } = mount(tokenEl(q, { onInspectToken }));
        act(() => { fireEvent.click(art(container, q)); });
        expect(onInspectToken).not.toHaveBeenCalled();
        act(() => { fireEvent.doubleClick(art(container, q)); });
        expect(BoardState.getTokenById(q.id)).toBeTruthy();
        expect(SpriteLayer.getSprites().length).toBe(before);
        expect(onInspectToken).toHaveBeenCalledTimes(1);
    });

    it('a map mode never claims: the click only goes to the mode', () => {
        const q = spawn(hunt({ currentCount: 3 }));
        const onModeClick = vi.fn();
        const { container } = mount(tokenEl(q, { mapMode: 'demolish', onModeClick }));
        act(() => { fireEvent.click(art(container, q)); });
        expect(onModeClick).toHaveBeenCalledWith(q.id);
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


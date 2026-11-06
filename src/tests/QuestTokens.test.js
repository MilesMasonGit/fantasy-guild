import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatCap from '../systems/board/MatCap.js';
import {
    getTokenType, getAllTokenTypes, listTokenTypeIds, tokenSpritePath, TOKENS
} from '../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE, ENGINE_TOKEN_TYPES } from '../config/registries/engineTokens.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { MAT_TUNABLES, setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { registerItems } from '../config/registries/itemRegistry.js';

/** A gathering tool, for the tutorial's first step (equip a tool). */
const TOOL = 'fixture_quest_woodaxe';
registerItems({
    [TOOL]: { id: TOOL, name: 'Fixture Woodaxe', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_woodaxe_copper', tool: { kind: 'woodaxe', tier: 1 } }
});

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ B6.1 — quests are Tokens on the mat. The Guild Hall spawns them beside
 * itself: bounties up to a cap (2, +1 per Notice Board rank, to 5) on a
 * 3-minute game-time clock; tutorial steps one at a time under a hidden cap of
 * their own. Claiming drops the reward as loot and removes the Token; bounties
 * may be dismissed, tutorial steps may not.
 */

const HALL = { x: 880, y: 560 };
const MIN = 60_000;

const hall = () => BoardState.tokens().find(t => t.typeId === 'token_guild_hall');
const bounties = () => QuestTokens.bountyTokens();
const tutorials = () => QuestTokens.tutorialTokens();

/** Put the tutorial chain out of the way: every step claimed. */
function finishTutorial() {
    GameState.state.quests.completedTutorials = TUTORIAL_QUESTS.map(t => t.id);
    for (const t of tutorials()) BoardState.removeToken(t.id);
}

function newGame({ withHall = true } = {}) {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = 50;
    if (withHall) BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), HALL.x, HALL.y);
    QuestManager.init();
}

beforeEach(() => {
    resetMatTuning();
    newGame();
});

afterEach(() => {
    QuestManager.cleanup();
    resetMatTuning();
});

describe('the quest Token type is engine-owned (B6.1)', () => {
    it('resolves like any Token, with the quest board art and no work', () => {
        const def = getTokenType(QUEST_TOKEN_TYPE);
        expect(def).toBeTruthy();
        expect(def.name).toBe('Quest');
        expect(def.config).toBeNull();
        expect(def.requiresHero).toBe(false);
        expect(tokenSpritePath(QUEST_TOKEN_TYPE)).toBe('/assets/ui/u_quest_board.png');
    });

    it('stays out of the authored content set the audits and the Shop walk', () => {
        expect(getAllTokenTypes()[QUEST_TOKEN_TYPE]).toBeUndefined();
        expect(listTokenTypeIds()).not.toContain(QUEST_TOKEN_TYPE);
        // No shipped Token takes an engine-owned id (the content one would win).
        for (const id of Object.keys(ENGINE_TOKEN_TYPES)) expect(TOKENS[id], id).toBeUndefined();
    });
});

describe('the Guild Hall spawns bounties up to the cap on a game-time clock (TL-18)', () => {
    beforeEach(() => finishTutorial());

    it('one every 3 minutes of delta, up to 2, then the clock holds', () => {
        expect(QuestTokens.questCap()).toBe(2);
        QuestManager.tick(3 * MIN - 1000);
        expect(bounties()).toHaveLength(0);
        QuestManager.tick(1000);
        expect(bounties()).toHaveLength(1);
        QuestManager.tick(3 * MIN);
        expect(bounties()).toHaveLength(2);
        QuestManager.tick(30 * MIN);
        expect(bounties()).toHaveLength(2);
        expect(QuestTokens.clockMs()).toBe(0);
        expect(QuestTokens.nextBountyInMs()).toBeNull();
    });

    it('one big tick equals many small ones (a catch-up step)', () => {
        QuestManager.tick(6 * MIN);
        expect(bounties()).toHaveLength(2);
        expect(QuestTokens.clockMs()).toBe(0);
    });

    it('never reads the wall clock', () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * MIN);
        try {
            QuestManager.tick(100);
            expect(bounties()).toHaveLength(0);
        } finally {
            now.mockRestore();
        }
    });

    it('bounties are spawned beside the Hall, draggable, and never count toward the Token cap', () => {
        const before = MatCap.tokenCount();
        QuestManager.tick(6 * MIN);
        for (const t of bounties()) {
            expect(BoardState.originOf(t)).toBe(BoardState.ORIGIN.SPAWNED);
            expect(Math.hypot(t.x - HALL.x, t.y - HALL.y)).toBeLessThan(400);
            expect(t.quest.tutorial).toBe(false);
            expect(t.quest.rewardItems.length).toBeGreaterThan(0);
            expect(['hunt', 'collection']).toContain(t.quest.type);
        }
        expect(MatCap.tokenCount()).toBe(before);
        const [first] = bounties();
        expect(QuestTokens.questOf(first.id)).toBe(first.quest);
    });

    it('with no Guild Hall nothing arrives and the clock holds full', () => {
        BoardState.removeToken(hall().id);
        QuestManager.tick(10 * MIN);
        expect(bounties()).toHaveLength(0);
        expect(QuestTokens.clockMs()).toBe(3 * MIN);
    });

    it('the numbers are Mat Tuner rows', () => {
        for (const [key, def] of [['questCap', 2], ['questCapMax', 5], ['questEverySec', 180]]) {
            const row = MAT_TUNABLES.find(t => t.key === key);
            expect(row?.def, key).toBe(def);
            expect(row.group).toBe('Quests');
        }
        setMatTuning('questEverySec', 60);
        QuestManager.tick(MIN);
        expect(bounties()).toHaveLength(1);
    });
});

describe('the bounty cap is fixed at 2 (brief 320 retired the Notice Board)', () => {
    it('has no Notice Board star, and ranks from an old save raise nothing', () => {
        expect(getUpgradeDef('notice_board')).toBeNull();
        finishTutorial();
        GameState.state.progress.guildUpgrades = { notice_board: 3 };
        expect(QuestTokens.questCap()).toBe(2);
        QuestManager.tick(60 * MIN);
        expect(bounties()).toHaveLength(2);
    });
});

describe('the tutorial chain under its hidden cap (FB-42)', () => {
    it('a new game starts with the first step on the mat, beside the Hall', () => {
        expect(tutorials().map(t => t.quest.id)).toEqual([TUTORIAL_QUESTS[0].id]);
        const [t] = tutorials();
        expect(BoardState.originOf(t)).toBe(BoardState.ORIGIN.SPAWNED);
        expect(MatCap.tokenCount()).toBe(0);
    });

    it('a new game whose Hall lands after init gets its step on the next tick', () => {
        QuestManager.cleanup();
        newGame({ withHall: false });
        expect(tutorials()).toHaveLength(0);
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), HALL.x, HALL.y);
        QuestManager.tick(16);
        expect(tutorials()).toHaveLength(1);
    });

    it('claiming a step brings the next; the last brings nothing', () => {
        for (let i = 0; i < TUTORIAL_QUESTS.length; i++) {
            const [t] = tutorials();
            expect(tutorials()).toHaveLength(1);
            expect(t.quest.id).toBe(TUTORIAL_QUESTS[i].id);
            expect(t.quest.step).toBe(i);
            t.quest.currentCount = t.quest.requiredCount;
            t.quest.done = true;
            expect(QuestTokens.claimQuest(t.id).success).toBe(true);
        }
        expect(tutorials()).toHaveLength(0);
        expect(GameState.state.quests.completedTutorials).toEqual(TUTORIAL_QUESTS.map(t => t.id));
    });

    it('tutorial steps ignore the bounty cap and the timer; bounties run beside them', () => {
        QuestManager.tick(6 * MIN);
        expect(tutorials()).toHaveLength(1);
        expect(bounties()).toHaveLength(2);
        QuestManager.tick(30 * MIN);
        expect(tutorials()).toHaveLength(1);   // no timer brings more steps
    });

    it('a tutorial quest cannot be dismissed; a bounty can, with no reward, and frees its place', () => {
        const [tut] = tutorials();
        const refused = QuestTokens.dismissBounty(tut.id);
        expect(refused.success).toBe(false);
        expect(refused.reason).toBe('Tutorial quests cannot be dismissed.');
        expect(BoardState.getTokenById(tut.id)).toBeTruthy();
        expect(QuestTokens.canDismiss(tut)).toBe(false);

        QuestManager.tick(6 * MIN);
        expect(bounties()).toHaveLength(2);
        const [b] = bounties();
        expect(QuestTokens.canDismiss(b)).toBe(true);
        const sprites = SpriteLayer.getSprites().length;
        expect(QuestTokens.dismissBounty(b.id).success).toBe(true);
        expect(BoardState.getTokenById(b.id)).toBeNull();
        expect(bounties()).toHaveLength(1);
        expect(SpriteLayer.getSprites().length).toBe(sprites);
        expect(QuestTokens.dismissBounty(b.id).success).toBe(false);
        // Freed: the timer brings another a full interval later.
        QuestManager.tick(3 * MIN - 1000);
        expect(bounties()).toHaveLength(1);
        QuestManager.tick(1000);
        expect(bounties()).toHaveLength(2);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
    });
});

describe('progress and claiming (FB-41)', () => {
    it('progress comes from the same events as before, and marks the quest done', () => {
        const [t] = tutorials();   // Equip a Tool
        expect(t.quest.done).toBe(false);
        EventBus.publish('hero_equipment_changed', { action: 'equip', heroId: 'h1', itemId: TOOL });
        expect(t.quest.currentCount).toBe(1);
        expect(t.quest.done).toBe(true);
    });

    it('a quest is claimed only when done', () => {
        const [t] = tutorials();
        const res = QuestTokens.claimQuest(t.id);
        expect(res.success).toBe(false);
        expect(BoardState.getTokenById(t.id)).toBe(t);
        expect(QuestTokens.claimQuest('tok_nothing').success).toBe(false);
        expect(QuestTokens.claimQuest(hall().id).success).toBe(false);
    });

    it('claiming drops the reward as loot beside the Token and removes it — not a depletion', () => {
        const [t] = tutorials();
        const at = { x: t.x, y: t.y };
        EventBus.publish('hero_equipment_changed', { action: 'equip', heroId: 'h1', itemId: TOOL });
        const depleted = vi.fn();
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, depleted);
        try {
            expect(QuestTokens.claimQuest(t.id).success).toBe(true);
        } finally {
            off?.();
        }
        expect(depleted).not.toHaveBeenCalled();
        expect(BoardState.getTokenById(t.id)).toBeNull();
        const loot = SpriteLayer.getSprites().filter(s => s.refId === 'item_oak_wood');
        expect(loot.reduce((n, s) => n + s.quantity, 0)).toBe(10);
        for (const s of loot) expect(Math.hypot(s.x - at.x, s.y - at.y)).toBeLessThan(200);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
    });
});

describe('saves (B6.1)', () => {
    it('quest Tokens and the clock survive a save and load', async () => {
        finishTutorial();
        QuestManager.tick(3 * MIN + 20_000);
        const [b] = bounties();
        b.quest.currentCount = 1;
        const saved = JSON.parse(JSON.stringify(GameState.serialize().state));
        QuestManager.cleanup();

        GameState.initNew();
        await GameState.initFromSave(saved);
        QuestManager.init();
        EventBus.publish('game_loaded', { slot: 0 });
        const [loaded] = bounties();
        expect(loaded.id).toBe(b.id);
        expect(loaded.quest).toEqual(b.quest);
        expect(QuestTokens.clockMs()).toBe(20_000);
        expect(tutorials()).toHaveLength(0);
    });

    it('an old save’s sidebar quests become quest Tokens with their progress', async () => {
        const state = JSON.parse(JSON.stringify(GameState.serialize().state));
        for (const id of Object.keys(state.board.tokens)) {
            if (state.board.tokens[id].typeId === QUEST_TOKEN_TYPE) delete state.board.tokens[id];
        }
        state.quests = {
            completedTutorials: ['cart_recruit', 'tutorial_3'],
            tutorialStep: 1,
            nextQuestAt: Date.now() + 1000,
            active: [
                { id: 'cart_flag', isTutorial: true, step: 1, title: 'old', targetType: 'hero_deployed', requiredCount: 1, currentCount: 0, status: 'active' },
                { id: 'cart_gather', isTutorial: true, step: 2, title: 'old', targetType: 'cycle_completed', requiredCount: 3, currentCount: 2, status: 'active' },
                { id: 'tutorial_12', isTutorial: true, title: 'Token Vault', targetType: 'open_vault', requiredCount: 1, currentCount: 0, status: 'active' },
                { id: 'quest_old_1', isTutorial: false, type: 'hunt', title: 'Defeat 3 Goblins', targetType: 'enemy_hunted', enemyId: 'token_goblin', requiredCount: 3, currentCount: 1, rewardMapId: 'map_x', status: 'active' },
                { id: 'quest_old_2', status: 'abandoned', originalId: 'x', readyAt: Date.now() + 60_000 }
            ]
        };
        QuestManager.cleanup();
        GameState.initNew();
        await GameState.initFromSave(state);
        QuestManager.init();
        EventBus.publish('game_loaded', { slot: 0 });

        expect(GameState.state.quests.active).toEqual([]);
        expect(tutorials().map(t => t.quest.id)).toEqual(['cart_flag', 'cart_gather']);
        const log = tutorials().find(t => t.quest.id === 'cart_gather').quest;
        expect(log.currentCount).toBe(2);
        expect(log.title).toBe('Gather');   // re-read from its template
        const [hunt] = bounties();
        expect(hunt.quest).toMatchObject({ id: 'quest_old_1', tutorial: false, type: 'hunt', enemyId: 'token_goblin', currentCount: 1, done: false });
        expect(hunt.quest.rewardItems).toEqual([{ itemId: 'item_oak_wood', quantity: 10 }]);
        expect(hunt.quest.rewardMapId).toBeUndefined();
        // Neither claimed id is a step the chain still has (the recruit step went with the new-game screen).
        expect(GameState.state.quests.tutorialStep).toBe(0);

        // The chain settles back to one at a time: no new step until the last is claimed.
        const flag = tutorials().find(t => t.quest.id === 'cart_flag');
        flag.quest.currentCount = 1;
        flag.quest.done = true;
        expect(QuestTokens.claimQuest(flag.id).success).toBe(true);
        expect(tutorials().map(t => t.quest.id)).toEqual(['cart_gather']);
        const logToken = tutorials()[0];
        logToken.quest.currentCount = 3;
        logToken.quest.done = true;
        expect(QuestTokens.claimQuest(logToken.id).success).toBe(true);
        // The first step not yet claimed: the tool step, which this save's chain never had.
        expect(tutorials().map(t => t.quest.id)).toEqual(['cart_tool']);
    });
});

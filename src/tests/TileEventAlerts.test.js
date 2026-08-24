import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';

import { InventoryManager } from '../systems/inventory/InventoryManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));

import { getAllSkillIds } from '../config/registries/skillRegistry.js';

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) {
        skills[s] = { level, xp: 0 };
    }
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

describe('On-Board Tile Event Alerts', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        BoardRunner.init();
        GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
        GameState.state.inventory.maxSlots = 50;
    });

    it('emits Red alert when a token depletes its last charge', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Create token with 1 charge
        const tok = BoardState.createTokenInstance('fixture_producer', 1);
        Placement.placeToken(8, tok);
        Placement.placeHero('hero_1', 8);

        // Run cycle to completion (fixture_producer cycleTime is 12s)
        for (let t = 0; t < 13000; t += 100) BoardRunner.tick(100);

        // Token should have depleted and emitted TILE_EVENT_ALERT
        expect(BoardState.getToken(8)).toBeNull();
        expect(events.length).toBeGreaterThanOrEqual(1);

        const exhaustEvent = events.find(e => e.type === 'token_exhausted');
        expect(exhaustEvent).toBeDefined();
        expect(exhaustEvent).toMatchObject({
            tile: 8,
            severity: 'red',
            type: 'token_exhausted'
        });
        expect(exhaustEvent.message).toContain('Token Exhausted:');
        expect(exhaustEvent.message).toContain('Fixture Producer');
    });

    it('emits Yellow alert when a staffed token lacks input materials', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place a consumer without providing its inputs in inventory
        const consumer = BoardState.createTokenInstance('fixture_consumer');
        Placement.placeToken(8, consumer);
        Placement.placeHero('hero_1', 8);

        // Tick runner
        BoardRunner.tick(100);

        const itemAlert = events.find(e => e.type === 'out_of_item');
        expect(itemAlert).toBeDefined();
        expect(itemAlert).toMatchObject({
            tile: 8,
            severity: 'yellow',
            type: 'out_of_item'
        });
        expect(itemAlert.message).toContain('Out of item:');
    });

    it('emits Yellow alert when a station lacks adjacent token recipe', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place station with no context beside it
        const station = BoardState.createTokenInstance('fixture_station');
        Placement.placeToken(8, station);
        Placement.placeHero('hero_1', 8);

        // Tick runner
        BoardRunner.tick(100);

        const tokenAlert = events.find(e => e.type === 'out_of_token');
        expect(tokenAlert).toBeDefined();
        expect(tokenAlert).toMatchObject({
            tile: 8,
            severity: 'yellow',
            type: 'out_of_token'
        });
        expect(tokenAlert.message).toMatch(/(Out of|Missing) token:/);
    });

    it('emits Yellow alert for Oak Tree missing Woodaxe tool', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place token_oak_tree (requires axe) without an adjacent axe
        const tree = BoardState.createTokenInstance('token_oak_tree');
        Placement.placeToken(8, tree);
        Placement.placeHero('hero_1', 8);

        // Tick runner
        BoardRunner.tick(100);

        const tokenAlert = events.find(e => e.type === 'out_of_token' && e.tile === 8);
        expect(tokenAlert).toBeDefined();
        expect(tokenAlert).toMatchObject({
            tile: 8,
            severity: 'yellow',
            type: 'out_of_token',
            name: 'Woodaxe',
            message: 'Missing token: Woodaxe'
        });
    });

    it('emits Red alert when an unworked adjacent tool/context token depletes its charges', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Add input coal for station
        InventoryManager.addItem('item_coal', 10);

        // Place station with recipe context
        const station = BoardState.createTokenInstance('fixture_station');
        Placement.placeToken(8, station);
        Placement.placeHero('hero_1', 8);

        // Place tool/context token with 1 charge adjacent at tile 9
        const contextA = BoardState.createTokenInstance('fixture_context_a', 1);
        Placement.placeToken(9, contextA);

        // Run cycle to completion (fixture_station cycleTime is 16s)
        for (let t = 0; t < 17000; t += 100) BoardRunner.tick(100);

        // The unworked tool on tile 9 should have depleted and emitted Red alert
        expect(BoardState.getToken(9)).toBeNull();

        const toolExhaustEvent = events.find(e => e.type === 'token_exhausted' && e.tile === 9);
        expect(toolExhaustEvent).toBeDefined();
        expect(toolExhaustEvent).toMatchObject({
            tile: 9,
            severity: 'red',
            type: 'token_exhausted'
        });
        expect(toolExhaustEvent.message).toContain('Token Exhausted:');
        expect(toolExhaustEvent.message).toContain('Fixture Context A');
    });

    it('emits Disallow alert with exact rules text when a drop is rejected by restrictions', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place 3 plain coasts surrounding tile 9 (tiles 8, 10, 16)
        Placement.placeToken(8, BoardState.createTokenInstance('fixture_plain_coast'));
        Placement.placeToken(10, BoardState.createTokenInstance('fixture_plain_coast'));
        Placement.placeToken(16, BoardState.createTokenInstance('fixture_plain_coast'));

        // Attempt to drop fixture_coast on tile 9 (it allows at most 2 adjacent Coasts)
        const rejectResult = Placement.placeToken(9, BoardState.createTokenInstance('fixture_coast'));
        expect(rejectResult.success).toBe(false);

        // Disallow alert should have been emitted on tile 9
        const rejectAlert = events.find(e => e.type === 'drop_rejected' && e.tile === 9);
        expect(rejectAlert).toBeDefined();
        expect(rejectAlert).toMatchObject({
            tile: 9,
            severity: 'disallow',
            type: 'drop_rejected',
            name: 'Fixture Coast',
            title: 'Drop Rejected: Fixture Coast'
        });
        expect(rejectAlert.rulesText).toBe('Cannot be adjacent to more than 2 Coast Tokens.');
    });

    it('emits Green alert when a token is restocked with text "Restocked from [Token Name]"', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place a fixture_producer on tile 8 with 20 uses remaining (max cap is 5000)
        const onBoardToken = BoardState.createTokenInstance('fixture_producer', 20);
        Placement.placeToken(8, onBoardToken);

        // Drop another fixture_producer with 100 uses onto tile 8
        const incomingToken = BoardState.createTokenInstance('fixture_producer', 100);
        const result = Placement.placeToken(8, incomingToken);
        expect(result.restocked).toBe(true);

        // Verify Green alert was emitted on tile 8
        const restockAlert = events.find(e => e.type === 'token_restocked' && e.tile === 8);
        expect(restockAlert).toBeDefined();
        expect(restockAlert).toMatchObject({
            tile: 8,
            severity: 'green',
            type: 'token_restocked',
            name: 'Fixture Producer',
            title: 'Restocked from Fixture Producer',
            message: 'Restocked from Fixture Producer'
        });
    });

    it('emits Upgrade alert when a stationed hero levels up a skill', async () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));
        await import('../systems/core/NotificationSubscriptions.js');
        const SkillSystem = await import('../systems/hero/SkillSystem.js');

        // Place hero on tile 8 with a token
        const tok = BoardState.createTokenInstance('fixture_producer');
        Placement.placeToken(8, tok);
        Placement.placeHero('hero_1', 8);

        // Set Ryan / hero_1's mining skill to level 3 with 0 XP
        const hero = GameState.state.heroes.find(h => h.id === 'hero_1');
        hero.name = 'Ryan';
        hero.skills.mining = { level: 3, xp: 0 };

        // Add enough XP to level up Mining 3 > 4
        SkillSystem.addXP('hero_1', 'mining', 500);

        const levelUpAlerts = events.filter(e => e.type === 'hero_level_up' && e.tile === 8);
        expect(levelUpAlerts.length).toBeGreaterThanOrEqual(1);
        const firstAlert = levelUpAlerts[0];
        expect(firstAlert).toMatchObject({
            tile: 8,
            severity: 'upgrade',
            type: 'hero_level_up',
            heroName: 'Ryan',
            skillName: 'Mining',
            startLevel: 3,
            newLevel: 4,
            message: 'Ryan leveled up Mining 3>4!'
        });
        const finalAlert = levelUpAlerts[levelUpAlerts.length - 1];
        expect(finalAlert).toMatchObject({
            tile: 8,
            severity: 'upgrade',
            type: 'hero_level_up',
            heroName: 'Ryan',
            skillName: 'Mining',
            startLevel: 3,
            newLevel: 5,
            message: 'Ryan leveled up Mining 3>5!'
        });
    });
});

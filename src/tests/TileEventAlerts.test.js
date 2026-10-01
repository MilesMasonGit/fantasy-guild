import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Placement from '../systems/board/Placement.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

/**
 * A gatherer that still needs an axe nearby. The shipped Oak Tree used to be
 * this case, but tool requirements were dropped from content (Token Lifecycle
 * TL-2, slice 7.0) while the engine path they exercise stays, so the test
 * keeps its own copy of the old requirement.
 */
registerTokenTypes({
    fixture_axe_tree: {
        id: 'fixture_axe_tree', name: 'Fixture Axe Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 25, sprite: 'token_tree_oak',
        acceptedTokens: [{ tag: 'axe', minTier: 1 }],
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 16000, xp: 2, inputs: [],
            outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 2 }]
        }
    }
});

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles.
 * A lattice of mat points 160 u apart, so spots 3, 8 and 10 are each a side
 * neighbour of spot 9 — which is what puts three Coasts within the shipped
 * 164 u Near of it below.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;

/** Put a Token on spot `i`, and plant a hero's flag there. */
// The player picks a station's recipe (TL-15); a non-station is untouched.
const put = (i, instance) => {
    const res = Placement.placeTokenAt(instance, C(i));
    pickRecipe(instance);
    return res;
};
const plant = (heroId, i) => Placement.plantFlagAt(heroId, C(i));

import { InventoryManager } from '../systems/inventory/InventoryManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));

import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { pickRecipe } from './fixtures/stations.js';

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) {
        skills[s] = { level, xp: 0 };
    }
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/**
 * Since Free Playmat slice 1.6b every alert names its Token by **instance id**,
 * and one with no Token to name (a refused drop, a Token that has just left)
 * by the **mat point** — never by tile.
 */
describe('On-Board Tile Event Alerts', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        BoardRunner.init();
        resetMatTuning();
        GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
        GameState.state.inventory.maxSlots = 50;
    });

    it('emits Red alert when a token depletes its last charge', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Create token with 1 charge
        const tok = BoardState.createTokenInstance('fixture_producer', 1);
        put(8, tok);
        plant('hero_1', 8);

        // Run cycle to completion (fixture_producer cycleTime is 12s)
        for (let t = 0; t < 13000; t += 100) BoardRunner.tick(100);

        // Token should have depleted and emitted TILE_EVENT_ALERT
        expect(tokenAt(8)).toBeNull();
        expect(events.length).toBeGreaterThanOrEqual(1);

        const exhaustEvent = events.find(e => e.type === 'token_exhausted');
        expect(exhaustEvent).toBeDefined();
        expect(exhaustEvent).toMatchObject({
            instanceId: tok.id,
            ...C(8),
            severity: 'red',
            type: 'token_exhausted'
        });
        expect(exhaustEvent).not.toHaveProperty('tile');
        expect(exhaustEvent.message).toContain('Token Exhausted:');
        expect(exhaustEvent.message).toContain('Fixture Producer');
    });

    /**
     * A hero already working a Token that then goes stuck (Free Playmat 1.4b).
     *
     * A flag never claims a Token it cannot run (FP-48), so the runner's
     * staffed-but-stuck alerts only ever describe a claim made while the Token
     * could run. That claim is staged directly here, so the alert — not the
     * chooser — is what each test below exercises.
     */
    function staff(tile, heroId) {
        const instance = tokenAt(tile);
        Flags.plant(heroId, C(tile));
        BoardState.setClaim(heroId, { instanceId: instance.id, typeId: instance.typeId });
    }

    it('emits Yellow alert when a staffed token lacks input materials', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place a consumer without providing its inputs in inventory
        const consumer = BoardState.createTokenInstance('fixture_consumer');
        put(8, consumer);
        staff(8, 'hero_1');

        // Tick runner
        BoardRunner.tick(100);

        const itemAlert = events.find(e => e.type === 'out_of_item');
        expect(itemAlert).toBeDefined();
        expect(itemAlert).toMatchObject({
            instanceId: consumer.id,
            severity: 'yellow',
            type: 'out_of_item'
        });
        expect(itemAlert.message).toContain('Out of item:');
    });

    /**
     * CR3-005 (owner, Z §11 Q12: "say it once"): a stuck station announces its
     * problem once, and again only if it clears and comes back. It used to
     * re-publish every tick (ten times a second) while the red mark, which
     * already shows the problem, stayed up.
     */
    it('a stalled station says it once, and again only after it clears and stalls again (CR3-005)', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => { if (e.type === 'out_of_item') events.push(e); });

        const consumer = BoardState.createTokenInstance('fixture_consumer');
        put(8, consumer);
        staff(8, 'hero_1');

        for (let i = 0; i < 10; i++) BoardRunner.tick(100);
        expect(events.length).toBe(1);
        expect(consumer.alert).toBe('inputs');

        // Give it the input: the mark clears and nothing new is said.
        InventoryManager.addItem('fixture_oak_wood', 2);
        BoardRunner.tick(100);
        expect(consumer.alert).toBeNull();
        expect(events.length).toBe(1);

        // Take it away again (or let the cycle use it up): one more, once.
        if (InventoryManager.getItemCount('fixture_oak_wood') > 0) {
            InventoryManager.removeItem('fixture_oak_wood', InventoryManager.getItemCount('fixture_oak_wood'));
        }
        for (let i = 0; i < 250; i++) BoardRunner.tick(100);
        expect(consumer.alert).toBe('inputs');
        expect(events.length).toBe(2);
    });

    it('emits Yellow alert when a station lacks nearby token recipe', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place station with no context beside it
        const station = BoardState.createTokenInstance('fixture_station');
        put(8, station);
        staff(8, 'hero_1');

        // Tick runner
        BoardRunner.tick(100);

        const tokenAlert = events.find(e => e.type === 'out_of_token');
        expect(tokenAlert).toBeDefined();
        expect(tokenAlert).toMatchObject({
            instanceId: station.id,
            severity: 'yellow',
            type: 'out_of_token'
        });
        expect(tokenAlert.message).toMatch(/(Out of|Missing) token:/);
    });

    it('emits Yellow alert for a tree missing its Woodaxe tool', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place a tree that requires an axe, without a nearby axe
        const tree = BoardState.createTokenInstance('fixture_axe_tree');
        put(8, tree);
        staff(8, 'hero_1');

        // Tick runner
        BoardRunner.tick(100);

        const tokenAlert = events.find(e => e.type === 'out_of_token' && e.instanceId === tree.id);
        expect(tokenAlert).toBeDefined();
        expect(tokenAlert).toMatchObject({
            instanceId: tree.id,
            severity: 'yellow',
            type: 'out_of_token',
            name: 'Woodaxe',
            message: 'Missing token: Woodaxe'
        });
    });

    it('emits Red alert when an unworked nearby tool/context token depletes its charges', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Add input coal for station
        InventoryManager.addItem('item_coal', 10);

        // Place station with recipe context
        const station = BoardState.createTokenInstance('fixture_station');
        put(8, station);
        plant('hero_1', 8);

        // Place tool/context token with 1 charge nearby at tile 9
        const contextA = BoardState.createTokenInstance('fixture_context_a', 1);
        put(9, contextA);

        // Run cycle to completion (fixture_station cycleTime is 16s)
        for (let t = 0; t < 17000; t += 100) BoardRunner.tick(100);

        // The unworked tool on tile 9 should have depleted and emitted Red alert
        expect(tokenAt(9)).toBeNull();

        const toolExhaustEvent = events.find(e => e.type === 'token_exhausted' && e.instanceId === contextA.id);
        expect(toolExhaustEvent).toBeDefined();
        expect(toolExhaustEvent).toMatchObject({
            instanceId: contextA.id,
            ...C(9),
            severity: 'red',
            type: 'token_exhausted'
        });
        expect(toolExhaustEvent.message).toContain('Token Exhausted:');
        expect(toolExhaustEvent.message).toContain('Fixture Context A');
    });

    it('emits Disallow alert with exact rules text when a drop has nowhere legal to go', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place 3 plain coasts beside tile 9 (tiles 8, 10, 3). Side neighbours
        // only: Near has reached no diagonal since FP-75 (164 u).
        put(8, BoardState.createTokenInstance('fixture_plain_coast'));
        put(10, BoardState.createTokenInstance('fixture_plain_coast'));
        put(3, BoardState.createTokenInstance('fixture_plain_coast'));

        // ⚠️ Since FP-88 a drop that would break a rule is NUDGED to the nearest
        // spot that obeys it, and flies back only when there is nowhere within
        // nudge reach. With the reach at zero there is nowhere by definition —
        // which is the refusal path, and the only one that raises this mark.
        setMatTuning('nudgeReach', 0);

        // Attempt to drop fixture_coast on tile 9 (it allows at most 2 nearby Coasts)
        const rejectResult = put(9, BoardState.createTokenInstance('fixture_coast'));
        expect(rejectResult.success).toBe(false);

        // A refused drop has no Token on the mat to name: the alert names the
        // point it was refused at (tile 9's centre).
        const at = C(9);
        const rejectAlert = events.find(e => e.type === 'drop_rejected' && e.x === at.x && e.y === at.y);
        expect(rejectAlert).toBeDefined();
        expect(rejectAlert).toMatchObject({
            ...at,
            severity: 'disallow',
            type: 'drop_rejected',
            name: 'Fixture Coast',
            title: 'Drop Rejected: Fixture Coast'
        });
        expect(rejectAlert.rulesText).toBe('Cannot be nearby to more than 2 Coast Tokens.');
    });

    it('emits Green alert when a token is restocked with text "Restocked from [Token Name]"', () => {
        const events = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, e => events.push(e));

        // Place a fixture_producer on tile 8 with 20 uses remaining (max cap is 5000)
        const onBoardToken = BoardState.createTokenInstance('fixture_producer', 20);
        put(8, onBoardToken);

        // Drop another fixture_producer with 100 uses onto tile 8
        const incomingToken = BoardState.createTokenInstance('fixture_producer', 100);
        const result = put(8, incomingToken);
        expect(result.restocked).toBe(true);

        // Verify Green alert was emitted on the Token that took the charges
        const restockAlert = events.find(e => e.type === 'token_restocked' && e.instanceId === onBoardToken.id);
        expect(restockAlert).toBeDefined();
        expect(restockAlert).toMatchObject({
            instanceId: onBoardToken.id,
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
        put(8, tok);
        plant('hero_1', 8);

        // Set Ryan / hero_1's mining skill to level 3 with 0 XP
        const hero = GameState.state.heroes.find(h => h.id === 'hero_1');
        hero.name = 'Ryan';
        hero.skills.mining = { level: 3, xp: 0 };

        // Add enough XP to level up Mining 3 > 4
        SkillSystem.addXP('hero_1', 'mining', 500);

        // Drawn on the Token the hero works (by id), at the point they are drawn.
        const levelUpAlerts = events.filter(e => e.type === 'hero_level_up' && e.instanceId === tok.id);
        expect(levelUpAlerts.length).toBeGreaterThanOrEqual(1);
        const firstAlert = levelUpAlerts[0];
        expect(firstAlert).toMatchObject({
            instanceId: tok.id,
            ...C(8),
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
            instanceId: tok.id,
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

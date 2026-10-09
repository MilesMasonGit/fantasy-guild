import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * A Token in the player's hand is paused: its work cycle, its fight and its last charge all wait
 * for the drop, so it can never vanish from under the cursor. Dropping it resumes exactly where it
 * stopped.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** A hero-less station on its last charge: its next completed cycle removes it. */
registerTokenTypes({
    carried_last_charge: {
        id: 'carried_last_charge', name: 'Carried Last Charge', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 'skill_industry',
        requiresHero: false,
        config: { skill: 'forestry', skillRequired: 0, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] }
    }
});

const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

function makeHero(id, { level = 50, hp = 100 } = {}) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: 100 };
    hero.skills.melee = { level, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = level; });
    return hero;
}

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
}

function run(ms) {
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
}

/** Tick until `done()` holds, at most `ms`; whether it did. */
function runUntil(done, ms = 60000) {
    for (let t = 0; t < ms; t += 100) {
        if (done()) return true;
        BoardRunner.tick(100);
    }
    return done();
}

const held = new Set();
function pickUp(instance) { held.add(instance.id); TimedChanges.setInHand(instance.id, true); }
function putDown(instance) { held.delete(instance.id); TimedChanges.setInHand(instance.id, false); }

let completed;
let depleted;
const offs = [];

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
    completed = [];
    depleted = [];
    offs.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, p => completed.push(p.instanceId)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, p => depleted.push(p.instanceId)));
});

afterEach(() => {
    while (offs.length) offs.pop()();
    for (const id of [...held]) TimedChanges.setInHand(id, false);
    held.clear();
});

describe('a carried Token does not work', () => {
    it('its cycle stops, no charge is spent and its hero stands by; the drop resumes it exactly', () => {
        const forest = place(10, 'fixture_producer', 'hero_1');
        expect(runUntil(() => forest.cycleElapsedMs >= 3000)).toBe(true);
        const elapsed = forest.cycleElapsedMs;
        const uses = forest.usesRemaining;

        pickUp(forest);
        run(30000);   // more than two whole 12 s cycles

        expect(forest.cycleElapsedMs).toBe(elapsed);
        expect(forest.usesRemaining).toBe(uses);
        expect(completed).not.toContain(forest.id);
        expect(BoardState.workerOf(forest.id)).toBe('hero_1');

        putDown(forest);
        BoardRunner.tick(100);
        expect(forest.cycleElapsedMs).toBe(elapsed + 100);

        expect(runUntil(() => completed.includes(forest.id), 13000)).toBe(true);
        expect(forest.usesRemaining).toBeLessThan(uses);
    });

    it('a Token on its last charge stays in the hand mid-cycle and finishes after the drop', () => {
        const last = place(10, 'carried_last_charge');
        run(1000);
        expect(last.cycleElapsedMs).toBe(1000);

        pickUp(last);
        run(10000);
        expect(BoardState.getTokenById(last.id)).toBe(last);
        expect(last.usesRemaining).toBe(1);
        expect(last.cycleElapsedMs).toBe(1000);

        putDown(last);
        run(900);
        expect(BoardState.getTokenById(last.id)).toBe(last);
        run(200);
        expect(BoardState.getTokenById(last.id)).toBeNull();
        expect(depleted).toContain(last.id);
    });
});

describe('a carried Token holds its last charge until the drop', () => {
    it('a charge spent on it in the hand removes it only when it is put down', () => {
        const tool = place(10, 'fixture_charged_context', null, 1);
        pickUp(tool);

        Charges.applyDelta(tool, -1);
        expect(BoardState.getTokenById(tool.id)).toBe(tool);
        expect(depleted).not.toContain(tool.id);
        run(5000);
        expect(BoardState.getTokenById(tool.id)).toBe(tool);

        putDown(tool);
        expect(BoardState.getTokenById(tool.id)).toBeNull();
        expect(depleted.filter(id => id === tool.id)).toHaveLength(1);
    });

    it('a support worn out by a neighbour\'s cycle while carried is removed on the drop', () => {
        const forest = place(10, 'fixture_producer', 'hero_1');
        const rack = place(11, 'fixture_buff_yield', null, 1);
        pickUp(rack);

        expect(runUntil(() => completed.includes(forest.id), 20000)).toBe(true);
        expect(BoardState.getTokenById(rack.id)).toBe(rack);

        // Worn to nothing, it is not worn again while it waits.
        expect(runUntil(() => completed.filter(id => id === forest.id).length >= 2, 20000)).toBe(true);
        expect(rack.usesRemaining).toBe(0);
        expect(BoardState.getTokenById(rack.id)).toBe(rack);

        putDown(rack);
        expect(BoardState.getTokenById(rack.id)).toBeNull();
        expect(depleted.filter(id => id === rack.id)).toHaveLength(1);
    });

    it('a support worn out by a kill while carried is removed on the drop', () => {
        const bear = place(10, 'fixture_enemy', 'hero_1');
        const rack = place(11, 'fixture_buff_yield', null, 1);
        pickUp(rack);

        expect(runUntil(() => completed.includes(bear.id), 60000)).toBe(true);
        expect(BoardState.getTokenById(rack.id)).toBe(rack);

        putDown(rack);
        expect(BoardState.getTokenById(rack.id)).toBeNull();
        expect(depleted.filter(id => id === rack.id)).toHaveLength(1);
    });

    it('a Token taken off the mat while in the hand is not removed again on the drop', () => {
        const tool = place(10, 'fixture_charged_context', null, 1);
        pickUp(tool);
        Charges.applyDelta(tool, -1);
        BoardState.removeToken(tool.id);
        depleted = [];

        putDown(tool);
        expect(depleted).toEqual([]);
    });
});

describe('a fight with a carried enemy pauses', () => {
    it('no damage either way while it is carried; the fight resumes on the drop', () => {
        const bear = place(10, 'fixture_enemy', 'hero_1');
        const hero = GameState.state.heroes[0];
        expect(runUntil(() => {
            const hp = BoardCombat.getFight(bear.id)?.combat?.enemyHp;
            return !!hp && hp.current < hp.max;
        })).toBe(true);

        const fight = BoardCombat.getFight(bear.id);
        const enemyHp = fight.combat.enemyHp.current;
        const heroHp = hero.hp.current;
        const uses = bear.usesRemaining;

        pickUp(bear);
        completed = [];
        run(20000);

        expect(BoardCombat.getFight(bear.id)).toBe(fight);
        expect(fight.combat.enemyHp.current).toBe(enemyHp);
        expect(hero.hp.current).toBe(heroHp);
        expect(bear.usesRemaining).toBe(uses);
        expect(completed).not.toContain(bear.id);
        expect(BoardState.getTokenById(bear.id)).toBe(bear);

        putDown(bear);
        expect(runUntil(() => completed.includes(bear.id), 30000)).toBe(true);
    });

    it('a carried enemy on its last charge is not killed until it is put down', () => {
        const bear = place(10, 'fixture_enemy', 'hero_1', 1);
        expect(runUntil(() => !!BoardCombat.getFight(bear.id))).toBe(true);

        pickUp(bear);
        run(60000);
        expect(BoardState.getTokenById(bear.id)).toBe(bear);

        putDown(bear);
        expect(runUntil(() => !BoardState.getTokenById(bear.id), 60000)).toBe(true);
    });
});

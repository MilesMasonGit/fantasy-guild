import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as RegenSystem from '../systems/hero/RegenSystem.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';

/**
 * A hero who lets go of a fight (a recall, a re-plant, moving on, the board changing) is no longer
 * fighting: they rest, regenerate and eat again. A win and a knock-out keep their own statuses.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
const idAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0]?.id ?? null;

function makeHero(id, { level = 50, hp = 100 } = {}) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: 100 };
    hero.skills.melee = { level, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = level; });
    return hero;
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Orders.orderAt(heroId, C(tile));
    return instance;
}

function run(ms) {
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
}

/** Run until the hero is marked as fighting, so the let-go below happens mid-fight. */
function untilFighting(hero) {
    for (let t = 0; t < 10000 && hero.status !== 'combat'; t += 100) BoardRunner.tick(100);
    expect(hero.status).toBe('combat');
}

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
    RegenSystem.reset();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

describe('Letting go of a fight', () => {
    it('a recall mid-fight leaves the hero idle, and they regenerate', () => {
        const hero = GameState.state.heroes[0];
        place(10, 'fixture_enemy', 'hero_1');
        untilFighting(hero);

        Placement.recallHeroById('hero_1');
        run(100);

        expect(BoardCombat.getFight(idAt(10))).toBeNull();
        expect(hero.status).toBe('idle');

        hero.hp.current = 20;
        RegenSystem.tick(60000);
        expect(hero.hp.current).toBeGreaterThan(20);
    });

    it('re-planting on another Token mid-fight leaves the hero idle there', () => {
        const hero = GameState.state.heroes[0];
        place(10, 'fixture_enemy', 'hero_1');
        place(14, 'fixture_producer');
        untilFighting(hero);

        Orders.orderAt('hero_1', C(14));
        run(100);

        expect(BoardCombat.getFight(idAt(10))).toBeNull();
        expect(hero.status).toBe('idle');
    });

    it('a hero who lets go of one enemy for another is marked fighting again by the new fight', () => {
        const hero = GameState.state.heroes[0];
        place(10, 'fixture_enemy', 'hero_1');
        place(14, 'fixture_enemy');
        untilFighting(hero);

        Orders.orderAt('hero_1', C(14));
        run(2000);

        expect(BoardCombat.getFight(idAt(10))).toBeNull();
        expect(BoardCombat.getFight(idAt(14))?.assignedHeroId).toBe('hero_1');
        expect(hero.status).toBe('combat');
    });

    it('the board changing under a fight (Region travel) leaves the hero idle', () => {
        const hero = GameState.state.heroes[0];
        place(10, 'fixture_enemy', 'hero_1');
        untilFighting(hero);

        EventBus.publish(ENGINE_EVENTS.BOARD_SWAPPED, {});

        expect(BoardCombat.getFight(idAt(10))).toBeNull();
        expect(hero.status).toBe('idle');
    });

    it('never touches a wounded hero, nor a working one', () => {
        const [a, b] = GameState.state.heroes;
        a.status = 'wounded';
        b.status = 'working';
        BoardCombat.clearAll();
        expect(a.status).toBe('wounded');
        expect(b.status).toBe('working');
    });
});

describe('A win and a knock-out keep their own statuses', () => {
    it('a win leaves the hero idle', () => {
        const hero = GameState.state.heroes[0];
        const victories = [];
        const unsub = EventBus.subscribe('combat_victory', p => victories.push(p));
        place(10, 'fixture_enemy', 'hero_1');
        for (let t = 0; t < 60000 && !victories.length; t += 100) BoardRunner.tick(100);
        unsub();

        expect(victories.length).toBeGreaterThan(0);
        expect(hero.status).toBe('idle');
    });

    it('a knock-out stays wounded', () => {
        const weak = makeHero('hero_weak', { level: 1, hp: 1 });
        GameState.state.heroes.push(weak);
        place(10, 'fixture_enemy', 'hero_weak');
        run(30000);

        expect(weak.status).toBe('wounded');
        expect(BoardCombat.getFight(idAt(10))).toBeNull();
    });
});

describe('A save from before the fix', () => {
    it('a hero saved as fighting, with no fight (fights are never saved), loads idle', () => {
        const hero = GameState.state.heroes[0];
        hero.status = 'combat';
        hero.hp.current = 2;

        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: null });

        expect(hero.status).toBe('idle');
        RegenSystem.tick(60000);
        expect(hero.hp.current).toBeGreaterThan(2);
    });
});

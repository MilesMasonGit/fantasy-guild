import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
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
import { tokenStartingUses, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles.
 * A lattice of mat points 160 u apart — the step the old board had — so spots
 * 10 and 11 are 160 u apart and therefore neighbours at the shipped 164 u Near,
 * which is what the nearby-support case below depends on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

/** What ran dry on spot `i`, or null. */

registerTokenTypes({
    /** A level 1 enemy at a quarter of the budget: weak enough for a fresh Recruit to beat. */
    fixture_enemy_weak: {
        id: 'fixture_enemy_weak', name: 'Fixture Weak Enemy', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 20, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.25 },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0,
            inputs: [],
            outputs: [{ itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 }]
        }
    }
});

/**
 * Combat on the board — **ported, not rebuilt**.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A hero strong enough to win, or weak enough to lose.
 *
 * ⚠️ **`generateHero` makes a Recruit**, who fights only as a level 1 fighter.
 * Every hero in this suite is therefore given a combat skill by hand.
 */
function makeHero(id, { level = 50, hp = 100, style = 'melee' } = {}) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: 100 };
    hero.skills[style] = { level, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = level; });
    return hero;
}

/** A hero who has NOT been promoted: no combat skill, so they fight as a level 1 fighter. */
function makeRecruit(id, { hp = 100 } = {}) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: 100 };
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

// start Flags' subscribers, as the game does. Today a defeat furls the flag by
// a direct call from BoardCombat's cycle cut moves that onto an event Flags
// subscribes to, and this suite asserts the furl (the Defeat case). Started
// here first, green before the cut, so the cut is not mistaken for a
// regression. Once per file: the EventBus is a singleton.
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
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

describe('Enemies are inert until targeted (D-14)', () => {
    it('an enemy Token with no hero does nothing at all', () => {
        const bear = place(10, 'fixture_enemy');
        run(20000);

        expect(BoardCombat.getFight(idAt(10))).toBeNull();
        expect(bear.usesRemaining).toBe(tokenStartingUses('fixture_enemy'));
    });

    it('raises no alert when unstaffed — same rule as any other Token (D-149)', () => {
        const bear = place(10, 'fixture_enemy');
        run(5000);
        expect(bear.alert).toBeFalsy();
    });

    it('starts fighting the moment a hero is placed on it', () => {
        place(10, 'fixture_enemy');
        run(5000);
        Placement.plantFlagAt('hero_1', C(10));
        run(1000);

        expect(BoardCombat.getFight(idAt(10))).not.toBeNull();
    });
});

describe('Everyone fights: a Recruit fights as a level 1 fighter', () => {
    beforeEach(() => {
        GameState.state.heroes = [makeRecruit('recruit_1'), makeHero('fighter_1')];
    });

    /** A real new Recruit, HP as generated, not the suite's padded 100. */
    function freshRecruit(id) {
        const hero = generateHero({ name: id });
        hero.id = id;
        hero.status = 'idle';
        return hero;
    }

    it('a Recruit on an enemy starts a fight', () => {
        place(10, 'fixture_enemy', 'recruit_1');
        run(1000);

        expect(BoardCombat.getFight(idAt(10))).not.toBeNull();
        expect(BoardState.workerOf(idAt(10))).toBe('recruit_1');
        expect(Flags.skipsOf(idAt(10))).toEqual([]);
    });

    it('a fresh Recruit beats a weak enemy, the loot is paid, and no combat XP is awarded', () => {
        const recruit = freshRecruit('recruit_new');
        GameState.state.heroes = [recruit];
        const skillsBefore = JSON.stringify(recruit.skills);
        const victories = [];
        const unsub = EventBus.subscribe('combat_victory', p => victories.push(p));

        const enemy = place(10, 'fixture_enemy_weak', 'recruit_new');
        // Until the first kill: a fresh Recruit wins one with most of their HP left.
        for (let t = 0; t < 60000 && !victories.length; t += 100) BoardRunner.tick(100);
        run(3000);
        unsub();

        expect(recruit.status).not.toBe('wounded');
        expect(victories.length).toBeGreaterThan(0);
        expect(enemy.usesRemaining).toBeLessThan(tokenStartingUses('fixture_enemy_weak'));
        // The kill's loot lands on the board as for anyone.
        expect(SpriteLayer.countOnBoard('item_blackberry')).toBeGreaterThan(0);
        // No combat skill appeared and no skill gained XP from the fights.
        expect(JSON.stringify(recruit.skills)).toBe(skillsBefore);
    });

    it('promoting the Recruit keeps the same hero fighting, now on the real skill', () => {
        place(10, 'fixture_enemy', 'recruit_1');
        run(1000);
        expect(BoardCombat.getFight(idAt(10))).not.toBeNull();

        // What a first promotion does: grant one combat skill.
        GameState.state.heroes.find(h => h.id === 'recruit_1')
            .skills.melee = { level: 20, xp: 0 };
        run(1000);

        expect(BoardCombat.getFight(idAt(10))).not.toBeNull();
    });
});

/** Every board event of the killing tick, in order, as published on. */
const KILLING_TICK_EVENTS = [
    'board:sprites_changed',
    'board:progress',
    'board:token_charges_changed',
    'board:cycle_complete',
    'board:combat_resolved',
    'board:tile_event_alert',
    'board:token_depleted',
    'board:tile_changed',
    'board:hero_moved',
    'board:adjacency_dirty'
];

describe('A kill', () => {
    /**
     * ⚠️ THE SAFETY NET for the card-system retirement.
     */
    it('is won by a capable hero, and drops loot ON THE BOARD (D-40)', () => {
        place(10, 'fixture_enemy', 'hero_1');
        run(60000);

        // Loot lands where the kill happened rather than teleporting to the
        // Bank — kills must not be the one thing that skips the sprite layer.
        expect(SpriteLayer.getSprites().length).toBeGreaterThan(0);
        expect(InventoryManager.getItemCount('item_blackberry')).toBe(0);
    });

    it('spends one charge — enemy Tokens deplete like anything else (D-104)', () => {
        const bear = place(10, 'fixture_enemy', 'hero_1', 20);
        run(60000);
        expect(bear.usesRemaining).toBeLessThan(20);
    });

    it('counts as ONE CYCLE for the rest of the board (D-129)', () => {
        // The single unit that connects combat to everything else.
        const seen = [];
        const unsub = EventBus.subscribe('board:cycle_complete', p => seen.push(p));

        place(10, 'fixture_enemy', 'hero_1');
        run(60000);
        unsub();

        expect(seen.length).toBeGreaterThan(0);
        expect(seen[0].instanceId).toBe(idAt(10));
    });

    it('wears nearby support per kill, exactly as a craft would (D-126)', () => {
        // A Weapon Rack burns down as it is used. Combat is not exempt from the
        // economy just because it runs on a different engine.
        place(10, 'fixture_enemy', 'hero_1');
        const rack = place(11, 'fixture_buff_yield', null, 10);

        run(60000);

        expect(rack.usesRemaining).toBeLessThan(10);
    });

    it('the killing tick names the enemy as depleted and changed, in a pinned order (CR3-250)', () => {
        const bear = place(10, 'fixture_enemy', 'hero_1', 1);
        const published = [];
        const original = EventBus.publish;
        EventBus.publish = function (name, payload) {
            if (String(name).startsWith('board:')) published.push({ name, payload });
            return original.call(this, name, payload);
        };
        let killing = null;
        try {
            for (let t = 0; t < 60000 && tokenAt(10); t += 100) {
                published.length = 0;
                BoardRunner.tick(100);
                if (!tokenAt(10)) killing = [...published];
            }
        } finally {
            EventBus.publish = original;
        }
        expect(killing, 'the enemy was never killed').not.toBeNull();

        const depleted = killing.filter(e => e.name === BOARD_EVENTS.TOKEN_DEPLETED && e.payload?.instanceId === bear.id);
        expect(depleted).toHaveLength(1);
        expect(depleted[0].payload.typeId).toBe('fixture_enemy');
        const changed = killing.filter(e => e.name === BOARD_EVENTS.TILE_CHANGED && e.payload?.instanceId === bear.id);
        expect(changed.map(e => e.payload.typeId)).toContain(null);

        // The whole board-event sequence of that tick, as it is today.
        expect(killing.map(e => e.name)).toEqual(KILLING_TICK_EVENTS);
    });

    it('a kill leaves a nearby producer\'s buffed yield exactly as it was (CR3-250)', () => {
        place(10, 'fixture_enemy', 'hero_1', 1);
        place(11, 'fixture_buff_yield', null, 10);                 // Near the enemy
        const producer = place(17, 'fixture_producer');            // Near the buff
        TileModifiers.rebuildAll();
        const yieldOf = () => TileModifiers.resolveAxis(producer.id, EFFECT_TYPES.YIELD, 100);
        const before = yieldOf();
        expect(before).toBeGreaterThan(100);

        run(60000);
        expect(tokenAt(10)).toBeNull();
        expect(yieldOf()).toBeCloseTo(before);
    });

    it('a depleted enemy Token disappears, leaving its hero standing there', () => {
        const bear = place(10, 'fixture_enemy', 'hero_1', 1);
        run(60000);

        expect(tokenAt(10)).toBeNull();
        // Exactly what a spent Forest does. Enemies are not a special case —
        // including in what they leave behind: the hero's flag stays planted
        // there (Free Playmat 1.4b).
        expect(BoardState.displayPointOf('hero_1')).toEqual(C(10));
        expect(BoardState.flagOf('hero_1')).not.toBeNull();
        // Nothing is owed the spot: Managers and vacancies are retired (9.2).
        expect(GameState.state.board.vacancies).toBeUndefined();
    });
});

describe('Retreat is just unassigning the hero (G-3, G-4)', () => {
    it('ends the fight immediately', () => {
        place(10, 'fixture_enemy', 'hero_1');
        run(3000);
        expect(BoardCombat.getFight(idAt(10))).not.toBeNull();

        Placement.recallHeroById('hero_1');
        run(100);

        expect(BoardCombat.getFight(idAt(10))).toBeNull();
    });

    it('⚠️ returns the enemy to FULL HP — retreat has a real cost', () => {
        // This is what gives §8.1's "watch your first few fights" any weight.
        // Without it a player could chip any enemy down across free attempts.
        place(10, 'fixture_enemy', 'hero_1');

        // ⚠️ Sample every tick and keep the LOWEST HP seen, rather than
        // checking once after a fixed window. Two things make the naive version
        // unreliable, and they pull in opposite directions: damage is rolled,
        // so a short window sometimes lands no hit at all; but a kill triggers
        // an intermission that restores the enemy to full, so a long window can
        // miss the damage by arriving after the reset. Tracking the minimum
        // catches the damaged state either way.
        run(100);                       // one tick, so the fight exists to read
        const max = BoardCombat.getFight(idAt(10)).combat.enemyHp.max;
        let lowest = BoardCombat.getFight(idAt(10)).combat.enemyHp.current;
        for (let elapsed = 0; elapsed < 20000 && lowest === max; elapsed += 100) {
            run(100);
            lowest = Math.min(lowest, BoardCombat.getFight(idAt(10)).combat.enemyHp.current);
        }
        expect(lowest).toBeLessThan(max);

        Placement.recallHeroById('hero_1');
        run(100);
        Placement.plantFlagAt('hero_1', C(10));
        run(100);

        const fresh = BoardCombat.getFight(idAt(10)).combat.enemyHp;
        expect(fresh.current).toBe(fresh.max);
    });

    it('a DIFFERENT hero arriving also starts a fresh fight', () => {
        place(10, 'fixture_enemy', 'hero_1');
        run(4000);

        // One hero per Token: hero_2 only gets the enemy once hero_1's flag is
        // taken down (Free Playmat 1.4b).
        Placement.recallHeroById('hero_1');
        Placement.plantFlagAt('hero_2', C(10));
        run(100);

        const fight = BoardCombat.getFight(idAt(10));
        expect(fight.assignedHeroId).toBe('hero_2');
        expect(fight.combat.enemyHp.current).toBe(fight.combat.enemyHp.max);
    });
});

describe('Defeat costs equipment (D-74)', () => {
    it('wounds the hero and takes them off the board', () => {
        const weakling = makeHero('hero_weak', { level: 1, hp: 1 });
        GameState.state.heroes = [weakling];

        place(10, 'fixture_enemy', 'hero_weak');
        run(30000);

        expect(weakling.status).toBe('wounded');
        expect(BoardState.workerOf(idAt(10))).toBeNull();
        expect(BoardState.flagOf('hero_weak')).toBeNull();
    });

    it('leaves the enemy Token in place, ready for someone else', () => {
        // Recovery is tracked on the HERO, never on the tile — so the tile is
        // immediately free, and the interesting decision is whether to send
        // someone else right now.
        const weakling = makeHero('hero_weak', { level: 1, hp: 1 });
        GameState.state.heroes = [weakling];

        place(10, 'fixture_enemy', 'hero_weak');
        run(30000);

        expect(tokenAt(10)?.typeId).toBe('fixture_enemy');
    });

    it('a wounded hero cannot simply be put back to keep fighting', () => {
        const weakling = makeHero('hero_weak', { level: 1, hp: 1 });
        GameState.state.heroes = [weakling];
        place(10, 'fixture_enemy', 'hero_weak');
        run(30000);

        // They are wounded; WoundedSystem owns their recovery timer.
        expect(weakling.status).toBe('wounded');
        expect(weakling.hp.current).toBeLessThanOrEqual(0);
    });
});

describe('Regen stops in a fight', () => {
    it('a fighting hero heals only by eating; withdrawn, they regenerate again', () => {
        // Mid-fight only food heals (the combat detail pass), so withdrawing is what
        // turns a losing hero's HP back upward.
        const hero = GameState.state.heroes[0];
        hero.status = 'combat';
        hero.hp.current = 50;

        RegenSystem.tick(60000);
        expect(hero.hp.current).toBe(50);

        hero.status = 'idle';
        RegenSystem.tick(60000);
        expect(hero.hp.current).toBeGreaterThan(50);
    });
});

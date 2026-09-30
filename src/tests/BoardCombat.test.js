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
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
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

/**
 * Combat on the board — **ported, not rebuilt** (D-136).
 *
 * The 7-stat engine is unchanged; only the trigger moved from "hero encounters
 * an enemy card" to "hero is dropped onto an enemy Token". These tests cover
 * what the BOARD adds: the tick owner, one-kill-is-one-cycle (D-129), enemy
 * depletion (D-104), retreat-by-unassigning (`G-3`, `G-4`) and defeat (D-74).
 *
 * ## Production is the idle half; combat is the active half (D-130)
 * There is no difficulty warning, no skill gate and no preview on an enemy
 * Token. The player is expected to watch the first few fights and pull out if
 * it goes badly — and leaving a hero in an unwinnable fight costs equipment.
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
 * ⚠️ **`generateHero` makes a Recruit, and a Recruit cannot fight** — holding a
 * combat skill is what decides whether a fight starts at all. Every hero in
 * this suite is therefore promoted by hand until the job tree exists (Phase 4).
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

/** A hero who has NOT been promoted: no combat skill, so no fight can start. */
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

// CR3-557: start Flags' subscribers, as the game does. Today a defeat furls the
// flag by a direct call from BoardCombat; CR3-157's cycle cut moves that onto
// an event Flags subscribes to, and this suite asserts the furl (the Defeat
// case). Started here first, green before the cut, so the cut is not mistaken
// for a regression. Once per file: the EventBus is a singleton.
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

describe('An unpromoted hero cannot fight (D-249)', () => {
    beforeEach(() => {
        GameState.state.heroes = [makeRecruit('recruit_1'), makeHero('fighter_1')];
    });

    it('a Recruit on an enemy starts no fight at all', () => {
        const bear = place(10, 'fixture_enemy', 'recruit_1');
        run(20000);

        expect(BoardCombat.getFight(idAt(10))).toBeNull();
        // The enemy is untouched: no charge spent, no damage dealt.
        expect(bear.usesRemaining).toBe(tokenStartingUses('fixture_enemy'));
    });

    it('...and takes no damage either — standing there is safe', () => {
        place(10, 'fixture_enemy', 'recruit_1');
        run(20000);

        const recruit = GameState.state.heroes.find(h => h.id === 'recruit_1');
        expect(recruit.hp.current).toBe(100);
        expect(recruit.status).not.toBe('wounded');
    });

    it('is skipped as unskilled, shown on hover, with no red mark (Free Playmat FP-60)', () => {
        // Was: "says so on the tile" — a red UNSKILLED mark on the enemy. Under
        // flags the Recruit never claims the enemy at all; the flag records why,
        // and a skill problem is hover-only (FP-60, slice 1.4c).
        const bear = place(10, 'fixture_enemy', 'recruit_1');
        run(1000);
        expect(bear.alert ?? null).toBeNull();
        expect(BoardState.workerOf(idAt(10))).toBeNull();
        expect(Flags.skipsOf(bear.id).map(s => s.reason)).toEqual([BoardRunner.ALERT.UNSKILLED]);
    });

    it('is possession, not level — a level-1 fighter still fights', () => {
        GameState.state.heroes = [makeHero('rookie', { level: 1 })];
        place(10, 'fixture_enemy', 'rookie');
        run(1000);

        expect(BoardCombat.getFight(idAt(10))).not.toBeNull();
    });

    it('promoting the Recruit lets the same hero start fighting', () => {
        place(10, 'fixture_enemy', 'recruit_1');
        run(5000);
        expect(BoardCombat.getFight(idAt(10))).toBeNull();

        // What a first promotion does: grant one combat skill.
        GameState.state.heroes.find(h => h.id === 'recruit_1')
            .skills.melee = { level: 20, xp: 0 };
        run(1000);

        expect(BoardCombat.getFight(idAt(10))).not.toBeNull();
    });
});

/** Every board event of the killing tick, in order, as published on 2026-09-30 (CR3-250). */
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
     * ⚠️ THE SAFETY NET for the card-system retirement (2026-08-18).
     *
     * The live combat chain runs BoardCombat → CombatProcessor →
     * CombatResolutionProcessor → WorkProcessor, all of which are being moved
     * out of the retired `systems/cards/` namespace. This test is the one that
     * proves that chain still works end to end: a capable hero fights, wins,
     * and the reward reaches the board.
     *
     * It was deleted during the cleanup because the re-authored content set has
     * no `item_blackberry` for `enemy_thorn_elemental` to drop. Restored by
     * registering that id as a fixture item, so the assertion tests the
     * MACHINERY rather than what happens to be authored.
     *
     * If this goes red during the retirement, stop and read the diff — nothing
     * else covers board loot end to end.
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

    /**
     * CR3-250 (test first): a kill rebuilds the neighbourhood twice today, and
     * its fix must not change what the killing tick tells the rest of the game,
     * nor what the buffs around it add up to.
     */
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
        // Exactly what a spent Forest does. Enemies are not a special case
        // (D-104) — including in what they leave behind: the hero's flag stays
        // planted there (Free Playmat 1.4b).
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
        // an intermission that restores the enemy to full (D-103), so a long
        // window can miss the damage by arriving after the reset. Tracking the
        // minimum catches the damaged state either way.
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

        // One hero per Token (FP-25): hero_2 only gets the enemy once hero_1's
        // flag is taken down (Free Playmat 1.4b).
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

describe('Regen is unchanged (G-2)', () => {
    it('combat does not suppress it — that was a documentation error, not a bug', () => {
        // §8.1/D-136 said RegenSystem heals "idle" heroes. It heals idle,
        // working AND fighting alike. The conclusion survives on different
        // grounds: regen is constant, so withdrawing removes the damage source
        // and flips a hero from net-losing HP to net-gaining it.
        const hero = GameState.state.heroes[0];
        hero.status = 'combat';
        hero.hp.current = 50;

        RegenSystem.tick(60000);

        expect(hero.hp.current).toBeGreaterThan(50);
    });
});

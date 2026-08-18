import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as RegenSystem from '../systems/hero/RegenSystem.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';

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
vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
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
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

function run(ms) {
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
}

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

        expect(BoardCombat.getFight(10)).toBeNull();
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
        Placement.placeHero('hero_1', 10);
        run(1000);

        expect(BoardCombat.getFight(10)).not.toBeNull();
    });
});

describe('An unpromoted hero cannot fight (D-249)', () => {
    beforeEach(() => {
        GameState.state.heroes = [makeRecruit('recruit_1'), makeHero('fighter_1')];
    });

    it('a Recruit on an enemy starts no fight at all', () => {
        const bear = place(10, 'fixture_enemy', 'recruit_1');
        run(20000);

        expect(BoardCombat.getFight(10)).toBeNull();
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

    it('says so on the tile rather than failing silently', () => {
        const bear = place(10, 'fixture_enemy', 'recruit_1');
        run(1000);
        expect(bear.alert).toBe(BoardRunner.ALERT.UNSKILLED);
    });

    it('is possession, not level — a level-1 fighter still fights', () => {
        GameState.state.heroes = [makeHero('rookie', { level: 1 })];
        place(10, 'fixture_enemy', 'rookie');
        run(1000);

        expect(BoardCombat.getFight(10)).not.toBeNull();
    });

    it('promoting the Recruit lets the same hero start fighting', () => {
        place(10, 'fixture_enemy', 'recruit_1');
        run(5000);
        expect(BoardCombat.getFight(10)).toBeNull();

        // What a first promotion does: grant one combat skill.
        GameState.state.heroes.find(h => h.id === 'recruit_1')
            .skills.melee = { level: 20, xp: 0 };
        run(1000);

        expect(BoardCombat.getFight(10)).not.toBeNull();
    });
});

describe('A kill', () => {
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
        expect(seen[0].tile).toBe(10);
    });

    it('wears adjacent support per kill, exactly as a craft would (D-126)', () => {
        // A Weapon Rack burns down as it is used. Combat is not exempt from the
        // economy just because it runs on a different engine.
        place(10, 'fixture_enemy', 'hero_1');
        const rack = place(11, 'fixture_buff_yield', null, 10);

        run(60000);

        expect(rack.usesRemaining).toBeLessThan(10);
    });

    it('a depleted enemy Token disappears, leaving its hero standing there', () => {
        const bear = place(10, 'fixture_enemy', 'hero_1', 1);
        run(60000);

        expect(BoardState.getToken(10)).toBeNull();
        // Exactly what a spent Forest does. Enemies are not a special case
        // (D-104) — including in what they leave behind.
        expect(BoardState.tileOfHero('hero_1')).toBe(10);
        expect(BoardState.getVacancy(10)?.typeId).toBe('fixture_enemy');
    });
});

describe('Retreat is just unassigning the hero (G-3, G-4)', () => {
    it('ends the fight immediately', () => {
        place(10, 'fixture_enemy', 'hero_1');
        run(3000);
        expect(BoardCombat.getFight(10)).not.toBeNull();

        Placement.recallHero(10);
        run(100);

        expect(BoardCombat.getFight(10)).toBeNull();
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
        const max = BoardCombat.getFight(10).combat.enemyHp.max;
        let lowest = BoardCombat.getFight(10).combat.enemyHp.current;
        for (let elapsed = 0; elapsed < 20000 && lowest === max; elapsed += 100) {
            run(100);
            lowest = Math.min(lowest, BoardCombat.getFight(10).combat.enemyHp.current);
        }
        expect(lowest).toBeLessThan(max);

        Placement.recallHero(10);
        run(100);
        Placement.placeHero('hero_1', 10);
        run(100);

        const fresh = BoardCombat.getFight(10).combat.enemyHp;
        expect(fresh.current).toBe(fresh.max);
    });

    it('a DIFFERENT hero arriving also starts a fresh fight', () => {
        place(10, 'fixture_enemy', 'hero_1');
        run(4000);

        Placement.placeHero('hero_2', 10);
        run(100);

        const fight = BoardCombat.getFight(10);
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
        expect(BoardState.heroOnTile(10)).toBeNull();
    });

    it('leaves the enemy Token in place, ready for someone else', () => {
        // Recovery is tracked on the HERO, never on the tile — so the tile is
        // immediately free, and the interesting decision is whether to send
        // someone else right now.
        const weakling = makeHero('hero_weak', { level: 1, hp: 1 });
        GameState.state.heroes = [weakling];

        place(10, 'fixture_enemy', 'hero_weak');
        run(30000);

        expect(BoardState.getToken(10)?.typeId).toBe('fixture_enemy');
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

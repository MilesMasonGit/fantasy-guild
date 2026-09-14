import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Managers from '../systems/board/Managers.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tileCentre } from '../config/boardGeometry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { getPromotionCost, getPromotionGateSkills } from '../config/registries/jobRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Flags choose the work (Free Playmat slice 1.4b).
 *
 * Board geometry for reading these: 6×6, one tile step is 160 u, so a
 * neighbour is 160 u away, a diagonal 226, two steps 320, three steps 480.
 * The default flag radius is 400 (FP-65).
 */

registerTokenTypes({
    /** A worked Token with a blank skill — FP-47's case. */
    ft_blank: {
        id: 'ft_blank', name: 'Blank Bush', uses: 100, requiresHero: true,
        config: { skill: '', skillRequired: 1, cycleTimeMs: 12000, inputs: [], outputs: [] }
    },
    /**
     * A logging Token that needs coal — stuck for a fixable reason. Coal, not
     * wood: the fixture Forests drop wood on the floor, which would feed it.
     */
    ft_hungry: {
        id: 'ft_hungry', name: 'Hungry Mill', uses: 100, requiresHero: true,
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [{ itemId: 'item_coal', quantity: 2 }],
            outputs: [{ itemId: 'item_glowcap', quantity: 1, chance: 100 }]
        }
    }
});

const C = (tile) => tileCentre(tile);

function hero(id, skills = { logging: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeToken(tile, instance);
    return BoardState.getToken(tile);
}

const plant = (heroId, tile, skill = 'logging') => Flags.plant(heroId, C(tile), { skill });
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const reasons = (instance) => Flags.skipsOf(instance.id).map(s => s.reason);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('h1'), hero('h2'), hero('h3')];
    GameState.state.inventory.maxSlots = 50;
});

describe('choosing — nearest first (FP-57)', () => {
    it('claims the nearest Token to the flag point', () => {
        put(16, 'fixture_producer');      // 320 u
        put(21, 'fixture_producer');      // 226 u (diagonal)
        put(15, 'fixture_producer');      // 160 u
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(15);
    });

    it('breaks a distance tie on the lower anchor', () => {
        put(15, 'fixture_producer');
        put(13, 'fixture_producer');
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(13);
    });
});

describe('the flag radius (FP-23, FP-65)', () => {
    it('ignores a Token 480 u away at 400, and claims it once the radius is 500', () => {
        put(3, 'fixture_producer');       // three steps from tile 0
        plant('h1', 0);
        expect(BoardState.workTileOf('h1')).toBeNull();

        setMatTuning('flagRadius', 500);  // the Mat Tuner marks flags dirty
        Flags.assign(0);

        expect(BoardState.workTileOf('h1')).toBe(3);
    });
});

describe('skill (FP-23, FP-47)', () => {
    it('works only its own skill, and skips a blank-skill Token as no_skill', () => {
        const blank = put(15, 'ft_blank');                 // nearest
        const mine = put(13, 'fixture_producer_alt');      // mining, just as near
        put(16, 'fixture_producer');                       // logging, further

        plant('h1', 14, 'logging');

        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(Flags.skipsOf(blank.id)).toEqual([{ heroId: 'h1', reason: Flags.SKIP.NO_SKILL }]);
        expect(Flags.skipsOf(mine.id)).toEqual([]);        // another skill is not a candidate at all
    });
});

describe('what a flag never chooses by itself', () => {
    it('passes over passive Tokens, enemies and Promotion Tokens in range', () => {
        put(15, 'fixture_passive');
        put(13, 'fixture_enemy');
        put(20, 'fixture_promotion');
        put(16, 'fixture_producer');

        plant('h1', 14);

        expect(BoardState.workTileOf('h1')).toBe(16);
    });

    it('works a Promotion Token only when the flag point is on it (FP-61)', () => {
        // A hero the Token could promote: an unqualified one is now skipped
        // (PR-8, Free Playmat 1.4c), which is not what this test is about.
        const cost = getPromotionCost('fighter');
        for (const skill of getPromotionGateSkills('fighter')) {
            GameState.state.heroes[0].skills[skill] = { level: cost.skillLevel, xp: 0 };
        }
        put(20, 'fixture_promotion');
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBeNull();

        plant('h1', 20);
        expect(BoardState.workTileOf('h1')).toBe(20);
    });
});

describe('one hero per Token (FP-25)', () => {
    it('a second flag skips a claimed Token as claimed', () => {
        const forest = put(15, 'fixture_producer');
        plant('h1', 14);
        plant('h2', 14);

        expect(BoardState.workTileOf('h1')).toBe(15);
        expect(BoardState.workTileOf('h2')).toBeNull();
        expect(Flags.skipsOf(forest.id)).toEqual([{ heroId: 'h2', reason: Flags.SKIP.CLAIMED }]);
    });
});

describe('planting order, and claims are sticky', () => {
    it('earlier-planted flags choose first, and keep their Token when a nearer one arrives', () => {
        put(15, 'fixture_producer');
        put(16, 'fixture_producer');
        // Written straight to storage so both choose in the same pass.
        BoardState.setFlag('h1', { ...C(14), skill: 'logging', plantedAt: 5 });
        BoardState.setFlag('h2', { ...C(14), skill: 'logging', plantedAt: 2 });
        Flags.markDirty();
        Flags.assign(0);

        expect(BoardState.workTileOf('h2')).toBe(15);
        expect(BoardState.workTileOf('h1')).toBe(16);

        put(14, 'fixture_producer');     // right under both flags
        Flags.markDirty();
        Flags.assign(0);

        expect(BoardState.workTileOf('h2')).toBe(15);
        expect(BoardState.workTileOf('h1')).toBe(16);
    });
});

describe('skipping what cannot run (FP-48, FP-49, FP-60)', () => {
    it('skips a Token the hero is too low for, works the next, and leaves no red mark', () => {
        GameState.state.heroes = [hero('h1', { mining: 5 })];
        const gated = put(15, 'fixture_gated');            // wants mining 25
        put(16, 'fixture_producer_alt');

        plant('h1', 15, 'mining');                         // dropped right on it
        run(2000);

        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(reasons(gated)).toEqual([ALERT.ACCESS]);
        expect(gated.alert ?? null).toBeNull();
    });
});

describe('⭐ leaving resets progress; a moved Token keeps it (FP-68)', () => {
    it('a claimed Token moved 3 steps out of range keeps its hero and its progress', () => {
        const forest = put(14, 'fixture_producer');
        plant('h1', 14);
        run(5000);
        const progress = forest.cycleElapsedMs;
        expect(progress).toBeGreaterThan(0);

        Placement.moveToken(14, 17);                       // 480 u from the flag
        run(100);

        expect(BoardState.workTileOf('h1')).toBe(17);
        expect(forest.cycleElapsedMs).toBeGreaterThanOrEqual(progress);
    });

    it('a re-plant zeroes the Token left behind', () => {
        const forest = put(14, 'fixture_producer');
        plant('h1', 14);
        run(5000);
        plant('h1', 0);
        expect(forest.cycleElapsedMs).toBe(0);
    });

    it('a recall zeroes it', () => {
        const forest = put(14, 'fixture_producer');
        plant('h1', 14);
        run(5000);
        Placement.recallHeroById('h1');
        expect(forest.cycleElapsedMs).toBe(0);
    });

    it('moving on by themselves zeroes it', () => {
        const forest = put(14, 'fixture_producer');
        plant('h1', 14);
        run(5000);
        GameState.state.heroes[0].skills.logging.level = 0;  // now below skillRequired 1
        run(300);

        expect(BoardState.workTileOf('h1')).toBeNull();
        expect(forest.cycleElapsedMs).toBe(0);
    });
});

describe('fixable problems (FP-69, FPP-1, FPP-2, FPP-5)', () => {
    it('one warning for passing a Token out of materials, even when the hero passes it again, and it keeps its red mark', () => {
        const hungry = put(14, 'ft_hungry');
        put(15, 'fixture_producer', 1);    // 160 u, runs dry after one cycle...
        put(16, 'fixture_producer');       // 320 u, so the flag chooses again and passes the mill a second time

        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(15);
        run(15000);                        // 150 ticks, one cycle (~9.6s) and a re-choose

        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
        expect(hungry.alert).toBe(ALERT.INPUTS);
    });

    it('a claimed Token that runs out keeps its hero until something else can run, then they go', () => {
        InventoryManager.addItem('item_coal', 10);
        const hungry = put(14, 'ft_hungry');
        plant('h1', 14);
        run(1000);
        expect(BoardState.workTileOf('h1')).toBe(14);

        InventoryManager.removeItem('item_coal', 10);
        run(3000);
        expect(BoardState.workTileOf('h1')).toBe(14);
        expect(hungry.alert).toBe(ALERT.INPUTS);
        expect(NotificationSystem.warning).not.toHaveBeenCalled();

        put(16, 'fixture_producer');
        run(1500);

        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
        expect(hungry.cycleElapsedMs).toBe(0);
        expect(hungry.alert).toBe(ALERT.INPUTS);
    });
});

describe('⭐ waiting for a Manager (FP-70, FPP-9)', () => {
    function dryForest({ copy = true, other = false } = {}) {
        put(15, 'fixture_manager');
        const first = put(14, 'fixture_producer', 1);
        if (copy) TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        if (other) put(20, 'fixture_producer');
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(14);
        Charges.destroyToken(14, first, { heroId: 'h1' });
        Flags.assign(0);
        return first;
    }

    it('waits on the spot, then claims the restocked Token — a different instance, from zero', () => {
        const first = dryForest();

        expect(BoardState.waitOfHero('h1')).toEqual({ tile: 14, typeId: 'fixture_producer' });
        expect(BoardRunner.isHeroIdle('h1')).toBe(false);

        Managers.sweep();
        Flags.assign(0);

        const restocked = BoardState.getToken(14);
        expect(BoardState.workTileOf('h1')).toBe(14);
        expect(restocked.id).not.toBe(first.id);
        expect(restocked.cycleElapsedMs).toBe(0);
    });

    it('moves on when the Vault has no copy', () => {
        dryForest({ copy: false, other: true });
        expect(BoardState.waitOfHero('h1')).toBeNull();
        expect(BoardState.workTileOf('h1')).toBe(20);
    });

    it('moves on when the Manager is taken away', () => {
        dryForest({ other: true });
        expect(BoardState.waitOfHero('h1')).not.toBeNull();

        Placement.returnTokenToTray(15);
        Flags.assign(0);

        expect(BoardState.waitOfHero('h1')).toBeNull();
        expect(BoardState.workTileOf('h1')).toBe(20);
    });

    it('a waiting hero gets the restock before an earlier-planted hero looking for work', () => {
        put(15, 'fixture_manager');
        const first = put(14, 'fixture_producer', 1);
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        plant('h1', 14);
        BoardState.setFlag('h2', { ...C(14), skill: 'logging', plantedAt: -1 });

        Charges.destroyToken(14, first, { heroId: 'h1' });
        Flags.markDirty();
        Flags.assign(0);
        Managers.sweep();
        Flags.markDirty();
        Flags.assign(0);

        expect(BoardState.workTileOf('h1')).toBe(14);
        expect(BoardState.workTileOf('h2')).toBeNull();
    });
});

describe('the bridge: dropping a hero plants their flag (until slice 1.5)', () => {
    it('dropped on an enemy, the flag is a combat flag and fights it', () => {
        // Holds a combat skill: a hero who cannot fight is skipped as unskilled
        // (FP-60, Free Playmat 1.4c).
        GameState.state.heroes = [hero('h1', { logging: 50, melee: 30 })];
        put(14, 'fixture_enemy');
        Placement.placeHero('h1', 14);
        expect(BoardState.flagOf('h1').skill).toBe(Flags.COMBAT_FLAG);
        expect(BoardState.workerOf(14)).toBe('h1');
    });

    it('dropped on a Token whose skill the hero lacks, the flag keeps the hero’s own skill (FPP-3)', () => {
        GameState.state.heroes = [hero('h1', { mining: 30 })];
        put(14, 'fixture_producer');
        Placement.placeHero('h1', 14);
        expect(BoardState.flagOf('h1').skill).toBe('mining');
        expect(BoardState.workerOf(14)).toBeNull();
    });
});

describe('⭐ no rebuild storms', () => {
    it('publishes zero HERO_MOVED over 100 stable ticks', () => {
        put(0, 'fixture_producer');
        put(35, 'fixture_producer');
        plant('h1', 0);
        plant('h2', 35);
        plant('h3', 18);          // nothing within 400 u: idle, retrying every second

        let moved = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, () => { moved++; });
        try { run(10000); } finally { off?.(); }

        expect(moved).toBe(0);
    });
});

describe('an old save converts (FP-59, FPP-7)', () => {
    it('turns heroTiles into flags at the Token centre, with no version bump', () => {
        const migrated = migrateState({
            meta: { version: GAME_VERSION },
            board: {
                tiles: {
                    9: { typeId: 'fixture_producer', usesRemaining: 10, cycleElapsedMs: 0 },
                    20: { typeId: 'fixture_enemy', usesRemaining: 5, cycleElapsedMs: 0 }
                },
                heroTiles: { h1: 9, h2: 20, h3: 4 }
            },
            heroes: [hero('h1'), hero('h2'), hero('h3')]
        }, GAME_VERSION);

        const b = migrated.board;
        expect(b.heroTiles).toBeUndefined();
        expect(b.flags.h1).toEqual({ ...C(9), skill: 'logging', plantedAt: 0 });
        expect(b.flags.h2).toEqual({ ...C(20), skill: 'combat', plantedAt: 1 });
        expect(b.flags.h3).toEqual({ ...C(4), skill: null, plantedAt: 2 });
        expect(b.nextFlagOrder).toBe(3);
        expect(b.tiles[9].id).toBeTruthy();

        // FPP-7: the bare-tile hero's flag takes their best skill at the first tick.
        GameState.state.board = { ...GameState.state.board, ...b };
        Flags.assign(0);
        expect(BoardState.flagOf('h3').skill).toBe('logging');
        expect(BoardState.workTileOf('h1')).toBe(9);
    });
});

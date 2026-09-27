import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Placement from '../systems/board/Placement.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import * as MatCap from '../systems/board/MatCap.js';
import { TURN_DEFAULTS, turnTiming } from '../config/registries/tokenConstants.js';

/**
 * Token Lifecycle slice 3.2 — **timed changes** (roadmap DP-2, §3.1):
 * `grows` and `turns`, on clocks advanced by the tick's `delta`.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

// --- Fixtures (test instruments, not content) -------------------------------

const fishing = (cycleTimeMs) => ({
    skill: 'fishing', skillRequired: 1, cycleTimeMs, xp: 1,
    inputs: [], outputs: [{ itemId: 'item_fish', quantity: 1, chance: 100 }]
});

registerTokenTypes({
    fixture_tl_sapling: {
        id: 'fixture_tl_sapling', name: 'Fixture Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'fixture_tl_tree', afterMs: 30000 }
    },
    fixture_tl_tree: {
        id: 'fixture_tl_tree', name: 'Fixture Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 50, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        }
    },
    /** Grows into something twice its size — for "nowhere to stand". */
    fixture_tl_big_sapling: {
        id: 'fixture_tl_big_sapling', name: 'Fixture Big Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'fixture_tl_big_tree', afterMs: 10000 }
    },
    fixture_tl_big_tree: {
        id: 'fixture_tl_big_tree', name: 'Fixture Big Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 50, sprite: 'skill_nature', size: 2
    },
    /**
     * The plain Coast: nothing to fish (the concept leaves that open). A 100%
     * chance, so it turns on every roll, both ways — the timing tests below
     * run through `BoardRunner`, which rolls with `Math.random`.
     */
    fixture_tl_coast: {
        id: 'fixture_tl_coast', name: 'Fixture Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: {
            into: [{ typeId: 'fixture_tl_shrimp_coast', weight: 1 }, { typeId: 'fixture_tl_crab_coast', weight: 3 }],
            everyMs: 120000,
            chance: 100
        }
    },
    fixture_tl_shrimp_coast: {
        id: 'fixture_tl_shrimp_coast', name: 'Fixture Shrimp Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        config: fishing(45000)
    },
    fixture_tl_crab_coast: {
        id: 'fixture_tl_crab_coast', name: 'Fixture Crab Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        config: fishing(45000)
    },
    /** A second Coast on its own timings, turning into one thing only. */
    fixture_tl_cove: {
        id: 'fixture_tl_cove', name: 'Fixture Cove', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: { into: [{ typeId: 'fixture_tl_shrimp_coast', weight: 1 }], everyMs: 50000, chance: 100 }
    },
    /** TL-12's shape: a 30% chance every minute, both ways. */
    fixture_tl_lagoon: {
        id: 'fixture_tl_lagoon', name: 'Fixture Lagoon', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: { into: [{ typeId: 'fixture_tl_shrimp_coast', weight: 1 }], everyMs: 60000, chance: 30 }
    },
    /** A turns block with neither cycle nor chance: the defaults (1 min, 30%). */
    fixture_tl_bay: {
        id: 'fixture_tl_bay', name: 'Fixture Bay', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: { into: [{ typeId: 'fixture_tl_shrimp_coast', weight: 1 }] }
    },
    /** Turns into something twice its size — for a won roll with nowhere to stand. */
    fixture_tl_big_shore: {
        id: 'fixture_tl_big_shore', name: 'Fixture Big Shore', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: { into: [{ typeId: 'fixture_tl_big_tree', weight: 1 }], everyMs: 10000, chance: 50 }
    }
});

// --- Helpers ----------------------------------------------------------------

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 100, max: 100 }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
    };
}

/** A seeded random (LCG), so two runs make the same weighted picks. */
function seeded(seed = 7) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const at = (x, y) => BoardState.tokensAtPoint(x, y)[0] ?? null;

/** Many small engine ticks, through `BoardRunner` — the path the game takes. */
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
});

afterEach(() => {
    for (const t of BoardState.tokens()) TimedChanges.setInHand(t.id, false);
    TriggerSystem.teardown();
    TileModifiers.teardown();
    resetMatTuning();
});

// --- grows ------------------------------------------------------------------

describe('⭐ grows — a Sapling becomes a Tree after its time', () => {
    it('stays a Sapling until afterMs, then becomes the Tree where it stood', () => {
        const sapling = placeAt('fixture_tl_sapling', 400, 400);

        run(29900);
        expect(at(400, 400).id).toBe(sapling.id);
        expect(sapling.clocks.growMs).toBe(29900);

        run(100);
        const tree = at(400, 400);
        expect(tree.typeId).toBe('fixture_tl_tree');
        expect(tree.id).not.toBe(sapling.id);
        expect(BoardState.getTokenById(sapling.id)).toBeNull();
        // A fresh Token: its own starting charges, no clocks carried across.
        expect(tree.usesRemaining).toBe(50);
        expect(tree.clocks).toBeUndefined();
    });

    it('keeps origin: a spawned Sapling grows into a spawned Tree, a placed one a placed Tree', () => {
        placeAt('fixture_tl_sapling', 400, 400);
        placeAt(BoardState.createTokenInstance('fixture_tl_sapling', null, null, 'spawned'), 800, 400);

        run(30000);

        expect(at(400, 400).origin).toBe('placed');
        expect(at(800, 400).origin).toBe('spawned');
    });

    it('a Token with no timed block gets no clocks at all', () => {
        const plain = placeAt('fixture_producer', 400, 400);
        run(1000);
        expect(plain.clocks).toBeUndefined();
    });

    it('the clock is saved: a half-grown Sapling finishes growing after a load', () => {
        const sapling = placeAt('fixture_tl_sapling', 400, 400);
        run(20000);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);

        expect(BoardState.getTokenById(sapling.id).clocks.growMs).toBe(20000);
        run(9900);
        expect(at(400, 400).typeId).toBe('fixture_tl_sapling');
        run(100);
        expect(at(400, 400).typeId).toBe('fixture_tl_tree');
    });

    it('⚠️ with nowhere legal to stand it does not happen: the clock waits full and retries each tick', () => {
        // A small mat packed with placed Tokens, so a 2×2 Tree fits nowhere
        // and may push nothing (placed Tokens are fixed).
        setMatTuning('matSteps', 6);
        const sapling = placeAt('fixture_tl_big_sapling', 200, 200);
        const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
        const blockers = [];
        for (let x = 64; x <= matW() - 64; x += gap) {
            for (let y = 64; y <= matH() - 64; y += gap) {
                if (Math.hypot(x - 200, y - 200) < gap) continue;
                blockers.push(placeAt('fixture_kitchen', x, y));
            }
        }

        TimedChanges.tick(15000);
        expect(at(200, 200).id).toBe(sapling.id);
        expect(sapling.clocks.growMs).toBe(10000);   // held full, not running on

        TimedChanges.tick(15000);
        expect(at(200, 200).id).toBe(sapling.id);
        expect(sapling.clocks.growMs).toBe(10000);

        // Clear the room around it: the next tick grows.
        for (const b of blockers) {
            if (Math.hypot(b.x - 200, b.y - 200) < 400) BoardState.removeToken(b.id);
        }
        TimedChanges.tick(100);
        expect(BoardState.getTokenById(sapling.id)).toBeNull();
        expect(BoardState.tokens().some(t => t.typeId === 'fixture_tl_big_tree')).toBe(true);
    });
});

// --- moving a spawned Token (owner feedback FB-12) --------------------------

describe('⭐ a spawned Token moves like any other, and keeps what makes it spawned (FB-12)', () => {
    const spawnedAt = (typeId, x, y) => {
        const inst = BoardState.createTokenInstance(typeId, null, null, BoardState.ORIGIN.SPAWNED);
        return BoardState.addToken(inst, x, y);
    };

    it('moves, stays spawned, and still does not count toward the mat cap (SP-67)', () => {
        const sapling = spawnedAt('fixture_tl_sapling', 400, 400);
        const before = MatCap.placedCount();
        const res = Placement.moveTokenTo(sapling.id, { x: 900, y: 700 });
        expect(res.success).toBe(true);
        expect(sapling.x).toBe(900);
        expect(sapling.y).toBe(700);
        expect(BoardState.originOf(sapling)).toBe(BoardState.ORIGIN.SPAWNED);
        expect(MatCap.placedCount()).toBe(before);
        // Still pushable by a spawn (SP-68): only placed Tokens are held fixed.
        expect(BoardState.placedTokenIds()).not.toContain(sapling.id);
    });

    it('a moved Sapling keeps its grow clock, and grows on schedule where it now stands', () => {
        const sapling = spawnedAt('fixture_tl_sapling', 400, 400);
        run(20000);
        expect(sapling.clocks.growMs).toBe(20000);

        Placement.moveTokenTo(sapling.id, { x: 900, y: 700 });
        expect(sapling.clocks.growMs).toBe(20000);

        run(9900);
        expect(BoardState.getTokenById(sapling.id)).toBeTruthy();
        run(200);
        const tree = at(900, 700);
        expect(tree?.typeId).toBe('fixture_tl_tree');
        expect(BoardState.originOf(tree)).toBe(BoardState.ORIGIN.SPAWNED);
    });

    it('does not grow while while carried: the change waits, then happens where it was put down', () => {
        const sapling = spawnedAt('fixture_tl_sapling', 400, 400);
        run(29000);

        // Picked up with a second to go, carried for five.
        TimedChanges.setInHand(sapling.id, true);
        run(5000);
        expect(BoardState.getTokenById(sapling.id)).toBeTruthy();       // the drag's id still names it
        expect(sapling.clocks.growMs).toBe(30000);                      // held full, not set back

        // Dropped: the move lands on the same instance...
        expect(Placement.moveTokenTo(sapling.id, { x: 900, y: 700 }).success).toBe(true);
        TimedChanges.setInHand(sapling.id, false);
        expect(at(900, 700)?.id).toBe(sapling.id);

        // ...and the next tick grows it there.
        run(100);
        expect(BoardState.getTokenById(sapling.id)).toBeNull();
        expect(at(900, 700)?.typeId).toBe('fixture_tl_tree');
        expect(at(400, 400)).toBeNull();
    });

    it('a Coast in the hand does not turn either', () => {
        const coast = placeAt('fixture_tl_cove', 400, 400);
        TimedChanges.setInHand(coast.id, true);
        run(60000);
        expect(BoardState.getTokenById(coast.id)?.typeId).toBe('fixture_tl_cove');
        TimedChanges.setInHand(coast.id, false);
        run(100);
        expect(at(400, 400)?.typeId).toBe('fixture_tl_shrimp_coast');
    });
});

// --- turns ------------------------------------------------------------------

describe('⭐ turns — a Coast turns, then turns back on the same cycle', () => {
    it('at a 100% chance it turns on its first roll into a pick from its list, and back on the next', () => {
        const coast = placeAt('fixture_tl_coast', 400, 400);

        run(119900);
        expect(at(400, 400).id).toBe(coast.id);

        run(100);
        const turned = at(400, 400);
        expect(['fixture_tl_shrimp_coast', 'fixture_tl_crab_coast']).toContain(turned.typeId);
        expect(turned.turnedFrom).toBe('fixture_tl_coast');
        expect(turned.origin).toBe('placed');

        // The turn back rolls on the Coast's cycle, the type it turned FROM (TL-12).
        run(119900);
        expect(at(400, 400).id).toBe(turned.id);
        run(100);
        const back = at(400, 400);
        expect(back.typeId).toBe('fixture_tl_coast');
        expect(back.turnedFrom).toBeUndefined();
        expect(back.origin).toBe('placed');

        // ...and the cycle starts again, from a fresh clock.
        run(119900);
        expect(at(400, 400).id).toBe(back.id);
        run(100);
        expect(at(400, 400).turnedFrom).toBe('fixture_tl_coast');
    });

    it('a spawned Coast stays spawned both ways', () => {
        placeAt(BoardState.createTokenInstance('fixture_tl_coast', null, null, 'spawned'), 400, 400);
        run(120000);
        expect(at(400, 400).origin).toBe('spawned');
        run(120000);
        expect(at(400, 400).typeId).toBe('fixture_tl_coast');
        expect(at(400, 400).origin).toBe('spawned');
    });

    it('picks by weight', () => {
        const entries = [{ typeId: 'fixture_tl_shrimp_coast', weight: 1 }, { typeId: 'fixture_tl_crab_coast', weight: 3 }];
        expect(TimedChanges.pickWeighted(entries, () => 0.2)).toBe('fixture_tl_shrimp_coast');   // 0.8 of 4
        expect(TimedChanges.pickWeighted(entries, () => 0.3)).toBe('fixture_tl_crab_coast');     // 1.2 of 4
        expect(TimedChanges.pickWeighted(entries, () => 0.999)).toBe('fixture_tl_crab_coast');
        // Unknown types and non-positive weights are never picked.
        expect(TimedChanges.pickWeighted([{ typeId: 'nope', weight: 5 }, { typeId: 'fixture_tl_crab_coast', weight: 0 }], () => 0)).toBeNull();

        const rng = seeded(3);
        const counts = { fixture_tl_shrimp_coast: 0, fixture_tl_crab_coast: 0 };
        for (let i = 0; i < 4000; i++) counts[TimedChanges.pickWeighted(entries, rng)]++;
        expect(counts.fixture_tl_crab_coast / 4000).toBeGreaterThan(0.7);
        expect(counts.fixture_tl_crab_coast / 4000).toBeLessThan(0.8);
    });

    it('the turned state and its clock are saved', () => {
        placeAt('fixture_tl_coast', 400, 400);
        run(150000);   // turned 30 s ago

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);

        const turned = at(400, 400);
        expect(turned.turnedFrom).toBe('fixture_tl_coast');
        expect(turned.clocks.turnMs).toBe(30000);
        run(89900);
        expect(at(400, 400).id).toBe(turned.id);
        run(100);
        expect(at(400, 400).typeId).toBe('fixture_tl_coast');
    });
});

// --- SP-51 / SP-52 ----------------------------------------------------------

describe('⭐ a hero fishing when the Coast turns back loses the cycle and moves on (SP-51, SP-52)', () => {
    it('no output for the cycle in progress; the hero takes the next fishing spot in range', () => {
        // A Coast that has already turned: a Shrimp Coast with 0 ms behind it.
        const shrimp = BoardState.createTokenInstance('fixture_tl_shrimp_coast');
        shrimp.turnedFrom = 'fixture_tl_coast';
        Placement.placeTokenAt(shrimp, { x: 400, y: 400 });
        const other = BoardState.createTokenInstance('fixture_seafood_producer', 3000);
        Placement.placeTokenAt(other, { x: 560, y: 400 });
        TileModifiers.rebuildAround([{ x: 400, y: 400 }, { x: 560, y: 400 }]);
        Placement.plantFlagAt('hero_1', { x: 400, y: 400 });

        const completions = [];
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => completions.push(p));
        try {
            run(1000);
            expect(BoardState.workTokenOf('hero_1')).toBe(shrimp.id);   // the nearest

            // Two 45 s cycles complete; the third is ~30 s in at the 120 s mark.
            run(118900);
            expect(completions.filter(c => c.instanceId === shrimp.id)).toHaveLength(2);
            expect(shrimp.cycleElapsedMs).toBeGreaterThan(25000);

            run(100);   // 120 s: the Coast's roll (100%) turns it back
            const coast = at(400, 400);
            expect(coast.typeId).toBe('fixture_tl_coast');
            expect(coast.cycleElapsedMs).toBe(0);
            expect(BoardState.getTokenById(shrimp.id)).toBeNull();

            // SP-52: the hero has already let go and taken the next spot in range.
            expect(BoardState.claimOfHero('hero_1')?.instanceId).toBe(other.id);

            // SP-51: the cycle in progress was lost — still exactly one completion
            // from the Shrimp Coast, however long we wait.
            run(60000);
            expect(completions.filter(c => c.typeId === 'fixture_tl_shrimp_coast')).toHaveLength(2);
            expect(completions.some(c => c.instanceId === other.id)).toBe(true);
        } finally {
            off?.();
        }
    });
});

// --- delta ------------------------------------------------------------------

describe('⭐ clocks run on delta: one big tick equals many small ones', () => {
    /** The same board, laid out fresh. */
    function layout() {
        clearMat();
        placeAt('fixture_tl_sapling', 300, 300);
        placeAt('fixture_tl_coast', 600, 300);
        placeAt(BoardState.createTokenInstance('fixture_tl_cove', null, null, 'spawned'), 900, 300);
    }

    /** Everything a timed change decides, per point on the mat. */
    function snapshot() {
        return BoardState.tokens()
            .map(t => ({
                x: t.x, y: t.y, typeId: t.typeId, origin: t.origin,
                turnedFrom: t.turnedFrom ?? null, clocks: t.clocks ?? null
            }))
            .sort((a, b) => a.x - b.x);
    }

    it('10 minutes in 100 ms ticks, and in six uneven big ones, end the same', () => {
        layout();
        const small = seeded(11);
        for (let t = 0; t < 600000; t += 100) TimedChanges.tick(100, small);
        const bySmallTicks = snapshot();

        layout();
        const big = seeded(11);
        for (const delta of [37000, 90000, 123000, 60000, 150000, 140000]) TimedChanges.tick(delta, big);
        const byBigTicks = snapshot();

        expect(byBigTicks).toEqual(bySmallTicks);
        // And something did happen: the Sapling grew, and the Coast (100%, every
        // 2 min) has turned and turned back twice and just turned a third time.
        expect(bySmallTicks[0].typeId).toBe('fixture_tl_tree');
        expect(bySmallTicks[1]).toMatchObject({ turnedFrom: 'fixture_tl_coast', clocks: { turnMs: 0 } });
    });

    it('a single ten-minute tick through BoardRunner does the same', () => {
        layout();
        BoardRunner.tick(600000);
        expect(at(300, 300).typeId).toBe('fixture_tl_tree');
        expect(at(600, 300)).toMatchObject({ turnedFrom: 'fixture_tl_coast', clocks: { turnMs: 0 } });
    });
});

// --- TL-12: a chance, not a timer ---------------------------------------------

describe('⭐ TL-12 — a turning Token rolls a chance once per cycle, both ways', () => {
    /** A random that returns these values in order, then fails loudly. */
    function scripted(values) {
        const queue = [...values];
        const fn = () => {
            if (!queue.length) throw new Error('scripted random ran out');
            fn.calls++;
            return queue.shift();
        };
        fn.calls = 0;
        return fn;
    }
    const minute = (random) => { for (let t = 0; t < 60000; t += 1000) TimedChanges.tick(1000, random); };

    it('the defaults are 1 minute and 30%, read for a block that leaves them out', () => {
        expect(TURN_DEFAULTS).toEqual({ everyMs: 60000, chance: 30 });
        expect(turnTiming(undefined)).toEqual({ everyMs: 60000, chance: 30 });
        expect(turnTiming({ everyMs: 0, chance: 'x' })).toEqual({ everyMs: 60000, chance: 30 });
        expect(turnTiming({ everyMs: 90000, chance: 150 })).toEqual({ everyMs: 90000, chance: 100 });

        const bay = placeAt('fixture_tl_bay', 400, 400);
        expect(TimedChanges.turnTimingOf(bay)).toEqual({ everyMs: 60000, chance: 30 });
        expect(TimedChanges.nextTurnRoll(bay)).toMatchObject({ inMs: 60000, chance: 30, back: false });
        // No roll before a minute; at the minute, one roll.
        const random = scripted([0.1]);
        TimedChanges.tick(59999, random);
        expect(random.calls).toBe(0);
        TimedChanges.tick(1, random);
        expect(random.calls).toBe(1);
        expect(at(400, 400)).toMatchObject({ typeId: 'fixture_tl_shrimp_coast', turnedFrom: 'fixture_tl_bay' });
    });

    it('a failed roll starts the next minute; a roll under the chance turns it, and the same both ways', () => {
        const lagoon = placeAt('fixture_tl_lagoon', 400, 400);
        // Rolls are drawn as random() * 100 < chance: 0.5 fails (50 >= 30), 0.29 wins.
        const random = scripted([0.5, 0.29, 0.9, 0.31, 0.05]);

        minute(random);                                   // roll 1: 50, stays
        expect(at(400, 400).id).toBe(lagoon.id);
        expect(lagoon.clocks.turnMs).toBe(0);             // a fresh lap
        expect(TimedChanges.nextTurnRoll(lagoon).inMs).toBe(60000);

        minute(random);                                   // roll 2: 29, turns
        const shrimp = at(400, 400);
        expect(shrimp).toMatchObject({ typeId: 'fixture_tl_shrimp_coast', turnedFrom: 'fixture_tl_lagoon' });
        // The turned Token counts down to its roll back, on the Lagoon's numbers.
        expect(TimedChanges.nextTurnRoll(shrimp)).toEqual({ inMs: 60000, chance: 30, back: true, into: ['fixture_tl_lagoon'] });
        TimedChanges.tick(26000, random);
        expect(TimedChanges.nextTurnRoll(shrimp).inMs).toBe(34000);
        TimedChanges.tick(34000, random);                 // roll 3: 90, stays turned
        expect(at(400, 400).id).toBe(shrimp.id);

        minute(random);                                   // roll 4: 31, stays turned
        expect(at(400, 400).id).toBe(shrimp.id);
        minute(random);                                   // roll 5: 5, turns back
        expect(at(400, 400)).toMatchObject({ typeId: 'fixture_tl_lagoon' });
        expect(at(400, 400).turnedFrom).toBeUndefined();
        expect(random.calls).toBe(5);
    });

    it('a 100% chance never draws from the random stream', () => {
        placeAt('fixture_tl_cove', 400, 400);
        const random = scripted([]);
        TimedChanges.tick(50000, random);
        TimedChanges.tick(50000, random);
        expect(at(400, 400).typeId).toBe('fixture_tl_cove');
        expect(random.calls).toBe(0);
    });

    it('one big tick rolls once per whole cycle in it and ends exactly where many small ticks do', () => {
        const snap = () => BoardState.tokens().map(t => ({ typeId: t.typeId, turnedFrom: t.turnedFrom ?? null, clocks: t.clocks ?? null }));
        const counted = (seed) => {
            const rng = seeded(seed);
            const fn = () => { fn.calls++; return rng(); };
            fn.calls = 0;
            return fn;
        };

        clearMat();
        placeAt('fixture_tl_lagoon', 400, 400);
        const small = counted(5);
        for (let t = 0; t < 1830000; t += 100) TimedChanges.tick(100, small);
        const bySmall = snap();

        clearMat();
        placeAt('fixture_tl_lagoon', 400, 400);
        const big = counted(5);
        TimedChanges.tick(1830000, big);
        const byBig = snap();

        clearMat();
        placeAt('fixture_tl_lagoon', 400, 400);
        const uneven = counted(5);
        for (const delta of [37000, 290000, 123000, 600000, 150000, 630000]) TimedChanges.tick(delta, uneven);
        const byUneven = snap();

        expect(byBig).toEqual(bySmall);
        expect(byUneven).toEqual(bySmall);
        // 30.5 minutes: exactly 30 rolls, and 30 s carried into the next lap.
        expect(small.calls).toBe(30);
        expect(big.calls).toBe(30);
        expect(uneven.calls).toBe(30);
        expect(bySmall[0].clocks.turnMs).toBe(30000);
    });

    it('flips on about 30% of rolls, both ways (about every three minutes)', () => {
        placeAt('fixture_tl_lagoon', 400, 400);
        const random = seeded(21);
        let flips = 0;
        let turnedMinutes = 0;
        let prev = at(400, 400).typeId;
        for (let m = 0; m < 2000; m++) {
            TimedChanges.tick(60000, random);
            const now = at(400, 400).typeId;
            if (now !== prev) flips++;
            if (now === 'fixture_tl_shrimp_coast') turnedMinutes++;
            prev = now;
        }
        expect(flips / 2000).toBeGreaterThan(0.26);
        expect(flips / 2000).toBeLessThan(0.34);
        // The same odds both ways: about half the time spent in each state.
        expect(turnedMinutes / 2000).toBeGreaterThan(0.4);
        expect(turnedMinutes / 2000).toBeLessThan(0.6);
    });

    it('in the hand it does not roll at all; put down, it rolls on the next tick', () => {
        const lagoon = placeAt('fixture_tl_lagoon', 400, 400);
        TimedChanges.setInHand(lagoon.id, true);
        const random = scripted([0.1]);
        TimedChanges.tick(60000, random);
        TimedChanges.tick(60000, random);
        expect(random.calls).toBe(0);
        expect(lagoon.clocks.turnMs).toBe(60000);         // held full
        expect(TimedChanges.nextTurnRoll(lagoon).inMs).toBe(0);
        TimedChanges.setInHand(lagoon.id, false);
        TimedChanges.tick(100, random);
        expect(random.calls).toBe(1);
        expect(at(400, 400).typeId).toBe('fixture_tl_shrimp_coast');
    });

    it('a won roll with nowhere to stand is kept: the retry does not roll again', () => {
        setMatTuning('matSteps', 6);
        const shore = placeAt('fixture_tl_big_shore', 200, 200);
        const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
        const blockers = [];
        for (let x = 64; x <= matW() - 64; x += gap) {
            for (let y = 64; y <= matH() - 64; y += gap) {
                if (Math.hypot(x - 200, y - 200) < gap) continue;
                blockers.push(placeAt('fixture_kitchen', x, y));
            }
        }

        const random = scripted([0.2]);                   // wins (20 < 50)
        TimedChanges.tick(10000, random);
        TimedChanges.tick(5000, random);
        TimedChanges.tick(5000, random);
        expect(random.calls).toBe(1);                     // no re-roll on the retries
        expect(at(200, 200).id).toBe(shore.id);
        expect(shore.clocks).toMatchObject({ turnMs: 10000, turnWon: 1 });

        for (const b of blockers) {
            if (Math.hypot(b.x - 200, b.y - 200) < 400) BoardState.removeToken(b.id);
        }
        TimedChanges.tick(100, random);
        expect(BoardState.getTokenById(shore.id)).toBeNull();
        const turned = BoardState.tokens().find(t => t.typeId === 'fixture_tl_big_tree');
        expect(turned.turnedFrom).toBe('fixture_tl_big_shore');
        expect(turned.clocks?.turnWon).toBeUndefined();   // the new Token starts fresh
    });
});

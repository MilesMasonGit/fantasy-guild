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
    /** The plain Coast: nothing to fish (the concept leaves that open). */
    fixture_tl_coast: {
        id: 'fixture_tl_coast', name: 'Fixture Coast', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nautical',
        turns: {
            into: [{ typeId: 'fixture_tl_shrimp_coast', weight: 1 }, { typeId: 'fixture_tl_crab_coast', weight: 3 }],
            everyMs: 120000,
            lastsMs: 60000
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
        turns: { into: [{ typeId: 'fixture_tl_shrimp_coast', weight: 1 }], everyMs: 50000, lastsMs: 25000 }
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

describe('⭐ turns — a Coast turns for a while, then turns back', () => {
    it('turns after everyMs into a pick from its list, and back after lastsMs', () => {
        const coast = placeAt('fixture_tl_coast', 400, 400);

        run(119900);
        expect(at(400, 400).id).toBe(coast.id);

        run(100);
        const turned = at(400, 400);
        expect(['fixture_tl_shrimp_coast', 'fixture_tl_crab_coast']).toContain(turned.typeId);
        expect(turned.turnedFrom).toBe('fixture_tl_coast');
        expect(turned.origin).toBe('placed');

        // lastsMs is read from the Coast, the type it turned FROM.
        run(59900);
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
        run(60000);
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
        run(30000);
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

            // One 45 s cycle completes; the second is 15 s in at the 60 s mark.
            run(58900);
            expect(completions.filter(c => c.instanceId === shrimp.id)).toHaveLength(1);
            expect(shrimp.cycleElapsedMs).toBeGreaterThan(14000);

            run(100);   // 60 s: the Coast turns back
            const coast = at(400, 400);
            expect(coast.typeId).toBe('fixture_tl_coast');
            expect(coast.cycleElapsedMs).toBe(0);
            expect(BoardState.getTokenById(shrimp.id)).toBeNull();

            // SP-52: the hero has already let go and taken the next spot in range.
            expect(BoardState.claimOfHero('hero_1')?.instanceId).toBe(other.id);

            // SP-51: the cycle in progress was lost — still exactly one completion
            // from the Shrimp Coast, however long we wait.
            run(60000);
            expect(completions.filter(c => c.typeId === 'fixture_tl_shrimp_coast')).toHaveLength(1);
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
        // And something did happen: the Sapling grew, and the Coast has turned
        // and turned back three times and is 60 s into being itself again.
        expect(bySmallTicks[0].typeId).toBe('fixture_tl_tree');
        expect(bySmallTicks[1]).toMatchObject({ typeId: 'fixture_tl_coast', clocks: { turnMs: 60000 } });
    });

    it('a single ten-minute tick through BoardRunner does the same', () => {
        layout();
        BoardRunner.tick(600000);
        expect(at(300, 300).typeId).toBe('fixture_tl_tree');
        expect(at(600, 300)).toMatchObject({ typeId: 'fixture_tl_coast', clocks: { turnMs: 60000 } });
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FIXTURE_TOKENS } from './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { SKILL_SPEED_FACTOR } from '../config/FormulaRegistry.js';

/**
 * The board's cycle engine — Tokens working, and what stops them.
 *
 * Covers D-53 (most Tokens need a hero), D-67's **Access** (the only hero
 * property implemented this pass), D-127 (first-come allocation, no partial
 * cycles), D-176 (charges, and `null` meaning unlimited), D-116 (Passive
 * Generators run unstaffed) and D-149 (an unstaffed Token is not an error).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));


vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * How long an authored `base`-ms cycle actually takes for a hero at `level`.
 *
 * Skill speed is live from 2026-08-25 (CR2-072): a skilled hero shortens the
 * cycle, so every timing assertion below is expressed against this rather than
 * against the raw authored number. Derived from `SKILL_SPEED_FACTOR` on purpose
 * — retuning the dial must not need these tests edited.
 */
function cycleMs(base, level = 50) {
    return base / (1 + level * SKILL_SPEED_FACTOR);
}

/** A hero with every skill at `level`, high enough to pass Access by default. */
function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) {
        skills[s] = { level, xp: 0 };
    }
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/** Place a Token of `typeId` on `tile`, optionally staffed. */
function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

/** Run the engine for `ms`, in realistic 100ms engine ticks. */
function run(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) BoardRunner.tick(100);
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

describe('A staffed Token works', () => {
    it('produces after one cycle and not before', () => {
        place(10, 'fixture_producer', 'hero_1');       // 12s cycle, authored

        run(cycleMs(12000) - 600);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(0);

        run(1200);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });

    it('drops its output on the BOARD, not straight into the Bank (D-40)', () => {
        place(10, 'fixture_producer', 'hero_1');
        run(13000);

        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(0);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });

    it('keeps cycling', () => {
        place(10, 'fixture_producer', 'hero_1');
        run(cycleMs(12000) * 3 + 1000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(6);
    });

    it('awards XP to the working hero, in the skill the Token demands', () => {
        place(10, 'fixture_producer', 'hero_1');
        const skillId = FIXTURE_TOKENS.fixture_producer.config.skill;
        const before = GameState.state.heroes[0].skills[skillId].xp;
        run(13000);
        expect(GameState.state.heroes[0].skills[skillId].xp).toBeGreaterThan(before);
    });

    it('resets progress after completing, rather than carrying the overflow', () => {
        const token = place(10, 'fixture_producer', 'hero_1');
        run(13000);
        expect(token.cycleElapsedMs).toBeLessThan(12000);
    });
});

describe('Output quantity ranges (CMS-41)', () => {
    /**
     * An output used to be a single fixed `quantity`. The CMS authors
     * `{ itemId, chance, minQty, maxQty }`, so a Token can yield "1–5" and a
     * completion is worth watching. Per-entry `chance` was already independent
     * and is unchanged.
     */
    it('yields a fixed quantity unchanged when no range is authored', () => {
        // Backwards compatibility is the whole reason nothing needed migrating.
        place(10, 'fixture_producer', 'hero_1');
        run(13000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });

    it('stays within the authored bounds over many cycles', () => {
        place(10, 'fixture_range_producer', 'hero_1');

        const CYCLES = 40;
        run(cycleMs(12000) * CYCLES + 1000);

        const total = SpriteLayer.countOnBoard('item_yew_log');
        expect(total).toBeGreaterThanOrEqual(CYCLES * 1);
        expect(total).toBeLessThanOrEqual(CYCLES * 5);
    });

    it('actually varies rather than pinning to one end of the range', () => {
        place(10, 'fixture_range_producer', 'hero_1');

        const CYCLES = 40;
        run(cycleMs(12000) * CYCLES + 1000);
        const total = SpriteLayer.countOnBoard('item_yew_log');

        // Over 40 rolls of 1–5, landing exactly on a bound every single time is
        // about 1 in 10^27 — so this is a real assertion, not a flaky one.
        expect(total).toBeGreaterThan(CYCLES * 1);
        expect(total).toBeLessThan(CYCLES * 5);
    });

    it('averages near the midpoint of the range', () => {
        place(10, 'fixture_range_producer', 'hero_1');

        const CYCLES = 200;
        run(cycleMs(12000) * CYCLES + 1000);

        const mean = SpriteLayer.countOnBoard('item_yew_log') / CYCLES;
        // Midpoint of 1–5 is 3. A generous band: this is checking the roll is
        // roughly uniform, not that the RNG is well-behaved.
        expect(mean).toBeGreaterThan(2.4);
        expect(mean).toBeLessThan(3.6);
    });
});

describe('A hero is a GATE (D-53, D-57)', () => {
    it('an unstaffed Token does nothing at all', () => {
        place(10, 'fixture_producer');
        run(30000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(0);
    });

    it('an unstaffed Token raises NO alert — it is not an error (D-149)', () => {
        // With ~8 heroes on 48 tiles most of the board is unstaffed at any
        // moment. Flagging all of it would make the mark meaningless.
        const token = place(10, 'fixture_producer');
        run(5000);
        expect(token.alert).toBeFalsy();
    });

    it('starts working the moment a hero arrives', () => {
        place(10, 'fixture_producer');
        run(30000);
        Placement.placeHero('hero_1', 10);
        run(13000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });

    it('stops when the hero leaves, and forfeits the cycle (D-131)', () => {
        place(10, 'fixture_producer', 'hero_1');
        run(8000);
        Placement.recallHero(10);

        expect(BoardState.getToken(10).cycleElapsedMs).toBe(0);
        run(30000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(0);
    });
});

describe('Access — the ONE hero property implemented this pass (D-67)', () => {
    it('refuses a hero below the skill requirement, and says so', () => {
        GameState.state.heroes = [makeHero('hero_1', 5)];     // Deep Mine wants 25
        const token = place(10, 'fixture_gated', 'hero_1');

        run(25000);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(0);
        expect(token.alert).toBe(BoardRunner.ALERT.ACCESS);
    });

    it('permits a hero who meets it, and clears the alert', () => {
        GameState.state.heroes = [makeHero('hero_1', 30)];
        const token = place(10, 'fixture_gated', 'hero_1');

        run(21000);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(6);
        expect(token.alert).toBeFalsy();
    });

    it('DOES make a high-skill hero faster (CR2-072)', () => {
        // ⚠️ This test used to assert the opposite — "a level 99 hero works a
        // Forest at exactly the speed a level 1 hero does" — pinning a hole
        // rather than a rule. Owner decision 5 (2026-08-19): *"Skills should
        // make a hero faster. WIRE IT UP."* So the same scenario now pins the
        // behaviour instead of the gap.
        GameState.state.heroes = [makeHero('hero_1', 1), makeHero('hero_2', 99)];
        place(10, 'fixture_producer', 'hero_1');
        place(20, 'fixture_producer', 'hero_2');

        // Long enough for the level-99 hero to finish a second cycle
        // (12000 / 1.495 ≈ 8.03s) but not the level-1 hero (≈ 11.94s).
        run(cycleMs(12000, 99) * 2 + 500);

        // 2 cycles from the veteran, 1 from the novice.
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(6);
    });

    it('leaves a raw beginner at essentially the authored cycle time', () => {
        // The floor of the mechanic: a level-1 hero is worth +0.5%, so the
        // Token's authored 12s is what a beginner experiences (11.94s).
        // Without this, a bug that simply made every cycle shorter for everyone
        // would still pass the test above. Level 1, not 0, because
        // `fixture_producer` gates at skillRequired: 1.
        GameState.state.heroes = [makeHero('hero_1', 1)];
        place(10, 'fixture_producer', 'hero_1');

        run(11900);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(0);
        run(200);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });
});

describe('Inputs (D-24, D-127)', () => {
    it('pulls from the Bank automatically — no assignment step', () => {
        InventoryManager.addItem('fixture_oak_wood', 10);
        place(10, 'fixture_consumer', 'hero_1');          // needs 2 wood

        run(19000);

        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(1);
        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(8);
    });

    it('waits when inputs are missing, and raises the red mark (D-114)', () => {
        const token = place(10, 'fixture_consumer', 'hero_1');
        run(25000);

        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(0);
        expect(token.alert).toBe(BoardRunner.ALERT.INPUTS);
    });

    it('waits rather than running slower — there are no partial cycles', () => {
        const token = place(10, 'fixture_consumer', 'hero_1');
        run(25000);
        expect(token.cycleElapsedMs).toBe(0);        // never started

        InventoryManager.addItem('fixture_oak_wood', 10);
        run(19000);
        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(1);
    });

    it('eats loot off the floor when the Bank is short (D-42)', () => {
        // Loot on the ground must never starve a chain.
        SpriteLayer.addSprite('item', 'fixture_oak_wood', 4, 30);
        place(10, 'fixture_consumer', 'hero_1');

        run(19000);

        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(1);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);
    });

    it('spends the Bank before the floor', () => {
        InventoryManager.addItem('fixture_oak_wood', 5);
        SpriteLayer.addSprite('item', 'fixture_oak_wood', 5, 30);
        place(10, 'fixture_consumer', 'hero_1');

        run(19000);

        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(3);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(5);   // untouched
    });
});

describe('⚠️ Risk 13 — first-come allocation starves deep chains (D-127)', () => {
    it('a cheap consumer beats an expensive one under shortage', () => {
        // THE risk the design flagged: a Token needing 1 acts sooner than one
        // needing 5, so under sustained shortage the deep, expensive steps the
        // game wants players to build are the ones that starve — the opposite
        // of the pressure §6.2 intends.
        //
        // Still needs 2 wood; Deep Kiln needs 5. Supply covers only the Still.
        InventoryManager.addItem('fixture_oak_wood', 3);
        place(10, 'fixture_consumer', 'hero_1');
        place(20, 'fixture_deep_consumer', 'hero_2');

        run(19000);

        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(1);      // cheap ran
        expect(SpriteLayer.countOnBoard('item_spider_silk')).toBe(0);  // deep starved
    });

    it('counts blocked ticks per Token type so the balance pass has data', () => {
        InventoryManager.addItem('fixture_oak_wood', 3);
        place(20, 'fixture_deep_consumer', 'hero_2');
        run(5000);

        const stats = InputAllocator.getStarvationStats();
        expect(stats.fixture_deep_consumer).toBeGreaterThan(0);
    });

    it('shortfall is per ITEM — a wood shortage never stalls an ore producer', () => {
        place(10, 'fixture_consumer', 'hero_1');         // starved of wood
        place(20, 'fixture_producer_alt', 'hero_2');      // needs nothing

        run(16000);

        expect(SpriteLayer.countOnBoard('fixture_copper_ore')).toBe(2);
        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(0);
    });
});

describe('Charges and depletion (D-176, D-118)', () => {
    it('spends one charge per completed cycle', () => {
        const token = place(10, 'fixture_producer', 'hero_1');
        const before = token.usesRemaining;
        run(13000);
        expect(BoardState.getToken(10).usesRemaining).toBe(before - 1);
    });

    it('never decrements an unlimited-use Token — null is not a big number', () => {
        const token = BoardState.createTokenInstance('fixture_passive', null);
        Placement.placeToken(10, token);
        run(31000 * 2);
        expect(BoardState.getToken(10).usesRemaining).toBeNull();
    });

    it('the Token DISAPPEARS when its last charge is spent, leaving the tile empty', () => {
        const token = BoardState.createTokenInstance('fixture_producer', 1);
        Placement.placeToken(10, token);
        Placement.placeHero('hero_1', 10);

        run(13000);

        expect(BoardState.getToken(10)).toBeNull();
        // Token depletion is the ONLY wear mechanic in the game (D-118).
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(2);   // last cycle still paid out
    });

    it('leaves the hero standing ON the empty tile, idle (D-60)', () => {
        const token = BoardState.createTokenInstance('fixture_producer', 1);
        Placement.placeToken(10, token);
        Placement.placeHero('hero_1', 10);
        run(13000);

        // Heroes never move themselves (D-59), and since Phase 7 they do not
        // get moved BY a Token vanishing either — the player returns to a
        // person standing on nothing, which is what the yellow mark is for
        // (D-172). This is also what D-151 restocks underneath.
        expect(BoardState.tileOfHero('hero_1')).toBe(10);
        expect(BoardRunner.isHeroIdle('hero_1')).toBe(true);
    });

    it('records what ran dry, so a Manager knows what the tile is owed', () => {
        const token = BoardState.createTokenInstance('fixture_producer', 1);
        Placement.placeToken(10, token);
        Placement.placeHero('hero_1', 10);
        run(13000);

        expect(BoardState.getVacancy(10)?.typeId).toBe('fixture_producer');
    });
});

describe('Passive Generators (D-116)', () => {
    it('run with NO hero at all', () => {
        place(10, 'fixture_passive');
        run(31000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(1);
    });

    it('⚠️ are strictly worse per tile than the same job staffed (risk 11)', () => {
        // If an unstaffed Token ever beat a staffed one per tile, the optimal
        // board would become mostly unstaffed and heroes would stop being the
        // ceiling — which unpicks D-115, D-181 and §6.2 at once.
        place(10, 'fixture_producer', 'hero_1');   // 2 wood / 12s
        place(20, 'fixture_passive');          // 1 wood / 30s

        run(60000);

        const staffed = 2 * Math.floor(60000 / cycleMs(12000));
        const passive = 1 * Math.floor(60000 / 30000);
        expect(passive).toBeLessThan(staffed);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(staffed + passive);
    });
});

describe('Inert Tokens', () => {
    it('a Context Token never runs a cycle of its own', () => {
        // Context, Buff and Structure Tokens work by ADJACENCY (Phase 5).
        const token = place(10, 'fixture_buff_yield', 'hero_1');
        run(60000);
        expect(token.usesRemaining).toBe(tokenStartingUses('fixture_buff_yield'));
        expect(token.cycleElapsedMs || 0).toBe(0);
    });
});

describe('Idle heroes — the yellow mark (D-172)', () => {
    it('a hero in the Dock is idle', () => {
        expect(BoardRunner.isHeroIdle('hero_1')).toBe(true);
    });

    it('a hero working a healthy Token is not idle', () => {
        place(10, 'fixture_producer', 'hero_1');
        run(1000);
        expect(BoardRunner.isHeroIdle('hero_1')).toBe(false);
    });

    it('a hero on a STUCK Token is idle — staffed but going nowhere', () => {
        place(10, 'fixture_consumer', 'hero_1');     // no wood anywhere
        run(2000);
        expect(BoardRunner.isHeroIdle('hero_1')).toBe(true);
    });

    it('a hero standing on an inert Token is idle', () => {
        place(10, 'fixture_buff_yield', 'hero_1');
        run(2000);
        expect(BoardRunner.isHeroIdle('hero_1')).toBe(true);
    });
});

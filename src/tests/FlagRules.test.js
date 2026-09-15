import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as PromotionSystem from '../systems/hero/PromotionSystem.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { tileCentre } from '../config/boardGeometry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getJobSkills, getPromotionCost, getPromotionGateSkills } from '../config/registries/jobRegistry.js';
import { resetMatTuning, matTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/combat/DefeatPenalties.js', () => ({
    applyDefeatPenalties: vi.fn(() => [])
}));

/**
 * ⭐ Free Playmat slice 1.5b-i — **a hero works anything they can in range, by
 * their own rules** (FP-71, FP-72, FP-74, FP-79, FP-80, FPP-17…FPP-19).
 *
 * ⚠️ Everything here runs at the **shipped reaches**: flag radius and Near both
 * 164 u (FP-75). A flag at tile 14 reaches the Token under it (0 u) and its four
 * side neighbours 8, 13, 15, 20 (160 u) — never a diagonal (226 u).
 * ```
 *    0  1  2  3  4  5
 *    6  7  8  9 10 11
 *   12 13 14 15 16 17
 *   18 19 20 21 22 23
 * ```
 */

registerTokenTypes({
    /** A logging Token that needs coal — stuck for a fixable reason. */
    fr_hungry: {
        id: 'fr_hungry', name: 'Hungry Mill', uses: 100, requiresHero: true,
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [{ itemId: 'item_coal', quantity: 2 }],
            outputs: [{ itemId: 'item_glowcap', quantity: 1, chance: 100 }]
        }
    }
});

const C = (tile) => tileCentre(tile);
const FOREST = 'fixture_producer';        // logging
const MINE = 'fixture_producer_alt';      // mining

function hero(id, skills = { logging: 50, mining: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeToken(tile, instance);
    return BoardState.getToken(tile);
}

const plant = (heroId, tile) => Flags.plant(heroId, C(tile));
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const reasons = (instance) => Flags.skipsOf(instance.id).map(s => s.reason);

function counting(event, fn) {
    let n = 0;
    const off = EventBus.subscribe(event, () => { n++; });
    try { fn(); } finally { off?.(); }
    return n;
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('h1'), hero('h2'), hero('h3')];
    GameState.state.inventory.maxSlots = 50;
});

// ---------------------------------------------------------------------------

describe('the shipped reach (FP-75)', () => {
    it('both reaches are 164 u, and a hero between a tree and a rock works the side one, not the diagonal', () => {
        expect(matTuning('flagRadius')).toBe(164);
        expect(matTuning('nearRadius')).toBe(164);

        const rock = put(21, MINE);                   // diagonal, 226 u
        put(15, FOREST);                              // side, 160 u
        FlagRules.heroRecord('h1').flagRules = { mining: { allowed: true, priority: 1 } };

        plant('h1', 14);

        expect(BoardState.workTileOf('h1')).toBe(15);
        expect(reasons(rock)).toEqual([]);            // out of reach: not even looked at
    });

    it('a new hero starts with empty rules', () => {
        expect(generateHero().flagRules).toEqual({});
    });
});

describe('⭐ works anything they hold, priority first, then nearest (FP-71, FP-72, FP-79)', () => {
    it('works a nearer Token of another held skill', () => {
        put(15, FOREST);                              // logging, 160 u
        put(14, MINE);                                // mining, under the flag
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(14);
    });

    it('a priority-1 Token farther away beats a priority-3 Token nearer', () => {
        put(14, MINE);                                // priority 3, 0 u
        put(15, FOREST);                              // priority 1, 160 u
        expect(Flags.setRule('h1', 'logging', { priority: 1 }).success).toBe(true);

        plant('h1', 14);

        expect(BoardState.workTileOf('h1')).toBe(15);
    });

    it('a priority-1 Token stuck on inputs → the priority-3 one, the skip recorded, one notice', () => {
        const hungry = put(15, 'fr_hungry');          // logging, priority 1, no coal
        put(13, MINE);                                // mining, priority 3
        Flags.setRule('h1', 'logging', { priority: 1 });

        plant('h1', 14);

        expect(BoardState.workTileOf('h1')).toBe(13);
        expect(reasons(hungry)).toEqual([ALERT.INPUTS]);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);

        run(30000);                                   // several cycles, each one looking again (FP-80)

        expect(BoardState.workTileOf('h1')).toBe(13);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
    });
});

describe('rules switched off (FPP-18)', () => {
    it('a skill whose rule is off is skipped as rule_off, and the hero works something else', () => {
        const forest = put(14, FOREST);
        put(15, MINE);
        Flags.setRule('h1', 'logging', { allowed: false });

        plant('h1', 14);

        expect(BoardState.workTileOf('h1')).toBe(15);
        expect(reasons(forest)).toEqual([Flags.SKIP.RULE_OFF]);
    });

    it('switching off the skill being worked lets go now and resets its progress (FP-68)', () => {
        const forest = put(15, FOREST);
        put(20, MINE);                                // just as near; the lower anchor 15 wins
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(15);
        run(3000);
        expect(forest.cycleElapsedMs).toBeGreaterThan(0);
        const plantedAt = BoardState.flagOf('h1').plantedAt;

        const deployed = counting('hero_deployed', () => {
            expect(Flags.setRule('h1', 'logging', { allowed: false }).success).toBe(true);
        });

        expect(BoardState.workTileOf('h1')).toBeNull();
        expect(forest.cycleElapsedMs).toBe(0);
        expect(deployed).toBe(0);
        expect(BoardState.flagOf('h1').plantedAt).toBe(plantedAt);

        Flags.assign(0);
        expect(BoardState.workTileOf('h1')).toBe(20);
    });

    it('Fight is allowed by default (FP-74); switching it off lets go of the enemy and skips enemies', () => {
        GameState.state.heroes = [hero('f1', { logging: 50, melee: 30 })];
        const bear = put(15, 'fixture_enemy');

        expect(FlagRules.ruleOf('f1', FlagRules.FIGHT)).toEqual({ allowed: true, priority: 3 });
        plant('f1', 14);
        expect(BoardState.workTileOf('f1')).toBe(15);

        Flags.setRule('f1', FlagRules.FIGHT, { allowed: false });
        expect(BoardState.workTileOf('f1')).toBeNull();
        expect(BoardCombat.fightOfHero('f1')).toBeNull();

        Flags.assign(0);
        expect(BoardState.workTileOf('f1')).toBeNull();
        expect(reasons(bear)).toEqual([Flags.SKIP.RULE_OFF]);
    });
});

describe('Flags.setRule and resetRules (FPP-17)', () => {
    it('refuses an unheld skill, Fight for a hero who cannot fight, and a priority outside 1–5', () => {
        GameState.state.heroes = [hero('h1', { logging: 50 })];
        const refused = (ruleId, change) => Flags.setRule('h1', ruleId, change).success === false;

        expect(refused('mining', { priority: 1 })).toBe(true);
        expect(refused(FlagRules.FIGHT, { allowed: false })).toBe(true);
        for (const priority of [0, 6, 2.5, '1', -1]) expect(refused('logging', { priority })).toBe(true);
        expect(refused('logging', { allowed: 'no' })).toBe(true);
        expect(Flags.setRule('nobody', 'logging', { priority: 1 }).success).toBe(false);

        expect(FlagRules.heroRecord('h1').flagRules ?? {}).toEqual({});
    });

    it('stores rules sparsely: a rule back at the default is no entry', () => {
        Flags.setRule('h1', 'logging', { priority: 1 });
        expect(FlagRules.heroRecord('h1').flagRules).toEqual({ logging: { allowed: true, priority: 1 } });
        Flags.setRule('h1', 'logging', { priority: 3 });
        expect(FlagRules.heroRecord('h1').flagRules).toEqual({});
    });

    it('resetRules puts every rule back to allowed, priority 3', () => {
        Flags.setRule('h1', 'logging', { priority: 5 });
        Flags.setRule('h1', 'mining', { allowed: false });
        expect(Flags.resetRules('h1').success).toBe(true);
        expect(FlagRules.ruleOf('h1', 'logging')).toEqual({ allowed: true, priority: 3 });
        expect(FlagRules.ruleOf('h1', 'mining')).toEqual({ allowed: true, priority: 3 });
    });

    it('a priority change is not a re-plant: claim, plantedAt, progress and notices stay; no hero_deployed', () => {
        GameState.state.heroes = [hero('h1', { logging: 50 })];
        put(14, 'fr_hungry');                          // under the flag, stuck: passed over with a notice
        const first = put(13, FOREST);
        put(15, FOREST);
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(13);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);

        run(3000);
        const progress = first.cycleElapsedMs;
        const plantedAt = BoardState.flagOf('h1').plantedAt;
        expect(progress).toBeGreaterThan(0);

        let moved = 0;
        const deployed = counting('hero_deployed', () => {
            moved = counting(BOARD_EVENTS.HERO_MOVED, () => {
                expect(Flags.setRule('h1', 'logging', { priority: 1 }).success).toBe(true);
                Flags.assign(0);
            });
        });

        expect(deployed).toBe(0);
        expect(moved).toBe(0);
        expect(BoardState.heroOfInstance(first.id)).toBe('h1');
        expect(first.cycleElapsedMs).toBe(progress);
        expect(BoardState.flagOf('h1').plantedAt).toBe(plantedAt);

        // The notice about the stuck mill is still spent: passing it again says nothing.
        Charges.destroyToken(13, first, { heroId: 'h1' });
        Flags.assign(0);
        expect(BoardState.workTileOf('h1')).toBe(15);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
    });

    it('rules survive a furl, a re-plant, and a save and reload', async () => {
        Flags.setRule('h1', 'logging', { priority: 2 });
        Flags.setRule('h1', 'mining', { allowed: false });
        plant('h1', 14);

        Flags.furl('h1');
        plant('h1', 20);
        expect(FlagRules.ruleOf('h1', 'logging')).toEqual({ allowed: true, priority: 2 });
        expect(FlagRules.ruleOf('h1', 'mining')).toEqual({ allowed: false, priority: 3 });

        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));

        expect(GameState.state.heroes.find(x => x.id === 'h1').flagRules).toEqual({
            logging: { allowed: true, priority: 2 },
            mining: { allowed: false, priority: 3 }
        });
        expect(FlagRules.ruleOf('h1', 'mining').allowed).toBe(false);
    });

    it('a promotion keeps a banked skill’s rule for its restore, and a newly gained skill starts at the default', () => {
        GameState.state.heroes = [];
        const h = generateHero();
        HeroManager.addHero(h);
        const qualify = (jobId) => {
            const cost = getPromotionCost(jobId);
            for (const s of getPromotionGateSkills(jobId)) {
                if (!h.skills[s]) h.skills[s] = { xp: 0, level: 0 };
                h.skills[s].level = cost.skillLevel;
            }
        };
        qualify('fighter');
        const dropped = Object.keys(h.skills).filter(id => !getJobSkills('fighter').includes(id));
        const revived = dropped.find(id => getJobSkills('cleric').includes(id));
        expect(revived).toBeTruthy();
        h.skills[revived].level = 40;                  // clears Cleric's gate from the bank later

        expect(Flags.setRule(h.id, revived, { priority: 1 }).success).toBe(true);

        const toFighter = PromotionSystem.promote(h.id, 'fighter');
        expect(toFighter.success).toBe(true);
        expect(toFighter.banked).toContain(revived);
        // Banked: no longer settable, not listed, but the rule is kept.
        expect(Flags.setRule(h.id, revived, { priority: 2 }).success).toBe(false);
        expect(FlagRules.rowsFor(h.id).map(r => r.ruleId)).not.toContain(revived);
        expect(h.flagRules[revived]).toEqual({ allowed: true, priority: 1 });
        for (const gained of toFighter.gained) {
            expect(FlagRules.ruleOf(h.id, gained)).toEqual({ allowed: true, priority: 3 });
        }
        expect(FlagRules.rowsFor(h.id).at(-1)).toMatchObject({ ruleId: FlagRules.FIGHT, allowed: true, priority: 3 });

        for (const s of getPromotionGateSkills('cleric')) {
            if (h.skills[s]) h.skills[s].level = getPromotionCost('cleric').skillLevel;
        }
        const toCleric = PromotionSystem.promote(h.id, 'cleric');
        expect(toCleric.success).toBe(true);
        expect(toCleric.restored).toContain(revived);
        expect(FlagRules.ruleOf(h.id, revived)).toEqual({ allowed: true, priority: 1 });
        expect(FlagRules.rowsFor(h.id).find(r => r.ruleId === revived)).toMatchObject({ priority: 1 });
    });
});

describe('FlagRules.rowsFor — what a rules panel lists', () => {
    it('held work skills by level then name, then one Fight row only for a hero who can fight', () => {
        GameState.state.heroes = [
            hero('w', { mining: 40, logging: 50, cooking: 50 }),
            hero('f', { mining: 40, melee: 10 })
        ];
        Flags.setRule('w', 'mining', { allowed: false, priority: 5 });

        expect(FlagRules.rowsFor('w')).toEqual([
            expect.objectContaining({ ruleId: 'cooking', level: 50, combat: false, allowed: true, priority: 3 }),
            expect.objectContaining({ ruleId: 'logging', level: 50, allowed: true, priority: 3 }),
            expect.objectContaining({ ruleId: 'mining', level: 40, allowed: false, priority: 5 })
        ]);
        expect(FlagRules.rowsFor('f').map(r => r.ruleId)).toEqual(['mining', FlagRules.FIGHT]);
        expect(FlagRules.rowsFor('f')[1]).toMatchObject({ name: 'Fight', combat: true, level: null });
    });
});

describe('⭐ better work appears: finish the cycle, then switch (FP-80)', () => {
    it('stays through the current cycle, and switches on the next pass after it completes', () => {
        const forest = put(15, FOREST);
        plant('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(15);
        run(2000);

        put(13, MINE);
        Flags.setRule('h1', 'mining', { priority: 1 });

        let completed = false;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, p => { if (p.tile === 15) completed = true; });
        let sawProgress = false;
        try {
            for (let i = 0; i < 600 && !completed; i++) {
                BoardRunner.tick(100);
                if (!completed) {
                    expect(BoardState.workTileOf('h1'), `tick ${i}, mid-cycle`).toBe(15);
                    if (forest.cycleElapsedMs > 0) sawProgress = true;
                }
            }
        } finally {
            off?.();
        }
        expect(completed).toBe(true);
        expect(sawProgress).toBe(true);
        expect(BoardState.workTileOf('h1')).toBe(15);  // the completing tick itself does not switch

        BoardRunner.tick(100);
        expect(BoardState.workTileOf('h1')).toBe(13);
        expect(forest.cycleElapsedMs).toBe(0);
    });

    it('in a fight, switches after the kill', () => {
        const fighter = generateHero({ name: 'f1' });
        fighter.id = 'f1';
        fighter.status = 'idle';
        fighter.hp = { current: 100, max: 100 };
        fighter.skills.melee = { level: 50, xp: 0 };
        Object.values(fighter.skills).forEach(s => { s.level = 50; });
        GameState.state.heroes = [fighter];

        put(15, 'fixture_enemy');
        plant('f1', 14);
        expect(BoardState.workTileOf('f1')).toBe(15);
        run(200);

        put(13, FOREST);
        Flags.setRule('f1', 'logging', { priority: 1 });

        let won = false;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, p => { if (p.outcome === 'victory') won = true; });
        try {
            for (let i = 0; i < 600 && !won; i++) {
                BoardRunner.tick(100);
                if (!won) expect(BoardState.workTileOf('f1'), `tick ${i}, mid-fight`).toBe(15);
            }
        } finally {
            off?.();
        }
        expect(won).toBe(true);

        BoardRunner.tick(100);
        expect(BoardState.workTileOf('f1')).toBe(13);
        expect(BoardCombat.fightOfHero('f1')).toBeNull();
    });

    it('⭐ publishes zero HERO_MOVED over stable ticks with mixed priorities', () => {
        put(15, FOREST);
        // Placed in tile order: equal distances break on the earlier-placed Token (slice 1.6b).
        put(8, MINE);                                  // spare: claimable, never better
        put(13, MINE);
        put(20, MINE);
        Flags.setRule('h1', 'logging', { priority: 1 });
        Flags.setRule('h2', 'mining', { priority: 1 });
        Flags.setRule('h3', 'logging', { priority: 1 });   // its priority-1 forest is h1's
        plant('h1', 14);
        plant('h2', 14);
        plant('h3', 14);
        expect(BoardState.workTileOf('h1')).toBe(15);
        expect(BoardState.workTileOf('h2')).toBe(8);
        expect(BoardState.workTileOf('h3')).toBe(13);

        let moved = 0;
        let cycles = 0;
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, () => { moved++; }),
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, () => { cycles++; })
        ];
        try { run(30000); } finally { offs.forEach(off => off?.()); }

        expect(cycles).toBeGreaterThan(3);
        expect(moved).toBe(0);
    });
});

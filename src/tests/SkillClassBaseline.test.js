import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { calculateHeroLevel } from '../systems/hero/HeroGenerator.js';

/**
 * **Baseline for the Skill & Class rework — Phase 0 re-pinning.**
 *
 * This suite captures behaviour that is about to move, so the move is visible
 * rather than silent. It is the "re-pin orphaned rules BEFORE deleting their
 * homes" step that Phase 0 of the playmat roadmap established.
 *
 * **Every assertion here is expected to CHANGE.** That is the point. Each one
 * names the phase that changes it and what it becomes:
 *
 * | What | Today | Becomes | Phase |
 * | :-- | :-- | :-- | :-- |
 * | `calculateHeroLevel` | average of 4 combat skills, incl. `defense` | average of the hero's 6 **held** skills (D-249) | 2 |
 * | Access gate | **level only** — possession never checked | possession first, then level (D-244 §1) | 1 |
 * | `skillRequired: 0` | no check at all; any hero works it | possession still checked | 1 |
 *
 * ⚠️ **If you are the session doing Phase 1 or 2: you are supposed to break
 * these.** Update the assertion and the table above; do not delete the suite.
 * A failure here after an unrelated change, though, means something moved that
 * should not have.
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

/** The 15 skills every hero currently holds. Phase 1 cuts this to six of 27. */
const ALL_SKILLS = [
    'melee', 'ranged', 'magic', 'defense',
    'labor', 'aquatic', 'nature',
    'forge', 'cooking', 'alchemy', 'science',
    'occult', 'crime', 'explore', 'social'
];

/** A hero holding every skill at `level` — today's universal shape. */
function makeHero(id, level = 50) {
    const skills = {};
    for (const s of ALL_SKILLS) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/** A hero holding ONLY the named skills — the shape Phase 1 makes universal. */
function makePartialHero(id, held, level = 50) {
    const skills = {};
    for (const s of held) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

function run(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) BoardRunner.tick(100);
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.inventory.maxSlots = 50;
});

describe('Hero Level today: the average of four combat skills (changes in Phase 2)', () => {
    it('averages melee, ranged, magic and defense — and nothing else', () => {
        const skills = {
            melee: { level: 10 }, ranged: { level: 20 },
            magic: { level: 30 }, defense: { level: 40 }
        };
        expect(calculateHeroLevel(skills)).toBe(25);   // (10+20+30+40) / 4
    });

    it('ignores production skills entirely — a master miner is still level 1', () => {
        const skills = {
            melee: { level: 1 }, ranged: { level: 1 },
            magic: { level: 1 }, defense: { level: 1 },
            labor: { level: 99 }, nature: { level: 99 }, forge: { level: 99 }
        };
        expect(calculateHeroLevel(skills)).toBe(1);
    });

    it('counts a missing combat skill as zero rather than skipping it', () => {
        // Load-bearing for Phase 2: once heroes hold ONE combat skill, this
        // path is what would silently divide a Recruit's level toward zero.
        expect(calculateHeroLevel({ melee: { level: 40 } })).toBe(10);   // 40/4
    });
});

describe('The Access gate today: level only, never possession (changes in Phase 1)', () => {
    it('refuses a hero whose level is too low', () => {
        GameState.state.heroes = [makeHero('hero_1', 5)];      // fixture wants 25
        const token = place(10, 'fixture_gated', 'hero_1');

        run(25000);
        expect(token.alert).toBe(BoardRunner.ALERT.ACCESS);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(0);
    });

    it('refuses a hero who does not hold the skill at all — but calls it ACCESS', () => {
        // SkillSystem already fails closed on a missing skill, so the Token
        // does not run. What is missing is the DISTINCTION: "can't do this
        // work" reads identically to "not good enough yet". Phase 1 gives
        // possession its own alert reason.
        GameState.state.heroes = [makePartialHero('hero_1', ['nature', 'cooking'], 99)];
        const token = place(10, 'fixture_gated', 'hero_1');    // wants `labor`

        run(25000);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(0);
        expect(token.alert).toBe(BoardRunner.ALERT.ACCESS);
    });

    it('SkillSystem.meetsRequirement fails closed on a skill the hero lacks', () => {
        GameState.state.heroes = [makePartialHero('hero_1', ['nature'], 99)];

        expect(SkillSystem.meetsRequirement('hero_1', { skill: 'nature', level: 50 })).toBe(true);
        expect(SkillSystem.meetsRequirement('hero_1', { skill: 'labor', level: 1 })).toBe(false);
        expect(SkillSystem.meetsRequirement('hero_1', { skill: 'labor', level: 0 })).toBe(false);
    });

    it('⚠️ THE HOLE: at skillRequired 0 the skills map is never consulted', () => {
        // `BoardRunner.heroMeetsRequirement` returns true early when
        // `required <= 0`, so a hero who has never heard of `crafting` works a
        // crafting Token. Harmless while every hero holds every skill; the
        // moment they hold six of 27 it is a hole straight through possession.
        //
        // **Phase 1 flips this assertion to 0 produced + a possession alert.**
        GameState.state.heroes = [makePartialHero('hero_1', ['nature'], 99)];
        const token = place(10, 'fixture_ungated', 'hero_1');  // wants `crafting`, level 0

        run(11000);
        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(1);
        expect(token.alert).toBeFalsy();
    });
});

describe('Every hero holds all 15 skills (changes in Phase 1)', () => {
    it('a generated hero has the full set, each independently levelled', () => {
        GameState.state.heroes = [makeHero('hero_1', 1)];
        const hero = GameState.state.heroes[0];

        expect(Object.keys(hero.skills)).toHaveLength(15);
        for (const id of ALL_SKILLS) expect(hero.skills[id]).toBeDefined();
    });

    it('the six ids being deleted are still live today', () => {
        // labor, aquatic, forge, defense, explore, social all disappear in
        // Phase 1. This asserts they exist now, so their removal is a visible
        // diff rather than a quiet one.
        GameState.state.heroes = [makeHero('hero_1', 7)];
        const hero = GameState.state.heroes[0];

        for (const doomed of ['labor', 'aquatic', 'forge', 'defense', 'explore', 'social']) {
            expect(hero.skills[doomed].level).toBe(7);
        }
    });
});

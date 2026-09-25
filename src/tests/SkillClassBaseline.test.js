import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { calculateHeroLevel } from '../systems/hero/HeroGenerator.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';
import {
    FOUNDATION_SKILL_IDS,
    COMBAT_SKILL_IDS,
    SIGNATURE_SKILL_IDS
} from '../config/registries/skillRegistry.js';

/**
 * **The Skill & Class rework's moving parts, pinned.**
 *
 * Written in Phase 0 to capture behaviour *before* it moved, so the move would
 * be visible rather than silent. Updated in Phase 1 as each rule flipped.
 *
 * | What | Was | Now | Phase |
 * | :-- | :-- | :-- | :-- |
 * | Hero shape | all 15 skills | ✅ the Foundation six — a Recruit | 1 |
 * | Access gate | level only; possession never checked | ✅ possession first, then level | 1 |
 * | `skillRequired: 0` | no check at all — any hero worked it | ✅ possession still checked | 1 |
 * | `calculateHeroLevel` | average of 4 combat skills incl. `defense` | ✅ average of the skills **held** (D-260) | 1 |
 * | `CombatFormulas` `defense` reads | reads `skills.defense` | ✅ the single combat skill | 2 |
 * | Combat XP | style award **plus** a third into Defence | ✅ the whole award, one skill | 2 |
 * | Fighting | any hero could fight | ✅ possession of a combat skill (D-249) | 2 |
 *
 * Every row has now flipped. The suite stays as the record of what moved and
 * when — a failure here after an *unrelated* change means something moved that
 * should not have.
 *
 * Nothing below names a skill by hand — every id comes from the registry,
 * because the skill list is a first draft and expected to change.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));


vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** A hero holding exactly `held`, each at `level`. */
function makeHero(id, held, level = 50) {
    const skills = {};
    for (const s of held) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/** A Recruit: the Foundation six and nothing else. */
const makeRecruit = (id, level = 50) => makeHero(id, FOUNDATION_SKILL_IDS, level);

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names one spot on the mat for the Token under test to stand on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
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

describe('Hero Level is the average of the skills a hero HOLDS', () => {
    it('averages held skills, whatever they are', () => {
        const [a, b, c, d] = FOUNDATION_SKILL_IDS;
        const skills = {
            [a]: { level: 10 }, [b]: { level: 20 },
            [c]: { level: 30 }, [d]: { level: 40 }
        };
        expect(calculateHeroLevel(skills)).toBe(25);
    });

    it('counts production skills — a master miner is NOT level 1', () => {
        // The old formula read only the four combat skills, so a fully-trained
        // production hero scored 1. This is the line that changed.
        const skills = Object.fromEntries(
            FOUNDATION_SKILL_IDS.map(id => [id, { level: 40 }])
        );
        expect(calculateHeroLevel(skills)).toBe(40);
    });

    it('a hero with no skills at all is level 0, not NaN', () => {
        expect(calculateHeroLevel({})).toBe(0);
        expect(calculateHeroLevel(null)).toBe(0);
    });
});

describe('The gate is possession first, then level', () => {
    /**
     * ⚠️ Under flags (Free Playmat 1.4b) a hero who cannot run a Token does not
     * stand on it with a red mark: their flag skips it and records why, for
     * hover (FP-48, FP-60). Where the hero lacks the skill, the flag is planted
     * with the Token's skill directly — a drop would keep the hero's own skill
     * (FPP-3) and the Token would not even be a candidate.
     */
    const plantFor = (heroId, tile, skill) => Flags.plant(heroId, C(tile), { skill });
    const skipReasons = (token) => Flags.skipsOf(token.id).map(s => s.reason);

    it('refuses a hero whose level is too low, and calls it ACCESS', () => {
        // `fixture_gated` wants a Foundation skill at 25.
        GameState.state.heroes = [makeRecruit('hero_1', 5)];
        const token = place(10, 'fixture_gated', 'hero_1');

        run(25000);
        expect(skipReasons(token)).toEqual([BoardRunner.ALERT.ACCESS]);
        expect(token.alert).toBeFalsy();
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(0);
    });

    it('refuses a hero who does not hold the skill, and calls it UNSKILLED', () => {
        // Two different problems, two different reasons. Levelling fixes one of
        // them and can never fix the other, so they must not look alike.
        GameState.state.heroes = [makeHero('hero_1', SIGNATURE_SKILL_IDS.slice(0, 2), 99)];
        const token = place(10, 'fixture_gated');
        plantFor('hero_1', 10, 'mining');

        run(25000);
        expect(skipReasons(token)).toEqual([BoardRunner.ALERT.UNSKILLED]);
        expect(token.alert).toBeFalsy();
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(0);
    });

    it('lets a qualified hero work, and clears the mark', () => {
        GameState.state.heroes = [makeRecruit('hero_1', 30)];
        const token = place(10, 'fixture_gated', 'hero_1');

        run(21000);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(6);
        expect(token.alert).toBeFalsy();
    });

    it('THE HOLE IS CLOSED: skillRequired 0 still checks possession', () => {
        // Phase 0 pinned this as a PASSING test of the wrong behaviour:
        // `heroMeetsRequirement` returned true the moment `required <= 0` and
        // never looked at the hero's skills, so a hero who did not hold the
        // skill worked the Token anyway.
        GameState.state.heroes = [makeHero('hero_1', SIGNATURE_SKILL_IDS.slice(0, 1), 99)];
        const token = place(10, 'fixture_ungated');
        plantFor('hero_1', 10, 'crafting');

        run(11000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(0);
        expect(skipReasons(token)).toEqual([BoardRunner.ALERT.UNSKILLED]);
        expect(token.alert).toBeFalsy();
    });

    it('...and a hero who DOES hold it still works a zero-requirement Token', () => {
        const skillId = 'crafting';   // what `fixture_ungated` asks for
        GameState.state.heroes = [makeHero('hero_1', [skillId], 1)];
        const token = place(10, 'fixture_ungated', 'hero_1');

        run(11000);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(1);
        expect(token.alert).toBeFalsy();
    });

    it('names the two failures apart at the SkillSystem level too', () => {
        GameState.state.heroes = [makeRecruit('hero_1', 10)];
        const held = FOUNDATION_SKILL_IDS[0];
        const notHeld = SIGNATURE_SKILL_IDS[0];

        expect(SkillSystem.requirementFailure('hero_1', { skill: held, level: 5 })).toBeNull();
        expect(SkillSystem.requirementFailure('hero_1', { skill: held, level: 50 })).toBe('LEVEL');
        expect(SkillSystem.requirementFailure('hero_1', { skill: notHeld, level: 1 })).toBe('POSSESSION');
    });
});

describe('One combat skill supplies both halves (Phase 2)', () => {
    it('attack and defence read the same number', () => {
        const hero = { skills: { [COMBAT_SKILL_IDS[0]]: { level: 30 } } };

        expect(CombatFormulas.getHeroCombatSkill(hero)).toBe(30);
        expect(CombatFormulas.getHeroDefenseSkill(hero)).toBe(30);
    });

    it('a Recruit scores 0, not 1 — they are a non-combatant, not a weak one', () => {
        const recruit = {
            skills: Object.fromEntries(FOUNDATION_SKILL_IDS.map(id => [id, { level: 40 }]))
        };

        expect(CombatFormulas.getHeroCombatSkillEntry(recruit).id).toBeNull();
        expect(CombatFormulas.getHeroCombatSkill(recruit)).toBe(0);
        expect(CombatFormulas.canHeroFight(recruit)).toBe(false);
    });

    it('max HP tracks the combat skill, and production skills never touch it', () => {
        const fighter = { [COMBAT_SKILL_IDS[0]]: { level: 20 } };
        const miner = Object.fromEntries(FOUNDATION_SKILL_IDS.map(id => [id, { level: 99 }]));

        const fighterHp = CombatFormulas.heroMaxHpFromSkills(fighter);
        const minerHp = CombatFormulas.heroMaxHpFromSkills(miner);

        expect(fighterHp).toBeGreaterThan(minerHp);
        // A Recruit still has a body: HP floors at the level-1 value rather
        // than collapsing to zero, because they stand on the board and heal.
        expect(minerHp).toBe(CombatFormulas.heroMaxHpFromSkills({}));
        expect(minerHp).toBeGreaterThan(0);
    });

    it('an unarmed hero fights in their own style, not a hardcoded melee', () => {
        const ranged = COMBAT_SKILL_IDS[1];
        expect(CombatFormulas.getHeroCombatStyle({ skills: { [ranged]: { level: 5 } } }))
            .toBe(ranged);
    });
});

describe('A hero holds some skills, not all of them', () => {
    it('a Recruit holds the Foundation skills and no others', () => {
        GameState.state.heroes = [makeRecruit('hero_1', 1)];
        const hero = GameState.state.heroes[0];

        expect(Object.keys(hero.skills).sort()).toEqual([...FOUNDATION_SKILL_IDS].sort());
        for (const id of [...COMBAT_SKILL_IDS, ...SIGNATURE_SKILL_IDS]) {
            expect(hero.skills[id]).toBeUndefined();
        }
    });

    it('the deleted ids are gone from the registry', () => {
        // labor, aquatic, forge, defense, social. Content or a save still
        // naming one of these must fail loudly, not resolve to something
        // approximate — which is why the sub-skill funnel went with them.
        // `explore` was the sixth; Token Lifecycle slice 1.1 reuses the id for
        // a NEW foundation skill (SP-74), asserted below.
        const { SKILLS } = require('../config/registries/skillRegistry.js');
        for (const dead of ['labor', 'aquatic', 'forge', 'defense', 'social']) {
            expect(SKILLS[dead]).toBeUndefined();
        }
    });

    it('explore is the new foundation Explore skill, not an alias of survival (SP-74)', () => {
        // Nothing ever remapped the old `explore` id to `survival` (no alias,
        // no save migration), so the id was free to reuse.
        const { SKILLS, SKILL_LAYERS } = require('../config/registries/skillRegistry.js');
        expect(SKILLS.explore.layer).toBe(SKILL_LAYERS.FOUNDATION);
        expect(SKILLS.explore.name).toBe('Explore');
        expect(SKILLS.survival.layer).toBe(SKILL_LAYERS.SIGNATURE);
    });
});

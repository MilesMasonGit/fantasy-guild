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
 * | `CombatFormulas` `defense` reads | reads `skills.defense` | the single combat skill | **2 — still open** |
 *
 * ⚠️ **If you are the session doing Phase 2, you are meant to break the last
 * row.** Update the assertion and this table; do not delete the suite. A
 * failure here after an *unrelated* change means something moved that should
 * not have.
 *
 * Nothing below names a skill by hand — every id comes from the registry,
 * because the skill list is a first draft and expected to change.
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

/** A hero holding exactly `held`, each at `level`. */
function makeHero(id, held, level = 50) {
    const skills = {};
    for (const s of held) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/** A Recruit: the Foundation six and nothing else. */
const makeRecruit = (id, level = 50) => makeHero(id, FOUNDATION_SKILL_IDS, level);

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
    it('refuses a hero whose level is too low, and calls it ACCESS', () => {
        // `fixture_gated` wants a Foundation skill at 25.
        GameState.state.heroes = [makeRecruit('hero_1', 5)];
        const token = place(10, 'fixture_gated', 'hero_1');

        run(25000);
        expect(token.alert).toBe(BoardRunner.ALERT.ACCESS);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(0);
    });

    it('refuses a hero who does not hold the skill, and calls it UNSKILLED', () => {
        // Two different problems, two different marks. Levelling fixes one of
        // them and can never fix the other, so they must not look alike.
        GameState.state.heroes = [makeHero('hero_1', SIGNATURE_SKILL_IDS.slice(0, 2), 99)];
        const token = place(10, 'fixture_gated', 'hero_1');

        run(25000);
        expect(token.alert).toBe(BoardRunner.ALERT.UNSKILLED);
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
        const token = place(10, 'fixture_ungated', 'hero_1');

        run(11000);
        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(0);
        expect(token.alert).toBe(BoardRunner.ALERT.UNSKILLED);
    });

    it('...and a hero who DOES hold it still works a zero-requirement Token', () => {
        const skillId = 'crafting';   // what `fixture_ungated` asks for
        GameState.state.heroes = [makeHero('hero_1', [skillId], 1)];
        const token = place(10, 'fixture_ungated', 'hero_1');

        run(11000);
        expect(SpriteLayer.countOnBoard('item_oak_wood')).toBe(1);
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

describe('A hero holds six of twenty-seven', () => {
    it('a Recruit holds the Foundation skills and no others', () => {
        GameState.state.heroes = [makeRecruit('hero_1', 1)];
        const hero = GameState.state.heroes[0];

        expect(Object.keys(hero.skills).sort()).toEqual([...FOUNDATION_SKILL_IDS].sort());
        for (const id of [...COMBAT_SKILL_IDS, ...SIGNATURE_SKILL_IDS]) {
            expect(hero.skills[id]).toBeUndefined();
        }
    });

    it('the six deleted ids are gone from the registry', () => {
        // labor, aquatic, forge, defense, explore, social. Content or a save
        // still naming one of these must fail loudly, not resolve to something
        // approximate — which is why the sub-skill funnel went with them.
        const { SKILLS } = require('../config/registries/skillRegistry.js');
        for (const dead of ['labor', 'aquatic', 'forge', 'defense', 'explore', 'social']) {
            expect(SKILLS[dead]).toBeUndefined();
        }
    });
});

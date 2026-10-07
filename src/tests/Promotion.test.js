import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as PromotionSystem from '../systems/hero/PromotionSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import {
    getJobSkills, getJobSheet, getPromotionCost, getPromotionGateSkills, STARTING_JOB_ID
} from '../config/registries/jobRegistry.js';
import { FOUNDATION_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { restoreBankedFoundation } from '../systems/hero/logic/HeroRehydration.js';
import { canHeroFight } from '../utils/CombatFormulas.js';

/**
 * Promotion, re-training and banking.
 *
 * ⚠️ **No gold, no materials (Promotes rule P3).** A promotion is paid for
 * with a charge of the Token whose Promotes rule names the job, spent by
 * `BoardPromotion` — see `BoardPromotion.test.js`. This file tests the
 * qualification and the skill-sheet swap, which is all `PromotionSystem` does.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/** A hero skilled enough to take `jobId`. */
function makeQualified(jobId, { extraLevels = 0 } = {}) {
    const hero = generateHero();
    HeroManager.addHero(hero);
    qualify(hero, jobId, extraLevels);
    return hero;
}

/** Raise the skills `jobId` carries forward to its threshold. */
function qualify(hero, jobId, extraLevels = 0) {
    const cost = getPromotionCost(jobId);
    for (const skillId of getPromotionGateSkills(jobId)) {
        if (!hero.skills[skillId]) hero.skills[skillId] = { xp: 0, level: 0 };
        hero.skills[skillId].level = cost.skillLevel + extraLevels;
    }
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.progress.rosterLimit = 20;
    GameState.state.heroes = [];
});

describe('The gate is the skills a job carries forward (D-262)', () => {
    it('refuses a Recruit who has not trained the right skills', () => {
        const hero = generateHero();
        HeroManager.addHero(hero);

        const verdict = PromotionSystem.canPromote(hero.id, 'fighter');
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toBe(PromotionSystem.REFUSAL.SKILL_TOO_LOW);
        // It says WHICH skills, and by how much — the player can act on that.
        expect(verdict.missing.length).toBeGreaterThan(0);
        expect(verdict.detail).toMatch(/\d+\/\d+/);
    });

    it('accepts once those skills reach the threshold', () => {
        const hero = makeQualified('fighter');
        expect(PromotionSystem.canPromote(hero.id, 'fighter').ok).toBe(true);
    });

    it('gates only on carried-forward skills, not on everything the hero holds', () => {
        // A Fighter's list does not name Fishing or Cooking (it keeps them,
        // but does not gate on them). Being terrible at them must not block
        // the promotion.
        const hero = makeQualified('fighter');
        const dropped = Object.keys(hero.skills)
            .filter(id => !getJobSkills('fighter').includes(id));

        expect(dropped.length).toBeGreaterThan(0);
        for (const id of dropped) hero.skills[id].level = 1;

        expect(PromotionSystem.canPromote(hero.id, 'fighter').ok).toBe(true);
    });

    /**
     * ⚠️ **Replaces two tests that asserted the retired price** — "refuses when
     * the gold is short" and "refuses when the materials are short". They
     * correctly described a rule the owner deliberately replaced. This is the
     * assertion that keeps the old price from creeping back.
     */
    it('does not care about materials (or gold, which is gone) — the Token is the price', () => {
        const hero = makeQualified('fighter');
        GameState.state.inventory.items = {};

        expect(PromotionSystem.canPromote(hero.id, 'fighter').ok).toBe(true);
    });

    it('has no gold or material refusals left to give', () => {
        expect(PromotionSystem.REFUSAL.NOT_ENOUGH_GOLD).toBeUndefined();
        expect(PromotionSystem.REFUSAL.SHORT_ON_MATERIALS).toBeUndefined();
    });

    it('refuses the job the hero already holds', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        expect(PromotionSystem.canPromote(hero.id, 'fighter').reason)
            .toBe(PromotionSystem.REFUSAL.SAME_JOB);
    });
});

describe('A promotion swaps the sheet', () => {
    it('leaves the hero holding exactly the new job sheet', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        expect(hero.jobId).toBe('fighter');
        // the held sheet is every foundation skill plus the Fighter's own.
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet('fighter')].sort());
    });

    /** ⚠️ Replaces 'takes the gold and the materials'. */
    it('leaves the guild materials completely alone (gold is gone, 9.4)', () => {
        const hero = makeQualified('fighter');
        InventoryManager.addItem('item_copper_ingot', 10);

        PromotionSystem.promote(hero.id, 'fighter');

        expect(InventoryManager.getItemCount('item_copper_ingot')).toBe(10);
    });

    it('changes nothing when it refuses', () => {
        const hero = generateHero();          // unqualified: no trained skills
        HeroManager.addHero(hero);
        const skillsBefore = Object.keys(hero.skills).sort();

        const result = PromotionSystem.promote(hero.id, 'fighter');

        expect(result.success).toBe(false);
        expect(hero.jobId).toBe(STARTING_JOB_ID);
        expect(Object.keys(hero.skills).sort()).toEqual(skillsBefore);
    });

    it('turns a Recruit into someone who can fight', () => {
        const hero = makeQualified('fighter');
        expect(canHeroFight(hero)).toBe(false);

        PromotionSystem.promote(hero.id, 'fighter');

        expect(canHeroFight(hero)).toBe(true);
        expect(hero.hp.max).toBeGreaterThan(0);
    });
});

describe('⭐ Promotion keeps all nine starting skills (TL-7)', () => {
    /** Levels 30, 31, … on each foundation skill, so each is distinguishable. */
    function stampFoundation(hero) {
        const stamped = {};
        FOUNDATION_SKILL_IDS.forEach((id, i) => {
            hero.skills[id].level = 30 + i;
            hero.skills[id].xp = 1000 + i;
            stamped[id] = { level: 30 + i, xp: 1000 + i };
        });
        return stamped;
    }

    it('a Recruit promoted to Fighter, then Knight, holds all nine at their levels plus the class skills', () => {
        const hero = generateHero();
        HeroManager.addHero(hero);
        // Every foundation skill at 30+ clears both the Fighter (10) and the
        // Knight (25) gates for their foundation picks.
        const stamped = stampFoundation(hero);

        const toFighter = PromotionSystem.promote(hero.id, 'fighter');
        expect(toFighter.success).toBe(true);
        expect(toFighter.banked).toEqual([]);

        qualify(hero, 'knight');   // raises the Fighter's melee/leadership
        // qualify() also writes the gate's foundation picks to 25; put the
        // stamped levels back so the check below is about promotion alone.
        for (const [id, s] of Object.entries(stamped)) hero.skills[id].level = s.level;
        const toKnight = PromotionSystem.promote(hero.id, 'knight');
        expect(toKnight.success).toBe(true);
        expect(toKnight.banked).toEqual([]);

        for (const [id, s] of Object.entries(stamped)) {
            expect(hero.skills[id], `${id} held`).toEqual(s);
        }
        for (const id of getJobSkills('knight')) expect(hero.skills[id], id).toBeDefined();
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet('knight')].sort());
        expect(Object.keys(hero.skills)).toHaveLength(13);
        expect(hero.bankedSkills || {}).toEqual({});
    });

    it('a never-held skill arrives at level 1, not from the bank', () => {
        const hero = makeQualified('fighter');
        const result = PromotionSystem.promote(hero.id, 'fighter');

        // Combat and the shared specialist are both new to a Recruit.
        expect(result.gained).toHaveLength(2);
        for (const id of result.gained) expect(hero.skills[id].level).toBe(1);
    });

    it('restores foundation skills an older save had banked, on the next promotion', () => {
        // A hero like that gets them back, at their stored level, when promoted
        // again.
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');
        hero.bankedSkills = { fishing: { level: 19, xp: 777 } };
        delete hero.skills.fishing;

        qualify(hero, 'knight');
        const result = PromotionSystem.promote(hero.id, 'knight');

        expect(result.restored).toContain('fishing');
        expect(hero.skills.fishing).toEqual({ level: 19, xp: 777 });
        expect(hero.bankedSkills.fishing).toBeUndefined();
    });

    it('restores them on load too (rehydration), and leaves banked non-foundation skills alone', () => {
        const hero = generateHero({ jobId: 'fighter' });
        delete hero.skills.farming;
        hero.skills.cooking = { level: 5, xp: 50 };
        hero.bankedSkills = {
            farming: { level: 14, xp: 400 },
            cooking: { level: 99, xp: 9 },     // a held copy wins
            armory: { level: 8, xp: 80 }
        };

        const restored = restoreBankedFoundation(hero);

        expect(restored).toEqual(['farming']);
        expect(hero.skills.farming).toEqual({ level: 14, xp: 400 });
        expect(hero.skills.cooking.level).toBe(5);
        expect(hero.bankedSkills).toEqual({ armory: { level: 8, xp: 80 } });
    });
});

describe('⚠️ Banking — nothing is lost, only set down (D-71)', () => {
    // ⚠️ Rewritten (slice 1.2). These used to bank the foundation skills
    // Recruit → Fighter dropped; promotion no longer drops any. Banking now
    // only happens when re-training ACROSS branches, which swaps
    // non-foundation skills — so that is what these exercise.

    /** A Fighter, re-trained to Cleric: banks Leadership, gains Faith. */
    function fighterThenCleric({ leadership = 17 } = {}) {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');
        hero.skills.leadership.level = leadership;
        qualify(hero, 'cleric');
        const result = PromotionSystem.promote(hero.id, 'cleric');
        return { hero, result };
    }

    it('banks a removed skill AT ITS LEVEL, not at zero', () => {
        const { hero, result } = fighterThenCleric({ leadership: 17 });

        expect(result.success).toBe(true);
        expect(result.banked).toEqual(['leadership']);
        expect(hero.skills.leadership).toBeUndefined();
        expect(hero.bankedSkills.leadership.level).toBe(17);
        // And every foundation skill is still held.
        for (const id of FOUNDATION_SKILL_IDS) expect(hero.skills[id], id).toBeDefined();
    });

    it('restores a banked skill intact when a later job wants it again', () => {
        const { hero } = fighterThenCleric({ leadership: 22 });

        // Back to Fighter, which wants Leadership again.
        qualify(hero, 'fighter');
        const result = PromotionSystem.promote(hero.id, 'fighter');

        expect(result.success).toBe(true);
        expect(result.restored).toContain('leadership');
        expect(hero.skills.leadership.level, 'restored at its banked level, not 1').toBe(22);
        expect(hero.bankedSkills.leadership, 'and taken back out of the bank').toBeUndefined();
    });

    it('banked skills count toward a later gate — the hero has not forgotten', () => {
        const { hero } = fighterThenCleric({ leadership: 40 });
        expect(PromotionSystem.knownLevel(hero, 'leadership')).toBe(40);
    });

    it('survives a save/load round trip', () => {
        const { hero } = fighterThenCleric({ leadership: 13 });

        // The bank is ordinary hero state, so it rides along with the save.
        const revived = JSON.parse(JSON.stringify(GameState.state.heroes));
        const reloaded = revived.find(h => h.id === hero.id);

        expect(reloaded.jobId).toBe('cleric');
        expect(reloaded.bankedSkills.leadership.level).toBe(13);
    });
});

describe('Re-training is the same act as promoting (D-248)', () => {
    // ⚠️ Un-skipped in Promotes rule P3.
    it('moves a hero sideways between siblings', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        // Qualify for both Knight and Warlord, then take Knight.
        for (const jobId of ['knight', 'warlord']) qualify(hero, jobId);
        expect(PromotionSystem.promote(hero.id, 'knight').success).toBe(true);
        expect(hero.skills.armory).toBeDefined();

        // Re-train to the sibling. The signature swaps over.
        const result = PromotionSystem.promote(hero.id, 'warlord');

        expect(result.success).toBe(true);
        expect(hero.jobId).toBe('warlord');
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet('warlord')].sort());
        expect(hero.skills.armory, 'the old signature is gone').toBeUndefined();
        expect(hero.bankedSkills.armory, 'but banked, not destroyed').toBeDefined();
    });

    it('a full Recruit → Fighter → Knight run lands on exactly the Knight sheet', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        const cost = getPromotionCost('knight');
        for (const skillId of getPromotionGateSkills('knight')) {
            hero.skills[skillId].level = cost.skillLevel;
        }
        PromotionSystem.promote(hero.id, 'knight');

        expect(hero.jobId).toBe('knight');
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet('knight')].sort());
    });
});

describe('The UI is told, so the Dock actually redraws', () => {
    // ⚠️ Standing in for browser verification: the Dock's six skill cells
    // changing contents hangs entirely off these two events. the Dock
    // subscribes to `heroes_updated` and projects `hero.skills`, so if the event
    // does not fire the grid keeps showing the old job's skills and nothing
    // looks wrong.

    it('publishes heroes_updated, which is what the Dock listens to', () => {
        const hero = makeQualified('fighter');
        const seen = [];
        const off = EventBus.subscribe('heroes_updated', p => seen.push(p));

        PromotionSystem.promote(hero.id, 'fighter');
        off?.();

        expect(seen.some(p => p.heroId === hero.id && p.source === 'promote')).toBe(true);
    });

    it('publishes hero_promoted carrying the whole trade', () => {
        const hero = makeQualified('fighter');
        const seen = [];
        const off = EventBus.subscribe('hero_promoted', p => seen.push(p));

        PromotionSystem.promote(hero.id, 'fighter');
        off?.();

        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({
            heroId: hero.id, fromJobId: STARTING_JOB_ID, toJobId: 'fighter'
        });
        // (Slice 1.1 asserted five banked here.)
        expect(seen[0].banked).toEqual([]);
        expect(seen[0].gained).toHaveLength(2);
    });

    it('the projection the Dock renders changes to the new job sheet', () => {
        // The skills projection the Dock renders: id:level pairs off hero.skills.
        const hero = makeQualified('fighter');
        const project = () => Object.entries(hero.skills)
            .map(([id, s]) => `${id}:${s.level}`).sort().join(',');

        const before = project();
        PromotionSystem.promote(hero.id, 'fighter');
        const after = project();

        expect(after).not.toBe(before);
        // nine foundation + combat + shared.
        expect(after.split(',')).toHaveLength(11);
        for (const id of getJobSheet('fighter')) expect(after).toContain(`${id}:`);
    });
});

describe('Preview shows the trade before the player commits', () => {
    it('names what is lost, kept and arriving', () => {
        const hero = makeQualified('fighter');
        const preview = PromotionSystem.previewPromotion(hero.id, 'fighter');

        // (Slice 1.1 asserted five lost and four kept.)
        expect(preview.losing).toEqual([]);
        expect(preview.arriving.length).toBe(2);
        expect(preview.keeping.length).toBe(FOUNDATION_SKILL_IDS.length);
        expect(preview.ok).toBe(true);
    });

    it('names a re-training swap: the old branch skill is lost (banked)', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');
        hero.skills.leadership.level = 12;

        const preview = PromotionSystem.previewPromotion(hero.id, 'cleric');

        expect(preview.losing).toEqual([{ skillId: 'leadership', name: expect.any(String), level: 12 }]);
        expect(preview.arriving.map(a => a.skillId)).toEqual(['faith']);
    });

    it('marks an arriving skill as restored, with its real level', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');
        hero.skills.leadership.level = 31;
        qualify(hero, 'cleric');
        PromotionSystem.promote(hero.id, 'cleric');   // banks Leadership at 31

        const preview = PromotionSystem.previewPromotion(hero.id, 'fighter');
        const entry = preview.arriving.find(a => a.skillId === 'leadership');

        expect(entry.restored).toBe(true);
        expect(entry.level).toBe(31);
    });
});

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
import { STARTING_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { restoreBankedStarting } from '../systems/hero/logic/HeroRehydration.js';
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

/** A hero skilled enough to take `jobId`, starting from `fromJobId`. */
function makeQualified(jobId, { extraLevels = 0, fromJobId } = {}) {
    const hero = generateHero(fromJobId ? { jobId: fromJobId } : {});
    HeroManager.addHero(hero);
    qualify(hero, jobId, extraLevels);
    return hero;
}

/** Raise the skills `jobId` gates on to its threshold. */
function qualify(hero, jobId, extraLevels = 0) {
    const cost = getPromotionCost(jobId);
    for (const skillId of getPromotionGateSkills(jobId)) {
        if (!hero.skills[skillId]) hero.skills[skillId] = { xp: 0, level: 0 };
        hero.skills[skillId].level = cost.skillLevel + extraLevels;
    }
}

/** A Fighter who has just been promoted from Recruit. */
function freshFighter() {
    const hero = makeQualified('fighter');
    expect(PromotionSystem.promote(hero.id, 'fighter').success).toBe(true);
    return hero;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.progress.rosterLimit = 20;
    GameState.state.heroes = [];
});

describe('The gate is the skills a job carries forward (D-262)', () => {
    it('refuses a Fighter who has not trained the skills a Paladin keeps', () => {
        const hero = freshFighter();

        const verdict = PromotionSystem.canPromote(hero.id, 'paladin');
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toBe(PromotionSystem.REFUSAL.SKILL_TOO_LOW);
        // It says WHICH skills, and by how much — the player can act on that.
        expect(verdict.missing.map(m => m.skillId).sort()).toEqual(['leadership', 'melee']);
        expect(verdict.detail).toMatch(/\d+\/\d+/);
    });

    it('accepts once those skills reach the threshold', () => {
        const hero = freshFighter();
        qualify(hero, 'paladin');
        expect(PromotionSystem.canPromote(hero.id, 'paladin').ok).toBe(true);
    });

    it('gates only on carried-forward skills, not on everything the hero holds', () => {
        // A Paladin's list does not name Fishing or Cooking (it keeps them,
        // but does not gate on them). Being terrible at them must not block
        // the promotion.
        const hero = freshFighter();
        qualify(hero, 'paladin');
        const unlisted = Object.keys(hero.skills)
            .filter(id => !getJobSkills('paladin').includes(id));

        expect(unlisted.length).toBeGreaterThan(0);
        for (const id of unlisted) hero.skills[id].level = 1;

        expect(PromotionSystem.canPromote(hero.id, 'paladin').ok).toBe(true);
    });

    it('each basic class gates on its two named Starting skills', () => {
        expect(getPromotionGateSkills('fighter')).toEqual(['mining', 'smithing']);
        expect(getPromotionGateSkills('ranger')).toEqual(['forestry', 'crafting']);
        expect(getPromotionGateSkills('wizard')).toEqual(['alchemy', 'cooking']);
        expect(getPromotionGateSkills('rogue')).toEqual(['fishing', 'crafting']);
        expect(getPromotionCost('fighter').skillLevel).toBe(10);
    });

    it('a Recruit cannot become a Fighter until Mining and Smithing reach 10', () => {
        const hero = generateHero();
        HeroManager.addHero(hero);
        for (const id of STARTING_SKILL_IDS) hero.skills[id].level = 50;
        hero.skills.mining.level = 9;
        hero.skills.smithing.level = 3;

        const verdict = PromotionSystem.canPromote(hero.id, 'fighter');
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toBe(PromotionSystem.REFUSAL.SKILL_TOO_LOW);
        expect(verdict.missing.map(m => m.skillId)).toEqual(['mining', 'smithing']);
        // What the Change Job planner prints.
        expect(verdict.detail).toBe('Needs Mining 9/10, Smithing 3/10');

        hero.skills.mining.level = 10;
        expect(PromotionSystem.canPromote(hero.id, 'fighter').missing.map(m => m.skillId))
            .toEqual(['smithing']);
        hero.skills.smithing.level = 10;
        expect(PromotionSystem.canPromote(hero.id, 'fighter').ok).toBe(true);
    });

    it('a Recruit who qualifies for one basic class does not qualify for the others', () => {
        const hero = generateHero();
        HeroManager.addHero(hero);
        for (const id of STARTING_SKILL_IDS) hero.skills[id].level = 1;
        qualify(hero, 'wizard');

        expect(PromotionSystem.canPromote(hero.id, 'wizard').ok).toBe(true);
        for (const jobId of ['fighter', 'ranger', 'rogue']) {
            expect(PromotionSystem.canPromote(hero.id, jobId).ok, jobId).toBe(false);
        }
    });

    it('a master class gates on its parent\'s combat and advanced skill at 25', () => {
        expect(getPromotionGateSkills('paladin').sort()).toEqual(['leadership', 'melee']);
        expect(getPromotionCost('paladin').skillLevel).toBe(25);
    });

    /**
     * ⚠️ **Replaces two tests that asserted the retired price** — "refuses when
     * the gold is short" and "refuses when the materials are short". They
     * correctly described a rule the owner deliberately replaced. This is the
     * assertion that keeps the old price from creeping back.
     */
    it('does not care about materials (or gold, which is gone) — the Token is the price', () => {
        const hero = freshFighter();
        qualify(hero, 'paladin');
        GameState.state.inventory.items = {};

        expect(PromotionSystem.canPromote(hero.id, 'paladin').ok).toBe(true);
    });

    it('has no gold or material refusals left to give', () => {
        expect(PromotionSystem.REFUSAL.NOT_ENOUGH_GOLD).toBeUndefined();
        expect(PromotionSystem.REFUSAL.SHORT_ON_MATERIALS).toBeUndefined();
    });

    it('refuses the job the hero already holds', () => {
        const hero = freshFighter();

        expect(PromotionSystem.canPromote(hero.id, 'fighter').reason)
            .toBe(PromotionSystem.REFUSAL.SAME_JOB);
    });
});

describe('A promotion swaps the sheet', () => {
    it('leaves the hero holding exactly the new job sheet', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        expect(hero.jobId).toBe('fighter');
        // the held sheet is every Starting skill plus the Fighter's own.
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
        const hero = freshFighter();          // unqualified for a master class
        const skillsBefore = JSON.stringify(hero.skills);

        const result = PromotionSystem.promote(hero.id, 'paladin');

        expect(result.success).toBe(false);
        expect(hero.jobId).toBe('fighter');
        expect(JSON.stringify(hero.skills)).toBe(skillsBefore);
    });

    it('turns a Recruit into someone who can fight', () => {
        const hero = makeQualified('fighter');
        expect(canHeroFight(hero)).toBe(false);

        PromotionSystem.promote(hero.id, 'fighter');

        expect(canHeroFight(hero)).toBe(true);
        expect(hero.hp.max).toBeGreaterThan(0);
    });
});

describe('⭐ Promotion keeps all nine Starting skills (TL-7)', () => {
    /** Levels 30, 31, … on each Starting skill, so each is distinguishable. */
    function stampStarting(hero) {
        const stamped = {};
        STARTING_SKILL_IDS.forEach((id, i) => {
            hero.skills[id].level = 30 + i;
            hero.skills[id].xp = 1000 + i;
            stamped[id] = { level: 30 + i, xp: 1000 + i };
        });
        return stamped;
    }

    it('Recruit → Fighter → Paladin holds 13 skills at their levels', () => {
        const hero = generateHero();
        HeroManager.addHero(hero);
        const stamped = stampStarting(hero);

        const toFighter = PromotionSystem.promote(hero.id, 'fighter');
        expect(toFighter.success).toBe(true);
        expect(toFighter.banked).toEqual([]);
        expect(toFighter.gained.sort()).toEqual(['leadership', 'melee']);

        hero.skills.melee = { level: 27, xp: 2700 };
        hero.skills.leadership = { level: 26, xp: 2600 };
        const toPaladin = PromotionSystem.promote(hero.id, 'paladin');
        expect(toPaladin.success).toBe(true);
        expect(toPaladin.banked).toEqual([]);
        expect(toPaladin.gained.sort()).toEqual(['enchanting', 'faith']);

        for (const [id, s] of Object.entries(stamped)) {
            expect(hero.skills[id], `${id} held`).toEqual(s);
        }
        expect(hero.skills.melee).toEqual({ level: 27, xp: 2700 });
        expect(hero.skills.leadership).toEqual({ level: 26, xp: 2600 });
        expect(hero.skills.enchanting.level).toBe(1);
        expect(hero.skills.faith.level).toBe(1);
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet('paladin')].sort());
        expect(Object.keys(hero.skills)).toHaveLength(13);
        expect(hero.bankedSkills || {}).toEqual({});
    });

    it('a never-held skill arrives at level 1, not from the bank', () => {
        const hero = makeQualified('fighter');
        const result = PromotionSystem.promote(hero.id, 'fighter');

        // Combat and the advanced skill are both new to a Recruit.
        expect(result.gained).toHaveLength(2);
        for (const id of result.gained) expect(hero.skills[id].level).toBe(1);
    });

    it('restores Starting skills an older save had banked, on the next promotion', () => {
        // A hero like that gets them back, at their stored level, when promoted
        // again.
        const hero = freshFighter();
        hero.bankedSkills = { fishing: { level: 19, xp: 777 } };
        delete hero.skills.fishing;

        qualify(hero, 'knight');
        const result = PromotionSystem.promote(hero.id, 'knight');

        expect(result.restored).toContain('fishing');
        expect(hero.skills.fishing).toEqual({ level: 19, xp: 777 });
        expect(hero.bankedSkills.fishing).toBeUndefined();
    });

    it('restores them on load too (rehydration), and leaves banked class skills alone', () => {
        const hero = generateHero({ jobId: 'fighter' });
        delete hero.skills.farming;
        hero.skills.cooking = { level: 5, xp: 50 };
        hero.bankedSkills = {
            farming: { level: 14, xp: 400 },
            cooking: { level: 99, xp: 9 },     // a held copy wins
            armory: { level: 8, xp: 80 }
        };

        const restored = restoreBankedStarting(hero);

        expect(restored).toEqual(['farming']);
        expect(hero.skills.farming).toEqual({ level: 14, xp: 400 });
        expect(hero.skills.cooking.level).toBe(5);
        expect(hero.bankedSkills).toEqual({ armory: { level: 8, xp: 80 } });
    });
});

describe('⚠️ Banking — nothing is lost, only set down (D-71)', () => {
    // Banking happens when re-training ACROSS branches, which swaps class
    // skills; no Starting skill is ever banked.

    /** A Paladin, re-trained to Wizard: banks Melee, Leadership and Faith, keeps Enchanting. */
    function paladinThenWizard({ melee = 31, leadership = 17, faith = 12 } = {}) {
        const hero = freshFighter();
        qualify(hero, 'paladin');
        expect(PromotionSystem.promote(hero.id, 'paladin').success).toBe(true);
        hero.skills.melee.level = melee;
        hero.skills.leadership.level = leadership;
        hero.skills.faith.level = faith;
        hero.skills.enchanting.level = 9;
        qualify(hero, 'wizard');
        const result = PromotionSystem.promote(hero.id, 'wizard');
        return { hero, result };
    }

    it('re-training Paladin → Wizard banks melee, leadership and faith and keeps every Starting skill', () => {
        const { hero, result } = paladinThenWizard();

        expect(result.success).toBe(true);
        expect([...result.banked].sort()).toEqual(['faith', 'leadership', 'melee']);
        expect(result.gained).toEqual(['magic']);
        // Enchanting is the Wizard's own skill too, so it stays on the sheet.
        expect(hero.skills.enchanting.level).toBe(9);
        for (const id of STARTING_SKILL_IDS) expect(hero.skills[id], id).toBeDefined();
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet('wizard')].sort());
    });

    it('banks a removed skill AT ITS LEVEL, not at zero', () => {
        const { hero } = paladinThenWizard({ melee: 31, leadership: 17, faith: 12 });

        expect(hero.skills.leadership).toBeUndefined();
        expect(hero.bankedSkills.melee.level).toBe(31);
        expect(hero.bankedSkills.leadership.level).toBe(17);
        expect(hero.bankedSkills.faith.level).toBe(12);
    });

    it('a banked skill returns intact when a later job wants it again', () => {
        const { hero } = paladinThenWizard({ leadership: 22 });
        const banked = { ...hero.bankedSkills.leadership };

        // Back to Fighter, which wants Leadership again.
        const result = PromotionSystem.promote(hero.id, 'fighter');

        expect(result.success).toBe(true);
        expect(result.restored).toEqual(expect.arrayContaining(['melee', 'leadership']));
        expect(hero.skills.leadership, 'restored exactly, not at level 1').toEqual(banked);
        expect(hero.bankedSkills.leadership, 'and taken back out of the bank').toBeUndefined();
        // Faith is still set down; the Fighter does not use it.
        expect(hero.bankedSkills.faith.level).toBe(12);
    });

    it('banked skills count toward a later gate — the hero has not forgotten', () => {
        const { hero } = paladinThenWizard({ leadership: 40 });
        expect(PromotionSystem.knownLevel(hero, 'leadership')).toBe(40);
    });

    it('survives a save/load round trip', () => {
        const { hero } = paladinThenWizard({ leadership: 13 });

        // The bank is ordinary hero state, so it rides along with the save.
        const revived = JSON.parse(JSON.stringify(GameState.state.heroes));
        const reloaded = revived.find(h => h.id === hero.id);

        expect(reloaded.jobId).toBe('wizard');
        expect(reloaded.bankedSkills.leadership.level).toBe(13);
    });
});

describe('⭐ Mastery: a class skill at 99 is never banked again', () => {
    /** A Paladin with chosen levels, re-trained to Wizard. */
    function masteredPaladinToWizard(levels) {
        const hero = freshFighter();
        qualify(hero, 'paladin');
        expect(PromotionSystem.promote(hero.id, 'paladin').success).toBe(true);
        for (const [id, level] of Object.entries(levels)) hero.skills[id] = { level, xp: level * 1000 };
        qualify(hero, 'wizard');
        const preview = PromotionSystem.previewPromotion(hero.id, 'wizard');
        const result = PromotionSystem.promote(hero.id, 'wizard');
        expect(result.success).toBe(true);
        return { hero, result, preview };
    }

    it('an advanced or master skill at 99 is never banked on re-training', () => {
        const { hero, result } = masteredPaladinToWizard({ leadership: 99, faith: 99 });

        expect(result.banked).toEqual(['melee']);
        expect(hero.skills.leadership).toEqual({ level: 99, xp: 99000 });
        expect(hero.skills.faith).toEqual({ level: 99, xp: 99000 });
        expect(hero.bankedSkills.leadership).toBeUndefined();
        expect(hero.bankedSkills.faith).toBeUndefined();
        // On top of the Wizard's own sheet, so more than 11.
        for (const id of getJobSheet('wizard')) expect(hero.skills[id], id).toBeDefined();
        expect(Object.keys(hero.skills)).toHaveLength(getJobSheet('wizard').length + 2);
    });

    it('a mastered skill stays through every later job change', () => {
        const { hero } = masteredPaladinToWizard({ faith: 99 });
        qualify(hero, 'rogue');
        expect(PromotionSystem.promote(hero.id, 'rogue').success).toBe(true);
        expect(hero.skills.faith.level).toBe(99);
        expect(hero.skills.magic, 'the Wizard combat skill banks as usual').toBeUndefined();
    });

    it('a combat skill at 99 is banked as usual', () => {
        const { hero, result } = masteredPaladinToWizard({ melee: 99 });

        expect(result.banked).toContain('melee');
        expect(hero.skills.melee).toBeUndefined();
        expect(hero.bankedSkills.melee.level).toBe(99);
    });

    it('a skill at 98 is banked as usual', () => {
        const { hero, result } = masteredPaladinToWizard({ faith: 98, leadership: 98 });

        expect([...result.banked].sort()).toEqual(['faith', 'leadership', 'melee']);
        expect(hero.skills.faith).toBeUndefined();
        expect(hero.bankedSkills.faith.level).toBe(98);
    });

    it('the preview does not list a mastered skill as lost', () => {
        const { preview } = masteredPaladinToWizard({ faith: 99, melee: 99 });

        expect(preview.losing.map(l => l.skillId).sort()).toEqual(['leadership', 'melee']);
        expect(preview.keeping).toContain('faith');
    });
});

describe('Re-training is the same act as promoting (D-248)', () => {
    it('moves a hero sideways between siblings', () => {
        const hero = freshFighter();

        // Qualify for both Paladin and Knight, then take Paladin.
        for (const jobId of ['paladin', 'knight']) qualify(hero, jobId);
        expect(PromotionSystem.promote(hero.id, 'paladin').success).toBe(true);
        expect(hero.skills.faith).toBeDefined();

        // Re-train to the sibling. The master skill swaps over.
        const result = PromotionSystem.promote(hero.id, 'knight');

        expect(result.success).toBe(true);
        expect(hero.jobId).toBe('knight');
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSheet('knight')].sort());
        expect(hero.skills.faith, 'the old master skill is gone').toBeUndefined();
        expect(hero.bankedSkills.faith, 'but banked, not destroyed').toBeDefined();
    });

    it('a full Recruit → Fighter → Knight run lands on exactly the Knight sheet', () => {
        const hero = freshFighter();

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
    // ⚠️ Standing in for browser verification: the Dock's skill cells
    // changing contents hangs entirely off these two events. The Dock
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
        // nine Starting + combat + advanced.
        expect(after.split(',')).toHaveLength(11);
        for (const id of getJobSheet('fighter')) expect(after).toContain(`${id}:`);
    });
});

describe('Preview shows the trade before the player commits', () => {
    it('names what is lost, kept and arriving', () => {
        const hero = makeQualified('fighter');
        const preview = PromotionSystem.previewPromotion(hero.id, 'fighter');

        expect(preview.losing).toEqual([]);
        expect(preview.arriving.length).toBe(2);
        expect(preview.keeping.length).toBe(STARTING_SKILL_IDS.length);
        expect(preview.ok).toBe(true);
    });

    it('names a re-training swap: the old branch skills are lost (banked)', () => {
        const hero = freshFighter();
        hero.skills.leadership.level = 12;

        const preview = PromotionSystem.previewPromotion(hero.id, 'wizard');

        expect(preview.losing).toEqual([
            { skillId: 'melee', name: 'Melee', level: 1 },
            { skillId: 'leadership', name: 'Leadership', level: 12 }
        ]);
        expect(preview.arriving.map(a => a.skillId)).toEqual(['magic', 'enchanting']);
    });

    it('marks an arriving skill as restored, with its real level', () => {
        const hero = freshFighter();
        hero.skills.leadership.level = 31;
        qualify(hero, 'wizard');
        PromotionSystem.promote(hero.id, 'wizard');   // banks Leadership at 31

        const preview = PromotionSystem.previewPromotion(hero.id, 'fighter');
        const entry = preview.arriving.find(a => a.skillId === 'leadership');

        expect(entry.restored).toBe(true);
        expect(entry.level).toBe(31);
    });
});

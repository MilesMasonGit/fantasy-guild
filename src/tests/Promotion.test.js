import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as PromotionSystem from '../systems/hero/PromotionSystem.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import {
    getJobSkills, getPromotionCost, getPromotionGateSkills, STARTING_JOB_ID
} from '../config/registries/jobRegistry.js';
import { canHeroFight } from '../utils/CombatFormulas.js';

/**
 * Promotion, re-training and banking.
 *
 * The three rules under test, and why each matters:
 *
 * 1. **A promotion is gated on the skills it carries forward** (D-262), so it
 *    is the payoff for work already done rather than a purchase.
 * 2. **Nothing is lost, only banked** (D-71). A removed skill goes dormant at
 *    its level and comes back exactly as it was — this is what makes promotion
 *    a reconfiguration rather than a gamble, and it is the single thing that
 *    lets a player engage with the system at all.
 * 3. **Re-training is the same act as promoting** (D-248), not an undo. It is
 *    also the ONLY respec the player has, which is why it needs to work
 *    perfectly in both directions.
 *
 * Nothing below hardcodes a skill name where the registry can supply it — the
 * job tree is a first draft and these tests must survive it changing.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/** A hero rich enough and skilled enough to take `jobId`. */
function makeQualified(jobId, { extraLevels = 0 } = {}) {
    const hero = generateHero();
    HeroManager.addHero(hero);

    const cost = getPromotionCost(jobId);
    for (const skillId of getPromotionGateSkills(jobId)) {
        if (!hero.skills[skillId]) hero.skills[skillId] = { xp: 0, level: 0 };
        hero.skills[skillId].level = cost.skillLevel + extraLevels;
    }
    fund(cost);
    return hero;
}

/** Put enough gold and materials in the guild to pay a cost. */
function fund(cost) {
    if (!cost) return;
    CurrencyManager.addGold(cost.gold * 4, 'test');
    for (const m of cost.materials || []) {
        InventoryManager.addItem(m.itemId, m.quantity * 4);
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
        fund(getPromotionCost('fighter'));

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
        // A Fighter drops Fishing and Cooking. Being terrible at them must not
        // block the promotion that removes them anyway.
        const hero = makeQualified('fighter');
        const dropped = Object.keys(hero.skills)
            .filter(id => !getJobSkills('fighter').includes(id));

        expect(dropped.length).toBeGreaterThan(0);
        for (const id of dropped) hero.skills[id].level = 1;

        expect(PromotionSystem.canPromote(hero.id, 'fighter').ok).toBe(true);
    });

    it('refuses when the gold is short, and says so', () => {
        const hero = makeQualified('fighter');
        GameState.state.currency.gold = 0;

        const verdict = PromotionSystem.canPromote(hero.id, 'fighter');
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toBe(PromotionSystem.REFUSAL.NOT_ENOUGH_GOLD);
    });

    it('refuses when the materials are short', () => {
        const hero = makeQualified('fighter');
        GameState.state.inventory.items = {};

        const verdict = PromotionSystem.canPromote(hero.id, 'fighter');
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toBe(PromotionSystem.REFUSAL.SHORT_ON_MATERIALS);
    });

    it('refuses the job the hero already holds', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        expect(PromotionSystem.canPromote(hero.id, 'fighter').reason)
            .toBe(PromotionSystem.REFUSAL.SAME_JOB);
    });
});

describe('A promotion swaps the sheet and charges for it', () => {
    it('leaves the hero holding exactly the new job sheet', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        expect(hero.jobId).toBe('fighter');
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSkills('fighter')].sort());
    });

    it('takes the gold and the materials', () => {
        const hero = makeQualified('fighter');
        const cost = getPromotionCost('fighter');
        const goldBefore = CurrencyManager.getCurrency('gold');
        const matBefore = InventoryManager.getItemCount(cost.materials[0].itemId);

        PromotionSystem.promote(hero.id, 'fighter');

        expect(CurrencyManager.getCurrency('gold')).toBe(goldBefore - cost.gold);
        expect(InventoryManager.getItemCount(cost.materials[0].itemId))
            .toBe(matBefore - cost.materials[0].quantity);
    });

    it('charges nothing and changes nothing when it refuses', () => {
        const hero = makeQualified('fighter');
        GameState.state.currency.gold = 0;
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

describe('⚠️ Banking — nothing is lost, only set down (D-71)', () => {
    it('banks a removed skill AT ITS LEVEL, not at zero', () => {
        const hero = makeQualified('fighter');
        const dropped = Object.keys(hero.skills)
            .filter(id => !getJobSkills('fighter').includes(id));
        for (const id of dropped) hero.skills[id].level = 17;

        PromotionSystem.promote(hero.id, 'fighter');

        for (const id of dropped) {
            expect(hero.skills[id], `${id} should be gone from the sheet`).toBeUndefined();
            expect(hero.bankedSkills[id].level, `${id} banked level`).toBe(17);
        }
    });

    it('restores a banked skill intact when a later job wants it again', () => {
        // The load-bearing case. Recruit → Fighter drops Cooking; Fighter →
        // Cleric... is a re-training that wants it back.
        const hero = makeQualified('fighter');
        const dropped = Object.keys(hero.skills)
            .filter(id => !getJobSkills('fighter').includes(id));
        const revived = dropped.find(id => getJobSkills('cleric').includes(id));
        expect(revived, 'expected Cleric to want something Fighter drops').toBeTruthy();

        hero.skills[revived].level = 22;
        PromotionSystem.promote(hero.id, 'fighter');
        expect(hero.bankedSkills[revived].level).toBe(22);

        // Re-train into Cleric, which wants that skill back.
        //
        // ⚠️ Only raise the gate skills the hero still HOLDS. The banked one is
        // deliberately left alone: at 22 it already clears the threshold, which
        // is exactly the "a hero has not forgotten" rule doing its job. Writing
        // it back into the held sheet here would fake the very thing under test.
        for (const skillId of getPromotionGateSkills('cleric')) {
            const cost = getPromotionCost('cleric');
            if (hero.skills[skillId]) hero.skills[skillId].level = cost.skillLevel;
        }
        fund(getPromotionCost('cleric'));
        const result = PromotionSystem.promote(hero.id, 'cleric');

        expect(result.success).toBe(true);
        expect(result.restored).toContain(revived);
        expect(hero.skills[revived].level, 'restored at its banked level, not 1').toBe(22);
        expect(hero.bankedSkills[revived], 'and taken back out of the bank').toBeUndefined();
    });

    it('a never-held skill arrives at level 1, not from the bank', () => {
        const hero = makeQualified('fighter');
        const result = PromotionSystem.promote(hero.id, 'fighter');

        // Combat and the shared specialist are both new to a Recruit.
        expect(result.gained.length).toBeGreaterThan(0);
        for (const id of result.gained) expect(hero.skills[id].level).toBe(1);
    });

    it('banked skills count toward a later gate — the hero has not forgotten', () => {
        const hero = makeQualified('fighter');
        const dropped = Object.keys(hero.skills)
            .filter(id => !getJobSkills('fighter').includes(id));
        for (const id of dropped) hero.skills[id].level = 40;

        PromotionSystem.promote(hero.id, 'fighter');

        for (const id of dropped) {
            expect(PromotionSystem.knownLevel(hero, id), `${id} still known`).toBe(40);
        }
    });

    it('survives a save/load round trip', () => {
        const hero = makeQualified('fighter');
        const dropped = Object.keys(hero.skills)
            .filter(id => !getJobSkills('fighter').includes(id));
        for (const id of dropped) hero.skills[id].level = 13;
        PromotionSystem.promote(hero.id, 'fighter');

        // The bank is ordinary hero state, so it rides along with the save.
        const revived = JSON.parse(JSON.stringify(GameState.state.heroes));
        const reloaded = revived.find(h => h.id === hero.id);

        expect(reloaded.jobId).toBe('fighter');
        for (const id of dropped) expect(reloaded.bankedSkills[id].level).toBe(13);
    });
});

describe('Re-training is the same act as promoting (D-248)', () => {
    it('moves a hero sideways between siblings, at the same price', () => {
        const hero = makeQualified('fighter');
        PromotionSystem.promote(hero.id, 'fighter');

        // Qualify for both Knight and Warlord, then take Knight.
        for (const jobId of ['knight', 'warlord']) {
            const cost = getPromotionCost(jobId);
            for (const skillId of getPromotionGateSkills(jobId)) {
                if (!hero.skills[skillId]) hero.skills[skillId] = { xp: 0, level: 0 };
                hero.skills[skillId].level = cost.skillLevel;
            }
            fund(cost);
        }
        expect(PromotionSystem.promote(hero.id, 'knight').success).toBe(true);
        expect(hero.skills.armory).toBeDefined();

        // Re-train to the sibling. The signature swaps over.
        fund(getPromotionCost('warlord'));
        const result = PromotionSystem.promote(hero.id, 'warlord');

        expect(result.success).toBe(true);
        expect(hero.jobId).toBe('warlord');
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSkills('warlord')].sort());
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
        fund(cost);
        PromotionSystem.promote(hero.id, 'knight');

        expect(hero.jobId).toBe('knight');
        expect(Object.keys(hero.skills).sort()).toEqual([...getJobSkills('knight')].sort());
    });
});

describe('The UI is told, so the Dock actually redraws', () => {
    // ⚠️ Standing in for browser verification, which this phase cannot reach:
    // promotion has no screen of its own until Phase 8, and its one visible
    // effect — the Dock's six skill cells changing contents — hangs entirely
    // off these two events. `DockSkillsGrid` subscribes to `heroes_updated`
    // and projects `hero.skills`, so if the event does not fire the grid keeps
    // showing the old job's skills and nothing looks wrong.

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
        expect(seen[0].banked).toHaveLength(2);
        expect(seen[0].gained).toHaveLength(2);
    });

    it('the projection the Dock renders changes to the new job sheet', () => {
        // Exactly what DockSkillsGrid computes: id:level pairs off hero.skills.
        const hero = makeQualified('fighter');
        const project = () => Object.entries(hero.skills)
            .map(([id, s]) => `${id}:${s.level}`).sort().join(',');

        const before = project();
        PromotionSystem.promote(hero.id, 'fighter');
        const after = project();

        expect(after).not.toBe(before);
        expect(after.split(',')).toHaveLength(6);
        for (const id of getJobSkills('fighter')) expect(after).toContain(`${id}:`);
    });
});

describe('Preview shows the trade before the player commits', () => {
    it('names what is lost, kept and arriving', () => {
        const hero = makeQualified('fighter');
        const preview = PromotionSystem.previewPromotion(hero.id, 'fighter');

        expect(preview.losing.length).toBe(2);      // promotion removes exactly two
        expect(preview.arriving.length).toBe(2);    // and adds exactly two
        expect(preview.keeping.length).toBe(4);
        expect(preview.ok).toBe(true);
        for (const l of preview.losing) expect(l.level).toBeGreaterThan(0);
    });

    it('marks an arriving skill as restored, with its real level', () => {
        const hero = makeQualified('fighter');
        const dropped = Object.keys(hero.skills)
            .filter(id => !getJobSkills('fighter').includes(id));
        const revived = dropped.find(id => getJobSkills('cleric').includes(id));
        hero.skills[revived].level = 31;
        PromotionSystem.promote(hero.id, 'fighter');

        const preview = PromotionSystem.previewPromotion(hero.id, 'cleric');
        const entry = preview.arriving.find(a => a.skillId === revived);

        expect(entry.restored).toBe(true);
        expect(entry.level).toBe(31);
    });
});

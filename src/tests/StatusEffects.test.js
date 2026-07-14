import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as StatusEffectSystem from '../systems/effects/StatusEffectSystem.js';
import { STATUS_EFFECTS, sumStatusEffect, getStatusStacks } from '../config/registries/statusRegistry.js';
import { computeHeroDamage, computeEnemyDamage } from '../utils/CombatFormulas.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';

describe('Status Effect System (status_effects_concept.md)', () => {
    let hero;

    beforeEach(() => {
        vi.clearAllMocks();
        hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(HeroManager, 'getAllHeroes').mockReturnValue([hero]);
        vi.spyOn(HeroManager, 'modifyHeroHp').mockImplementation((id, amount) => {
            hero.hp.current = Math.max(0, Math.min(hero.hp.max, hero.hp.current + amount));
        });
    });

    it('ships the 7 starter statuses', () => {
        expect(Object.keys(STATUS_EFFECTS).sort()).toEqual(
            ['armor_shield', 'bleed', 'burning', 'cookout', 'poison', 'stun', 'well_fed']
        );
    });

    it('decrement stacking merges and respects maxStacks (Burning caps at 3)', () => {
        StatusEffectSystem.applyToHero(hero.id, 'burning', 2);
        StatusEffectSystem.applyToHero(hero.id, 'burning', 5);
        expect(getStatusStacks(hero.statuses, 'burning')).toBe(3);

        StatusEffectSystem.applyToHero(hero.id, 'poison', 2);
        StatusEffectSystem.applyToHero(hero.id, 'poison', 1);
        expect(getStatusStacks(hero.statuses, 'poison')).toBe(3);
    });

    it('DoT tick deals stack-scaled damage then decays (§4A)', () => {
        StatusEffectSystem.applyToHero(hero.id, 'poison', 3); // 3 stacks × 2 dmg
        const hpBefore = hero.hp.current;

        StatusEffectSystem.tick(STATUS_TICK_INTERVAL_MS);
        expect(hpBefore - hero.hp.current).toBe(6);
        expect(getStatusStacks(hero.statuses, 'poison')).toBe(2);

        StatusEffectSystem.tick(STATUS_TICK_INTERVAL_MS);
        expect(hpBefore - hero.hp.current).toBe(10); // +4 (2 stacks)
        expect(getStatusStacks(hero.statuses, 'poison')).toBe(1);

        StatusEffectSystem.tick(STATUS_TICK_INTERVAL_MS);
        StatusEffectSystem.tick(STATUS_TICK_INTERVAL_MS);
        expect(getStatusStacks(hero.statuses, 'poison')).toBe(0); // expired
    });

    it('a DoT tick can drop the hero to 0 HP (can kill — owner-locked)', () => {
        hero.hp.current = 3;
        StatusEffectSystem.applyToHero(hero.id, 'burning', 3); // 12 dmg on tick
        StatusEffectSystem.tick(STATUS_TICK_INTERVAL_MS);
        expect(hero.hp.current).toBe(0);
    });

    it('Stun decays per attack attempt whether or not it fires', () => {
        StatusEffectSystem.applyToHero(hero.id, 'stun', 2);
        StatusEffectSystem.rollAttackFailure(hero.statuses);
        expect(getStatusStacks(hero.statuses, 'stun')).toBe(1);
        StatusEffectSystem.rollAttackFailure(hero.statuses);
        expect(getStatusStacks(hero.statuses, 'stun')).toBe(0);
    });

    it('Armor Shield adds flat armor and decays on hits taken (§4A example)', () => {
        StatusEffectSystem.applyToHero(hero.id, 'armor_shield', 5);
        expect(sumStatusEffect(hero.statuses, 'flat_armor')).toBe(5);

        // A 10-damage enemy hit lands for 10 − 5 = 5, then the shield decays to 4
        const enemy = { minDamage: 10, maxDamage: 10, combatType: 'melee' };
        const dmg = computeEnemyDamage(enemy, hero, 'melee');
        expect(dmg).toBe(5);
        StatusEffectSystem.notifyHitTaken(hero.statuses);
        expect(sumStatusEffect(hero.statuses, 'flat_armor')).toBe(4);
    });

    it('layered buffs sum magnitude with independent lifetimes (§4B Cookout walkthrough)', () => {
        StatusEffectSystem.applyToHero(hero.id, 'cookout', 1); // A: 3 slots
        expect(StatusEffectSystem.getYieldMultiplier(hero.id)).toBeCloseTo(1.10, 5);

        StatusEffectSystem.notifySlotResolved(hero.id);        // A: 2 left
        StatusEffectSystem.applyToHero(hero.id, 'cookout', 1); // B: 3 slots
        expect(StatusEffectSystem.getYieldMultiplier(hero.id)).toBeCloseTo(1.20, 5);

        StatusEffectSystem.notifySlotResolved(hero.id); // A:1 B:2
        expect(StatusEffectSystem.getYieldMultiplier(hero.id)).toBeCloseTo(1.20, 5);
        StatusEffectSystem.notifySlotResolved(hero.id); // A expires, B:1
        expect(StatusEffectSystem.getYieldMultiplier(hero.id)).toBeCloseTo(1.10, 5);
        StatusEffectSystem.notifySlotResolved(hero.id); // B expires
        expect(StatusEffectSystem.getYieldMultiplier(hero.id)).toBeCloseTo(1.0, 5);
    });

    it('Well Fed boosts damage and decays per resolved combat (§3A clears combat-only too)', () => {
        StatusEffectSystem.applyToHero(hero.id, 'well_fed', 1);
        StatusEffectSystem.applyToHero(hero.id, 'stun', 2); // combat-only

        // Damage with +10%: base 4 × 1.1 × spread(0.85–1.15) → always > unbuffed min
        const enemy = { combatType: 'melee', defenceSkill: 1 };
        let buffedTotal = 0;
        for (let i = 0; i < 30; i++) buffedTotal += computeHeroDamage(hero, enemy, null, 0, 'melee');
        expect(buffedTotal / 30).toBeGreaterThan(3.4); // unbuffed mean = 4

        StatusEffectSystem.notifyCombatResolved(hero.id);
        expect(getStatusStacks(hero.statuses, 'stun')).toBe(0);      // combat-only cleared
        expect(getStatusStacks(hero.statuses, 'well_fed')).toBe(1);  // 2 encounters left
        StatusEffectSystem.notifyCombatResolved(hero.id);
        StatusEffectSystem.notifyCombatResolved(hero.id);
        expect(getStatusStacks(hero.statuses, 'well_fed')).toBe(0);  // expired
    });

    it('purge removes debuffs but not buffs; clearAll removes everything (§4C/§6)', () => {
        StatusEffectSystem.applyToHero(hero.id, 'poison', 2);
        StatusEffectSystem.applyToHero(hero.id, 'bleed', 1);
        StatusEffectSystem.applyToHero(hero.id, 'cookout', 1);

        expect(StatusEffectSystem.purge(hero.id, 'poison')).toBe(1);
        expect(getStatusStacks(hero.statuses, 'bleed')).toBe(1);

        StatusEffectSystem.purge(hero.id); // all debuffs
        expect(getStatusStacks(hero.statuses, 'bleed')).toBe(0);
        expect(getStatusStacks(hero.statuses, 'cookout')).toBe(1); // buff survives

        StatusEffectSystem.clearAll(hero.id);
        expect(hero.statuses.length).toBe(0);
    });

    it('enemy statuses tick on the combat card and can kill the enemy', () => {
        const card = { id: 'c1', combat: { enemyHp: { current: 5, max: 20 }, enemyStatuses: [] } };
        StatusEffectSystem.applyToEnemy(card, 'poison', 3); // 6 dmg per tick

        const died = StatusEffectSystem.tickEnemyStatuses(card, STATUS_TICK_INTERVAL_MS);
        expect(died).toBe(true);
        expect(card.combat.enemyHp.current).toBe(0);
    });
});

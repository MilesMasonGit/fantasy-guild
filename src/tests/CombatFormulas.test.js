import { describe, it, expect } from 'vitest';
import {
    growth,
    heroMaxHp,
    heroBaseDamage,
    hitChance,
    blockChance,
    rpsOutcome,
    enemyCombatBudget,
    RPS_HIT_SHIFT,
    HERO_ATTACK_INTERVAL_MS,
    ENEMY_ATTACK_INTERVAL_MS,
} from '../config/FormulaRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import {
    heroMaxHpFromSkills,
    getHeroCombatStyle,
    computeHeroDamage,
    computeEnemyDamage,
} from '../utils/CombatFormulas.js';
import { getEnemy } from '../config/registries/enemyRegistry.js';

describe('7-Stat Combat Engine (combat_formula_spec.md)', () => {
    it('growth curve G(L) hits the spec checkpoints', () => {
        expect(growth(1)).toBe(1);
        expect(growth(20)).toBeCloseTo(2.31, 1);
        expect(growth(50)).toBeCloseTo(8.64, 1);
        expect(growth(99)).toBeGreaterThan(70); // ≈75×
    });

    it('reference hero at CL 20 has ~115 HP and ~9 base damage (spec §3)', () => {
        expect(heroMaxHp(20, 20)).toBe(115);
        expect(heroBaseDamage(20)).toBeCloseTo(9.2, 0);
    });

    it('level-1 hero: 50 HP, melee style unarmed, 2.5s interval', () => {
        const hero = generateHero();
        expect(hero.hp.max).toBe(50);
        expect(heroMaxHpFromSkills(hero.skills)).toBe(50);
        expect(getHeroCombatStyle(hero)).toBe('melee');
        expect(HERO_ATTACK_INTERVAL_MS).toBe(2500);
        expect(ENEMY_ATTACK_INTERVAL_MS).toBe(3000);
    });

    it('band-20 enemy budget: ~74 HP, ~21 damage, ~31 XP (spec §6/§8)', () => {
        const budget = enemyCombatBudget(20);
        expect(budget.hp).toBe(74);
        expect((budget.minDamage + budget.maxDamage) / 2).toBeCloseTo(21, 0);
        expect(budget.xp).toBeCloseTo(31, 0);
    });

    it('budgetScale shrinks tutorial enemies proportionally', () => {
        const skeleton = getEnemy('guild_hall_t1_skeleton');
        expect(skeleton.level).toBe(1);
        expect(skeleton.hp).toBe(8);       // 32 × 0.25
        expect(skeleton.energyCost).toBe(0); // F4: no energy in combat
    });

    it('hit chance: 75 base, ±0.25/level shift, ±7 RPS, clamped 5-95 (spec §7)', () => {
        expect(hitChance(1, 1)).toBe(75);
        expect(hitChance(21, 1)).toBe(80);         // +20 levels × 0.25
        expect(hitChance(1, 1, RPS_HIT_SHIFT)).toBe(82);
        expect(hitChance(1, 999)).toBe(5);          // clamp low
        expect(hitChance(999, 1, RPS_HIT_SHIFT)).toBe(95); // clamp high
    });

    it('RPS orientation is Melee > Ranged > Magic > Melee (owner-locked)', () => {
        expect(rpsOutcome('melee', 'ranged')).toBe(1);
        expect(rpsOutcome('ranged', 'magic')).toBe(1);
        expect(rpsOutcome('magic', 'melee')).toBe(1);
        expect(rpsOutcome('ranged', 'melee')).toBe(-1);
        expect(rpsOutcome('melee', 'melee')).toBe(0);
    });

    it('innate Block from Defense (owner deviation 2026-07-12)', () => {
        expect(blockChance(1)).toBeCloseTo(0.125, 3);
        expect(blockChance(99)).toBeCloseTo(12.375, 2);
        // Gear block amplified by Defense: 12 base at Defense 99 → ~17.9 + innate
        expect(blockChance(99, 12)).toBeCloseTo(12 * 1.495 + 12.375, 1);
    });

    it('damage pipeline: spread, RPS shift, minimum 1', () => {
        const hero = generateHero();
        const enemy = getEnemy('guild_hall_t1_skeleton'); // melee
        for (let i = 0; i < 50; i++) {
            const dmg = computeHeroDamage(hero, enemy, null, 0, 'melee');
            // base 4 × 0.85–1.15 → 3.4–4.6 → rounded 3-5
            expect(dmg).toBeGreaterThanOrEqual(3);
            expect(dmg).toBeLessThanOrEqual(5);

            const enemyDmg = computeEnemyDamage(enemy, hero, 'melee');
            expect(enemyDmg).toBeGreaterThanOrEqual(1);
            expect(enemyDmg).toBeLessThanOrEqual(enemy.maxDamage);
        }
    });
});

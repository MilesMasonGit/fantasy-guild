import { describe, it, expect } from 'vitest';
import { enemyProfileOf, enemyDropsOf, isEnemyDef, ENEMY_STYLES } from '../config/registries/enemyProfile.js';
import { enemyCombatBudget } from '../config/FormulaRegistry.js';
import { getCombatXpAward } from '../utils/CombatFormulas.js';
import { derivedTokenType } from '../config/registries/tokenTypeDerivation.js';

/**
 * An enemy is a Token (D-104) — and since 2026-09-06 that is true of the data
 * too. These cover the seam that replaced `enemyRegistry.js`: what makes a
 * Token an enemy, what its stat block is, and what a kill drops.
 */

const bear = () => ({
    id: 'token_bear',
    name: 'Bear',
    enemy: { level: 4, style: 'ranged' },
    config: {
        inputs: [],
        outputs: [{ itemId: 'item_pelt', chance: 40, minQty: 1, maxQty: 3 }]
    }
});

describe('What makes a Token an enemy', () => {
    it('is a level, and nothing else', () => {
        expect(isEnemyDef(bear())).toBe(true);
        expect(isEnemyDef({ id: 'token_forest', config: { outputs: [] } })).toBe(false);
    });

    it('files it as an enemy on the derivation ladder', () => {
        expect(derivedTokenType(bear())).toBe('enemy');
    });

    /**
     * The rung sits above every other one for a reason: an enemy's drops live
     * in `config.outputs`, which is exactly the shape the `resource` rung
     * matches. Without the enemy rung first, every enemy in the game would
     * quietly file itself as a Forest.
     */
    it('beats the resource rung, which its drops would otherwise match', () => {
        const def = bear();
        expect(derivedTokenType({ ...def, enemy: undefined })).toBe('resource');
        expect(derivedTokenType(def)).toBe('enemy');
    });
});

describe('The stat block', () => {
    it('derives every combat number from the one authored level', () => {
        const p = enemyProfileOf(bear());
        const budget = enemyCombatBudget(4);
        expect(p.hp).toBe(budget.hp);
        expect(p.minDamage).toBe(budget.minDamage);
        expect(p.maxDamage).toBe(budget.maxDamage);
        expect(p.attackSpeed).toBe(budget.attackIntervalMs);
    });

    it('uses the level for BOTH attack and defence, as the hero side does', () => {
        const p = enemyProfileOf(bear());
        expect(p.attackSkill).toBe(4);
        expect(p.defenceSkill).toBe(4);
    });

    /**
     * ⚠️ **A regression guard, not a formality.** `getCombatXpAward` reads
     * `enemy.xpAwarded` and falls back to a flat 1 when it is missing. The
     * first cut of this module simply left the field out: nothing threw,
     * nothing logged, and every kill at every level paid exactly 1 XP. It was
     * caught by running a real fight in the browser and noticing the number
     * was too small — which is not a way of catching things that scales.
     */
    it('pays the level\'s XP budget, not the silent fallback of 1', () => {
        const p = enemyProfileOf(bear());
        expect(p.xpAwarded).toBe(enemyCombatBudget(4).xp);
        expect(getCombatXpAward(p)).toBe(enemyCombatBudget(4).xp);
        expect(getCombatXpAward(p)).toBeGreaterThan(1);
    });

    it('scales the whole budget together when budgetScale is set', () => {
        const full = enemyProfileOf(bear());
        const pushover = enemyProfileOf({ ...bear(), enemy: { level: 4, style: 'ranged', budgetScale: 0.25 } });
        expect(pushover.hp).toBeLessThan(full.hp);
        expect(pushover.maxDamage).toBeLessThan(full.maxDamage);
        expect(pushover.xpAwarded).toBeLessThan(full.xpAwarded);
        // Difficulty scales; the level itself does not lie about its band.
        expect(pushover.level).toBe(4);
    });

    it('keeps an authored style, and refuses one the engine has never heard of', () => {
        expect(enemyProfileOf(bear()).combatType).toBe('ranged');
        const nonsense = enemyProfileOf({ ...bear(), enemy: { level: 1, style: 'interpretive dance' } });
        expect(ENEMY_STYLES).toContain(nonsense.combatType);
        expect(nonsense.combatType).toBe('melee');
    });

    it('is null for a Token that is not an enemy', () => {
        expect(enemyProfileOf({ id: 'token_forest' })).toBeNull();
        expect(enemyProfileOf(null)).toBeNull();
    });
});

describe('What a kill drops', () => {
    it('is the Token\'s outputs, in the shape LootSystem wants', () => {
        expect(enemyDropsOf(bear())).toEqual([
            { itemId: 'item_pelt', chance: 40, minQty: 1, maxQty: 3 }
        ]);
    });

    it('treats an output with no chance as always dropping', () => {
        const [drop] = enemyDropsOf({ config: { outputs: [{ itemId: 'item_bones', minQty: 2, maxQty: 2 }] } });
        expect(drop.chance).toBe(100);
    });

    /** The simulator rewrites quantities into `baseQty`; both shapes must read. */
    it('falls back to baseQty for entries the simulator has rewritten', () => {
        const [drop] = enemyDropsOf({
            config: { outputs: [{ itemId: 'item_ore', baseQty: { min: 2, max: 5 } }] }
        });
        expect(drop.minQty).toBe(2);
        expect(drop.maxQty).toBe(5);
    });

    it('drops nothing for an enemy with no outputs, rather than throwing', () => {
        expect(enemyDropsOf({ id: 'token_ghost', enemy: { level: 1 } })).toEqual([]);
    });
});

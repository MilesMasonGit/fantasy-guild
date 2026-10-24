import { describe, it, expect } from 'vitest';
import { enemyProfileOf, enemyDropsOf, isEnemyDef, ENEMY_STYLES } from '../config/registries/enemyProfile.js';
import { enemyLevelStats } from '../config/FormulaRegistry.js';
import { getCombatXpAward } from '../utils/CombatFormulas.js';
import { derivedTokenType } from '../config/registries/tokenTypeDerivation.js';

/**
 * An enemy is a Token — and that is true of the data too. These cover the
 * seam that replaced `enemyRegistry.js`: what makes a Token an enemy, what
 * its stat block is, and what a kill drops.
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
        const table = enemyLevelStats(4);
        expect(p.hp).toBe(table.hp);
        expect(p.hit).toBe(table.hit);
        expect(p.armor).toBe(table.armor);
        expect(p.attackSpeed).toBe(table.attackSpeedMs);
    });

    it('carries the level, which the miss chance compares with the hero level', () => {
        expect(enemyProfileOf(bear()).level).toBe(4);
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
        expect(p.xpAwarded).toBe(enemyLevelStats(4).xp);
        expect(getCombatXpAward(p)).toBe(enemyLevelStats(4).xp);
        expect(getCombatXpAward(p)).toBeGreaterThan(1);
    });

    it('scales HP, hit and XP together when an older budgetScale is set', () => {
        // Level 40, where the table's hit (3) is big enough for a quarter of it to show.
        const full = enemyProfileOf({ ...bear(), enemy: { level: 40, style: 'ranged' } });
        const pushover = enemyProfileOf({ ...bear(), enemy: { level: 40, style: 'ranged', budgetScale: 0.25 } });
        expect(pushover.hp).toBeLessThan(full.hp);
        expect(pushover.hit).toBeLessThan(full.hit);
        expect(pushover.xpAwarded).toBeLessThan(full.xpAwarded);
        // Difficulty scales; the level itself does not lie about its band.
        expect(pushover.level).toBe(40);
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

// Fantasy Guild — an enemy, read off the Token that is one

import { getTokenType } from './tokenRegistry.js';
import { enemyCombatBudget } from '../FormulaRegistry.js';

/**
 * The combat stat block for an enemy Token.
 *
 * ## Why there is no longer an enemy registry
 * `data/enemies.json` and `enemyRegistry.js` were the last of the card era.
 * They described a creature as a separate entity that a Token then pointed at
 * through `enemyId` — except **nothing ever wrote `enemyId`**. The CMS had no
 * field for it, `deriveTokenType` keyed the whole `enemy` rung off it, and so
 * the game shipped four enemies that no Token could reference and zero enemy
 * Tokens. The combat engine underneath was finished and tested; it simply had
 * no content it could reach.
 *
 * D-104 already said an enemy is just a Token. This makes that true of the
 * data as well: the creature and the Token are one entity, authored in one
 * editor, written to one file. `enemies.json`, `encounters.json` and the
 * registry were deleted with this change (owner decision, 2026-09-06).
 *
 * ## What an author actually types
 * Two fields, in the Token editor's Enemy section:
 *
 * ```json
 * "enemy": { "level": 2, "style": "melee", "budgetScale": 1.0 }
 * ```
 *
 * `level` is the single difficulty dial — HP, damage, attack speed, attack and
 * defence skill and XP all derive from it through `enemyCombatBudget`, exactly
 * as they did before. This mirrors the hero side, which is also one number now
 * (a hero holds one combat skill supplying attack, defence, HP and block), so
 * a level-5 enemy and a Melee-5 hero are directly comparable.
 *
 * `budgetScale` is the optional thumb on the scale: it multiplies HP, damage
 * and XP together, so a tutorial pushover can sit below its band without
 * pretending to be a lower level. Per-stat deviation — tanky-but-weak, glass
 * cannon — is deliberately still absent; it wants a budget-trade rule, and
 * that belongs with the status-system pass.
 *
 * ## Drops
 * Not here. A kill is a cycle (D-129), so a kill's loot is the cycle's output:
 * `BoardCombat` resolves it from the Token's `config.outputs`, which already
 * carry the `{ itemId, chance, minQty, maxQty }` shape the old inline drop
 * table used. One drop mechanism for the whole board, and the economy
 * simulator can price a Bear the same way it prices a Forest.
 */

/**
 * The three sides of the combat triangle. Anything else falls back to melee.
 *
 * ⚠️ The CMS imports this to fill its Style dropdown (via `constants.js`), so
 * the authoring tool can never offer a style the engine has not got — the same
 * game-declares / CMS-offers rule as every other vocabulary in the project.
 * These are deliberately the same three ids as the hero combat skills: an
 * enemy's style and a hero's skill are the two sides of the same RPS check.
 */
export const ENEMY_STYLES = Object.freeze(['melee', 'ranged', 'magic']);

/** Whether a Token def describes something a hero can fight. */
export function isEnemyDef(def) {
    return def?.enemy?.level != null;
}

/**
 * Build the enemy stat block for a Token definition.
 *
 * Returns exactly the twelve fields the ported combat engine reads off an
 * enemy — no more, so a missing field fails loudly here rather than resolving
 * to `undefined` three calls deep inside the attack processor.
 *
 * ⚠️ `armor` is deliberately absent. `CombatFormulas` reads `enemy?.armor`,
 * but it is a documented hook for the armour pass that resolves to 0; the old
 * registry never set it either, so adding it here would invent a number.
 *
 * `id` is the **Token's** id. That is what makes the Bestiary, the kill counts
 * and the discovery notifications keep working with no migration: they key on
 * an id and look up a name, and the id they now get is one that exists.
 *
 * @param {Object} def A Token definition
 * @returns {Object|null} The stat block, or null if this Token is not an enemy
 */
export function enemyProfileOf(def) {
    if (!isEnemyDef(def)) return null;

    const level = def.enemy.level;
    const budgetScale = def.enemy.budgetScale ?? 1.0;
    const budget = enemyCombatBudget(level, budgetScale);
    const style = ENEMY_STYLES.includes(def.enemy.style) ? def.enemy.style : 'melee';

    return {
        id: def.id,
        name: def.name || def.id,
        level,
        combatType: style,
        hp: budget.hp,
        minDamage: budget.minDamage,
        maxDamage: budget.maxDamage,
        attackSpeed: budget.attackIntervalMs,
        attackSkill: level,
        defenceSkill: level,
        // ⚠️ Load-bearing, and easy to miss: `getCombatXpAward` reads
        // `enemy.xpAwarded` and falls back to a flat **1** when it is absent.
        // Leaving it out does not throw — it silently pays 1 XP for every kill
        // at every level, which is exactly the kind of quiet wrongness a
        // missing field is supposed to make loud.
        xpAwarded: budget.xp,
        // `traits` is read by the attack processor's thorns branch and must be
        // present. Enemy traits are not authorable yet; an empty array is the
        // honest answer, not a stub for one that is coming.
        traits: []
    };
}

/** The stat block for a Token id, or null. */
export function getEnemyProfile(typeId) {
    return enemyProfileOf(getTokenType(typeId));
}

/**
 * What a kill drops: the Token's outputs.
 *
 * Shaped for `LootSystem`, which wants `{ itemId, chance, minQty, maxQty }`.
 * Output entries already carry all four — `chance` defaults to 100 for the
 * ordinary always-produces case, and `minQty`/`maxQty` fall back to `baseQty`
 * for entries the simulator has rewritten.
 */
export function enemyDropsOf(def) {
    const outputs = def?.config?.outputs || [];
    return outputs
        .filter(o => o?.itemId)
        .map(o => ({
            itemId: o.itemId,
            chance: o.chance ?? 100,
            minQty: o.minQty ?? o.baseQty?.min ?? 1,
            maxQty: o.maxQty ?? o.baseQty?.max ?? o.minQty ?? 1
        }));
}

// Fantasy Guild — an enemy, read off the Token that is one

import { getTokenType } from './tokenRegistry.js';
import { enemyLevelStats, attackSpeedMs, ATTACK_SPEED_MS, BASE_CRIT_CHANCE, roundHalfUp } from '../FormulaRegistry.js';
import { COMBAT_SKILL_IDS } from './skillRegistry.js';

/**
 * The combat stat block for an enemy Token.
 *
 * ## Why there is no enemy registry
 * An enemy is a Token: the creature and the Token are one entity, authored in one
 * editor and written to one file.
 *
 * ## What an author actually types
 * Fields, in the Token editor's Enemy section:
 *
 * ```json
 * "enemy": { "level": 2, "style": "melee" }
 * ```
 *
 * `level` is the difficulty dial: HP, hit, armour, speed and XP come from the level table
 * (`FormulaRegistry.enemyLevelStats`), and the level is also what the miss chance compares with
 * the hero's combat level. Any one number can be written beside it to replace the table's.
 *
 * ## Drops
 * Not here. A kill is a cycle, so a kill's loot is the cycle's output:
 * `BoardCombat` resolves it from the Token's `config.outputs`, which already
 * carry the `{ itemId, chance, minQty, maxQty }` shape the old inline drop
 * table used. One drop mechanism for the whole board, and the economy
 * simulator can price a Bear the same way it prices a Forest.
 */

/**
 * The combat styles an enemy can be: the registry's Combat-layer skills.
 * Anything else falls back to melee.
 *
 * ⚠️ The CMS imports this to fill its Style dropdown (via `constants.js`), so
 * the authoring tool can never offer a style the engine has not got — the same
 * game-declares / CMS-offers rule as every other vocabulary in the project.
 * An enemy's style and a hero's combat skill are the two sides of the same
 * matchup check, so they share one list.
 */
export const ENEMY_STYLES = Object.freeze([...COMBAT_SKILL_IDS]);

/** Whether a Token def describes something a hero can fight. */
export function isEnemyDef(def) {
    return def?.enemy?.level != null;
}

/**
 * Whether an enemy Token type is **hostile**: it attacks
 * a hero whose flag stands inside the flag radius around its spawner (or itself)
 * (`board/Hostiles.js`). Authored in the CMS as `enemy.hostile`; only a literal
 * `true` counts, and a missing field is peaceful — such an enemy fights only
 * when a hero attacks it.
 */
export function isHostileEnemy(def) {
    return isEnemyDef(def) && def.enemy.hostile === true;
}

/**
 * Build the enemy stat block for a Token definition.
 *
 * The level fills every number from the level table (`enemyLevelStats`); a number written beside
 * the level on the Token's `enemy` (`hp`, `hit`, `armor`, `speed`, `xp`, `dodge`, `accuracy`,
 * `pierce`, `critChance`) replaces that one. Without them an enemy has no Dodge, Accuracy or
 * Pierce and the base 5 % crit.
 *
 * ⚠️ `budgetScale`, from content authored before the level table, still multiplies the table's
 * HP, hit and XP (rounded halves up, at least 1), so the shipped tutorial goblins stay pushovers
 * until their numbers are authored directly. Armour and speed are not scaled.
 *
 * `id` is the **Token's** id: the Bestiary, kill counts and discovery
 * notifications key on an id and look up a name.
 *
 * @param {Object} def A Token definition
 * @returns {Object|null} The stat block, or null if this Token is not an enemy
 */
export function enemyProfileOf(def) {
    if (!isEnemyDef(def)) return null;

    const authored = def.enemy;
    const level = authored.level;
    const table = enemyLevelStats(level);
    const scale = Number(authored.budgetScale) > 0 ? Number(authored.budgetScale) : 1;
    const scaled = (n) => Math.max(1, roundHalfUp(n * scale));
    const style = ENEMY_STYLES.includes(authored.style) ? authored.style : 'melee';
    const speed = ATTACK_SPEED_MS[authored.speed] ? authored.speed : table.speed;

    return {
        id: def.id,
        name: def.name || def.id,
        level,
        combatType: style,
        hp: Math.max(1, numberOr(authored.hp, scaled(table.hp))),
        hit: Math.max(1, numberOr(authored.hit, scaled(table.hit))),
        armor: numberOr(authored.armor, table.armor),
        speed,
        attackSpeed: attackSpeedMs(speed),
        dodge: numberOr(authored.dodge, 0),
        accuracy: numberOr(authored.accuracy, 0),
        pierce: numberOr(authored.pierce, 0),
        critChance: numberOr(authored.critChance, BASE_CRIT_CHANCE),
        // ⚠️ Load-bearing, and easy to miss: `getCombatXpAward` reads
        // `enemy.xpAwarded` and falls back to a flat **1** when it is absent.
        // Leaving it out does not throw — it silently pays 1 XP for every kill
        // at every level, which is exactly the kind of quiet wrongness a
        // missing field is supposed to make loud.
        xpAwarded: Math.max(0, numberOr(authored.xp, scaled(table.xp))),
        // `traits` is read by the attack processor's thorns branch and must be
        // present. Enemy traits are not authorable yet; an empty array is the
        // right value.
        traits: []
    };
}

/** An authored number, or the fallback when the field is missing or not a number. */
function numberOr(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

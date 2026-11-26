// An enemy, read off the Token that is one

import { getTokenType } from './tokenRegistry.js';
import { EFFECTS } from './effectRegistry.js';
import { outputRange } from './tokenConstants.js';
import { enemyLevelStats, attackSpeedMs, ATTACK_SPEED_MS, BASE_CRIT_CHANCE } from '../FormulaRegistry.js';
import { COMBAT_SKILL_IDS } from './skillRegistry.js';
import { enemyKindsOf } from './enemyKinds.js';
import { normaliseResistances } from './damageTypes.js';
import { enemyMovesOf } from './enemyMoves.js';

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
 * `level` is the difficulty dial: HP, hit, speed and XP come from the level table
 * (`FormulaRegistry.enemyLevelStats`), and the level is also what the miss chance compares with
 * the hero's combat level. Any one number can be written beside the level to replace it.
 * `resistances` (a damage type → a signed step, `damageTypes.js`) say what the enemy shrugs off or
 * is weak to, `moves` (`enemyMoves.js`) what it does with each swing, and `kinds` (none, one or two
 * library effects, `enemyKinds.js`) the traits it always carries, which add to all of these in a
 * fight (`enemyKindEffects.js`).
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

/** The numbers an author may type on an enemy to replace what the level fills. */
export const ENEMY_OVERRIDE_FIELDS = Object.freeze(['hp', 'hit', 'speed', 'xp', 'dodge', 'accuracy', 'critChance']);

/**
 * Numbers older content may still carry that the game no longer reads: flat armour and Pierce
 * gave way to damage types (the Armoured kind is a Slash, Crush and Stab resistance now). The audits name them.
 */
export const RETIRED_ENEMY_FIELDS = Object.freeze(['armor', 'pierce']);

/**
 * Marks older content may still carry that the game no longer reads: `boss` (a boss is what a boss
 * camp spawns), `hostile` (an enemy fights only a hero sent at it), `budgetScale` (the level table
 * fills the numbers) and `traits` (kinds are traits). The audits name them.
 */
export const LEFTOVER_ENEMY_FIELDS = Object.freeze(['boss', 'hostile', 'budgetScale', 'traits']);

/**
 * What the level gives an enemy before the author changes anything: the CMS shows these as the
 * defaults, and `enemyProfileOf` starts from them.
 *
 * The level fills HP, hit, speed and XP from the level table (`enemyLevelStats`), with no
 * Dodge or Accuracy, no resistances and the base 5 % crit. Its kinds change nothing here: they add
 * in the fight.
 *
 * @param {Object} enemy a Token's `enemy` block
 * @returns {{hp: number, hit: number, speed: string, xp: number, dodge: number, accuracy: number, critChance: number, resistances: Object<string, number>}}
 */
export function enemyFilledStats(enemy) {
    const table = enemyLevelStats(enemy?.level);
    return {
        hp: table.hp,
        hit: table.hit,
        speed: table.speed,
        xp: table.xp,
        dodge: 0,
        accuracy: 0,
        critChance: BASE_CRIT_CHANCE,
        resistances: {}
    };
}

/**
 * Build the enemy stat block for a Token definition: what the level fills (`enemyFilledStats`), with
 * any number the author wrote beside the level on the Token's `enemy` (`hp`, `hit`, `speed`, `xp`,
 * `dodge`, `accuracy`, `critChance`) replacing that one outright. Its kinds (`kindEffects`) add on
 * top in a fight, as every effect does (`enemyKindEffects.js`).
 *
 * `id` is the **Token's** id: the Bestiary, kill counts and discovery
 * notifications key on an id and look up a name.
 *
 * @param {Object} def A Token definition
 * @param {Object|null} [library] the effect library by id (the CMS hands in its own)
 * @returns {Object|null} The stat block, or null if this Token is not an enemy
 */
export function enemyProfileOf(def, library = EFFECTS) {
    if (!isEnemyDef(def)) return null;

    const authored = def.enemy;
    const level = authored.level;
    const filled = enemyFilledStats(authored);
    const style = ENEMY_STYLES.includes(authored.style) ? authored.style : 'melee';
    const speed = ATTACK_SPEED_MS[authored.speed] ? authored.speed : filled.speed;
    const kinds = enemyKindsOf(authored, library);
    const moves = enemyMovesOf(authored);

    return {
        id: def.id,
        name: def.name || def.id,
        level,
        combatType: style,
        hp: Math.max(1, numberOr(authored.hp, filled.hp)),
        hit: Math.max(1, numberOr(authored.hit, filled.hit)),
        speed,
        attackSpeed: attackSpeedMs(speed),
        dodge: numberOr(authored.dodge, filled.dodge),
        accuracy: numberOr(authored.accuracy, filled.accuracy),
        critChance: numberOr(authored.critChance, filled.critChance),
        resistances: normaliseResistances(authored.resistances),
        // ⚠️ Load-bearing, and easy to miss: `getCombatXpAward` reads
        // `enemy.xpAwarded` and falls back to a flat **1** when it is absent.
        // Leaving it out does not throw — it silently pays 1 XP for every kill
        // at every level, which is exactly the kind of quiet wrongness a
        // missing field is supposed to make loud.
        xpAwarded: Math.max(0, numberOr(authored.xp, filled.xp)),
        // The kinds it carries, library effects' ids, for the enemy card once the guild has fought one.
        kinds,
        // The same effects, whose numbers go on the fight's aggregator (`enemyKindEffects.js`).
        ...(kinds.length ? { kindEffects: kinds } : {}),
        // The moves it picks from each swing (`enemyMoves.js`); without any, a plain Crush hit.
        ...(moves.length ? { moves } : {})
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
 * `chance` defaults to 100 for the ordinary always-produces case. The range is
 * the one a station reads off the same output (`outputRange`: an old `quantity`
 * and an inverted pair included), so a kill and a cycle of one Token roll alike;
 * a line naming no quantity at all falls back to `baseQty`, for entries the
 * simulator has rewritten.
 */
export function enemyDropsOf(def) {
    const outputs = def?.config?.outputs || [];
    return outputs
        .filter(o => o?.itemId)
        .map(o => {
            const named = o.minQty != null || o.maxQty != null || o.quantity != null;
            const { min, max } = outputRange(named ? o : { minQty: o.baseQty?.min, maxQty: o.baseQty?.max });
            return { itemId: o.itemId, chance: o.chance ?? 100, minQty: min, maxQty: max };
        });
}

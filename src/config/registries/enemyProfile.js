// Fantasy Guild — an enemy, read off the Token that is one

import { getTokenType } from './tokenRegistry.js';
import { enemyLevelStats, attackSpeedMs, ATTACK_SPEED_MS, BASE_CRIT_CHANCE, roundHalfUp } from '../FormulaRegistry.js';
import { COMBAT_SKILL_IDS } from './skillRegistry.js';
import { enemyKindsOf } from './enemyKinds.js';

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
 * the hero's combat level. `kinds` (none, one or two of `enemyKinds.js`) twist those numbers, and
 * any one number can be written beside the level to replace the result.
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
    return isEnemyDef(def) && def.enemy.hostile === true && !isBossEnemy(def);
}

/**
 * Whether an enemy Token type is a **boss**: `enemy.boss: true` (only a literal `true`). A boss
 * fights only when the player sends a hero: it is never hostile, whatever `hostile` says, and no
 * `Spawns` rule makes one, so it never ambushes. It comes from a camp of its own (a spawner that
 * keeps one) or a Summoning Circle (a Token whose work makes it). Boss moves hang on this mark.
 */
export function isBossEnemy(def) {
    return isEnemyDef(def) && def.enemy.boss === true;
}

/** The numbers an author may type on an enemy to replace what the level and kinds fill. */
export const ENEMY_OVERRIDE_FIELDS = Object.freeze(['hp', 'hit', 'armor', 'speed', 'xp', 'dodge', 'accuracy', 'pierce', 'critChance']);

/**
 * What the level and the kinds give an enemy before the author changes anything: the CMS shows
 * these as the defaults, and `enemyProfileOf` starts from them.
 *
 * The level fills HP, hit, armour, speed and XP from the level table (`enemyLevelStats`), with no
 * Dodge, Accuracy or Pierce and the base 5 % crit. Each kind then adjusts the result, in the order
 * ticked (`enemyKinds.js` says how).
 *
 * ⚠️ `budgetScale`, from content authored before the level table, still multiplies the table's
 * HP, hit and XP (rounded halves up, at least 1), so the shipped tutorial goblins stay pushovers
 * until their numbers are authored directly. Armour and speed are not scaled.
 *
 * @param {Object} enemy a Token's `enemy` block
 * @returns {{hp: number, hit: number, armor: number, speed: string, xp: number, dodge: number, accuracy: number, pierce: number, critChance: number, onHit: Array<{effectId: string}>}}
 */
export function enemyFilledStats(enemy) {
    const table = enemyLevelStats(enemy?.level);
    const scale = Number(enemy?.budgetScale) > 0 ? Number(enemy.budgetScale) : 1;
    const scaled = (n) => Math.max(1, roundHalfUp(n * scale));

    const levelHit = scaled(table.hit);
    const filled = {
        hp: scaled(table.hp),
        hit: levelHit,
        armor: table.armor,
        speed: table.speed,
        xp: scaled(table.xp),
        dodge: 0,
        accuracy: 0,
        pierce: 0,
        critChance: BASE_CRIT_CHANCE,
        onHit: []
    };

    for (const kind of enemyKindsOf(enemy)) {
        if (kind.armor) filled.armor += kind.armor;
        if (kind.dodge) filled.dodge += kind.dodge;
        if (kind.speed) filled.speed = kind.speed;
        if (kind.hitScale) filled.hit = Math.max(1, roundHalfUp(filled.hit * kind.hitScale));
        if (kind.hitAtLeastMore) filled.hit = Math.max(filled.hit, levelHit + kind.hitAtLeastMore);
        if (kind.onHit) filled.onHit.push({ ...kind.onHit });
    }

    return filled;
}

/**
 * Build the enemy stat block for a Token definition: what the level and kinds fill
 * (`enemyFilledStats`), with any number the author wrote beside the level on the Token's `enemy`
 * (`hp`, `hit`, `armor`, `speed`, `xp`, `dodge`, `accuracy`, `pierce`, `critChance`) replacing that
 * one outright.
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
    const filled = enemyFilledStats(authored);
    const style = ENEMY_STYLES.includes(authored.style) ? authored.style : 'melee';
    const speed = ATTACK_SPEED_MS[authored.speed] ? authored.speed : filled.speed;
    const kinds = enemyKindsOf(authored).map(k => k.id);

    return {
        id: def.id,
        name: def.name || def.id,
        level,
        combatType: style,
        hp: Math.max(1, numberOr(authored.hp, filled.hp)),
        hit: Math.max(1, numberOr(authored.hit, filled.hit)),
        armor: numberOr(authored.armor, filled.armor),
        speed,
        attackSpeed: attackSpeedMs(speed),
        dodge: numberOr(authored.dodge, filled.dodge),
        accuracy: numberOr(authored.accuracy, filled.accuracy),
        pierce: numberOr(authored.pierce, filled.pierce),
        critChance: numberOr(authored.critChance, filled.critChance),
        // ⚠️ Load-bearing, and easy to miss: `getCombatXpAward` reads
        // `enemy.xpAwarded` and falls back to a flat **1** when it is absent.
        // Leaving it out does not throw — it silently pays 1 XP for every kill
        // at every level, which is exactly the kind of quiet wrongness a
        // missing field is supposed to make loud.
        xpAwarded: Math.max(0, numberOr(authored.xp, filled.xp)),
        // The kinds it carries, for the enemy card once the guild has fought one.
        kinds,
        // What a landed hit puts on the hero (Venomous), by library effect; `FightMoments` lands it.
        ...(filled.onHit.length ? { onHit: filled.onHit } : {}),
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

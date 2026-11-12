import * as TileModifiers from './TileModifiers.js';
import { rollChance } from './CycleSavings.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { rareTableOf, pickRareEntry, rareEntryShare } from '../../config/registries/rareTables.js';

/**
 * A Token's rare drop table rolled at the end of a cycle (`BoardRunner.completeCycle`) or a kill
 * (`LootSystem`), after its own lines: one roll at the table's chance widened by Lucky, and on a hit
 * one entry picked by weight. The caller lands the entry as it lands any line (Yield, Double Loot,
 * Double Item), and never asks on a failed cycle.
 *
 * ⚠️ The bench's work check pins the `Math.random` stream. A Token with no table makes no draw at
 * all (nor does Lucky); with one, the roll draws once and a hit draws once more for the pick, unless
 * the table holds one entry.
 */

const clampChance = (n) => Math.max(0, Math.min(100, Number(n) || 0));

/**
 * The chance (percent) `table` rolls at Token `instanceId` once Lucky has widened it: the table's
 * own chance as the base, through the Token's neighbours, the guild's stars and its hero, narrowed
 * to `skill`. With no Token (a kill banked off the mat), the guild's stars alone. 0 with no table.
 * Draws nothing.
 */
export function luckyChance(instanceId, table, skill) {
    if (!table) return 0;
    const resolved = instanceId
        ? TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.LUCKY, table.chance, skill)
        : getGlobalAggregator().resolveAxis(EFFECT_TYPES.LUCKY, table.chance, skill);
    return clampChance(resolved);
}

/**
 * Token type `def`'s rare table at Token `instanceId`: the chance it rolls now, with Lucky, or null
 * for a Token with no table. Draws nothing.
 */
export function rareChanceAt(instanceId, def, skill) {
    const table = rareTableOf(def);
    return table ? luckyChance(instanceId, table, skill) : null;
}

/**
 * Roll Token type `def`'s rare table at Token `instanceId`: `{ entry, chance }` on a hit (`chance`:
 * the percent this entry drops a cycle, Lucky counted), else null. No table, no draw.
 */
export function rollRareTable(instanceId, def, skill, random = Math.random) {
    const table = rareTableOf(def);
    if (!table) return null;
    const chance = luckyChance(instanceId, table, skill);
    if (!rollChance(chance, random)) return null;
    const entry = pickRareEntry(table, random);
    return entry ? { entry, chance: chance * rareEntryShare(table, entry) } : null;
}

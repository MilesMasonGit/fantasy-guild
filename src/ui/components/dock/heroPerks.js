import { EFFECTS } from '../../../config/registries/effectRegistry.js';
import { perkRowsFor } from '../../../config/registries/perkRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { tokenName, getAllTokenTypes } from '../../../config/registries/tokenRegistry.js';
import { perksEarnedAt, perksReached, nextPerksAfter } from '../../../systems/hero/perkTable.js';
import { effectTitle, statementsFromEntry } from '../../../systems/effects/effectLibrary.js';
import { renderStatement, renderSegments } from '../../../systems/effects/statementText.js';
import { toolNamer } from '../../../systems/effects/toolNames.js';

/**
 * Milestone perks as the hero sheet, the hero bar's alerts and the level-up float show them: each
 * perk by its effect's title (with its numeral at a scale above 1) and what its rules do, at its
 * scale.
 */

/** The names the grammar's sentences use for a rule a hero carries (a perk, a piece of gear). */
export function carriedRuleNames() {
    return {
        carried: true,
        token: id => tokenName(id) || id,
        item: id => getItem(id)?.name || id,
        tool: toolNamer(getAllTokenTypes())
    };
}

/** A perk's name: its effect's title, or the effect id while the effect is missing. */
export function perkTitle(row) {
    const entry = EFFECTS[row?.effectId];
    return effectTitle(entry?.name || row?.effectId || '', row?.scale ?? 1);
}

/**
 * A perk's rules, one line each, at its scale, as the hero's rule lines: a standing effect leads
 * with its name and number, as the badge it causes ("Double Loot 5% on Forestry Tokens.").
 */
export function perkLines(row) {
    const entry = EFFECTS[row?.effectId];
    if (!entry) return [];
    const names = carriedRuleNames();
    return statementsFromEntry(entry, row).map(statement => renderStatement(statement, names));
}

/** {@link perkLines} as segments, each effect's name marked (`effect`) for its hover. */
export function perkSegments(row) {
    const entry = EFFECTS[row?.effectId];
    if (!entry) return [];
    const names = carriedRuleNames();
    return statementsFromEntry(entry, row).map(statement => renderSegments(statement, names));
}

const shown = (row) => ({ level: row.level, effectId: row.effectId, title: perkTitle(row) });

/**
 * One skill's perks for a hero at `level`: those held, lowest first, and the next level's (several
 * when two share it), each `{ level, effectId, title }`. Both empty when the skill has no table.
 */
export function skillPerkView(skillId, level) {
    const rows = perkRowsFor(skillId);
    if (!rows.length) return { earned: [], next: [] };
    return {
        earned: perksEarnedAt(rows, level).map(shown),
        next: nextPerksAfter(rows, level).map(shown)
    };
}

/** The perks a level-up from `fromLevel` to `toLevel` reached in one skill, lowest first. */
export function perksReachedBy(skillId, fromLevel, toLevel) {
    return perksReached(perkRowsFor(skillId), fromLevel, toLevel).map(shown);
}

/**
 * Every milestone perk of one skill, lowest first, each `{ level, effectId, title, earned }`:
 * `earned` when a hero at `level` holds it. Empty when the skill has no table.
 */
export function skillPerkTable(skillId, level) {
    const held = new Set(perksEarnedAt(perkRowsFor(skillId), level));
    return perkRowsFor(skillId).map(row => ({ ...shown(row), scale: row.scale, earned: held.has(row) }));
}

// Perk tables that name a skill the game does not have, an effect that is gone, or a level no hero reaches.

import { isSkillId, getSkill } from '../../config/registries/skillRegistry.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { statementsOf, getKeyword, KEYWORD } from '../effects/statements.js';
import { TARGET_CATEGORIES } from '../effects/constants.js';
import { isPerkLevel } from '../hero/perkTable.js';

/**
 * The one rule behind the perk lines of the game's boot audit (`ContentAudit`) and the CMS Economy
 * Audit, so both name the same perks in the same words. It only reports: a bad row is skipped by
 * the game (`perkTable.perkRowsOf`) and does nothing.
 *
 * Input: the perk tables as authored (`{ forestry: { perks: [...] } }`) and the effect library,
 * both keyed by id. A row with no effect is a blank row, not a finding.
 *
 * Output: `[{ entityType: 'Skill', entityId, entityName, field, message }]`, `message` a sentence
 * that does not repeat the skill's name.
 */
export function perkFindings({ skillPerks, effects } = {}) {
    const out = [];
    for (const [skillId, record] of Object.entries(skillPerks || {})) {
        const rows = Array.isArray(record?.perks) ? record.perks : [];
        const name = getSkill(skillId)?.name || skillId;
        const push = (message) => out.push({ entityType: 'Skill', entityId: skillId, entityName: name, field: 'perks', message });
        const working = rows.filter(row => typeof row?.effectId === 'string' && row.effectId.trim());
        if (!working.length) continue;

        if (!isSkillId(skillId)) {
            push(`has a perk table, but "${skillId}" is not a skill the game has, so no hero ever holds its perks. Move them to a skill in the CMS's Skill Perks page.`);
            continue;
        }
        for (const row of working) {
            const level = Number(row.level);
            const effect = effects?.[row.effectId];
            const at = Number.isFinite(level) ? `level ${level}` : 'a level that is not a number';
            if (!isPerkLevel(level)) {
                push(`has a perk at ${at}, which no hero reaches (perks sit at whole levels from 2 to 99) — it is never held.`);
                continue;
            }
            if (!effect) {
                push(`its level ${level} perk points at the effect "${row.effectId}", which does not exist — it was probably renamed or deleted. The perk does nothing.`);
                continue;
            }
            perkEffectFindings(effect, skillId, (message) => push(`its level ${level} perk (${effect.name || row.effectId}) ${message}`));
        }
    }
    return out;
}

/** What a perk's own effect does wrong as a perk. */
function perkEffectFindings(effect, skillId, push) {
    const skillName = getSkill(skillId)?.name || skillId;
    for (const statement of statementsOf(effect)) {
        const keyword = getKeyword(statement?.keyword);
        if (keyword?.retired || keyword?.tokensOnly) {
            push(`has a ${keyword.label} rule, which does nothing on a hero.`);
            continue;
        }
        const payload = statement?.payload || {};
        const palette = statement?.keyword === KEYWORD.PROVIDES ? getPaletteEntry(payload.type) : null;
        const unscoped = !payload.category || payload.category === TARGET_CATEGORIES.ALL;
        if (palette?.categories === 'skill' && unscoped) {
            push(`changes ${palette.label} on every skill's work, not only ${skillName}'s. Narrow the rule to ${skillName} in the CMS if that is not meant.`);
        }
    }
}

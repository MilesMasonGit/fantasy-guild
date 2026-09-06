import { SKILLS } from '../utils/constants';

/**
 * The Progression screen's rows — one shape from two different records.
 *
 * ## ⚠️ The level is not one field
 *
 * A **Token** states its level as `config.skillRequired`; a **recipe** states it
 * as `levelRequirement`. `fieldAdapter.js` says outright that the two are not
 * interchangeable (finding B5), and a list that reads one name for both would
 * look right while silently showing — and writing — the wrong thing for half
 * its rows. The same is true of the cycle length: `config.cycleTimeMs` on a
 * Token, `durationMs` on a recipe.
 *
 * So the reconciliation happens **here, once, at the edge**, and every consumer
 * above this file sees one row. That is deliberately the same trick
 * `fieldAdapter.js` plays for the simulator's passes, for the same reason.
 *
 * Tempo and Purpose are the exception: both records keep them on `sim`, so they
 * need no adapting.
 *
 * ## What a row carries
 *
 * Besides the display fields, each row carries **where to write back to**:
 * `kind` says which store action applies, and a recipe adds the `poolSkill` and
 * `index` that `updateRecipe(skillId, index, patch)` addresses it by. A Token is
 * addressed by `id`. Nothing above this file has to know either rule.
 */

/** The level a record gates on, whichever field it keeps it in. */
export function levelOf(row) {
    return row.level;
}

/**
 * Every Token and recipe that has a work cycle, as rows.
 *
 * ⚠️ "Has a work cycle" means **has a config**, not "has inputs or outputs". A
 * pooled station draws its recipes from a skill pool and so carries no I/O of
 * its own, while still having exactly the skill and level this screen edits.
 * Filtering on I/O would drop it.
 */
export function progressionRows({ tokens = {}, recipePools = {} } = {}) {
    const rows = [];

    for (const [key, token] of Object.entries(tokens)) {
        const config = token?.config;
        if (!config) continue;
        rows.push({
            rowKey: `token:${token.id ?? key}`,
            kind: 'token',
            id: token.id ?? key,
            name: token.name || token.id || key,
            skill: config.skill || '',
            level: config.skillRequired ?? 1,
            tempo: token.sim?.tempo,
            purpose: token.sim?.purpose,
            cycleTimeMs: config.cycleTimeMs,
            xp: config.xp,
        });
    }

    for (const [poolSkill, pool] of Object.entries(recipePools)) {
        if (!Array.isArray(pool)) continue;
        pool.forEach((recipe, index) => {
            if (!recipe) return;
            rows.push({
                rowKey: `recipe:${recipe.id ?? `${poolSkill}:${index}`}`,
                kind: 'recipe',
                id: recipe.id,
                name: recipe.name || recipe.id || 'Untitled',
                // A recipe is owned by its pool, so the pool key is the
                // authority when the record disagrees or says nothing.
                skill: recipe.skill || poolSkill || '',
                level: recipe.levelRequirement ?? 1,
                tempo: recipe.sim?.tempo,
                purpose: recipe.sim?.purpose,
                cycleTimeMs: recipe.durationMs,
                xp: recipe.xp,
                poolSkill,
                index,
            });
        });
    }

    return rows;
}

/** Rows with no skill sort last, under this key. */
export const NO_SKILL = '';

/**
 * Rows grouped by skill, in the game's own skill order, level-ordered within.
 *
 * ⚠️ Skills with no rows are dropped. The skill registry has 27 entries and the
 * shipped corpus uses six of them, so keeping the empties would bury the list
 * under twenty-one headings for nothing — the same noise the Recipes sidebar
 * carries because it is a list *of skills* rather than of content.
 *
 * The **No skill** group sorts last rather than first. 16 of the shipped Tokens
 * with a cycle have no skill at all, so it is a large group, and it is a group
 * of things that are not on any ladder — the opposite of what this screen is
 * for reading top to bottom.
 */
export function groupBySkill(rows) {
    const order = SKILLS.map((s) => s.id);
    const bySkill = new Map();

    for (const row of rows) {
        const key = row.skill || NO_SKILL;
        if (!bySkill.has(key)) bySkill.set(key, []);
        bySkill.get(key).push(row);
    }

    const rank = (skill) => {
        if (skill === NO_SKILL) return Number.MAX_SAFE_INTEGER;
        const i = order.indexOf(skill);
        // A skill the registry does not declare still gets a group rather than
        // vanishing: content outlives a registry edit, and a silently dropped
        // row is worse than an oddly placed one.
        return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i;
    };

    return [...bySkill.entries()]
        .sort(([a], [b]) => rank(a) - rank(b))
        .map(([skill, group]) => [skill, group.sort(compareRows)]);
}

/** Level first, then name, so two runs of the same content agree. */
export function compareRows(a, b) {
    if (a.level !== b.level) return a.level - b.level;
    return String(a.name).localeCompare(String(b.name));
}

/** Rows matching a name search and an optional skill. */
export function filterRows(rows, { search = '', skill = '' } = {}) {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
        if (skill && (row.skill || NO_SKILL) !== skill) return false;
        if (!needle) return true;
        return String(row.name).toLowerCase().includes(needle)
            || String(row.id ?? '').toLowerCase().includes(needle);
    });
}

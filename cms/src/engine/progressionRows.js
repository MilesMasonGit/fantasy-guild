import { SKILLS } from '../utils/constants';

/**
 * The Progression screen's rows: one shape from two different records.
 * ⚠️ The level is not one field: a Token keeps it at `config.skillRequired`, a recipe at `levelRequirement`; likewise cycle length is `config.cycleTimeMs` on a Token and `durationMs` on a recipe. The reconciliation happens here, once, so every consumer sees one row. Tempo and Purpose are on `sim` for both. Each row also carries where to write back to: `kind` picks the store action, and a recipe adds the `poolSkill` and `index` that `updateRecipe(skillId, index, patch)` addresses it by.
 */

/** The level a record gates on, whichever field it keeps it in. */
export function levelOf(row) {
    return row.level;
}

/**
 * Every Token and recipe that has a work cycle, as rows.
 * ⚠️ Has a work cycle means has a config, not has inputs or outputs: a pooled station carries no I/O of its own but still has the skill and level this screen edits.
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

/** Rows grouped by skill, in the game's own skill order, level-ordered within. Skills with no rows are dropped. The No skill group sorts last, because it holds things that are not on any ladder. */
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

/**
 * The record patch for one inline edit.
 * ⚠️ The write half of the field-name problem: writing the wrong field puts an authored value where nothing reads it and looks like it worked, so the same `kind` that chose where to read chooses where to write. A Token's level is `config.skillRequired`, and the config is MERGED because `updateToken` shallow-merges its patch; a recipe's is `levelRequirement`. Tempo and Purpose sit on `sim` and are merged the same way. Clearing a tag DELETES the key: `tempoPass` treats a missing tag as untagged, whereas an empty string would file an `unknown-tempo` row.
 * @param row     the row being edited, for its `kind`
 * @param current the live record, so merges keep what they are not changing
 * @param edit    any of `{ level, tempo, purpose }`
 * @returns a patch for `updateToken` / `updateRecipe`
 */
export function recordPatch(row, current, edit = {}) {
    const patch = {};

    if ('level' in edit) {
        const level = Math.max(1, Math.round(Number(edit.level) || 1));
        if (row.kind === 'token') {
            patch.config = { ...(current?.config || {}), skillRequired: level };
        } else {
            patch.levelRequirement = level;
        }
    }

    if ('tempo' in edit || 'purpose' in edit) {
        const sim = { ...(current?.sim || {}) };
        for (const key of ['tempo', 'purpose']) {
            if (!(key in edit)) continue;
            if (edit[key]) sim[key] = edit[key];
            else delete sim[key];
        }
        // An empty `sim` is dropped entirely rather than left as `{}`, so a
        // record that has been untagged again is byte-identical to one that was
        // never tagged. The drift alarm compares those.
        patch.sim = Object.keys(sim).length > 0 ? sim : undefined;
    }

    return patch;
}

/**
 * A patch that puts one record back the way it was. The undo for a bulk edit is a snapshot taken before the action, because a bulk action sets an absolute value over rows that held different values.
 * ⚠️ Deep-copied, not referenced: a snapshot holding a live reference would silently undo to the current value. A `sim` that did not exist snapshots as `undefined`, restoring no `sim` rather than an empty one.
 */
export function undoSnapshot(row, current) {
    const sim = current?.sim ? { ...current.sim } : undefined;
    if (row.kind === 'token') {
        return { config: { ...(current?.config || {}) }, sim };
    }
    return { levelRequirement: current?.levelRequirement, sim };
}

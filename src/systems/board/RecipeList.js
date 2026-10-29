// the recipe list a station's or Foundation's card flips to

import { poolFor, recipeLevel } from './StationRecipe.js';
import { stationSkillOf } from '../effects/statements.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { tokenName } from '../../config/registries/tokenRegistry.js';

/**
 * One list per station, sorted by required level, with a hero-face divider at the level of each
 * hero holding the skill and the next locked recipes as "???" silhouettes. "Can run" is the whole
 * roster's best level. Pure: every engine read is the def and the hero records passed in, so a
 * test can pin the list without a mat.
 */

export const ENTRY = Object.freeze({
    RECIPE: 'recipe',
    HEROES: 'heroes',
    LOCKED: 'locked'
});

/** How many recipes past the guild's reach show as "???" (concept_knowledge: a step or two ahead). */
export const SPOILER_COUNT = 2;

/** The skill whose recipes a Token chooses between: a Foundation's own, else its `Works as`. */
export function listSkillOf(def) {
    return def?.foundation?.skill || stationSkillOf(def) || null;
}

/** A hero record's level in a skill; 0 when they do not hold it. Tolerates a bare-number skill. */
export function heroSkillLevel(hero, skill) {
    const entry = skill ? hero?.skills?.[skill] : null;
    if (entry == null) return 0;
    return Number(typeof entry === 'number' ? entry : entry.level) || 0;
}

/** Whether a hero holds the skill. */
export function permitsSkill(hero, skill) {
    return !!hero && !!skill && hero.skills?.[skill] != null;
}

/**
 * The permitted heroes and their levels, highest first (ties keep roster order).
 * @returns {{ heroId: string, level: number, isWorker: boolean }[]}
 */
export function permittedHeroes(heroes, skill, workerId = null) {
    return (heroes || [])
        .map((hero, order) => ({ hero, order }))
        .filter(({ hero }) => permitsSkill(hero, skill))
        .map(({ hero, order }) => ({ heroId: hero.id, level: heroSkillLevel(hero, skill), isWorker: hero.id === workerId, order }))
        .sort((a, b) => (b.level - a.level) || (a.order - b.order))
        .map(({ order, ...rest }) => rest);
}

/** The display names a search matches: every input's and every output's (an item, or a built Token). */
export function searchNamesOf(recipe, names = defaultNames) {
    const out = [];
    for (const i of recipe?.inputs || []) if (i?.itemId) out.push(names.item(i.itemId));
    for (const o of recipe?.outputs || []) {
        if (o?.tokenId) out.push(names.token(o.tokenId));
        else if (o?.itemId) out.push(names.item(o.itemId));
    }
    return out.filter(Boolean);
}

const defaultNames = {
    item: (id) => getItem(id)?.name || id,
    token: (id) => tokenName(id) || id
};

/** Whether a recipe matches a search: any input or output name holds the text, case ignored. */
export function matchesSearch(recipe, query, names = defaultNames) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    return searchNamesOf(recipe, names).some(n => String(n).toLowerCase().includes(q));
}

/**
 * The list, top to bottom.
 *
 * Entries: `recipe` rows (level ascending, ties in content order); a `heroes` divider after the
 * last row each permitted hero can run, carrying every permitted hero at that point (a hero who
 * can run none of the rows gets no face); then up to {@link SPOILER_COUNT} `locked` silhouettes
 * for the next levels past the whole roster. With a search, rows that do not match drop out,
 * silhouettes always drop out, and the dividers stay. Dividers with no row between them are one
 * line: two lines in a row would say nothing the faces on one line don't.
 *
 * @param {object} def        the station or Foundation type
 * @param {{ workerId?: string|null, heroes?: object[], query?: string, names?: object }} [opts]
 * @returns {{ skill: string|null, guildLevel: number, entries: object[] }}
 */
export function recipeListFor(def, { workerId = null, heroes = [], query = '', names = defaultNames } = {}) {
    const skill = listSkillOf(def);
    const guildLevel = (heroes || []).reduce((best, h) => Math.max(best, heroSkillLevel(h, skill)), 0);
    const sorted = poolFor(def)
        .map((recipe, order) => ({ recipe, order, level: recipeLevel(recipe) }))
        .sort((a, b) => (a.level - b.level) || (a.order - b.order));

    const runnable = sorted.filter(r => r.level <= guildLevel);
    const locked = sorted.filter(r => r.level > guildLevel).slice(0, SPOILER_COUNT);
    const lowest = runnable.length ? runnable[0].level : Infinity;

    // Grouped by level, highest first, so the last group popped is the next divider down the list.
    const groups = new Map();
    for (const h of permittedHeroes(heroes, skill, workerId)) {
        if (h.level < lowest) continue;
        if (!groups.has(h.level)) groups.set(h.level, []);
        groups.get(h.level).push(h);
    }
    const pending = [...groups.entries()].sort((a, b) => b[0] - a[0]);
    const divider = ([level, list]) => ({ kind: ENTRY.HEROES, level, heroes: list });

    const searching = String(query || '').trim() !== '';
    const entries = [];
    for (const row of runnable) {
        while (pending.length && pending[pending.length - 1][0] < row.level) entries.push(divider(pending.pop()));
        if (!searching || matchesSearch(row.recipe, query, names)) {
            entries.push({ kind: ENTRY.RECIPE, recipe: row.recipe, level: row.level });
        }
    }
    while (pending.length) entries.push(divider(pending.pop()));
    mergeAdjacentDividers(entries);
    if (!searching) {
        for (const row of locked) entries.push({ kind: ENTRY.LOCKED, level: row.level, key: row.recipe.id, recipe: row.recipe });
    }

    return { skill, guildLevel, entries };
}

/** Folds each run of dividers with no row between into the first of them, in place. */
function mergeAdjacentDividers(entries) {
    for (let i = entries.length - 1; i > 0; i--) {
        if (entries[i].kind === ENTRY.HEROES && entries[i - 1].kind === ENTRY.HEROES) {
            entries[i - 1] = { ...entries[i - 1], heroes: [...entries[i - 1].heroes, ...entries[i].heroes] };
            entries.splice(i, 1);
        }
    }
}

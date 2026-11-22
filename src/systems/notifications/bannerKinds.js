/**
 * What each kind of banner says. A banner carries its `parts` (who, what), and its title and line
 * are written from them here, so two banners of a kind can merge by merging their parts.
 *
 * `tone` is `'milestone'` (gold edge, a shine, a chime) or `'problem'` (red edge, a warning tone).
 * `merge` folds a waiting banner's parts into another of its kind (null: a kind that never merges).
 * `mergeShown`: a kind that is a lasting condition rather than a moment, merged into one already on
 * screen instead of stacking a copy (a full Bank refusing one item after another).
 * `pointsTo`: a kind whose click takes the player to its Token on the mat and pulses its outline
 * (from the World Map or the Guild Hall, back to the mat first), and which also shows on those two
 * screens (`BannerStack`'s `away`).
 * `kept`: a kind the save keeps while it is unclicked, shown again at the next start (`ui.banners`).
 * A save problem is not kept: it speaks of the run that raised it.
 */

import { t } from '../../i18n/index.js';

export const TONE = Object.freeze({ MILESTONE: 'milestone', PROBLEM: 'problem' });

/** "Aela", "Aela and Bram", "Aela, Bram and Cara", "Aela, Bram and 2 more". */
export function nameList(names) {
    const list = [...new Set((names || []).filter(Boolean))];
    if (list.length <= 1) return list[0] || '';
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]}`;
    return `${list[0]}, ${list[1]} and ${list.length - 2} more`;
}

const union = (a = [], b = []) => [...new Set([...a, ...b])];

/** A knock-out banner's losses, one row per hero: `{ hero, lost }`. */
function knockoutLosses({ heroes = [], lost = [], losses } = {}) {
    if (Array.isArray(losses)) return losses;
    return heroes.slice(0, 1).map(hero => ({ hero, lost: Array.isArray(lost) ? lost : [] }));
}

/** "Cider", "Cider, Apple Pie", "3 recipes: Cider, Apple Pie, ..." */
function recipeList(recipes) {
    if (recipes.length <= 2) return recipes.join(', ');
    return `${recipes.length} recipes: ${recipes[0]}, ${recipes[1]}, ...`;
}

export const BANNER_KINDS = Object.freeze({
    recipe: {
        tone: TONE.MILESTONE,
        text: ({ heroes = [], recipes = [] }) => ({
            title: recipes.length > 1 ? 'New Recipes!' : 'New Recipe!',
            line: `${nameList(heroes)} unlocked ${recipeList(recipes)}`
        }),
        merge: (a, b) => ({ heroes: union(a.heroes, b.heroes), recipes: union(a.recipes, b.recipes) })
    },
    hero: {
        tone: TONE.MILESTONE,
        text: ({ heroes = [] }) => ({
            title: heroes.length > 1 ? 'New Heroes!' : 'New Hero!',
            line: `${nameList(heroes)} joined the guild`
        }),
        merge: (a, b) => ({ heroes: union(a.heroes, b.heroes) })
    },
    upgrade: {
        tone: TONE.MILESTONE,
        text: ({ upgrades = [], detail = null }) => ({
            title: 'Guild Upgrade!',
            line: upgrades.length === 1 && detail ? `${upgrades[0]}: ${detail}` : `${nameList(upgrades)} upgraded`
        }),
        merge: (a, b) => ({ upgrades: union(a.upgrades, b.upgrades), detail: b.detail })
    },
    settled: {
        tone: TONE.MILESTONE,
        text: ({ places = [] }) => ({
            title: 'New Place Settled!',
            line: `The guild settled ${nameList(places)}`
        }),
        merge: (a, b) => ({ places: union(a.places, b.places) })
    },
    // A banner pushed for one knock-out carries `{ heroes: [name], lost }`; a merged one carries
    // each hero's own losses in `losses` (one row per hero, in the order they fell), since one merged
    // list cannot say who lost what.
    knockout: {
        tone: TONE.PROBLEM,
        kept: true,
        text: (parts) => {
            const { heroes = [] } = parts;
            const rows = knockoutLosses(parts);
            if (heroes.length === 1) {
                const lost = rows[0]?.lost ?? [];
                return {
                    title: 'Knocked Out!',
                    line: `${heroes[0]} was carried home, injured. ${lost.length ? `Lost: ${lost.join(', ')}.` : 'Nothing was lost.'}`
                };
            }
            const said = rows.filter(r => r.lost.length).map(r => `${r.hero} lost: ${r.lost.join(', ')}.`);
            return {
                title: 'Knocked Out!',
                line: `${nameList(heroes)} knocked out and carried home. ${said.length ? said.join(' ') : 'Nothing was lost.'}`
            };
        },
        merge: (a, b) => {
            const losses = knockoutLosses(a).map(r => ({ ...r, lost: [...r.lost] }));
            for (const row of knockoutLosses(b)) {
                const same = losses.find(r => r.hero === row.hero);
                if (same) same.lost.push(...row.lost);
                else losses.push({ hero: row.hero, lost: [...row.lost] });
            }
            return { heroes: union(a.heroes, b.heroes), losses };
        }
    },
    bankFull: {
        tone: TONE.PROBLEM,
        kept: true,
        mergeShown: true,
        text: ({ items = [] }) => ({
            title: 'Bank Full!',
            line: `${nameList(items)} ${items.length > 1 ? 'wait' : 'waits'} on the mat until the Bank has room`
        }),
        merge: (a, b) => ({ items: union(a.items, b.items) })
    },
    // An item at the ceiling every stack shares (`DEFAULT_MAX_STACK`): the Bank may have free slots,
    // so "Bank full" would send the player to look for the wrong thing.
    stackFull: {
        tone: TONE.PROBLEM,
        mergeShown: true,
        text: ({ items = [] }) => ({
            title: 'Stack Full!',
            line: `${nameList(items)} ${items.length > 1 ? 'wait' : 'waits'} on the mat: the Bank holds no more of ${items.length > 1 ? 'them' : 'it'}`
        }),
        merge: (a, b) => ({ items: union(a.items, b.items) })
    },
    // One event at a time is on the mat, so one banner each; it goes when its Token leaves.
    event: {
        tone: TONE.MILESTONE,
        pointsTo: true,
        text: ({ name = '' }) => ({ title: t('events.banner.title', { event: name }), line: '' }),
        merge: null
    },
    // Each save problem is its own banner; only a repeat of the same one (its `groupKey`) folds in.
    save: {
        tone: TONE.PROBLEM,
        text: ({ title = 'Save Problem', message = '' }) => ({ title, line: message }),
        merge: null
    }
});

/** The title and line a kind writes from its parts. */
export function bannerText(kind, parts) {
    const def = BANNER_KINDS[kind];
    return def ? def.text(parts || {}) : { title: '', line: '' };
}

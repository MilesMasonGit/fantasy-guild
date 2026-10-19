/**
 * What each kind of banner says. A banner carries its `parts` (who, what), and its title and line
 * are written from them here, so two banners of a kind can merge by merging their parts.
 *
 * `tone` is `'milestone'` (gold edge, a shine, a chime) or `'problem'` (red edge, a warning tone).
 * `merge` folds a waiting banner's parts into another of its kind (null: a kind that never merges).
 * `mergeShown`: a kind that is a lasting condition rather than a moment, merged into one already on
 * screen instead of stacking a copy (a full Bank refusing one item after another).
 */

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
    promotion: {
        tone: TONE.MILESTONE,
        text: ({ heroes = [], job = null }) => ({
            title: 'Promotion!',
            line: heroes.length === 1 && job ? `${heroes[0]} is now a ${job}` : `${nameList(heroes)} were promoted`
        }),
        merge: (a, b) => ({ heroes: union(a.heroes, b.heroes), job: a.job === b.job ? a.job : null })
    },
    upgrade: {
        tone: TONE.MILESTONE,
        text: ({ upgrades = [], detail = null }) => ({
            title: 'Guild Upgrade!',
            line: upgrades.length === 1 && detail ? `${upgrades[0]}: ${detail}` : `${nameList(upgrades)} upgraded`
        }),
        merge: (a, b) => ({ upgrades: union(a.upgrades, b.upgrades), detail: b.detail })
    },
    knockout: {
        tone: TONE.PROBLEM,
        text: ({ heroes = [], lost = [] }) => ({
            title: 'Knocked Out!',
            line: heroes.length === 1
                ? `${heroes[0]} was carried home, injured. ${lost.length ? `Lost: ${lost.join(', ')}.` : 'Nothing was lost.'}`
                : `${nameList(heroes)} knocked out and carried home`
        }),
        merge: (a, b) => ({ heroes: union(a.heroes, b.heroes), lost: union(a.lost, b.lost) })
    },
    bankFull: {
        tone: TONE.PROBLEM,
        mergeShown: true,
        text: ({ items = [] }) => ({
            title: 'Bank Full!',
            line: `${nameList(items)} ${items.length > 1 ? 'wait' : 'waits'} on the mat until the Bank has room`
        }),
        merge: (a, b) => ({ items: union(a.items, b.items) })
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

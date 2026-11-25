/**
 * What each kind of banner says. A banner carries its `parts` (who, what), and its title and line
 * are written from them here, so two banners of a kind can merge by merging their parts.
 *
 * `tone` is `'milestone'` (gold edge, a shine, a chime) or `'problem'` (red edge, a warning tone).
 * `merge` folds one banner's parts into another of its kind: two of one moment (a `groupKey`) or of
 * a `mergeShown` kind (null: a kind that never merges).
 * `mergeShown`: a kind that is a lasting condition rather than a moment, merged into the one
 * already up instead of stacking a copy (a full Bank refusing one item after another).
 * `pointsTo`: a kind whose click takes the player to its Token on the mat and pulses its outline
 * (from the World Map or the Guild Hall, back to the mat first), and which also shows on those two
 * screens (`BannerStack`'s `away`).
 * `kept`: a kind the save keeps while it is unclicked, shown again at the next start (`ui.banners`).
 * A save problem is not kept: it speaks of the run that raised it.
 * A Bank-full or stack-full banner carries its items' ids (`itemIds`) beside their names, so it can
 * go by itself once the Bank takes them (`routing.js`); the rest stay until clicked.
 */

import { t } from '../../i18n/index.js';
import { toRoman } from '../../utils/Formatters.js';

const romanOf = (n) => toRoman(Math.max(1, Math.floor(Number(n) || 1)));

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
            title: t(recipes.length > 1 ? 'bannerTitle.recipes' : 'bannerTitle.recipe'),
            line: `${nameList(heroes)} unlocked ${recipeList(recipes)}`
        }),
        merge: (a, b) => ({ heroes: union(a.heroes, b.heroes), recipes: union(a.recipes, b.recipes) })
    },
    hero: {
        tone: TONE.MILESTONE,
        text: ({ heroes = [] }) => ({
            title: t(heroes.length > 1 ? 'bannerTitle.heroes' : 'bannerTitle.hero'),
            line: `${nameList(heroes)} joined the guild`
        }),
        merge: (a, b) => ({ heroes: union(a.heroes, b.heroes) })
    },
    upgrade: {
        tone: TONE.MILESTONE,
        text: ({ upgrades = [], detail = null }) => ({
            title: t('bannerTitle.upgrade'),
            line: upgrades.length === 1 && detail ? `${upgrades[0]}: ${detail}` : `${nameList(upgrades)} upgraded`
        }),
        merge: (a, b) => ({ upgrades: union(a.upgrades, b.upgrades), detail: b.detail })
    },
    // A rank of Science mastery: `{ kind, rank, buff }`, the kind's name, the rank reached and its
    // buff's title. Two ranks of one kind at once are one banner, the higher rank.
    mastery: {
        tone: TONE.MILESTONE,
        text: ({ kind = '', rank = 1, buff = '' }) => ({
            title: t('bannerTitle.mastery'),
            line: buff ? t('science.rankUp', { kind, rank: romanOf(rank), buff }) : t('science.rankUpPlain', { kind, rank: romanOf(rank) })
        }),
        merge: (a, b) => ((b.rank || 0) >= (a.rank || 0) ? b : a)
    },
    settled: {
        tone: TONE.MILESTONE,
        text: ({ places = [] }) => ({
            title: t('bannerTitle.settled'),
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
                    title: t('bannerTitle.knockout'),
                    line: `${heroes[0]} was carried home, injured. ${lost.length ? `Lost: ${lost.join(', ')}.` : 'Nothing was lost.'}`
                };
            }
            const said = rows.filter(r => r.lost.length).map(r => `${r.hero} lost: ${r.lost.join(', ')}.`);
            return {
                title: t('bannerTitle.knockout'),
                line: `${nameList(heroes)} were defeated and carried home. ${said.length ? said.join(' ') : 'Nothing was lost.'}`
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
            title: t('bannerTitle.bankFull'),
            line: `${nameList(items)} ${items.length > 1 ? 'wait' : 'waits'} on the mat until the Bank has room`
        }),
        merge: (a, b) => ({ items: union(a.items, b.items), itemIds: union(a.itemIds, b.itemIds) })
    },
    // An item at the ceiling every stack shares (`DEFAULT_MAX_STACK`): the Bank may have free slots,
    // so "Bank full" would send the player to look for the wrong thing.
    stackFull: {
        tone: TONE.PROBLEM,
        mergeShown: true,
        text: ({ items = [] }) => ({
            title: t('bannerTitle.stackFull'),
            line: `${nameList(items)} ${items.length > 1 ? 'wait' : 'waits'} on the mat: the Bank holds no more of ${items.length > 1 ? 'them' : 'it'}`
        }),
        merge: (a, b) => ({ items: union(a.items, b.items), itemIds: union(a.itemIds, b.itemIds) })
    },
    // One event at a time is on the mat, so one banner each; it goes when its Token leaves.
    event: {
        tone: TONE.MILESTONE,
        pointsTo: true,
        text: ({ name = '', kind = null, lastsMs = 0, leavesMs = 0 }) => ({
            title: t('events.banner.title', { event: name }),
            line: kind === 'buff' && lastsMs > 0
                ? t('events.banner.buffLine', { time: spanText(lastsMs) })
                : kind === 'node' && leavesMs > 0 ? t('events.banner.nodeLine', { time: spanText(leavesMs) }) : ''
        }),
        merge: null
    },
    // Its Token is gone, so there is nothing to point to; the event's own goodbye, or a plain one.
    eventGone: {
        tone: TONE.MILESTONE,
        text: ({ name = '', word = '', goodbye = '' }) => ({
            title: t('events.gone.title', { word, event: name }),
            line: goodbye || t('events.gone.fallback', { event: name })
        }),
        merge: null
    },
    // Something new waits for room on the mat (`RoomWait`): each wait said once, folded into the
    // one on screen. `beside` names the waiting stations and spawners; `arrival` and `event` are
    // the waits with no Token to name.
    noRoom: {
        tone: TONE.PROBLEM,
        mergeShown: true,
        text: ({ beside = [], arrival = false, event = false }) => ({
            title: t('noRoom.banner.title'),
            line: [
                beside.length ? t('noRoom.banner.beside', { names: nameList(beside.map(name => t('noRoom.banner.token', { name }))) }) : null,
                arrival ? t('noRoom.banner.arrival') : null,
                event ? t('noRoom.banner.event') : null
            ].filter(Boolean).join(' ')
        }),
        merge: (a, b) => ({
            beside: union(a.beside, b.beside),
            arrival: !!(a.arrival || b.arrival),
            event: !!(a.event || b.event)
        })
    },
    // Each save problem is its own banner; only a repeat of the same one (its `groupKey`) folds in.
    save: {
        tone: TONE.PROBLEM,
        text: ({ title = t('bannerTitle.saveProblem'), message = '' }) => ({ title, line: message }),
        merge: null
    }
});

/** A span as the event banner's second line says it: whole hours as "1 h", otherwise minutes. */
function spanText(ms) {
    const minutes = Math.max(1, Math.round(ms / 60000));
    return minutes % 60 === 0 ? t('events.banner.hours', { n: minutes / 60 }) : t('events.banner.minutes', { n: minutes });
}

/** The title and line a kind writes from its parts. */
export function bannerText(kind, parts) {
    const def = BANNER_KINDS[kind];
    return def ? def.text(parts || {}) : { title: '', line: '' };
}

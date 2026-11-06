import { getItem } from '../../../config/registries/itemRegistry.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { CATCH_UP } from '../../../config/loopConstants.js';

const MINUTE = 60 * 1000;

/** A length of time away, in plain words: `45 min`, `3 h 12 min`, `30 h`. Rounded down to the minute. */
export function formatAway(ms) {
    const minutes = Math.floor(Math.max(0, Number(ms) || 0) / MINUTE);
    if (minutes < 1) return 'less than a minute';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
}

/** A readable name for an id nothing names (`enemy_wolf` → `Wolf`). */
function fallbackName(id) {
    const words = String(id || '').replace(/^(item|enemy|token)_/, '').split('_').filter(Boolean);
    return words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || String(id);
}

const itemName = (id) => getItem(id)?.name || fallbackName(id);
const tokenName = (id) => getTokenType(id)?.name || fallbackName(id);

/** `{ id: n }` → rows biggest first, then by name; zero and negative amounts are left out. */
function rows(amounts, nameOf, key) {
    return Object.entries(amounts || {})
        .filter(([, n]) => n > 0)
        .map(([id, n]) => ({ [key]: id, name: nameOf(id), count: n }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * What the Bank paid out, per item: the announced amounts, raised to the Bank's own loss
 * (`net`) where that is more, since two Bank paths announce no amounts.
 */
function bankSpent(counted, net) {
    const out = { ...(counted || {}) };
    for (const [id, diff] of Object.entries(net || {})) {
        if (-diff > (out[id] || 0)) out[id] = -diff;
    }
    return out;
}

/**
 * Every item that changed, once each: `{ itemId, name, net, gained, spent, onMat }`, from a
 * catch-up's `summary.items` (`CatchUp.js`).
 *
 * `net` is how much more (or less) of it the player has, the Bank and the mat together: the
 * Bank's own before/after difference (`items.net`) plus the loot lying on the mat's
 * (`items.floor`). Loot that lay on the mat before and was carried to the Bank while away
 * counts once: the Bank's gain and the mat's loss cancel.
 *
 * `gained` and `spent` are the hover's two halves, and always `gained − spent = net`: the
 * announced gains (less what only moved from the mat to the Bank) or what the totals say came
 * in, whichever is more; spent is the rest. `onMat` is how many more lie on the mat than before
 * (with auto-collect off, most of a long absence's production).
 *
 * Gains first, biggest first; then losses, biggest first; an item gained and spent evenly last.
 */
export function itemChanges(items = {}) {
    const net = items.net || {};
    const floor = items.floor || {};
    const counted = items.gained || {};
    const paid = bankSpent(items.spent, net);
    const ids = new Set([...Object.keys(net), ...Object.keys(floor), ...Object.keys(counted), ...Object.keys(paid)]);
    const out = [];
    for (const itemId of ids) {
        const total = (net[itemId] || 0) + (floor[itemId] || 0);
        const movedOff = Math.min(0, floor[itemId] || 0);
        const gained = Math.max(0, (counted[itemId] || 0) + movedOff, total + Math.max(0, paid[itemId] || 0));
        const spent = gained - total;
        if (!gained && !spent) continue;
        out.push({ itemId, name: itemName(itemId), net: total, gained, spent, onMat: Math.max(0, floor[itemId] || 0) });
    }
    const rank = (r) => (r.net > 0 ? 0 : r.net < 0 ? 1 : 2);
    return out.sort((a, b) => rank(a) - rank(b) || Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));
}

/**
 * The "While you were away" panel's content, from a catch-up's result (`CatchUp.run`), in two
 * columns. `items` is the left one (`itemChanges`). The right one is the news, in this order:
 * `knockouts`, `bankFull`, `recipes`, `finds`, `levelUps`, `depleted`, `kills`. Every list is
 * empty when there is nothing to say, so the panel can leave that section out; `hasNews` says
 * whether the right column has anything at all. The news the banners and stubs also get once it
 * closes (`summary.news`) are the knock-outs, `bankFull`, `recipes` and `finds`.
 */
export function summaryView(result) {
    const summary = result?.summary || {};
    const levelUps = new Map();
    for (const row of summary.levelUps || []) {
        if (!(row.to > row.from)) continue;
        if (!levelUps.has(row.heroId)) levelUps.set(row.heroId, { heroId: row.heroId, heroName: row.heroName, skills: [] });
        levelUps.get(row.heroId).skills.push({ skillId: row.skillId, skillName: row.skillName, from: row.from, to: row.to });
    }
    const news = summary.news || {};
    // The news hears what each knock-out cost; a catch-up without it still counts them.
    const knockouts = (news.knockouts?.length ? news.knockouts : summary.wounded || [])
        .filter(w => w.times > 0)
        .map(w => ({ heroId: w.heroId, heroName: w.heroName, times: w.times, lost: w.lost || [] }));
    const view = {
        awayText: formatAway(result?.awayMs),
        droppedText: result?.droppedMs >= MINUTE
            ? `${formatAway(result.droppedMs)} past the ${formatAway(CATCH_UP.CAP_MS)} limit was skipped.`
            : null,
        items: itemChanges(summary.items),
        /** Heroes knocked out: `{ heroId, heroName, times, lost }`, `lost` the gear it cost. */
        knockouts,
        /** Items a full Bank refused: they wait on the mat. */
        bankFull: (news.bankFull || []).map(itemId => ({ itemId, name: itemName(itemId) })),
        /** Recipes unlocked, one row each in the order unlocked: `{ key, heroId, heroName, recipeId, name, itemId }`. */
        recipes: (news.recipes || []).flatMap(row => (row.recipes || []).map(r => ({
            key: `${row.heroId}|${r.id}`, heroId: row.heroId, heroName: row.heroName, recipeId: r.id, name: r.name, itemId: r.itemId
        }))),
        /** Items found for the first time, in the order found, with how many came in. */
        finds: (news.finds || []).map(f => ({ itemId: f.itemId, name: itemName(f.itemId), count: f.count })),
        levelUps: [...levelUps.values()],
        depleted: rows(summary.depleted?.byType, tokenName, 'typeId'),
        /** The fights: each enemy beaten, with how many times. */
        kills: rows(summary.fightsWon?.byEnemy, tokenName, 'enemyId')
    };
    view.hasNews = ['knockouts', 'bankFull', 'recipes', 'finds', 'levelUps', 'depleted', 'kills'].some(k => view[k].length > 0);
    return view;
}

/** The loading bar's title: `Catching up on 3 h 12 min away`. */
export function catchUpTitle(awayMs) {
    return `Catching up on ${formatAway(awayMs)} away`;
}

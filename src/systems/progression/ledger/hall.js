// the progression ledger's view of the Guild Hall: every track (built-in and authored star), its ranks, and the neighbour gate

import { GUILD_UPGRADES, BUILT_IN_UPGRADE_IDS, HALL_NODE, getUpgradePrice } from '../../../config/guildUpgrades.js';
import { rankOf } from '../../../config/hallStars.js';
import { KEYWORD } from '../../effects/statements.js';
import { EFFECT_TYPES } from '../../effects/constants.js';

/**
 * One list for the profiles and the pace to read the Hall from: the built-in tracks (Bunk Beds,
 * Bank Tabs, the Wishing Well: the game's own) and the authored stars the rate book was built with
 * (`book.hall`, from the content's `hallSky`), each as
 *
 *     { id, name, builtIn, maxRank, links, price(rank), tier(rank), star }
 *
 * `price(r)` and `tier(r)` are rank r's own (r from 1); a built-in rank has no tier.
 *
 * ⚠️ The built-ins come from the live `GUILD_UPGRADES`, filtered to their ids: the game puts its
 * authored stars into that list as well, and the ledger must read the content it is handed, never
 * the sky the game happens to hold.
 *
 * Pure.
 */

/** The axes the rate calculator reads on a piece of work: a star whose rules move none adds no rate. */
export const RATE_AXES = Object.freeze(new Set([
    EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.YIELD, EFFECT_TYPES.XP_BONUS, EFFECT_TYPES.LOOT_MULT, EFFECT_TYPES.DOUBLE_DROP,
    EFFECT_TYPES.INPUT_COST, EFFECT_TYPES.FAIL_CHANCE, EFFECT_TYPES.GROW_TIME, EFFECT_TYPES.BONUS_DROP,
    EFFECT_TYPES.CROP_LOAD, EFFECT_TYPES.CATCH_WEIGHT
]));

/** Whether a star's rules move Passive Production's lap: a rate at the Guild Hall only, never on a hero's work. */
export function starMovesLap(star) {
    return starRulesOf(star).some(r => r.type === EFFECT_TYPES.PASSIVE_LAP);
}

/** Every Hall track, built-ins first. */
export function hallTracksOf(book) {
    const tracks = [];
    for (const u of GUILD_UPGRADES) {
        if (!BUILT_IN_UPGRADE_IDS.includes(u.id)) continue;
        tracks.push({
            id: u.id, name: u.name, builtIn: true, maxRank: u.maxRank, links: u.links || [],
            price: (r) => getUpgradePrice(u, r - 1) || [], tier: () => null, star: null, description: u.description
        });
    }
    for (const star of book.hall?.stars || []) {
        tracks.push({
            id: star.id, name: star.name, builtIn: false, maxRank: star.ranks.length, links: star.links,
            price: (r) => rankOf(star, r)?.price || [], tier: (r) => rankOf(star, r)?.tier ?? null, star, description: star.description
        });
    }
    return tracks;
}

/** The ranks of a built-in track a new guild has for free: the first ones whose price is nothing. An authored star has none. */
export function freeRanks(track) {
    if (!track?.builtIn) return 0;
    let rank = 0;
    while (rank < track.maxRank && track.price(rank + 1).length === 0) rank++;
    return rank;
}

/**
 * The Provides rules a star's ranks hold, each with its axis and whether it names some Tokens:
 * `{ rank, type, category, to, aimed }`. Only the kind `HallRules` carries (standing, with an axis).
 */
export function starRulesOf(star) {
    const out = [];
    star?.ranks?.forEach((rank, i) => {
        for (const s of rank.rules) {
            if (s?.keyword !== KEYWORD.PROVIDES || s.when?.event || !s.payload?.type) continue;
            const to = s.to && typeof s.to === 'object' ? s.to : null;
            const aimed = !!to && ((!!to.mode && to.mode !== 'all') || (Array.isArray(to.filters) && to.filters.length > 0));
            out.push({ rank: i + 1, type: s.payload.type, category: s.payload.category || null, to: aimed ? to : null, aimed });
        }
    });
    return out;
}

/** Whether a star's ranks add a rate the calculator reads: a rule on a work axis, a Passive Production line, or the lap. */
export function starAddsRate(star) {
    return star.ranks.some(r => r.lines.length > 0) || starMovesLap(star) || starRulesOf(star).some(r => RATE_AXES.has(r.type));
}

/** Each track's neighbours (a link counts from both ends), the Hall as `HALL_NODE`. */
export function hallGraph(tracks) {
    const ids = new Set(tracks.map(t => t.id));
    const out = new Map(tracks.map(t => [t.id, new Set()]));
    for (const t of tracks) {
        for (const to of t.links) {
            if (to === HALL_NODE) { out.get(t.id).add(HALL_NODE); continue; }
            if (!ids.has(to)) continue;
            out.get(t.id).add(to);
            out.get(to).add(t.id);
        }
    }
    return out;
}

/**
 * The cheapest way to open a track by the neighbour rule (a star opens once a linked star is lit, or
 * at once when linked to the Hall): the stars to light at rank 1 first, and what that costs.
 * `{ path: [], cost: 0 }` when it is open already; null when no way is affordable.
 *
 * @param {string} id  the track to open
 * @param {Map} graph  from {@link hallGraph}
 * @param {(id: string) => number} held  a track's rank now (free ranks included)
 * @param {(id: string) => number} lightCost  what lighting a track (its rank 1) costs; Infinity when it cannot be had
 */
export function openingPath(id, graph, held, lightCost) {
    const near = graph.get(id);
    if (!near) return null;
    const lit = (t) => held(t) >= 1;
    if (near.has(HALL_NODE) || [...near].some(n => n !== HALL_NODE && lit(n))) return { path: [], cost: 0 };
    // Dijkstra over the tracks: reaching one means it is lit, at the cost of every track lit on the way.
    const dist = new Map();
    const prev = new Map();
    const done = new Set();
    for (const t of graph.keys()) {
        if (t === id) continue;
        if (lit(t)) dist.set(t, 0);
        else if (graph.get(t).has(HALL_NODE) || [...graph.get(t)].some(n => n !== HALL_NODE && lit(n))) dist.set(t, lightCost(t));
    }
    for (;;) {
        let at = null;
        for (const [t, d] of dist) if (!done.has(t) && Number.isFinite(d) && (at === null || d < dist.get(at))) at = t;
        if (at === null) break;
        done.add(at);
        for (const n of graph.get(at)) {
            if (n === HALL_NODE || n === id || done.has(n) || lit(n)) continue;
            const d = dist.get(at) + lightCost(n);
            if (d < (dist.get(n) ?? Infinity)) { dist.set(n, d); prev.set(n, at); }
        }
    }
    let best = null;
    for (const n of near) {
        if (n === HALL_NODE) continue;
        const d = dist.get(n);
        if (Number.isFinite(d) && (best === null || d < dist.get(best))) best = n;
    }
    if (best === null) return null;
    const path = [];
    for (let at = best; at !== undefined; at = prev.get(at)) if (!lit(at)) path.unshift(at);
    return { path, cost: dist.get(best) };
}

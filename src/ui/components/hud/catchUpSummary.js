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
 * What the Bank took in (or paid out), per item. `gained` / `spent` count the announced changes;
 * two Bank paths announce no amounts, so where the Bank's own before/after difference (`net`) is
 * larger, it is the floor.
 */
function bankSide(counted, net, sign) {
    const out = { ...(counted || {}) };
    for (const [id, diff] of Object.entries(net || {})) {
        const n = sign * diff;
        if (n > (out[id] || 0)) out[id] = n;
    }
    return out;
}

/**
 * The "While you were away" panel's content, from a catch-up's result (`CatchUp.run`). Every
 * list is empty when there is nothing to say, so the panel can leave that section out. The fights
 * are one block (`combat`, owner 2026-10-25): fights won and lost, the enemies beaten, the heroes
 * knocked out, the food and elixirs used and what the kills dropped.
 */
export function summaryView(result) {
    const summary = result?.summary || {};
    const items = summary.items || {};
    const levelUps = new Map();
    for (const row of summary.levelUps || []) {
        if (!(row.to > row.from)) continue;
        if (!levelUps.has(row.heroId)) levelUps.set(row.heroId, { heroId: row.heroId, heroName: row.heroName, skills: [] });
        levelUps.get(row.heroId).skills.push({ skillId: row.skillId, skillName: row.skillName, from: row.from, to: row.to });
    }
    const fights = summary.fightsWon || {};
    const wounded = (summary.wounded || []).filter(w => w.times > 0);
    const used = summary.combat || {};
    const combat = {
        won: Number(fights.total) || 0,
        lost: wounded.reduce((n, w) => n + w.times, 0),
        beaten: rows(fights.byEnemy, tokenName, 'enemyId'),
        knockouts: wounded,
        // Meals first, then elixirs: what the fights cost.
        used: [...rows(used.food, itemName, 'itemId'), ...rows(used.elixirs, itemName, 'itemId')],
        drops: rows(used.drops, itemName, 'itemId')
    };
    combat.shown = combat.won > 0 || combat.lost > 0 || combat.used.length > 0 || combat.drops.length > 0;
    return {
        awayText: formatAway(result?.awayMs),
        droppedText: result?.droppedMs >= MINUTE
            ? `${formatAway(result.droppedMs)} past the ${formatAway(CATCH_UP.CAP_MS)} limit was skipped.`
            : null,
        gained: rows(bankSide(items.gained, items.net, 1), itemName, 'itemId'),
        waiting: rows(items.floor, itemName, 'itemId'),
        spent: rows(bankSide(items.spent, items.net, -1), itemName, 'itemId'),
        levelUps: [...levelUps.values()],
        depleted: rows(summary.depleted?.byType, tokenName, 'typeId'),
        wounded,
        fightsWon: combat.won,
        fights: combat.beaten,
        /** The fights block: won and lost, who was beaten and knocked out, what was used and dropped. */
        combat
    };
}

/** The loading bar's title: `Catching up on 3 h 12 min away`. */
export function catchUpTitle(awayMs) {
    return `Catching up on ${formatAway(awayMs)} away`;
}

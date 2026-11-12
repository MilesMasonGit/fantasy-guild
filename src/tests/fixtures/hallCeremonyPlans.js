// Test plans for the Guild Hall's upgrade ceremony: the ranks that leave the sky one purchase short
// of each moment, and the star to buy.

import { CONSTELLATIONS, GUILD_UPGRADES, getUpgradeDef, isUpgradeAccessible } from '../../config/guildUpgrades.js';
import { ceremonyFor, constellationStars } from '../../ui/components/board/hallCeremony.js';

const open = (id, ranks) => (ranks[id] || 0) < getUpgradeDef(id).maxRank && isUpgradeAccessible(id, ranks);

/**
 * Every rank at 0, and the open star whose first rank opens the most others (and finishes nothing).
 * @returns {{ok: true, ranks: object, id: string, name: string, opens: string[]} | {ok: false, error: string}}
 */
export function planStarThatOpens() {
    const ranks = {};
    let best = null;
    for (const def of GUILD_UPGRADES) {
        if (!open(def.id, ranks)) continue;
        const c = ceremonyFor(def.id, 1, ranks);
        if (!c || c.finished.length || !c.opened.length) continue;
        if (!best || c.opened.length > best.opened.length) best = c;
    }
    if (!best) return { ok: false, error: 'No open star opens another in this sky.' };
    return { ok: true, ranks, id: best.id, name: getUpgradeDef(best.id).name, opens: best.opened.map(id => getUpgradeDef(id).name) };
}

/**
 * The biggest constellation lit all but one star: every other star at rank 1, the rest of the sky
 * at 0, and the last star to buy.
 * @returns {{ok: true, ranks: object, constellation: string, id: string, name: string} | {ok: false, error: string}}
 */
export function planConstellationOneShort() {
    const options = CONSTELLATIONS
        .map(c => ({ c, stars: constellationStars(c.id) }))
        .filter(o => o.stars.length > 1)
        .sort((a, b) => b.stars.length - a.stars.length);
    for (const { c, stars } of options) {
        // The last star: one still open once the others are lit, furthest down the list.
        for (const last of [...stars].reverse()) {
            const ranks = Object.fromEntries(stars.filter(id => id !== last).map(id => [id, 1]));
            if (!open(last, ranks)) continue;
            const ceremony = ceremonyFor(last, 1, ranks);
            if (!ceremony?.finished.includes(c.id)) continue;
            return { ok: true, ranks, constellation: c.name, id: last, name: getUpgradeDef(last).name };
        }
    }
    return { ok: false, error: 'No constellation can be left one star short in this sky.' };
}


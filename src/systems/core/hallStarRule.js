// Guild Hall stars that cannot open, name what is gone, or carry a rule the guild cannot hold.

import { normaliseHallSky, normaliseStar } from '../../config/hallStars.js';
import { BUILT_IN_CONSTELLATIONS, BUILT_IN_UPGRADE_IDS, HALL_NODE } from '../../config/guildUpgrades.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { KEYWORD } from '../effects/statements.js';
import { hallRulesOf } from '../progression/hallModifiers.js';

/**
 * The rule behind the Guild Hall lines of the game's boot audit (`ContentAudit`). It only reports:
 * the game leaves a bad star or rule out (`guildUpgrades.setHallSky`, `hallModifiers.hallRulesOf`).
 *
 * Input: the sky as authored (`data/hallStars.json`: `{ constellations, stars }`), and the items
 * and Tokens keyed by id.
 *
 * Output: `[{ entityType: 'Hall star', entityId, entityName, field, message }]`, `message` a sentence
 * that does not repeat the star's name.
 */
export function hallStarFindings({ sky, items = {}, tokens = {} } = {}) {
    const out = [];
    const { constellations, stars } = normaliseHallSky(sky || {});
    const constellationIds = new Set([...BUILT_IN_CONSTELLATIONS.map(c => c.id), ...constellations.map(c => c.id)]);
    const starIds = new Set([...BUILT_IN_UPGRADE_IDS, ...stars.map(s => s.id)]);
    const push = (star, field, message) => out.push({ entityType: 'Hall star', entityId: star.id, entityName: star.name || star.id, field, message });

    for (const [key, raw] of Object.entries(sky?.stars || {})) {
        if (!normaliseStar(raw, key) && raw && typeof raw === 'object') {
            push({ id: raw.id || key, name: raw.name }, 'ranks', 'has no rank to buy, so it is left out of the sky.');
        }
    }

    for (const star of stars) {
        if (BUILT_IN_UPGRADE_IDS.includes(star.id)) {
            push(star, 'id', `takes the id of a built-in Guild Hall track ("${star.id}"), so it is left out of the sky. Give it its own id.`);
            continue;
        }
        if (!constellationIds.has(star.constellation)) {
            push(star, 'constellation', star.constellation
                ? `names the constellation "${star.constellation}", which does not exist, so it belongs to no picture.`
                : 'names no constellation, so it belongs to no picture.');
        }
        if (!star.links.length) push(star, 'links', 'is linked to nothing, so it never opens. Link it to the Hall ("hall") or another star.');
        for (const to of star.links) {
            if (to !== HALL_NODE && !starIds.has(to)) push(star, 'links', `is linked to "${to}", which is not a star, so that line is not drawn and does not open it.`);
        }
        star.ranks.forEach((rank, i) => {
            const r = i + 1;
            for (const p of rank.price) {
                if (!items[p.itemId]) push(star, 'ranks', `rank ${r} costs the item "${p.itemId}", which does not exist, so it can never be bought.`);
            }
            for (const line of rank.lines) {
                if (!items[line.itemId]) push(star, 'ranks', `rank ${r} pays the item "${line.itemId}", which does not exist.`);
            }
            if (!rank.rules.length && !rank.lines.length) push(star, 'ranks', `rank ${r} gives nothing: no rule and no Passive Production line.`);
            for (const statement of rank.rules) {
                const to = statement?.to;
                if (to?.mode === 'id' && to.value && !tokens[to.value]) {
                    push(star, 'ranks', `rank ${r} has a rule aimed at the Token "${to.value}", which does not exist, so it reaches nothing.`);
                }
                const entry = statement?.keyword === KEYWORD.PROVIDES ? getPaletteEntry(statement.payload?.type) : null;
                if (entry?.heroOnly) push(star, 'ranks', `rank ${r} has a ${entry.label} rule, which only reaches a hero from what they carry, so it does nothing from the Hall.`);
            }
            for (const skipped of hallRulesOf([star], { [star.id]: r }).ignored) {
                push(star, 'ranks', `rank ${r}'s rule ${skipped.index + 1} is left out: ${skipped.reason}. A star holds standing Provides rules only.`);
            }
        });
    }
    return out;
}

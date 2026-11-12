// Guild Hall stars that cannot open, name what is gone, or carry a rule the guild cannot hold.

import { normaliseHallSky, normaliseStar, opensRingOf } from '../../config/hallStars.js';
import { BUILT_IN_CONSTELLATIONS, BUILT_IN_UPGRADE_IDS, HALL_NODE } from '../../config/guildUpgrades.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { KEYWORD } from '../effects/statements.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { hallRulesOf, xpForEveryoneOf, RETIRED_AXIS } from '../progression/hallModifiers.js';
import { isCombatStyleScope } from '../../config/registries/modifierPalette.js';

/** A Provides rule's palette row when its axis is retired (Camp Reach), else null. */
function retiredEntryOf(statement) {
    const entry = statement?.keyword === KEYWORD.PROVIDES ? getPaletteEntry(statement.payload?.type) : null;
    return entry?.retired ? entry : null;
}

/** Why a retired axis went, in words. */
function retiredWhy(entry) {
    return entry.type === EFFECT_TYPES.CAMP_REACH ? 'every camp works the one standard reach' : 'nothing reads it';
}

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
        // A star whose every rule is on a retired axis gives nothing at all: one line, to delete it.
        const rules = star.ranks.flatMap(rank => rank.rules);
        const retiredOnly = rules.length > 0 && star.ranks.every(rank => !rank.lines.length) && rules.every(retiredEntryOf);
        if (retiredOnly) {
            const entry = retiredEntryOf(rules[0]);
            push(star, 'ranks', `carries only ${entry.label} rules, retired: ${retiredWhy(entry)}, so the star gives nothing. Delete the star in the CMS.`);
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
            // A ring star's first rank opens its ring of the world map: that is what it gives.
            const opensRing = r === 1 && opensRingOf(star.opensRing) !== null;
            if (!rank.rules.length && !rank.lines.length && !opensRing) push(star, 'ranks', `rank ${r} gives nothing: no rule and no Passive Production line.`);
            for (const statement of rank.rules) {
                const to = statement?.to;
                if (to?.mode === 'id' && to.value && !tokens[to.value]) {
                    push(star, 'ranks', `rank ${r} has a rule aimed at the Token "${to.value}", which does not exist, so it reaches nothing.`);
                }
                const entry = statement?.keyword === KEYWORD.PROVIDES ? getPaletteEntry(statement.payload?.type) : null;
                // Damage, Swing Time and Accuracy are read from the guild too, for the style a hero fights in.
                if (entry?.heroOnly && entry.categories !== 'combatStyle') push(star, 'ranks', `rank ${r} has a ${entry.label} rule, which only reaches a hero from what they carry, so it does nothing from the Hall.`);
                if (entry?.categories === 'combatStyle' && !isCombatStyleScope(statement.payload?.category)) {
                    push(star, 'ranks', `rank ${r} has a ${entry.label} rule narrowed to "${statement.payload.category}", which is no combat style, so it helps no fighter. Pick Melee, Ranged, Magic or Stealth, or no style, in the CMS.`);
                }
                if (entry?.retired && !retiredOnly) push(star, 'ranks', `rank ${r} has a ${entry.label} rule, retired: ${retiredWhy(entry)}, so the rule does nothing. Delete the rule in the CMS.`);
            }
            for (const skipped of hallRulesOf([star], { [star.id]: r }).ignored) {
                if (skipped.reason === RETIRED_AXIS) continue;
                push(star, 'ranks', `rank ${r}'s rule ${skipped.index + 1} is left out: ${skipped.reason}. A star holds standing Provides rules only.`);
            }
        });
        auditXpForEveryone(star, push);
    }
    return out;
}

/**
 * XP for Everyone gives, at a purchase, what the rank lists beyond the rank before: a rank written as
 * "100 a rank" rather than as the whole so far gives nothing from its second rank on.
 */
function auditXpForEveryone(star, push) {
    const gives = (rank) => rank.rules.some(s => s?.keyword === KEYWORD.PROVIDES && s.payload?.type === EFFECT_TYPES.XP_FOR_EVERYONE);
    if (!star.ranks.some(gives)) return;
    const WHOLE = 'A rank lists the star\'s whole gift so far (rank 3 of 100 a rank lists 300).';
    let before = 0;
    star.ranks.forEach((rank, i) => {
        const r = i + 1;
        const listed = xpForEveryoneOf([star], { [star.id]: r });
        if (listed <= before && (gives(rank) || before > 0)) {
            push(star, 'ranks', r === 1
                ? `rank 1 gives no XP for Everyone: it lists ${listed} XP.`
                : `rank ${r} gives no XP for Everyone at its purchase: it lists ${listed} XP, no more than rank ${r - 1} does. ${WHOLE}`);
        }
        before = Math.max(before, listed);
    });
}

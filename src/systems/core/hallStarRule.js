// Guild Hall stars that cannot open, name what is gone, or carry a rule the guild cannot hold.

import { normaliseHallSky, normaliseStar, opensRingOf } from '../../config/hallStars.js';
import {
    FALLBACK_CONSTELLATION_IDS, FALLBACK_STAR_IDS, FALLBACK_SKY, HALL_NODE, RANKS_BY_ID, ROSTER_STAR, BANK_TABS_STAR
} from '../../config/guildUpgrades.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { coinAmountProblem } from '../../config/registries/coinCosts.js';
import { KEYWORD } from '../effects/statements.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { hallRulesOf, xpForEveryoneOf, RETIRED_AXIS, NEVER_ON_GUILD, CARRIED_ONLY_AXIS } from '../progression/hallModifiers.js';
import { isCombatStyleScope, isDoseKindScope } from '../../config/registries/modifierPalette.js';
import { isCapFixed, getCategoryInfo } from '../../config/registries/equipmentCategories.js';

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
    // The game stands in for Bunk Beds, Bank Tabs, the Wishing Well and their constellations when the
    // sky lacks them, so a link or a constellation naming one is good either way.
    const constellationIds = new Set([...FALLBACK_CONSTELLATION_IDS, ...constellations.map(c => c.id)]);
    const starIds = new Set([...FALLBACK_STAR_IDS, ...stars.map(s => s.id)]);
    const push = (star, field, message) => out.push({ entityType: 'Hall star', entityId: star.id, entityName: star.name || star.id, field, message });

    for (const [key, raw] of Object.entries(sky?.stars || {})) {
        if (!normaliseStar(raw, key) && raw && typeof raw === 'object') {
            push({ id: raw.id || key, name: raw.name }, 'ranks', 'has no rank to buy, so it is left out of the sky.');
        }
        // A rank's coins are dropped to 0 by the normaliser, so they are read here as written.
        (Array.isArray(raw?.ranks) ? raw.ranks : []).forEach((rank, i) => {
            const problem = coinAmountProblem(rank?.coins, `rank ${i + 1}'s coins`);
            if (problem) push({ id: raw.id || key, name: raw.name }, 'ranks', `${problem.replace(/^its /, '')}.`);
        });
    }

    for (const star of stars) {
        const byId = RANKS_BY_ID[star.id];
        if (byId !== undefined && star.ranks.length !== byId) {
            const n = star.ranks.length;
            const past = n > byId ? `, so its ranks past ${byId} give nothing` : '';
            push(star, 'ranks', `has ${n} ${n === 1 ? 'rank' : 'ranks'}, but every rank ${BY_ID[star.id].gives} and ${byId} ranks reach ${BY_ID[star.id].cap}${past}. Give it ${byId} ranks in the CMS.`);
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
            // A ring star's first rank opens its ring of the world map, and a Bunk Beds or Bank Tabs
            // rank gives a hero or a tab by id: that is what they give.
            const opensRing = r === 1 && opensRingOf(star.opensRing) !== null;
            if (!rank.rules.length && !rank.lines.length && !opensRing && byId === undefined) push(star, 'ranks', `rank ${r} gives nothing: no rule and no Passive Production line.`);
            for (const statement of rank.rules) {
                const to = statement?.to;
                if (to?.mode === 'id' && to.value && !tokens[to.value]) {
                    push(star, 'ranks', `rank ${r} has a rule aimed at the Token "${to.value}", which does not exist, so it reaches nothing.`);
                }
                const entry = statement?.keyword === KEYWORD.PROVIDES ? getPaletteEntry(statement.payload?.type) : null;
                if (entry?.neverOnGuild) push(star, 'ranks', `rank ${r} has a ${entry.label} rule, which a star cannot carry: ${entry.guildWhy}, so the rule is left out. Delete the rule in the CMS.`);
                else if (entry?.heroOnly && !entry.fromGuild && !entry.retired) push(star, 'ranks', `rank ${r} has a ${entry.label} rule, which only reaches a hero from what they carry, so it does nothing from the Hall.`);
                if (entry?.categories === 'combatStyle' && !isCombatStyleScope(statement.payload?.category)) {
                    push(star, 'ranks', `rank ${r} has a ${entry.label} rule narrowed to "${statement.payload.category}", which is no combat style, so it helps no fighter. Pick Melee, Ranged, Magic or Stealth, or no style, in the CMS.`);
                }
                if (entry?.categories === 'doseKind' && !isDoseKindScope(statement.payload?.category)) {
                    push(star, 'ranks', `rank ${r} has a ${entry.label} rule narrowed to "${statement.payload.category}", which is no kind of dose, so it reaches nothing. Pick Drink, Potion or Fight elixir, or no kind, in the CMS.`);
                }
                if (entry?.type === EFFECT_TYPES.LOADOUT_SLOTS && isCapFixed(statement.payload?.category)) {
                    push(star, 'ranks', `rank ${r} has a ${entry.label} rule for ${getCategoryInfo(statement.payload.category).label}, which a star never raises: a hero carries one drink, potion or elixir at a time, so the rule does nothing. Pick another kind in the CMS.`);
                }
                if (entry?.retired && !retiredOnly) push(star, 'ranks', `rank ${r} has a ${entry.label} rule, retired: ${retiredWhy(entry)}, so the rule does nothing. Delete the rule in the CMS.`);
            }
            for (const skipped of hallRulesOf([star], { [star.id]: r }).ignored) {
                if ([RETIRED_AXIS, NEVER_ON_GUILD, CARRIED_ONLY_AXIS].includes(skipped.reason)) continue;
                push(star, 'ranks', `rank ${r}'s rule ${skipped.index + 1} is left out: ${skipped.reason}. A star holds standing Provides rules only.`);
            }
        });
        auditXpForEveryone(star, push);
    }
    return out;
}

/** What every rank of a star known by id gives, and the cap its ranks reach, in words. */
const BY_ID = {
    [ROSTER_STAR]: { gives: 'makes room for one more hero', cap: 'the most heroes a guild can have' },
    [BANK_TABS_STAR]: { gives: 'opens one more Bank tab', cap: 'the most Bank tabs' }
};

/**
 * ⚠️ While the fallback stands: a warning for each of Bunk Beds, Bank Tabs, the Wishing Well and
 * their constellations the sky as authored lacks, which the game stands in for with its built-in
 * placeholder (`guildUpgrades.FALLBACK_SKY`). `severity: 'warning'`: the game plays as it did before
 * the three were authored. Output as {@link hallStarFindings}'s, `entityType` 'Hall constellation'
 * for a constellation.
 */
export function hallFallbackFindings({ sky } = {}) {
    const { constellations, stars } = normaliseHallSky(sky || {});
    const haveS = new Set(stars.map(s => s.id));
    const haveC = new Set(constellations.map(c => c.id));
    const out = [];
    for (const [id, star] of Object.entries(FALLBACK_SKY.stars)) {
        if (haveS.has(id)) continue;
        out.push({
            entityType: 'Hall star', entityId: id, entityName: star.name, field: 'id', severity: 'warning',
            message: 'is not an authored star yet, so the game uses its built-in stand-in (placeholder prices in Oak Wood). A change pack from the content agent brings it.'
        });
    }
    for (const [id, constellation] of Object.entries(FALLBACK_SKY.constellations)) {
        if (haveC.has(id)) continue;
        out.push({
            entityType: 'Hall constellation', entityId: id, entityName: constellation.name, field: 'id', severity: 'warning',
            message: 'is not an authored constellation yet, so the game uses its built-in stand-in. A change pack from the content agent brings it.'
        });
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

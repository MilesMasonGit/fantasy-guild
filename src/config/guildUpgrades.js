// Fantasy Guild — Guild Hall upgrade definitions & the upgrade web.
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (the progression ledger). Keep it pure:
// the authored stars are handed in by `hallStarRegistry.js` ({@link setHallSky}), never loaded here.

import { normaliseHallSky, rankOf } from './hallStars.js';

/**
 * Heroes a guild starts with, before any Roster Size rank is bought.
 *
 * Lives here rather than only in `StateSchema`'s `rosterLimit` default because
 * the upgrade track's top rank must agree with it: ROSTER_BASE +
 * `roster_size`.maxRank must equal {@link ROSTER_MAX}.
 */
export const ROSTER_BASE = 0;

/** The most heroes a guild can have. A save already holding more keeps them all but cannot recruit. */
export const ROSTER_MAX = 8;

/**
 * The roster cap for a given `roster_size` rank. `GuildUpgradeManager.recompute` and
 * `HeroLifecycle.getRosterLimit` both call this so they cannot disagree about ROSTER_BASE.
 */
export function rosterLimitForRank(rank) {
    // Clamped: a save with ranks above ROSTER_MAX still caps at ROSTER_MAX.
    return Math.min(ROSTER_MAX, ROSTER_BASE + (rank || 0));
}

/** Item kinds one Bank tab holds. */
export const BANK_TAB_SLOTS = 64;

/** The most Bank tabs: the first, plus one per Bank Tabs rank. */
export const BANK_TAB_CAP = 16;

/** The Bank's tabs at a tab count, as the Bank Tabs star reads them. */
function bankTabsLabel(tabs) {
    return `${tabs} ${tabs === 1 ? 'tab' : 'tabs'}`;
}

/**
 * The art each upgrade track draws on the Guild Hall screen.
 *
 * ⚠️ Token art lives in per-family folders under `public/assets/tokens/`; `UpgradeSprites.test.js` checks each file exists.
 */
export const UPGRADE_SPRITES = {
    roster_size: '/assets/tokens/upgrade/t_bunk_bed.png',
    bank_tabs: '/assets/tokens/chest/t_chest_addy.png',
    guild_hall: '/assets/tokens/upgrade/t_guildhall.png',
    wishing_well: '/assets/tokens/upgrade/t_well_wishing.png',
    // An authored star with no sprite of its own: the owner's gold star stands in.
    star: '/assets/playmat/screens/ui_star_gold.png'
};

/**
 * The upgrades are a web around the Hall (`HALL_NODE`), addressed by id.
 * Each upgrade carries:
 *   `node`  — `{ x, y }` in a unit space centred on the Hall (0, 0); +x is
 *             right, +y is down. The first ring sits about 0.5 out. The screen
 *             turns these into pixels (`GuildHallBoard`).
 *   `tag`   — where its name and rank sit beside its star: 'below' (when left out),
 *             'above', 'left' or 'right', so neighbouring tags do not overlap.
 *   `links` — ids of the nodes it is joined to, or `HALL_NODE` for the Hall.
 *             A link is a line, so it counts from both ends (see
 *             {@link getUpgradeLinks}); each is written once, on the outer node.
 */
export const HALL_NODE = 'hall';

/**
 * Guild Hall upgrades are paid in items, never gold.
 *
 * Each upgrade carries `prices`: one entry per rank, where `prices[n - 1]` is
 * what rank n costs, as a list of `{ itemId, quantity }`. An empty list is
 * free. The built-in tracks use the same placeholder (rank n costs 10·n Oak Wood); an authored
 * star carries a price per rank (`hallStars.js`).
 */
export const PLACEHOLDER_PRICE_ITEM = 'item_oak_wood';
export const PLACEHOLDER_PRICE_PER_RANK = 10;

/**
 * Build a placeholder price list: rank n costs `perRank·n` of `itemId`.
 * `freeFirstRank` makes rank 1 cost nothing — used by Bunk Beds (a new game
 * holds rank 1 already, for the hero made on the new-game screen) and the
 * Wishing Well.
 */
export function placeholderPrices(maxRank, {
    itemId = PLACEHOLDER_PRICE_ITEM,
    perRank = PLACEHOLDER_PRICE_PER_RANK,
    freeFirstRank = false
} = {}) {
    return Array.from({ length: maxRank }, (_, i) => {
        const rank = i + 1;
        if (freeFirstRank && rank === 1) return [];
        return [{ itemId, quantity: perRank * rank }];
    });
}

/** What the Wishing Well adds to the Guild Hall's Passive Production: 10 Water per rank, per lap. */
export const WISHING_WELL_ITEM = 'item_water';
export const WISHING_WELL_WATER_PER_RANK = 10;

/** Water the Wishing Well pays each Passive Production lap at a rank (0 below rank 1). */
export function wishingWellWater(rank) {
    const r = Math.floor(Number(rank) || 0);
    return r > 0 ? WISHING_WELL_WATER_PER_RANK * r : 0;
}

/** The Wishing Well's rank in a ranks map, honouring its old id. */
export function wishingWellRank(ranks) {
    return rankIn(ranks, 'wishing_well');
}

/**
 * The sky's constellations: each upgrade names one in `constellation`. `label` is where the
 * name sits, in the same unit space as a node's `node`. A constellation is finished when every
 * star in it is lit (rank 1 or more).
 *
 * The three built in come first; the authored ones (a constellation per skill) follow, put in by
 * {@link setHallSky}. ⚠️ A live list: readers keep the array, so it is changed in place.
 */
export const BUILT_IN_CONSTELLATIONS = Object.freeze([
    Object.freeze({ id: 'hearth', name: 'The Hearth', label: Object.freeze({ x: 0, y: -0.8 }) }),
    Object.freeze({ id: 'vault', name: 'The Vault', label: Object.freeze({ x: -0.72, y: 0.3 }) }),
    Object.freeze({ id: 'well', name: 'The Well', label: Object.freeze({ x: 0, y: 0.8 }) })
]);
export const CONSTELLATIONS = [...BUILT_IN_CONSTELLATIONS];

/**
 * Every upgrade track: the three built in, whose effects are the game's own (a hero recruited, a
 * Bank tab, the Wishing Well's Water), then the authored stars ({@link setHallSky}), whose ranks
 * carry rules and Passive Production lines (`hallStars.js`).
 * ⚠️ A live list, changed in place, like {@link CONSTELLATIONS}.
 */
export const GUILD_UPGRADES = [
    {
        id: 'bank_tabs',
        constellation: 'vault',
        name: 'Bank Tabs',
        description: `Unlock another Bank tab: ${BANK_TAB_SLOTS} more kinds of items in storage.`,
        node: { x: -0.5, y: 0 },
        links: [HALL_NODE],
        maxRank: BANK_TAB_CAP - 1,
        prices: placeholderPrices(BANK_TAB_CAP - 1),
        statLabel: rank => bankTabsLabel(1 + rank),
        nextStatLabel: rank => bankTabsLabel(2 + rank),
        sprite: UPGRADE_SPRITES.bank_tabs
    },
    {
        id: 'roster_size',
        constellation: 'hearth',
        name: 'Bunk Beds',
        description: 'Expand guild sleeping quarters to recruit new heroes and increase roster capacity.',
        node: { x: 0, y: -0.5 },
        links: [HALL_NODE],
        // One hero per rank, 0 to ROSTER_MAX.
        maxRank: ROSTER_MAX - ROSTER_BASE,
        prices: placeholderPrices(ROSTER_MAX - ROSTER_BASE, { freeFirstRank: true }),
        statLabel: rank => rank === 1 ? '1 hero' : `${rank} heroes`,
        nextStatLabel: rank => `${rank + 1} heroes`,
        sprite: UPGRADE_SPRITES.roster_size
    },
    {
        id: 'wishing_well',
        constellation: 'well',
        name: 'Wishing Well',
        description: 'The Guild Hall draws fresh Water as Passive Production every 5 minutes. No hero needed.',
        node: { x: 0, y: 0.5 },
        links: [HALL_NODE],
        maxRank: 10,
        prices: placeholderPrices(10, { freeFirstRank: true }),
        statLabel: rank => rank === 0 ? 'No water generated' : `${wishingWellWater(rank)} Water / 5 min`,
        nextStatLabel: rank => `${wishingWellWater(rank + 1)} Water / 5 min`,
        sprite: UPGRADE_SPRITES.wishing_well
    }
];

/** The built-in track ids: an authored star may not take one. */
export const BUILT_IN_UPGRADE_IDS = Object.freeze(GUILD_UPGRADES.map(u => u.id));

/**
 * An authored star as an upgrade track: what the sky, the details panel and the purchase read.
 * `authored: true` and `star` (its normalised record) set it apart from a built-in track; its
 * labels come from `describeRank(star, rank)`, which the game hands in (this module cannot name
 * items), or say the rank alone.
 */
export function upgradeDefOfStar(star, describeRank = null) {
    const label = (rank) => {
        const r = Math.floor(Number(rank) || 0);
        if (r <= 0) return 'Not yet bought';
        return (describeRank && describeRank(star, r)) || `Rank ${r}`;
    };
    return {
        id: star.id,
        constellation: star.constellation,
        name: star.name,
        description: star.description,
        node: star.node,
        tag: star.tag,
        links: star.links,
        maxRank: star.ranks.length,
        prices: star.ranks.map(r => r.price),
        statLabel: label,
        nextStatLabel: rank => label(rank + 1),
        sprite: star.sprite || UPGRADE_SPRITES.star,
        authored: true,
        star
    };
}

/** The authored stars and constellations last put in by {@link setHallSky}, so a later call replaces exactly them. */
let authoredStarDefs = [];
let authoredConstellations = [];
/** Their normalised records, kept as one list: Passive Production reads it every tick. */
let authoredStarList = Object.freeze([]);
/** Moves on every {@link setHallSky}, so a screen drawing the sky knows to draw it again. */
let skyChanges = 0;

/** How many times the authored sky has been put in. */
export function skyVersion() {
    return skyChanges;
}

/**
 * Put the authored sky in: `sky` is `data/hallStars.json` (or a fixture) in the file's shape, or
 * already normalised. Replaces whatever the last call put in; anything else in the live lists (a
 * test's own track) stays. A star or constellation taking a built-in id is left out.
 *
 * @param {object|null} sky
 * @param {{ describeRank?: (star: object, rank: number) => string }} [options]
 * @returns {{ constellations: object[], stars: object[] }} what went in
 */
export function setHallSky(sky, { describeRank = null } = {}) {
    for (const def of authoredStarDefs) {
        const i = GUILD_UPGRADES.indexOf(def);
        if (i !== -1) GUILD_UPGRADES.splice(i, 1);
    }
    for (const c of authoredConstellations) {
        const i = CONSTELLATIONS.indexOf(c);
        if (i !== -1) CONSTELLATIONS.splice(i, 1);
    }
    const { constellations, stars } = normaliseHallSky(sky || {});
    const builtInC = new Set(BUILT_IN_CONSTELLATIONS.map(c => c.id));
    const builtInS = new Set(BUILT_IN_UPGRADE_IDS);
    authoredConstellations = constellations.filter(c => !builtInC.has(c.id) && !CONSTELLATIONS.some(o => o.id === c.id));
    authoredStarDefs = stars
        .filter(s => !builtInS.has(s.id) && !GUILD_UPGRADES.some(o => o.id === s.id))
        .map(s => upgradeDefOfStar(s, describeRank));
    CONSTELLATIONS.push(...authoredConstellations);
    GUILD_UPGRADES.push(...authoredStarDefs);
    authoredStarList = Object.freeze(authoredStarDefs.map(d => d.star));
    skyChanges += 1;
    return { constellations: [...authoredConstellations], stars: [...authoredStarList] };
}

/** The authored stars in the sky now, as their normalised records (one frozen list until the sky changes). */
export function authoredStars() {
    return authoredStarList;
}

/**
 * What an authored star gives at a rank: its rank record's `rules` and `lines` (`hallStars.js`),
 * or null for a built-in track or a rank of 0.
 */
export function rankEffectOf(def, rank) {
    if (!def?.authored) return null;
    return rankOf(def.star, rank);
}

/** Look up an upgrade definition by id. */
export function getUpgradeDef(id) {
    const key = id === 'guildmasters_banner' ? 'wishing_well' : id;
    return GUILD_UPGRADES.find(u => u.id === key) || null;
}

/**
 * Item price of the NEXT rank (`rank` = ranks already owned), as a fresh list
 * of `{ itemId, quantity }`. `[]` means free; `null` means there is no next
 * rank (maxed, or no such upgrade).
 */
export function getUpgradePrice(def, rank) {
    if (!def || rank >= def.maxRank) return null;
    const price = def.prices?.[rank] || [];
    return price.map(p => ({ itemId: p.itemId, quantity: p.quantity }));
}

/**
 * Merge a price list so each item appears once (a price that named the same
 * item twice must be checked against the combined amount).
 */
export function totalPrice(price) {
    const totals = new Map();
    for (const p of price || []) {
        if (!p?.itemId || !(p.quantity > 0)) continue;
        totals.set(p.itemId, (totals.get(p.itemId) || 0) + p.quantity);
    }
    return [...totals].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** A rank from a ranks map, honouring the Wishing Well's old id. */
function rankIn(ranks, id) {
    if (id === 'wishing_well') return ranks?.wishing_well ?? ranks?.guildmasters_banner ?? 0;
    return ranks?.[id] || 0;
}

/**
 * Every node joined to an upgrade by a line: the ones it names in `links`,
 * plus every upgrade that names it (a line counts from both ends). May
 * include {@link HALL_NODE}.
 */
export function getUpgradeLinks(upgradeId) {
    const def = getUpgradeDef(upgradeId);
    if (!def) return [];
    const out = new Set((def.links || []).filter(to => to === HALL_NODE || getUpgradeDef(to)));
    for (const other of GUILD_UPGRADES) {
        if (other.id !== def.id && (other.links || []).includes(def.id)) out.add(other.id);
    }
    return [...out];
}

/**
 * Every line of the web, once each, as `{ from, to }` — `from` is the upgrade
 * that names the link in its `links`, `to` the node it names (an upgrade id or
 * {@link HALL_NODE}). A pair named from both ends is drawn once.
 */
export function getUpgradeWebLinks() {
    const seen = new Set();
    const out = [];
    for (const def of GUILD_UPGRADES) {
        for (const to of def.links || []) {
            // A link naming no star (an authored star's typo) draws nothing.
            if (to !== HALL_NODE && !getUpgradeDef(to)) continue;
            const key = [def.id, to].sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ from: def.id, to });
        }
    }
    return out;
}

/**
 * The kinds of lock an upgrade can carry. The kind rides alongside the text because the UI shows some kinds and stays quiet about others.
 */
export const LOCK_KIND = {
    /** No linked node bought yet — the web already shows this. */
    LINK: 'link',
    /**
     * A gate an upgrade sets itself through `gate(ranks)` — meant for skill
     * requirements. No upgrade sets one yet; the inspection panel spells these
     * out, where it stays silent about LINK.
     */
    SKILL: 'skill'
};

/**
 * Why an upgrade cannot be bought yet, as `{ kind, text }`, or null when it
 * can be (rank and price aside).
 *
 * Its own `gate(ranks)` is asked first — an upgrade may refuse however its
 * links stand. Then the web rule: it opens once **any** node linked to
 * it has rank ≥ 1, or straight away when it is linked to the Hall.
 */
export function getLockDetail(upgradeId, ranks = {}) {
    const def = getUpgradeDef(upgradeId);
    if (!def) return { kind: LOCK_KIND.LINK, text: 'Unknown upgrade' };
    const gated = typeof def.gate === 'function' ? def.gate(ranks) : null;
    if (gated) return gated;

    const links = getUpgradeLinks(def.id);
    if (links.includes(HALL_NODE)) return null;
    if (links.some(id => rankIn(ranks, id) >= 1)) return null;

    const names = links.map(id => getUpgradeDef(id)?.name).filter(Boolean);
    if (names.length > 0) {
        return {
            kind: LOCK_KIND.LINK,
            text: `Requires a linked upgrade (${names.join(' or ')}) at Rank I+`
        };
    }
    return { kind: LOCK_KIND.LINK, text: 'Path to this upgrade is locked' };
}

/** True when an upgrade may be bought, rank and price aside. */
export function isUpgradeAccessible(upgradeId, ranks = {}) {
    return getLockDetail(upgradeId, ranks) === null;
}

/** Why an upgrade is locked, as plain text, or null when it is not. */
export function getLockReason(upgradeId, ranks = {}) {
    const detail = getLockDetail(upgradeId, ranks);
    return detail ? detail.text : null;
}

/** Convert number to Roman numerals (e.g. 1 -> 'I', 4 -> 'IV', 10 -> 'X'). */
export function toRoman(num) {
    if (!num || num <= 0) return '0';
    const lookup = [
        { val: 10, sym: 'X' },
        { val: 9, sym: 'IX' },
        { val: 5, sym: 'V' },
        { val: 4, sym: 'IV' },
        { val: 1, sym: 'I' }
    ];
    let roman = '';
    let n = num;
    for (const { val, sym } of lookup) {
        while (n >= val) {
            roman += sym;
            n -= val;
        }
    }
    return roman;
}

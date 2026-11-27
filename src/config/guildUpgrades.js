// Guild Hall upgrade definitions & the upgrade web.
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (the progression ledger). Keep it pure:
// the authored stars are handed in by `hallStarRegistry.js` ({@link setHallSky}), never loaded here.

import { normaliseHallSky, rankOf } from './hallStars.js';

/**
 * Heroes a guild starts with, before any Bunk Beds rank is bought.
 *
 * Lives here rather than only in `StateSchema`'s `rosterLimit` default because
 * the Bunk Beds star's top rank must agree with it: ROSTER_BASE + its rank count must equal
 * {@link ROSTER_MAX} (the boot audit checks, {@link RANKS_BY_ID}).
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

/**
 * The two stars whose effect the game knows by id, whatever else their ranks carry: every Bunk Beds
 * rank makes room for a hero ({@link rosterLimitForRank}), every Bank Tabs rank opens a Bank tab.
 * Everything else about them (place, links, prices, words) is authored like any star.
 */
export const ROSTER_STAR = 'roster_size';
export const BANK_TABS_STAR = 'bank_tabs';

/**
 * The Wishing Well: an ordinary star whose ranks pay Water as Passive Production lines. Its id stays
 * known for Limes's lesson and the progression ledger's reach (`ledger/engine.js`).
 */
export const WISHING_WELL_STAR = 'wishing_well';

/** The rank count a Bunk Beds or Bank Tabs star needs to reach the roster or the tab cap. */
export const RANKS_BY_ID = Object.freeze({
    [ROSTER_STAR]: ROSTER_MAX - ROSTER_BASE,
    [BANK_TABS_STAR]: BANK_TAB_CAP - 1
});

/** The Bank a new guild starts with, and what a save that never wrote one gets: one tab. */
export const BANK_STARTING_SLOTS = BANK_TAB_SLOTS;

/** The Bank's tabs at a tab count, as the Bank Tabs star reads them. */
function bankTabsLabel(tabs) {
    return `${tabs} ${tabs === 1 ? 'tab' : 'tabs'}`;
}

/**
 * What a Bunk Beds or Bank Tabs rank gives by id, in words ("3 heroes", "2 tabs"), or null for any
 * other star. Bank Tabs says its one tab at rank 0 too.
 */
export function rankEffectLabel(id, rank) {
    const r = Math.max(0, Math.floor(Number(rank) || 0));
    if (id === BANK_TABS_STAR) return bankTabsLabel(Math.min(BANK_TAB_CAP, 1 + r));
    if (id === ROSTER_STAR && r >= 1) {
        const heroes = rosterLimitForRank(r);
        return heroes === 1 ? '1 hero' : `${heroes} heroes`;
    }
    return null;
}

/**
 * Sprites the Guild Hall screen falls back on.
 *
 * ⚠️ Token art lives in per-family folders under `public/assets/tokens/`; `UpgradeSprites.test.js` checks each file exists.
 */
export const UPGRADE_SPRITES = {
    guild_hall: '/assets/tokens/upgrade/t_guildhall.png',
    // A star with no sprite of its own: the owner's gold star stands in.
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
 * free. A star carries a price per rank (`hallStars.js`).
 */

/** The three stars the game knows by id: the sky must hold each, and the boot audit refuses one that is missing. */
export const REQUIRED_STAR_IDS = Object.freeze([BANK_TABS_STAR, ROSTER_STAR, WISHING_WELL_STAR]);

/**
 * A star as an upgrade track: what the sky, the details panel and the purchase read. `star` is its
 * normalised record; `authored: true` marks one from the data. Its labels
 * say what a Bunk Beds or Bank Tabs rank gives by id ({@link rankEffectLabel}), then
 * `describeRank(star, rank)`, which the game hands in (this module cannot name items), or the rank
 * alone.
 */
export function upgradeDefOfStar(star, describeRank = null) {
    const label = (rank) => {
        const r = Math.floor(Number(rank) || 0);
        const own = rankEffectLabel(star.id, r);
        if (r <= 0) return own || 'Not yet bought';
        const words = [own, describeRank && describeRank(star, r)].filter(Boolean).join(', ');
        return words || `Rank ${r}`;
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
        coinPrices: star.ranks.map(r => r.coins || 0),
        statLabel: label,
        nextStatLabel: rank => label(rank + 1),
        sprite: star.sprite || UPGRADE_SPRITES.star,
        authored: true,
        star
    };
}

/**
 * The sky's constellations: each upgrade names one in `constellation`. `label` is where the name
 * sits, in the same unit space as a node's `node`. A constellation is finished when every star in it
 * is lit (rank 1 or more). Put in by {@link setHallSky}. ⚠️ A live list: readers keep the array, so it is changed in place.
 */
export const CONSTELLATIONS = [];

/**
 * Every upgrade track: the stars put in by {@link setHallSky}, whose ranks carry
 * rules and Passive Production lines (`hallStars.js`), Bunk Beds and Bank Tabs giving a hero or a tab
 * a rank by id besides. ⚠️ A live list, changed in place, like {@link CONSTELLATIONS}: a test may put
 * its own track in too.
 */
export const GUILD_UPGRADES = [];

/** The tracks and constellations last put in by {@link setHallSky}, so a later call replaces exactly them. */
let skyDefs = [];
let skyConstellations = [];
/** Their normalised star records, kept as one list: Passive Production reads it every tick. */
let skyStarList = Object.freeze([]);
/** Moves on every {@link setHallSky}, so a screen drawing the sky knows to draw it again. */
let skyChanges = 0;

/** How many times the sky has been put in. */
export function skyVersion() {
    return skyChanges;
}

/**
 * Put the sky in: `sky` is `data/hallStars.json` (or a fixture) in the file's shape, or already
 * normalised. Replaces whatever the last call put in; anything else in the live lists (a test's own
 * track) stays, and a star or constellation taking its id is left out.
 *
 * @param {object|null} sky
 * @param {{ describeRank?: (star: object, rank: number) => string }} [options]
 * @returns {{ constellations: object[], stars: object[] }} what went in
 */
export function setHallSky(sky, { describeRank = null } = {}) {
    for (const def of skyDefs) {
        const i = GUILD_UPGRADES.indexOf(def);
        if (i !== -1) GUILD_UPGRADES.splice(i, 1);
    }
    for (const c of skyConstellations) {
        const i = CONSTELLATIONS.indexOf(c);
        if (i !== -1) CONSTELLATIONS.splice(i, 1);
    }
    const { constellations, stars } = normaliseHallSky(sky || {});
    skyConstellations = constellations.filter(c => !CONSTELLATIONS.some(o => o.id === c.id));
    skyDefs = stars
        .filter(s => !GUILD_UPGRADES.some(o => o.id === s.id))
        .map(s => upgradeDefOfStar(s, describeRank));
    CONSTELLATIONS.push(...skyConstellations);
    GUILD_UPGRADES.push(...skyDefs);
    skyStarList = Object.freeze(skyDefs.map(d => d.star));
    skyChanges += 1;
    return { constellations: [...skyConstellations], stars: [...skyStarList] };
}

/**
 * The stars in the sky now, as their normalised records (one frozen list until the sky changes).
 */
export function authoredStars() {
    return skyStarList;
}

/** What a star gives at a rank: its rank record's `rules` and `lines` (`hallStars.js`), or null for a test's own track or a rank of 0. */
export function rankEffectOf(def, rank) {
    if (!def?.star) return null;
    return rankOf(def.star, rank);
}

/** Look up an upgrade definition by id. */
export function getUpgradeDef(id) {
    return GUILD_UPGRADES.find(u => u.id === id) || null;
}

// Empty until `hallStarRegistry.js` puts the authored sky in.
setHallSky(null);

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

/** The coins the NEXT rank asks beside its items (`rank` = ranks already owned); 0 for none or past the top. */
export function getUpgradeCoins(def, rank) {
    if (!def || rank >= def.maxRank) return 0;
    return def.coinPrices?.[rank] || 0;
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
    if (links.some(id => (ranks?.[id] || 0) >= 1)) return null;

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

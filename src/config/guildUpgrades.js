// Fantasy Guild — Guild Hall upgrade definitions & the upgrade web.

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
    notice_board: '/assets/ui/u_quest_board.png',
    cartography_slots: '/assets/tokens/map/t_map_base.png',
    token_cap: '/assets/tokens/map/t_map_guild.png'
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
 * free. Most tracks use the same placeholder (rank n costs 10·n Oak Wood); the Token cap and the
 * Cartography table price their first ranks by the planes ({@link planePrices}).
 */
export const PLACEHOLDER_PRICE_ITEM = 'item_oak_wood';
export const PLACEHOLDER_PRICE_PER_RANK = 10;

/**
 * Build a placeholder price list: rank n costs `perRank·n` of `itemId`.
 * `freeFirstRank` makes rank 1 cost nothing — used by Bunk Beds (the first
 * recruit is free; a new game has no heroes until it is bought) and the
 * Wishing Well (the tutorial's first upgrade).
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

/**
 * Prices by the planes, for the upgrades that open the world (the Token cap, the Cartography table):
 * one list per rank from rank 1, each `[itemId, quantity]` pairs; ranks past the list keep the
 * placeholder until a later plane prices them. Ranks 1-2 cost plane 1's materials (oak, stone,
 * copper), ranks 3-4 plane 2's (fir, iron). ⚠️ First-pass numbers, for the owner to tune by playing.
 */
export const TOKEN_CAP_PLANE_PRICES = Object.freeze([
    [['item_oak_wood', 40], ['item_stone', 20], ['item_copper_ingot', 10]],
    [['item_oak_wood', 80], ['item_stone', 40], ['item_copper_ingot', 20]],
    [['item_fir_wood', 60], ['item_iron_ingot', 15]],
    [['item_fir_wood', 120], ['item_iron_ingot', 30]]
]);
export const CARTOGRAPHY_PLANE_PRICES = Object.freeze([
    [['item_oak_wood', 30], ['item_stone', 15], ['item_copper_ingot', 5]],
    [['item_oak_wood', 60], ['item_stone', 30], ['item_copper_ingot', 10]],
    [['item_fir_wood', 50], ['item_iron_ingot', 10]],
    [['item_fir_wood', 100], ['item_iron_ingot', 20]]
]);

/** A track's prices: `byRank` for its first ranks, the placeholder (`placeholderPrices`) after. */
export function planePrices(maxRank, byRank) {
    return placeholderPrices(maxRank).map((placeholder, i) => (
        byRank[i] ? byRank[i].map(([itemId, quantity]) => ({ itemId, quantity })) : placeholder
    ));
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
 * Notice Board ranks: +1 quest per rank from the base of 2 to 5, so three ranks.
 */
export const NOTICE_BOARD_MAX_RANK = 3;

/** Cartography table slots: 4 to start, one more per rank, up to 8. */
export const CARTOGRAPHY_SLOTS_BASE = 4;
export const CARTOGRAPHY_SLOTS_MAX = 8;

/** How many slots the Cartography table has at a `cartography_slots` rank. */
export function cartographySlotsForRank(rank) {
    const r = Math.max(0, Math.floor(Number(rank) || 0));
    return Math.min(CARTOGRAPHY_SLOTS_MAX, CARTOGRAPHY_SLOTS_BASE + r);
}

/**
 * The Token cap: 128 to start, +16 per rank over 8 ranks, up to 256. Here rather than in `MatCap`
 * so the upgrade's labels and the cap read one definition.
 */
export const TOKEN_CAP_BASE = 128;
export const TOKEN_CAP_PER_RANK = 16;
export const TOKEN_CAP_MAX_RANK = 8;

/** The Token cap at a `token_cap` rank. A save with ranks above the top caps at the top. */
export function tokenCapForRank(rank) {
    const r = Math.min(TOKEN_CAP_MAX_RANK, Math.max(0, Math.floor(Number(rank) || 0)));
    return TOKEN_CAP_BASE + r * TOKEN_CAP_PER_RANK;
}

/**
 * The sky's constellations: each upgrade names one in `constellation`. `label` is where the
 * name sits, in the same unit space as a node's `node`. A constellation is finished when every
 * star in it is lit (rank 1 or more).
 */
export const CONSTELLATIONS = [
    { id: 'hearth', name: 'The Hearth', label: { x: 0, y: -0.8 } },
    { id: 'vault', name: 'The Vault', label: { x: -0.72, y: 0.3 } },
    { id: 'compass', name: 'The Compass', label: { x: 0.9, y: 0.3 } },
    { id: 'well', name: 'The Well', label: { x: 0, y: 0.8 } }
];

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
    },
    {
        // Each rank lets the Guild Hall keep one more bounty quest on the mat.
        // The base and the ceiling are game values (`QuestTokens.QUEST_CAP_BASE`, `QUEST_CAP_MAX`), read by `QuestTokens.questCap`.
        id: 'notice_board',
        constellation: 'compass',
        name: 'Notice Board',
        description: 'The Guild Hall keeps one more quest on the mat at a time.',
        node: { x: 0.5, y: 0 },
        links: [HALL_NODE],
        maxRank: NOTICE_BOARD_MAX_RANK,
        prices: placeholderPrices(NOTICE_BOARD_MAX_RANK),
        statLabel: rank => `+${rank} quest${rank === 1 ? '' : 's'}`,
        nextStatLabel: rank => `+${rank + 1} quests`,
        sprite: UPGRADE_SPRITES.notice_board
    },
    {
        id: 'cartography_slots',
        tag: 'above',
        constellation: 'compass',
        name: 'Cartography Table',
        description: 'One more slot on the Cartography table, to write a Region from more maps.',
        node: { x: 0.55, y: 0.55 },
        links: [HALL_NODE],
        maxRank: CARTOGRAPHY_SLOTS_MAX - CARTOGRAPHY_SLOTS_BASE,
        prices: planePrices(CARTOGRAPHY_SLOTS_MAX - CARTOGRAPHY_SLOTS_BASE, CARTOGRAPHY_PLANE_PRICES),
        statLabel: rank => `${cartographySlotsForRank(rank)} slots`,
        nextStatLabel: rank => `${cartographySlotsForRank(rank + 1)} slots`,
        sprite: UPGRADE_SPRITES.cartography_slots
    },
    {
        id: 'token_cap',
        tag: 'above',
        constellation: 'compass',
        name: 'Token Cap',
        description: `Room for ${TOKEN_CAP_PER_RANK} more Tokens on the mat.`,
        node: { x: 0.55, y: -0.55 },
        links: [HALL_NODE],
        maxRank: TOKEN_CAP_MAX_RANK,
        prices: planePrices(TOKEN_CAP_MAX_RANK, TOKEN_CAP_PLANE_PRICES),
        statLabel: rank => `${tokenCapForRank(rank)} Tokens`,
        nextStatLabel: rank => `${tokenCapForRank(rank + 1)} Tokens`,
        sprite: UPGRADE_SPRITES.token_cap
    }
];

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
    const out = new Set(def.links || []);
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

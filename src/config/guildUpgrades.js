// Fantasy Guild — Guild Hall upgrade definitions & the upgrade web (B9, TL-23).

/**
 * Heroes a guild starts with, before any Roster Size rank is bought.
 *
 * Lives here rather than only in `StateSchema`'s `rosterLimit` default because
 * the upgrade track's top rank must agree with it: ROSTER_BASE +
 * `roster_size`.maxRank must equal {@link ROSTER_MAX}.
 */
export const ROSTER_BASE = 0;

/**
 * ⭐ The most heroes a guild can have: **8** (owner, 2026-09-21 — replaces
 * D-251's twelve). Matches the eight flag colours (FP-82). A save that already
 * holds more keeps every one of them; it just cannot recruit (owner).
 */
export const ROSTER_MAX = 8;

/**
 * The roster cap for a given `roster_size` rank — the ONE definition (CR2-193).
 *
 * Two places used to work this out independently: `GuildUpgradeManager.recompute`
 * (which writes `progress.rosterLimit`) and `HeroLifecycle.getRosterLimit`'s
 * fallback for a save with no `rosterLimit` written yet. The fallback left
 * `ROSTER_BASE` out entirely, so the moment ROSTER_BASE stops being 0 the two
 * disagree by the whole base and `isRosterFull()` refuses a recruit the player
 * has already paid for. Both now call this.
 */
export function rosterLimitForRank(rank) {
    // Clamped: a save that bought ranks 9–12 under the old twelve-hero track
    // still caps at ROSTER_MAX.
    return Math.min(ROSTER_MAX, ROSTER_BASE + (rank || 0));
}

/**
 * The art each upgrade track draws on the Guild Hall screen.
 *
 * ⚠️ Token art lives in per-family folders under `public/assets/tokens/`
 * (`upgrade/`, `chest/`, …). These paths used to point at the old flat
 * folder, so every upgrade but the Hall drew a broken image (Token Lifecycle
 * feedback Q7, FB-40). `UpgradeSprites.test.js` checks each file exists.
 *
 * `flag_radius` has no art of its own (`token_banner_wood.png` exists
 * nowhere): it borrows the plain hero flag the mat draws.
 */
export const UPGRADE_SPRITES = {
    roster_size: '/assets/tokens/upgrade/token_bunk_bed.png',
    bank_slots: '/assets/tokens/chest/token_chest_iron.png',
    bank_tabs: '/assets/tokens/chest/token_chest_addy.png',
    guild_hall: '/assets/tokens/token_guildhall.png',
    wishing_well: '/assets/tokens/upgrade/token_well_wishing.png',
    flag_radius: '/assets/ui/flag/hero_flag_base.png',
    // The quest Token's own art (B6.1): the board that makes the quests.
    notice_board: '/assets/ui/quest_board.png'
};

/**
 * ⭐ **The Guild Hall upgrades are a web around the Hall** (B9, TL-23, FB-39).
 *
 * The Hall sits at the centre of its screen; every upgrade is a node placed
 * freely around it, joined to other nodes by lines. There are no squares and no
 * tile indices any more — the 7×7 upgrade grid and its cardinal-neighbour
 * unlock went with this slice. An upgrade is addressed by its id, everywhere.
 *
 * Each upgrade carries:
 *   `node`  — `{ x, y }` in a unit space centred on the Hall (0, 0); +x is
 *             right, +y is down. The first ring sits about 0.5 out. The screen
 *             turns these into pixels (`GuildHallBoard`).
 *   `links` — ids of the nodes it is joined to, or `HALL_NODE` for the Hall.
 *             A link is a line, so it counts from both ends (see
 *             {@link getUpgradeLinks}); each is written once, on the outer node.
 *
 * Links and positions are set here in code for now; the CMS gets them later
 * (B9 web unlock).
 */
export const HALL_NODE = 'hall';

/**
 * Guild Hall upgrades are paid in items, never gold (SP-65, slice 2.1).
 *
 * Each upgrade carries `prices`: one entry per rank, where `prices[n - 1]` is
 * what rank n costs, as a list of `{ itemId, quantity }`. An empty list is
 * free. Every track uses the same placeholder today (TL-5: low and simple,
 * rank n costs 10·n Oak Wood), but the shape lets any track ask for its own
 * items later.
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
 * Notice Board ranks (B6.1, TL-18): +1 quest per rank from the base of 2 to
 * the owner's 5, so three ranks. A rank past the ceiling would buy nothing.
 */
export const NOTICE_BOARD_MAX_RANK = 3;

export const GUILD_UPGRADES = [
    {
        id: 'bank_tabs',
        name: 'Bank Tabs',
        description: 'Unlock another Bank tab for organizing items in storage.',
        // Beyond Bank Slots on the left, as it sat beyond it on the old grid.
        node: { x: -0.95, y: 0 },
        links: ['bank_slots'],
        maxRank: 15,
        prices: placeholderPrices(15),
        statLabel: rank => `${1 + rank} tabs`,
        nextStatLabel: rank => `${1 + rank + 1} tabs`,
        sprite: UPGRADE_SPRITES.bank_tabs
    },
    {
        id: 'bank_slots',
        name: 'Bank Slots',
        description: 'Store 32 more kinds of items in the Bank.',
        node: { x: -0.5, y: 0 },
        links: [HALL_NODE],
        maxRank: 10,
        prices: placeholderPrices(10),
        statLabel: rank => `${64 + rank * 32} slots`,
        nextStatLabel: rank => `${64 + (rank + 1) * 32} slots`,
        sprite: UPGRADE_SPRITES.bank_slots
    },
    {
        id: 'roster_size',
        name: 'Bunk Beds',
        description: 'Expand guild sleeping quarters to recruit new heroes and increase roster capacity.',
        node: { x: 0, y: -0.5 },
        links: [HALL_NODE],
        // One hero per rank, 0 to ROSTER_MAX (8 since 2026-09-21; was 12).
        maxRank: ROSTER_MAX - ROSTER_BASE,
        prices: placeholderPrices(ROSTER_MAX - ROSTER_BASE, { freeFirstRank: true }),
        statLabel: rank => rank === 1 ? '1 hero' : `${rank} heroes`,
        nextStatLabel: rank => `${rank + 1} heroes`,
        sprite: UPGRADE_SPRITES.roster_size
    },
    {
        id: 'flag_radius',
        name: 'Scouting Flags',
        description: 'Increases the radius heroes look for work from their flags.',
        // Between Bunk Beds and Bank Slots: either one bought opens it, as
        // either grid neighbour did before B9.
        node: { x: -0.55, y: -0.55 },
        links: ['roster_size', 'bank_slots'],
        maxRank: 5,
        prices: placeholderPrices(5),
        statLabel: rank => `+${rank * 40}u reach`,
        nextStatLabel: rank => `+${(rank + 1) * 40}u reach`,
        sprite: UPGRADE_SPRITES.flag_radius
    },
    {
        id: 'wishing_well',
        name: 'Wishing Well',
        description: 'The Guild Hall draws fresh water every cycle.',
        node: { x: 0, y: 0.5 },
        links: [HALL_NODE],
        maxRank: 10,
        prices: placeholderPrices(10, { freeFirstRank: true }),
        statLabel: rank => rank === 0 ? 'No water generated' : `${rank} Water / 10s`,
        nextStatLabel: rank => `${rank + 1} Water / 10s`,
        sprite: UPGRADE_SPRITES.wishing_well
    },
    {
        // B6.1 (TL-18, FB-41): each rank lets the Guild Hall keep one more
        // bounty quest on the mat. The base and the ceiling are Mat Tuner rows
        // (`questCap`, `questCapMax`: 2 and 5), read by `QuestTokens.questCap`.
        id: 'notice_board',
        name: 'Notice Board',
        description: 'The Guild Hall keeps one more quest on the mat at a time.',
        node: { x: 0.5, y: 0 },
        links: [HALL_NODE],
        maxRank: NOTICE_BOARD_MAX_RANK,
        prices: placeholderPrices(NOTICE_BOARD_MAX_RANK),
        statLabel: rank => `+${rank} quest${rank === 1 ? '' : 's'}`,
        nextStatLabel: rank => `+${rank + 1} quests`,
        sprite: UPGRADE_SPRITES.notice_board
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
 * plus every upgrade that names it (a line counts from both ends, TL-23). May
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
 * The kinds of lock an upgrade can carry. The owner intends skill gates later
 * ("Requires Blacksmithing 5"), which is why the kind is carried alongside the
 * text rather than left implicit — the UI shows some kinds and deliberately
 * stays quiet about others.
 */
export const LOCK_KIND = {
    /** No linked node bought yet — the web already shows this (TL-23). */
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
 * links stand. Then the web rule (TL-23): it opens once **any** node linked to
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

/** True when an upgrade may be bought, rank and price aside (TL-23). */
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

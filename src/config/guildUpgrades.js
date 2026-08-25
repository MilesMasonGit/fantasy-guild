// Fantasy Guild — Guild Hall upgrade definitions & 7x7 Playmat Layout.

import { BOARD_SIZE, TILE_COUNT, GUILD_HALL_TILE } from './boardGeometry.js';

/**
 * Heroes a guild starts with, before any Roster Size rank is bought.
 *
 * Lives here rather than only in `StateSchema`'s `rosterLimit` default because
 * two separate things must agree with it: the upgrade track's top rank (D-251
 * pins the roster at twelve, so ROSTER_BASE + maxRank must equal 12) and
 * `GuildUpgradeManager.recompute`, which derives the live cap from rank.
 */
export const ROSTER_BASE = 0;

export const UPGRADE_SPRITES = {
    roster_size: '/assets/tokens/token_bunk_bed.png',
    bank_slots: '/assets/tokens/token_chest_iron.png',
    bank_tabs: '/assets/tokens/token_chest_addy.png',
    token_bank_slots: '/assets/tokens/token_chest_gold.png',
    token_bank_tabs: '/assets/tokens/token_chest_myth.png',
    guild_hall: '/assets/tokens/token_guildhall.png',
    wishing_well: '/assets/tokens/token_well_wishing.png'
};

export const UPGRADE_TILES = {
    17: 'roster_size',
    23: 'bank_slots',
    22: 'bank_tabs',
    25: 'token_bank_slots',
    26: 'token_bank_tabs',
    31: 'wishing_well'
};

export const GUILD_UPGRADES = [
    {
        id: 'bank_tabs',
        name: 'Bank Tabs',
        description: 'Unlock another Bank tab for organizing items in storage.',
        tileIndex: 22,
        maxRank: 15,
        costBase: 250,
        costGrowth: 1.6,
        statLabel: rank => `${1 + rank} tabs`,
        nextStatLabel: rank => `${1 + rank + 1} tabs`,
        sprite: UPGRADE_SPRITES.bank_tabs
    },
    {
        id: 'bank_slots',
        name: 'Bank Slots',
        description: 'Store 32 more kinds of items in the Bank.',
        tileIndex: 23,
        maxRank: 10,
        costBase: 150,
        costGrowth: 1.45,
        statLabel: rank => `${64 + rank * 32} slots`,
        nextStatLabel: rank => `${64 + (rank + 1) * 32} slots`,
        sprite: UPGRADE_SPRITES.bank_slots
    },
    {
        id: 'token_bank_tabs',
        name: 'Vault Tabs',
        description: 'Unlock another Token Vault tab for organizing tokens.',
        tileIndex: 26,
        maxRank: 15,
        costBase: 250,
        costGrowth: 1.6,
        statLabel: rank => `${1 + rank} tabs`,
        nextStatLabel: rank => `${1 + rank + 1} tabs`,
        sprite: UPGRADE_SPRITES.token_bank_tabs
    },
    {
        id: 'token_bank_slots',
        name: 'Token Vault Slots',
        description: 'Store 32 more kinds of Tokens in the Vault.',
        tileIndex: 25,
        maxRank: 10,
        costBase: 200,
        costGrowth: 1.5,
        statLabel: rank => `${64 + rank * 32} slots`,
        nextStatLabel: rank => `${64 + (rank + 1) * 32} slots`,
        sprite: UPGRADE_SPRITES.token_bank_slots
    },
    {
        id: 'roster_size',
        name: 'Bunk Beds',
        description: 'Expand guild sleeping quarters to recruit new heroes and increase roster capacity.',
        tileIndex: 17,
        // The roster runs from 0 to 12. Rank is directly proportional to heroes (0 to 12).
        maxRank: 12,
        costBase: 500,
        costGrowth: 1.8,
        statLabel: rank => rank === 1 ? '1 hero' : `${rank} heroes`,
        nextStatLabel: rank => `${rank + 1} heroes`,
        sprite: UPGRADE_SPRITES.roster_size
    },
    {
        id: 'wishing_well',
        name: 'Wishing Well',
        description: 'The Guild Hall draws fresh water every cycle.',
        tileIndex: 31,
        maxRank: 10,
        costBase: 300,
        costGrowth: 1.5,
        statLabel: rank => rank === 0 ? 'No water generated' : `${rank} Water / 10s`,
        nextStatLabel: rank => `${rank + 1} Water / 10s`,
        sprite: UPGRADE_SPRITES.wishing_well
    }
];

/** Look up an upgrade definition by id. */
export function getUpgradeDef(id) {
    const key = id === 'guildmasters_banner' ? 'wishing_well' : id;
    return GUILD_UPGRADES.find(u => u.id === key) || null;
}

/** Look up an upgrade definition by tile index (0-48). */
export function getUpgradeDefByTile(tileIndex) {
    const id = UPGRADE_TILES[tileIndex];
    return id ? getUpgradeDef(id) : null;
}

/** Gold cost of the NEXT rank (`rank` = ranks already owned). */
export function getUpgradeCost(def, rank) {
    if (!def) return 0;
    if (def.id === 'roster_size' || def.id === 'wishing_well') {
        if (rank === 0) return 0; // Rank 0 starter recruit / first well level is free
        return Math.round(def.costBase * Math.pow(def.costGrowth, rank - 1));
    }
    return Math.round(def.costBase * Math.pow(def.costGrowth, rank));
}

/**
 * Get cardinal neighbors (Up, Down, Left, Right) of a tile index on the board.
 *
 * Deliberately *not* `adjacency.neighboursOf` — that is the game board's
 * 8-neighbour rule (D-81). The upgrade tree spreads along the four cardinal
 * directions only, so this is a genuinely different rule that happens to sit on
 * the same grid. It reads its geometry from `boardGeometry.js` so there is one
 * board, not two.
 */
export function getCardinalNeighbors(tileIndex) {
    if (tileIndex < 0 || tileIndex >= TILE_COUNT) return [];
    const row = Math.floor(tileIndex / BOARD_SIZE);
    const col = tileIndex % BOARD_SIZE;
    const neighbors = [];
    if (row > 0) neighbors.push((row - 1) * BOARD_SIZE + col); // Up
    if (row < BOARD_SIZE - 1) neighbors.push((row + 1) * BOARD_SIZE + col); // Down
    if (col > 0) neighbors.push(row * BOARD_SIZE + (col - 1)); // Left
    if (col < BOARD_SIZE - 1) neighbors.push(row * BOARD_SIZE + (col + 1)); // Right
    return neighbors;
}

/**
 * Check if a tile is accessible for upgrading based on cardinal adjacency.
 * A tile is accessible if:
 * 1. It is directly adjacent to the Center Guild Hall (Tile 24), OR
 * 2. It is directly adjacent to a tile that has rank >= 1.
 */
export function isTileAccessible(tileIndex, ranks = {}) {
    if (tileIndex === GUILD_HALL_TILE) return true;
    const neighbors = getCardinalNeighbors(tileIndex);
    for (const n of neighbors) {
        if (n === GUILD_HALL_TILE) return true;
        const upgradeId = UPGRADE_TILES[n];
        if (upgradeId && (ranks[upgradeId] || 0) >= 1) {
            return true;
        }
    }
    return false;
}

/**
 * Returns why a tile is locked if inaccessible.
 */
export function getLockReason(tileIndex, ranks = {}) {
    if (isTileAccessible(tileIndex, ranks)) return null;
    const neighbors = getCardinalNeighbors(tileIndex);
    const requiredUpgrades = [];
    for (const n of neighbors) {
        const upId = UPGRADE_TILES[n];
        if (upId) {
            const def = getUpgradeDef(upId);
            if (def) requiredUpgrades.push(def.name);
        }
    }
    if (requiredUpgrades.length > 0) {
        return `Requires adjacent upgrade (${requiredUpgrades.join(' or ')}) at Level 1+`;
    }
    return 'Path to this upgrade is locked';
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

import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';
import { logger } from '../../utils/Logger.js';
import { currentSpriteName } from '../../utils/AssetManager.js';

/**
 * Thrown when a save was created under an incompatible schema version. Reworks
 * intentionally break save compatibility: older saves are refused, not migrated.
 */
export class IncompatibleSaveError extends Error {
    constructor(savedVersion) {
        super(`Save version ${savedVersion} is incompatible with game version ${GAME_VERSION}`);
        this.name = 'IncompatibleSaveError';
        this.savedVersion = savedVersion;
    }
}

/**
 * Migrate state to fill in missing properties from INITIAL_STATE
 * @param {Object} state - The loaded state
 * @param {string} savedVersion - The version of the loaded state
 * @returns {Object} Migrated state
 * @throws {IncompatibleSaveError} If the save predates the current schema version
 */
export function migrateState(state, savedVersion) {
    // Saves from any other version (e.g. the pre-rework '1.0.0' schema) use
    // structures the current code no longer reads — refuse to load them
    // rather than attempting a structural merge over stale nested shapes.
    if (savedVersion !== GAME_VERSION) {
        throw new IncompatibleSaveError(savedVersion);
    }

    // Flags and Work Permissions became orders: an old save's boards and heroes are brought over
    // before the backfill below, which would otherwise stamp its boards as already made for orders (`migrateStateToOrders`, below).
    let migrated = { ...migrateStateToOrders(state) };

    // Backfill missing keys from INITIAL_STATE, two levels deep: the top-level
    // sections, and each section's own fields.
    //
    // ⚠️ It stops at two levels on purpose. Going deeper would reach inside
    // things like `inventory.groupDefs` and resurrect entries a save has
    // deliberately dropped. Existing values are never overwritten — only keys
    // that are `undefined` are filled, so a field a save stores as null or 0
    // keeps that value.
    for (const key of Object.keys(INITIAL_STATE)) {
        const template = INITIAL_STATE[key];

        if (migrated[key] === undefined) {
            logger.debug('SaveManager', `Adding missing property: ${key}`);
            migrated[key] = structuredClone(template);
            continue;
        }

        if (!isPlainObject(template) || !isPlainObject(migrated[key])) continue;

        let section = migrated[key];
        for (const field of Object.keys(template)) {
            if (section[field] !== undefined) continue;
            if (section === migrated[key]) section = { ...migrated[key] };
            logger.debug('SaveManager', `Adding missing property: ${key}.${field}`);
            section[field] = structuredClone(template[field]);
        }
        migrated[key] = section;
    }

    // Retired: the `currency` section an older save still carries is dropped, not kept.
    if ('currency' in migrated) delete migrated.currency;

    // Retired Map bursts and Map purchase: an older save's unopened Maps on the
    // mat, its purchase list and its burst bookkeeping are dropped, not kept.
    if ('cartographer' in migrated) delete migrated.cartographer;
    if (isPlainObject(migrated.board) && 'maps' in migrated.board) {
        migrated.board = { ...migrated.board };
        delete migrated.board.maps;
    }
    if (isPlainObject(migrated.progress) && ('mapDiscoveries' in migrated.progress || 'guildHallMapOpens' in migrated.progress)) {
        migrated.progress = { ...migrated.progress };
        delete migrated.progress.mapDiscoveries;
        delete migrated.progress.guildHallMapOpens;
    }
    if (isPlainObject(migrated.progress) && RETIRED_PROGRESS_FIELDS.some(f => f in migrated.progress)) {
        migrated.progress = { ...migrated.progress };
        for (const f of RETIRED_PROGRESS_FIELDS) delete migrated.progress[f];
    }

    // Retired Token Vault and Tray: an older save's Vault and Tray contents, tab
    // and cap fields, Token loot on the floor and ranks in the two Vault upgrade
    // tracks are dropped, not kept. Item loot stays.
    if (isPlainObject(migrated.board)) {
        const board = { ...migrated.board };
        let changed = false;
        for (const field of RETIRED_BOARD_FIELDS) {
            if (field in board) { delete board[field]; changed = true; }
        }
        if (Array.isArray(board.sprites) && board.sprites.some(isTokenSprite)) {
            board.sprites = board.sprites.filter(s => !isTokenSprite(s));
            changed = true;
        }
        if (changed) migrated.board = board;
    }
    // Retired Disallow: a Token an older save marked "heroes may not work this" loses the mark,
    // on the live board and every Region's, and heroes may work it again.
    migrated = withoutDisallowMarks(migrated);

    const ranks = migrated.progress?.guildUpgrades;
    if (isPlainObject(ranks) && RETIRED_UPGRADES.some(id => id in ranks)) {
        const kept = { ...ranks };
        for (const id of RETIRED_UPGRADES) delete kept[id];
        migrated.progress = { ...migrated.progress, guildUpgrades: kept };
    }

    // Renamed art: a hero's portrait (`spriteId`) and dock icon (`icon`) are sprite names, and an
    // older save holds the names from before the rename.
    if (Array.isArray(migrated.heroes) && migrated.heroes.some(hasOldSpriteName)) {
        migrated.heroes = migrated.heroes.map(h => {
            if (!hasOldSpriteName(h)) return h;
            const renamed = { ...h };
            if (typeof h.spriteId === 'string') renamed.spriteId = currentSpriteName(h.spriteId);
            if (typeof h.icon === 'string') renamed.icon = currentSpriteName(h.icon);
            return renamed;
        });
    }

    return migrated;
}

/**
 * Boards made since orders carry `orders: ORDERS_VERSION` (`StateSchema.createEmptyBoard`). A save
 * from before has none, and is brought over once as it loads (`SaveMigration.migrateState`), every
 * Region's board included:
 * - a flag pinned to a Token is an order on that Token, as it is;
 * - an area flag becomes a spot order where it stood: its hero idles there, working nothing, and
 * the note of work it had reached is dropped;
 * - every hero's rules and priorities (`flagRules`) are dropped.
 *
 * Pure: `migrateState` calls it before the game's modules read the state.
 */
export const ORDERS_VERSION = 1;

/** A board brought to orders, or the same board when it already is. */
export function migrateBoardToOrders(board) {
    if (!isPlainObject(board) || board.orders === ORDERS_VERSION) return board;
    const flags = isPlainObject(board.flags) ? { ...board.flags } : {};
    const workClaims = isPlainObject(board.workClaims) ? { ...board.workClaims } : board.workClaims;
    for (const [heroId, flag] of Object.entries(flags)) {
        if (!isPlainObject(flag) || typeof flag.pinnedTo === 'string' || flag.spot === true) continue;
        flags[heroId] = { ...flag, spot: true };
        if (isPlainObject(workClaims)) delete workClaims[heroId];
    }
    return { ...board, flags, ...(workClaims !== undefined ? { workClaims } : {}), orders: ORDERS_VERSION };
}

/** A hero without the retired `flagRules`, or the same hero when it has none. */
export function withoutFlagRules(hero) {
    if (!isPlainObject(hero) || !('flagRules' in hero)) return hero;
    const { flagRules: _dropped, ...rest } = hero;
    return rest;
}

/**
 * A whole saved state brought to orders: the live board, every Region's frozen board and every
 * hero. Returns the same object when nothing needed changing.
 */
export function migrateStateToOrders(state) {
    if (!isPlainObject(state)) return state;
    let out = state;
    const board = migrateBoardToOrders(state.board);
    if (board !== state.board) out = { ...out, board };
    const regions = state.atlas?.regions;
    if (isPlainObject(regions) && Object.values(regions).some(r => isPlainObject(r?.board) && r.board.orders !== ORDERS_VERSION)) {
        const next = {};
        for (const [id, r] of Object.entries(regions)) {
            next[id] = isPlainObject(r?.board) ? { ...r, board: migrateBoardToOrders(r.board) } : r;
        }
        out = { ...out, atlas: { ...state.atlas, regions: next } };
    }
    if (Array.isArray(state.heroes) && state.heroes.some(h => isPlainObject(h) && 'flagRules' in h)) {
        out = { ...out, heroes: state.heroes.map(withoutFlagRules) };
    }
    return out;
}

/** A board whose Tokens carry no retired `disallowed` mark, or the same board when none does. */
export function boardWithoutDisallowMarks(board) {
    const tokens = board?.tokens;
    if (!isPlainObject(tokens) || !Object.values(tokens).some(t => isPlainObject(t) && 'disallowed' in t)) return board;
    const kept = {};
    for (const [id, t] of Object.entries(tokens)) {
        if (!isPlainObject(t) || !('disallowed' in t)) { kept[id] = t; continue; }
        const { disallowed: _dropped, ...rest } = t;
        kept[id] = rest;
    }
    return { ...board, tokens: kept };
}

/** A saved state with no `disallowed` mark on any Token: the live board and every Region's. */
export function withoutDisallowMarks(state) {
    let out = state;
    const board = boardWithoutDisallowMarks(state.board);
    if (board !== state.board) out = { ...out, board };
    const regions = state.atlas?.regions;
    if (isPlainObject(regions)) {
        let changed = false;
        const next = {};
        for (const [id, r] of Object.entries(regions)) {
            const b = isPlainObject(r?.board) ? boardWithoutDisallowMarks(r.board) : r?.board;
            if (b !== r?.board) { changed = true; next[id] = { ...r, board: b }; } else next[id] = r;
        }
        if (changed) out = { ...out, atlas: { ...state.atlas, regions: next } };
    }
    return out;
}

/** A hero whose portrait or icon is a sprite name from before the art was renamed. */
function hasOldSpriteName(hero) {
    return isPlainObject(hero) && (currentSpriteName(hero.spriteId) !== hero.spriteId || currentSpriteName(hero.icon) !== hero.icon);
}

/** Board fields of the Token Vault and the Tray. */
export const RETIRED_BOARD_FIELDS = Object.freeze([
    'tokenBank', 'tray', 'nextTrayZ', 'tokenBankSlots', 'tokenTabsUnlocked', 'tokenGroups'
]);

/**
 * Retired Guild Hall upgrade tracks, whose bought ranks an older save drops silently (no refund):
 * the two that only ever served the Token Vault, Scouting Flags (`flag_radius`), which widened
 * the area flags that orders and camps replaced, Bank Slots (`bank_slots`), now that each Bank
 * tab holds 64 kinds (the items stay in their tabs; `InventoryManager.spillOverfullTabs`), and the
 * Compass's three: the Token Cap (the cap is fixed at 128; Tokens over it stay, and adding waits),
 * the Cartography Table (4 slots) and the Notice Board (2 bounties).
 */
export const RETIRED_UPGRADES = Object.freeze([
    'token_bank_slots', 'token_bank_tabs', 'flag_radius', 'bank_slots', 'token_cap', 'cartography_slots', 'notice_board'
]);

/** Retired `progress` fields an older save still carries: the Scouting Flags radius bonus. */
export const RETIRED_PROGRESS_FIELDS = Object.freeze(['flagRadiusBonus']);

/** A loose Token lying on the floor — the retired Token loot. */
function isTokenSprite(sprite) {
    return sprite?.kind === 'token';
}

/** An object we can merge field-by-field — not an array, not null. */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

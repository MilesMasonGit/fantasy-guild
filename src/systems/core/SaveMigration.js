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
    // So a field removed before GAME_VERSION was set can be in no save that
    // loads, and needs no step below.
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

    // Retired sections and fields, read by nothing, are dropped, not kept.
    migrated = withoutRetiredFields(migrated);
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

/**
 * Retired Guild Hall upgrade tracks, whose bought ranks an older save drops silently (no refund):
 * Scouting Flags (`flag_radius`), which widened
 * the area flags that orders and camps replaced, Bank Slots (`bank_slots`), now that each Bank
 * tab holds 64 kinds (the items stay in their tabs; `InventoryManager.spillOverfullTabs`), and the
 * Compass's three: the Token Cap (the cap is fixed at 128; Tokens over it stay, and adding waits),
 * the Cartography Table (4 slots) and the Notice Board (2 bounties).
 */
export const RETIRED_UPGRADES = Object.freeze([
    'flag_radius', 'bank_slots', 'token_cap', 'cartography_slots', 'notice_board'
]);

/** Retired top-level sections a save of this version may still carry: hero recruitment, cards. */
export const RETIRED_SECTIONS = Object.freeze(['recruitment', 'cards']);

/**
 * Retired fields a save of this version may still carry, by section: the inert Bank slot count and
 * stack caps, the Scouting Flags radius bonus, rarities and per-biome tasks, the sidebar quests and
 * their timer, which Token or enemy produced an item, and the item ids marked New!.
 */
export const RETIRED_FIELDS = Object.freeze({
    inventory: Object.freeze(['slots', 'maxStack', 'maxStackBonus']),
    progress: Object.freeze(['flagRadiusBonus', 'unlockedRarities', 'discoveredTasksByBiome']),
    quests: Object.freeze(['active', 'nextQuestAt']),
    collection: Object.freeze(['provenance']),
    ui: Object.freeze(['newDiscoveries'])
});

/**
 * A saved state without the retired sections and fields, a Bank tab's `isCustom` or a Region's
 * `settledAt`. Returns the same object when nothing needed changing.
 */
export function withoutRetiredFields(state) {
    let out = state;
    const edit = () => (out === state ? (out = { ...state }) : out);
    for (const key of RETIRED_SECTIONS) {
        if (key in out) delete edit()[key];
    }
    for (const [key, fields] of Object.entries(RETIRED_FIELDS)) {
        const section = out[key];
        if (!isPlainObject(section) || !fields.some(f => f in section)) continue;
        const kept = { ...section };
        for (const f of fields) delete kept[f];
        edit()[key] = kept;
    }
    const defs = out.inventory?.groupDefs;
    if (isPlainObject(defs) && Object.values(defs).some(d => isPlainObject(d) && 'isCustom' in d)) {
        const next = {};
        for (const [id, d] of Object.entries(defs)) next[id] = withoutKey(d, 'isCustom');
        edit().inventory = { ...out.inventory, groupDefs: next };
    }
    const regions = out.atlas?.regions;
    if (isPlainObject(regions) && Object.values(regions).some(r => isPlainObject(r) && 'settledAt' in r)) {
        const next = {};
        for (const [id, r] of Object.entries(regions)) next[id] = withoutKey(r, 'settledAt');
        edit().atlas = { ...out.atlas, regions: next };
    }
    return out;
}

/** `obj` without `key`, or the same object when it has none. */
function withoutKey(obj, key) {
    if (!isPlainObject(obj) || !(key in obj)) return obj;
    const { [key]: _dropped, ...rest } = obj;
    return rest;
}

/** An object we can merge field-by-field — not an array, not null. */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

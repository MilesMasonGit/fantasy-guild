import { INITIAL_STATE, GAME_VERSION } from '../../state/StateSchema.js';
import { logger } from '../../utils/Logger.js';
import { currentSpriteName } from '../../utils/AssetManager.js';
import { followRenames } from './followRenames.js';
import { RETIRED_WATER_TOKENS } from '../../config/registries/fishingSpots.js';

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
    // ⚠️ Before the backfill, which would otherwise give a renamed field an empty value under its
    // new name and leave the save's counts under the old one.
    migrated = withRenamedFields(migrated);

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
    // Retired bounties: their Tokens leave every board quietly, unpaid, progress and all.
    migrated = withoutQuestTokens(migrated);
    // Retired fixed waters (the fishing spots came): they leave every board quietly too.
    migrated = withoutRetiredWaters(migrated);

    const ranks = migrated.progress?.guildUpgrades;
    if (isPlainObject(ranks) && RETIRED_UPGRADES.some(id => id in ranks)) {
        const kept = { ...ranks };
        for (const id of RETIRED_UPGRADES) delete kept[id];
        migrated.progress = { ...migrated.progress, guildUpgrades: kept };
    }
    migrated = withRenamedUpgrades(migrated);

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

    // Retired timed effects: an older save's leave its heroes quietly, and what lasts for a fight or
    // a cycle loses the clock fields it carried beside that.
    if (Array.isArray(migrated.heroes) && migrated.heroes.some(hasRetiredClock)) {
        migrated.heroes = migrated.heroes.map(h => (hasRetiredClock(h) ? withoutRetiredClock(h) : h));
    }

    // Content renamed in the CMS since the save was written: the old ids it holds take the new ones.
    migrated = followRenames(migrated);

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

/** The retired bounty Token's type id. */
export const RETIRED_QUEST_TOKEN = 'token_quest';

/** A board with no bounty Token on it, or the same board when it holds none. */
export function boardWithoutQuestTokens(board) {
    const tokens = board?.tokens;
    const isQuest = (t) => isPlainObject(t) && t.typeId === RETIRED_QUEST_TOKEN;
    if (!isPlainObject(tokens) || !Object.values(tokens).some(isQuest)) return board;
    const kept = {};
    for (const [id, t] of Object.entries(tokens)) {
        if (!isQuest(t)) kept[id] = t;
    }
    return { ...board, tokens: kept };
}

/** A saved state with no bounty Token on any board: the live board and every Region's. */
export function withoutQuestTokens(state) {
    return onEveryBoard(state, boardWithoutQuestTokens);
}

/** A board with none of the retired fixed waters (`RETIRED_WATER_TOKENS`), or the same board. */
export function boardWithoutRetiredWaters(board) {
    const tokens = board?.tokens;
    const isRetired = (t) => isPlainObject(t) && RETIRED_WATER_TOKENS.includes(t.typeId);
    if (!isPlainObject(tokens) || !Object.values(tokens).some(isRetired)) return board;
    const kept = {};
    for (const [id, t] of Object.entries(tokens)) {
        if (!isRetired(t)) kept[id] = t;
    }
    return { ...board, tokens: kept };
}

/**
 * A saved state with none of the retired fixed waters on any board. A hero's order onto one lapses
 * on the first tick, as for any Token that leaves (`Flags`): they idle where it stood.
 */
export function withoutRetiredWaters(state) {
    return onEveryBoard(state, boardWithoutRetiredWaters);
}

/** `state` with `edit` applied to the live board and every Region's, sharing what it leaves alone. */
function onEveryBoard(state, edit) {
    let out = state;
    const board = edit(state.board);
    if (board !== state.board) out = { ...out, board };
    const regions = state.atlas?.regions;
    if (isPlainObject(regions)) {
        let changed = false;
        const next = {};
        for (const [id, r] of Object.entries(regions)) {
            const b = isPlainObject(r?.board) ? edit(r.board) : r?.board;
            if (b !== r?.board) { changed = true; next[id] = { ...r, board: b }; } else next[id] = r;
        }
        if (changed) out = { ...out, atlas: { ...state.atlas, regions: next } };
    }
    return out;
}

/**
 * What the retired effect clock wrote on an instance: the game time a timed one had left, the while
 * one carried for the fight also had, the wall-clock ends before those, and the never-by-time mark.
 */
const RETIRED_CLOCK_FIELDS = Object.freeze(['remainingMs', 'whileLeftMs', 'whileUntil', 'expiresAt']);

/** An instance whose only lifetime was the clock: it lasts for no fight and no cycle. */
function isTimedOnly(instance) {
    return isPlainObject(instance) && !instance.forFight && !instance.forCycle;
}

function hasClockFields(instance) {
    return isPlainObject(instance) && RETIRED_CLOCK_FIELDS.some(field => field in instance);
}

function hasRetiredClock(hero) {
    return isPlainObject(hero) && Array.isArray(hero.effects)
        && hero.effects.some(e => isTimedOnly(e) || hasClockFields(e));
}

/** A hero with its timed effects dropped and the clock's fields off the rest. Nothing is said. */
function withoutRetiredClock(hero) {
    const effects = hero.effects.filter(e => !isTimedOnly(e)).map((e) => {
        if (!hasClockFields(e)) return e;
        const kept = { ...e };
        for (const field of RETIRED_CLOCK_FIELDS) delete kept[field];
        return kept;
    });
    return { ...hero, effects };
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

/**
 * Guild Hall stars an older save holds under an old id, by the id the sky knows them by: the Wishing
 * Well was the Guildmaster's Banner. A rank under the new id, when the save holds both, wins.
 */
export const RENAMED_UPGRADES = Object.freeze({ guildmasters_banner: 'wishing_well' });

/** A state whose Guild Hall ranks are under the ids the sky knows ({@link RENAMED_UPGRADES}). */
export function withRenamedUpgrades(state) {
    const ranks = state?.progress?.guildUpgrades;
    if (!isPlainObject(ranks) || !Object.keys(RENAMED_UPGRADES).some(id => id in ranks)) return state;
    const kept = { ...ranks };
    for (const [old, id] of Object.entries(RENAMED_UPGRADES)) {
        if (!(old in kept)) continue;
        kept[id] = kept[id] ?? kept[old];
        delete kept[old];
    }
    return { ...state, progress: { ...state.progress, guildUpgrades: kept } };
}

/**
 * Fields an older save holds under an old name, by section: the completed cycles per Token type
 * were named for the cards. A value under the new name, when the save holds both, wins.
 */
export const RENAMED_FIELDS = Object.freeze({
    collection: Object.freeze({ cardUseCounts: 'cyclesByTokenType' })
});

/** A state whose fields are under their current names ({@link RENAMED_FIELDS}). */
export function withRenamedFields(state) {
    let out = state;
    for (const [key, renames] of Object.entries(RENAMED_FIELDS)) {
        const section = out?.[key];
        if (!isPlainObject(section) || !Object.keys(renames).some(old => old in section)) continue;
        const kept = { ...section };
        for (const [old, name] of Object.entries(renames)) {
            if (!(old in kept)) continue;
            kept[name] = kept[name] ?? kept[old];
            delete kept[old];
        }
        out = { ...out, [key]: kept };
    }
    return out;
}

/**
 * Retired top-level sections a save of this version may still carry: hero recruitment, cards, and
 * the bounties' clock.
 */
export const RETIRED_SECTIONS = Object.freeze(['recruitment', 'cards', 'quests']);

/**
 * Retired fields a save of this version may still carry, by section: the inert Bank slot count and
 * stack caps, the Scouting Flags radius bonus, rarities and per-biome tasks, which Token or enemy
 * produced an item, and the item ids marked New!.
 */
export const RETIRED_FIELDS = Object.freeze({
    inventory: Object.freeze(['slots', 'maxStack', 'maxStackBonus']),
    progress: Object.freeze(['flagRadiusBonus', 'unlockedRarities', 'discoveredTasksByBiome']),
    collection: Object.freeze(['provenance']),
    ui: Object.freeze(['newDiscoveries'])
});

/**
 * A saved state without the retired sections and fields, a Bank tab's `isCustom`, a Region's
 * `settledAt`, `rules` and `archived`, or a Token's `biome`. Returns the same object when nothing
 * needed changing.
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
    const staleRegion = (r) => isPlainObject(r) && (RETIRED_REGION_FIELDS.some(f => f in r) || hasTokenBiome(r.board));
    if (isPlainObject(regions) && Object.values(regions).some(staleRegion)) {
        const next = {};
        for (const [id, r] of Object.entries(regions)) {
            if (!isPlainObject(r)) { next[id] = r; continue; }
            let kept = r;
            for (const f of RETIRED_REGION_FIELDS) kept = withoutKey(kept, f);
            next[id] = isPlainObject(kept.board) ? { ...kept, board: boardWithoutTokenBiome(kept.board) } : kept;
        }
        edit().atlas = { ...out.atlas, regions: next };
    }
    if (hasTokenBiome(out.board)) edit().board = boardWithoutTokenBiome(out.board);
    return out;
}

/** A Region's own retired fields (its Token biome weights, `biome`, stay: the event clock reads them). */
const RETIRED_REGION_FIELDS = Object.freeze(['settledAt', 'rules', 'archived']);

function hasTokenBiome(board) {
    const tokens = board?.tokens;
    return isPlainObject(tokens) && Object.values(tokens).some(t => isPlainObject(t) && 'biome' in t);
}

/** A board whose Tokens carry no `biome`, or the same board when none does. */
function boardWithoutTokenBiome(board) {
    if (!hasTokenBiome(board)) return board;
    const tokens = {};
    for (const [id, t] of Object.entries(board.tokens)) tokens[id] = withoutKey(t, 'biome');
    return { ...board, tokens };
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

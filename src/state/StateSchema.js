// State Schema
// Phase 5: State Foundation

/**
 * StateSchema - Defines initial state and validation for game data
 */

import { BANK_STARTING_SLOTS } from '../config/guildUpgrades.js';

/**
 * Save schema version, deliberately decoupled from the app version in
 * package.json. It names the app version at which the save *structure* last
 * changed, so it only moves when saves genuinely break.
 *
 * '0.2.0' — the Area Deck Loop rework.
 * '0.4.0' — the Hero Dock rework: `state.bench` is removed entirely (the
 *           roster is the whole roster now), and hero equipment moves from two
 *           slots to six. Old saves are refused rather than migrated, matching
 *           the deck-loop precedent (hero_dock_roadmap_v1.md D7 / Phase 0).
 * '0.6.0' — the 7×7 Playmat rework (D-110). Nothing meaningful maps across:
 *           cards become Tokens carrying board state, areas cease to exist
 *           entirely, and heroes lose their area binding. Refused, not
 *           migrated — see playmat_roadmap_v1.md Phase 0 §C.
 * '0.7.0' — the Skill & Class rework (D-253). A hero's shape changes
 *           fundamentally: they hold 6 of 27 skills instead of all 15, six
 *           skill ids are deleted outright, `defense` folds into the single
 *           combat skill, and every hero gains a job. A migration would
 *           produce nonsense heroes, so old saves are refused — see
 *           skill_class_rework_roadmap_v1.md Phase 0.
 * '0.8.0' — Free Playmat slice 1.6a (FP-85). Tokens are stored by instance id
 *           at a point on the mat (`board.tokens`), not by tile, vacancies by
 *           the spot that ran dry, and the terrain fields leave the board.
 *           (Vacancies went again with the Managers, Token Lifecycle 9.2: an
 *           older save's `board.vacancies` is dropped on load, no bump; likewise
 *           the Token Vault and Tray fields, Token Lifecycle 9.3.) Old
 *           saves are refused through the existing version check — no message
 *           of their own, no export, no conversion.
 * '0.8.1' — the Atlas: a save holds every Region the guild has settled
 *           (`atlas`), each with its own board. A pre-Atlas save is refused, not
 *           carried over as a first Region.
 * '0.8.2' — Token spacing (brief 890): Tokens stand edges touching, 128 u apart
 *           at the closest. An older save's boards hold them closer; the owner
 *           chose a fresh start over moving them apart, so it is refused, and the
 *           slot screen says so (`SaveSlotHelper.getSlotInfo`'s `outdated`).
 */
export const GAME_VERSION = '0.8.2';

/**
 * The board's default shape, in one place.
 *
 * There used to be three disagreeing copies of this — `INITIAL_STATE.board`,
 * `BoardState.board()` and `SpriteLayer.sprites()` — and no two listed the same
 * fields (CR2-049). Both helpers now call this, so "what is an empty board"
 * has a single answer.
 *
 * See the `board` comment in INITIAL_STATE below for what each field holds.
 */
export function createEmptyBoard() {
    return {
        // Every Token on the mat, keyed by instance id; each carries its own
        // point `x`, `y` (mat units) and `placedAt` (Free Playmat 1.6a).
        tokens: {},
        // Counter behind each Token's `placedAt` — the order Tokens arrived in.
        nextTokenOrder: 0,
        // Each hero's order, keyed by hero id, saved as their flag record: pinned
        // to a Token (`pinnedTo`), or a spot to idle at (`spot`). A hero with no
        // record waits at the Guild Hall. Which Token a flag works is runtime,
        // except the note below of work a hero had reached (`workClaims`, HM-7).
        flags: {},
        // 1: this board's flags are orders. A board from an older save has none
        // and is brought over as it loads (`SaveMigration.migrateStateToOrders`).
        orders: 1,
        // Counter behind each flag's `plantedAt` — the order flags choose in.
        nextFlagOrder: 0,
        // Which Token each hero had REACHED and was working, and from which
        // side: `{ heroId: { instanceId, side } }` (Hero Movement M5, HM-7,
        // amending FP-58). On load a hero here stands back at that Token and
        // carries on; everyone else starts beside their flag. Written by
        // `BoardState` on arrival, erased when the hero lets go.
        workClaims: {},
        sprites: [],
        // 1 once `EnemyMotion.attachUntethered` has run on this board, so an
        // enemy placed by hand later is never tethered by a reload. 0 reads as
        // not yet, exactly as a missing field did.
        enemyTethers: 0,
        // 1 once `Groves.attachUntethered` has run on this board: an older save's
        // trees have joined the Forest in their reach. 0 reads as not yet.
        groveTethers: 0,
        // `tokenBank`, `tray`, `nextTrayZ`, `tokenBankSlots`, `tokenTabsUnlocked`
        // and `tokenGroups` went with the Token Vault and the Tray (Token
        // Lifecycle 9.3): Tokens live on the mat. `migrateState` drops them
        // from an older save.

        // No ground on the board: a Region's ground is its stored cell map
        // (`region.terrain`), drawn by `TerrainCanvas`.
    };
}

/**
 * One Region of the Atlas, as saved in `atlas.regions[id]`. `Atlas.js` owns the rules; this is the
 * shape.
 */
export function createRegionRecord(id = null) {
    return {
        id,
        // 'starter' (the board a new game opens on) or 'settled' (written since).
        kind: 'settled',
        // Made from the ingredients when the Region is written; never changes.
        practicalName: '',
        // Generated, then the player's to rename.
        flavourName: '',
        // The recipe ids it was written from, in slot order.
        ingredients: [],
        // The seed its layout was settled with.
        seed: 0,
        // Biome weights, `{ forest: 1, mountain: 1 }`: how many of its Base Maps were of each biome.
        // Null for a Region no map wrote.
        biome: null,
        // Its ground as the maps describe it (`Budget.budget().ground`): `{ main, terrains, water,
        // shore }`. Null for a Region no map wrote.
        ground: null,
        // The terrain grid under it, as `TerrainMap.encodeTerrain` stores it (read with
        // `terrainAt`). Null for a Region no map wrote.
        terrain: null,
        // The world map's cell it was settled on (`"q,r"`). Null for the Starter Camp (the Hall's
        // cell, by its kind) and for a Region written off the map (the dev tools').
        cellId: null,
        // Milliseconds the guild has spent here, time away included (`Atlas.addPlaytime`, every tick).
        // A Region from an older save has none and reads 0.
        playtimeMs: 0,
        // ⚠️ Null for the Region the guild is in: its board is the live `state.board`. Every other
        // Region keeps its whole board here, frozen, as a save would write it.
        board: null,
        // Where the Hall stood when the guild left, by instance id
        // (`{ x, y, placedAt }`), so going back puts them where they were.
        travellers: {}
    };
}

/**
 * Initial game state for new games
 * This is the complete state structure - all sections must be present
 */
export const INITIAL_STATE = {
    // === Meta ===
    meta: {
        version: GAME_VERSION,
        createdAt: null,       // Set on new game
        lastSavedAt: null,
        totalPlaytime: 0,      // Milliseconds: the guild's whole time, accepted away time included
        guildName: null        // Named on the new-game screen (`GuildName.js`); null in an older save
    },

    // (No `settings` section: player settings are device-local and owned by
    // SettingsManager/localStorage. The drifted duplicate that used to live
    // here was removed in the code-review Wave 5 sweep — CR-011.)

    // === Heroes ===
    // The roster is the whole roster — there is no bench (Hero Dock Phase 3).
    // `progress.rosterLimit` caps it, and recruiting is refused at the cap.
    // ⚠️ A hero's own shape is NOT declared here — it is owned by
    // `HeroGenerator` (creation) and `HeroRehydration` (load). Fields that only
    // appear on some heroes are saved with them, notably
    // `woundedRemainingMs` (WoundedSystem's recovery countdown; null once
    // recovered, absent on a hero who has never been wounded).
    heroes: [],    // Array of hero objects

    // === Inventory ===
    inventory: {
        // Bank capacity, both rank-derived: GuildUpgradeManager.recompute()
        // rewrites them on every load (1 + bank_tabs, 64 per tab).
        // These are the starting values, i.e. rank 0.
        maxTabs: 1,
        maxSlots: BANK_STARTING_SLOTS,
        items: {},        // { itemId: { quantity, durabilities? } }
        // Bank tabs. Extra entries are added ONLY by
        // GuildUpgradeManager._ensureBankTabs when the `bank_tabs` upgrade
        // raises maxTabs, and are named 'bank-tab-2', 'bank-tab-3', … There
        // are no player-created tabs (owner ruling 2026-08-25, CR2-089).
        groupOrder: ['default-loot'],   // ['default-loot', 'bank-tab-2', …]
        groupDefs: {
            'default-loot': { title: 'Loot', id: 'default-loot', orderedItems: [] }
        },
        itemOverrides: {} // itemId -> groupId: { 'item_apple': 'bank-tab-2' }
    },

    // === Progress ===
    progress: {
        rosterLimit: 0, // Active roster capacity (matches roster_size rank: 1 once a new game has made its first hero, max 8 — ROSTER_MAX)
        // Guild Hall upgrade ranks: { upgradeId: rank }. Owned by
        // GuildUpgradeManager, which derives rosterLimit and the bank caps
        // from it on every load.
        guildUpgrades: {},
        // The guild's coins, a whole number (`inventory/Coins.js`); an older save gets 0 from `migrateState`.
        coins: 0,
        // Science's mastery points by node kind, guild-wide: { kindId: points } (`progression/Mastery.js`).
        mastery: {}
    },

    // === Time ===
    time: {
        gameTimeMs: 0
    },


    // === Collection ===
    // Discovery and statistics. An older save may still carry the retired
    // card-ownership fields (binders, playsets, packs…); `migrateState` only
    // back-fills missing keys, so they ride along unread.
    collection: {
        discoveredItems: {},     // { [itemId]: true }
        discoveredEnemies: {},   // { [enemyId]: true }
        itemLifetimeCounts: {},  // { [itemId]: number }
        enemyKillCounts: {},     // { [enemyId]: number }
        cardUseCounts: {},       // { [typeId]: number } — completed cycles per Token type
        // The Encyclopedia's ticks (`collectionLog.js`); an older save gets them empty from `migrateState`.
        tokensHad: {},           // { [typeId]: true } — a Token of the type has stood on the mat
        recipesMade: {},         // { [recipeId]: true } — a cycle of the recipe has finished
        tokensBuilt: {}          // { [typeId]: number } — Tokens of the type built on a Foundation
    },

    // === UI State (Transient Focus) ===
    ui: {
        pinnedStubs: [],                 // [{ itemId, added, removed }] - pinned item stubs, counting since pinned
        banners: []                      // [{ kind, parts, sprite, subjects }] - unclicked kept banners (knock-outs, Bank full), oldest first (`banners.serializeKept`)
    },

    // === The Board (the playmat) ===
    //   tokens      { [id]: { id, typeId, x, y, placedAt, usesRemaining, cycleElapsedMs, selectedRecipeId? } }  (Free Playmat 1.6a)
    //               + origin 'placed'|'spawned' (absent reads as placed), clocks? { growMs, spawnMs, ... },
    //                 fixture? true on a node a map wrote, fixture? 'camp' on a Token the Starter Camp laid (`BoardState.isFixture`),
    //                 demolish? true on a Token marked for demolition (`Demolition.js`; its progress is cycleElapsedMs),
    //                 secondRecipeId?, secondElapsedMs? on a Many Hands station: its second recipe and that recipe's cycle (`StationRecipe.js`),
    //                 secondAlert? that recipe's problem, for its card (`BoardRunner`),
    //                 paid? { items: [{ itemId, quantity }], coins } what the guild paid for it: its Shop price as bought, a building's
    //                 Foundation and build materials as paid; a refund gives it back, Salvage a share of it (`BuildPrices.js`),
    //                 field? { cropId?, load?, full?, seedOwed? } on a Field: the crop in its ground, the harvests left, the seed its first harvest still owes (`Fields.js`; its growth on clocks.fieldMs)
    //                 fightHp? { current, heroId?, restMs?, leftAt? } on a hurt enemy: its health (`BoardCombat.keepHp`); heroId while its fight is live (a reload goes on with that hero),
    //                 restMs the part second of healing out of a fight, leftAt (on a frozen Region's board) when the guild left, so the rest it missed is played on return; absent is whole
    //                 fortune? number   the Token's count toward Fortune's sure rare find, 0 to under 100 (`Fortune.js`); absent is 0
    //   nextTokenOrder number               the next Token's placedAt
    //   flags       { [heroId]: { x, y, plantedAt, pinnedTo?, spot?, needsJob?, returnTo? } }  each hero's order: pinnedTo = the Token instance id it
    //                 works; spot = a point to idle at (any record not pinned is one); needsJob = the ordered Token is gone for good;
    //                 returnTo = a caught thief's Hideout, gone back to once the guard they were sent at is beaten (`Flags.goForGuard`)
    //   orders      1                       the flags are orders (an older save's board is migrated as it loads, `SaveMigration.migrateStateToOrders`)
    //   nextFlagOrder number                the next flag's plantedAt
    //   sprites     [ ... ]                 item loot on the floor (D-40), added Phase 3;
    //                                       no Token sprites since Token Lifecycle 9.3
    //
    // ⚠️ **`flags` is a hero's place on the board, and it is the only copy.**
    // Which Token a flag works is a runtime claim; the save keeps only
    // `workClaims`, a note of work a hero had reached, so a reload can put them
    // back at it (Hero Movement M5, HM-7, amending FP-58). A hero with no flag
    // is in the Dock; the Dock is still not a data structure.
    board: createEmptyBoard(),

    // === Events (`events/EventClock.js`) ===
    // The guild's event clock in game ms: advanced by the tick's `delta` while no event Token
    // stands on the active mat, held at 0 while one does. `waitMs` is the wait it counts to, drawn
    // when it starts (45 to 75 min) and kept until the next landing; null until the first tick.
    // The events themselves are Tokens (`instance.event`).
    events: {
        clockMs: 0,
        waitMs: null
    },

    // === The Atlas (Regions) ===
    // `board` above is always the active Region's board; every other Region is a record here
    // (`createRegionRecord`) holding its own frozen board. Owned by `Atlas.js`.
    atlas: {
        activeRegionId: null,
        // Region ids are `region_<n>`, never reused.
        nextRegionNumber: 1,
        regions: {},
        // The guild's layout seed: a preview asked without a seed steps it and lays out with the
        // result, so layouts vary without the game ever drawing from `Math.random`. Null until the
        // first such preview, which starts it from `meta.createdAt`.
        seed: null
    },

    // === Limes, the guide (`quests/LimesGuide.js`, `quests/LimesLessons.js`) ===
    // Not a Token: nothing works it and the board never reads it.
    guide: {
        limesSpot: null,   // { x, y } Limes's middle on the Starter Camp's mat, mat units; null = its corner
        lessons: true,     // the new-game screen's lessons switch: whether Limes speaks of them
        // The lessons' progress, counted from the engine's events: { done: [stepId], counts:
        // { stepId: n }, moments: { momentId: 'due' | 'heard' }, seen: [stepId] (the steps this
        // game has met, so a step that joins later is placed: `LimesLessons.js`) }. Null in a game with no lessons
        // (made before them, or with no new game behind it); a new game sets it.
        progress: null
    },

    // === The world (brief 330) ===
    // The run's hex world around the Hall, generated whole at a new game and kept as it was made
    // (`world/World.js`; the shape is `world/generate.js`'s). Null in a save made before the world
    // existed: old saves are abandoned, so none is generated for them. ⚠️ Not in REQUIRED_KEYS:
    // a required section may not be null.
    world: null,
};

/**
 * List of all required top-level state keys.
 *
 * `migrateState` runs before this check and backfills any wholly-missing
 * top-level section from INITIAL_STATE, so requiring them cannot reject a save
 * that merely predates them.
 */
const REQUIRED_KEYS = [
    'meta', 'heroes',
    'inventory', 'progress', 'time',
    'collection', 'board', 'atlas'
];

/**
 * Validate save data structure
 * @param {Object} saveData - The save data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSaveData(saveData) {
    const errors = [];

    // Check top-level structure
    if (!saveData) {
        errors.push('Save data is null or undefined');
        return { valid: false, errors };
    }

    if (!saveData.version) {
        errors.push('Missing version field');
    }

    if (!saveData.state) {
        errors.push('Missing state field');
        return { valid: false, errors };
    }

    // Check required state keys. A null/undefined section counts as missing:
    // it passes `in` but crashes everything downstream, and the shape checks
    // below all skip falsy values (found by the CR-008 wiring tests).
    for (const key of REQUIRED_KEYS) {
        if (!(key in saveData.state)) {
            errors.push(`Missing state.${key}`);
        } else if (saveData.state[key] === null || saveData.state[key] === undefined) {
            errors.push(`state.${key} is null`);
        }
    }

    // Validate heroes array
    if (saveData.state.heroes && !Array.isArray(saveData.state.heroes)) {
        errors.push('state.heroes must be an array');
    }

    // Validate inventory structure
    if (saveData.state.inventory) {
        if (typeof saveData.state.inventory.items !== 'object') {
            errors.push('state.inventory.items must be an object');
        }
        if (!Array.isArray(saveData.state.inventory.groupOrder)) {
            errors.push('state.inventory.groupOrder must be an array');
        }
    }

    // The areaStates validation block was removed with areas. There is
    // deliberately no deep board check: `migrateState` now backfills a
    // section's missing fields before this runs, so a shape check here could
    // never fire.

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Create a fresh initial state with current timestamp
 * @returns {Object} New game state
 */
export function createInitialState() {
    const state = structuredClone(INITIAL_STATE);
    state.meta.createdAt = Date.now();
    return state;
}

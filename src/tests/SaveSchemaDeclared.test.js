import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE, createEmptyBoard, validateSaveData, GAME_VERSION } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TokenGroups from '../systems/board/TokenGroups.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';

/**
 * CR2-042 / CR2-069: the declared schema must describe the save the game
 * actually writes.
 *
 * Twelve fields had been added to real saves without ever being declared in
 * `INITIAL_STATE`, each one covered by its own defensive re-creation at the
 * point of use. This test is the durable half of that fix: it plays enough of
 * the game to make those writers run, then fails if `serialize()` produced a
 * field the schema does not declare.
 *
 * If this test fails, the fix is to declare the new field in
 * `StateSchema.INITIAL_STATE` — not to loosen the test.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Sections whose *contents* are keyed by id or index rather than by a fixed set
 * of field names, so there is nothing to declare below the section itself.
 * `heroes` and `recruitment.candidates` are arrays of hero blobs whose shape is
 * owned by `HeroGenerator`, not by this schema.
 */
const OPAQUE_SECTIONS = ['heroes'];

/** Keys the game uses as in-memory scratch. `_rev` is a change counter. */
const isScratch = (key) => key.startsWith('_');

/** Run the systems that write save fields of their own accord. */
function playALittle() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GuildUpgradeManager.recompute();
    QuestManager.ensureState();
    TokenGroups.ensure();

    // The Cartographer's three fields (a purchase, a discovery and the Guild
    // Hall drop index) were written here until the Map bursts and the Map
    // purchase were deleted (Token Lifecycle 9.1).
}

describe('The declared schema matches the save (CR2-042, CR2-069)', () => {
    beforeEach(() => {
        playALittle();
    });

    it('declares every top-level section that serialize() writes', () => {
        const saved = GameState.serialize().state;
        const undeclared = Object.keys(saved)
            .filter(key => !isScratch(key) && !(key in INITIAL_STATE));
        expect(undeclared).toEqual([]);
    });

    it('declares every field inside every section that serialize() writes', () => {
        const saved = GameState.serialize().state;
        const undeclared = [];

        for (const [section, value] of Object.entries(saved)) {
            if (OPAQUE_SECTIONS.includes(section)) continue;
            const declared = INITIAL_STATE[section];
            if (!declared || Array.isArray(value) || typeof value !== 'object') continue;
            if (Array.isArray(declared) || typeof declared !== 'object') continue;

            for (const field of Object.keys(value)) {
                if (isScratch(field)) continue;
                if (!(field in declared)) undeclared.push(`${section}.${field}`);
            }
        }

        expect(undeclared).toEqual([]);
    });

    it('names the twelve fields the review found saved but undeclared', () => {
        // Spelled out so a future deletion of one of them is a deliberate act.
        expect(Object.keys(INITIAL_STATE.board)).toEqual(
            expect.arrayContaining(['sprites', 'tokenBankSlots', 'tokenTabsUnlocked', 'tokenGroups'])
        );
        expect(Object.keys(INITIAL_STATE.inventory)).toEqual(
            expect.arrayContaining(['maxTabs', 'maxSlots'])
        );
        expect(Object.keys(INITIAL_STATE.progress)).toEqual(
            expect.arrayContaining(['guildUpgrades'])
        );
        expect(INITIAL_STATE.quests).toHaveProperty('completedTutorials');
        // Deleted on purpose with the Map bursts (Token Lifecycle 9.1): the
        // Map discoveries, the Guild Hall drop index and the Cartographer's
        // purchase list.
        expect(INITIAL_STATE.progress).not.toHaveProperty('mapDiscoveries');
        expect(INITIAL_STATE.progress).not.toHaveProperty('guildHallMapOpens');
        expect(INITIAL_STATE.cartographer).toBeUndefined();
        expect(INITIAL_STATE.board).not.toHaveProperty('maps');
    });

    it('still passes its own validator after a real play session', () => {
        const result = validateSaveData(GameState.serialize());
        expect(result.errors).toEqual([]);
    });
});

describe('One definition of an empty board (CR2-049)', () => {
    it('is the shape INITIAL_STATE declares', () => {
        expect(Object.keys(INITIAL_STATE.board).sort())
            .toEqual(Object.keys(createEmptyBoard()).sort());
    });

    it('is the shape the board helpers repair a boardless save to', async () => {
        GameState.initNew();
        delete GameState.state.board;
        const BoardState = await import('../systems/board/BoardState.js');
        BoardState.getTray();
        expect(Object.keys(GameState.state.board).sort())
            .toEqual(Object.keys(createEmptyBoard()).sort());
    });
});

describe('Migration repairs a partially-present section (CR2-042)', () => {
    /** A save that has a `board`, but only one of its fields. */
    const truncatedBoard = () => {
        const state = GameState.serialize().state;
        state.board = { tokens: { tok_f: { id: 'tok_f', typeId: 'token_forest', x: 544, y: 64, placedAt: 0, usesRemaining: 7 } } };
        return state;
    };

    beforeEach(() => {
        GameState.initNew();
    });

    it('fills the missing fields of a section that is present but incomplete', () => {
        const migrated = migrateState(truncatedBoard(), GAME_VERSION);
        for (const field of Object.keys(createEmptyBoard())) {
            expect(migrated.board).toHaveProperty(field);
        }
    });

    it('keeps what the incomplete section did contain', () => {
        const migrated = migrateState(truncatedBoard(), GAME_VERSION);
        expect(migrated.board.tokens.tok_f.typeId).toBe('token_forest');
        expect(migrated.board.tokens.tok_f.usesRemaining).toBe(7);
    });

    it('never overwrites a field the save already stores, including 0 and null', () => {
        const state = GameState.serialize().state;
        state.time.gameTimeMs = 0;   // was progress.guildHallMapOpens, deleted in 9.1
        state.board.tokenGroups = { groupOrder: ['mine'], groupDefs: {}, overrides: {} };
        state.meta.createdAt = null;

        const migrated = migrateState(state, GAME_VERSION);
        expect(migrated.time.gameTimeMs).toBe(0);
        expect(migrated.board.tokenGroups.groupOrder).toEqual(['mine']);
        expect(migrated.meta.createdAt).toBeNull();
    });

    it('does not reach a third level down, where it would resurrect deleted entries', () => {
        const state = GameState.serialize().state;
        state.inventory.groupDefs = { 'bank-tab-2': { id: 'bank-tab-2', title: 'Ore', orderedItems: [] } };

        const migrated = migrateState(state, GAME_VERSION);
        expect(Object.keys(migrated.inventory.groupDefs)).toEqual(['bank-tab-2']);
    });

    it('does not mutate the state handed to it', () => {
        const state = truncatedBoard();
        migrateState(state, GAME_VERSION);
        expect(Object.keys(state.board)).toEqual(['tokens']);
    });
});

describe('The validator guards the sections this game is made of (CR2-043)', () => {
    beforeEach(() => {
        GameState.initNew();
    });

    it('rejects a save with no board', () => {
        const state = GameState.serialize().state;
        delete state.board;
        const result = validateSaveData({ version: GAME_VERSION, state });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing state.board');
    });

    it('rejects a save with no quests', () => {
        const state = GameState.serialize().state;
        delete state.quests;
        const result = validateSaveData({ version: GAME_VERSION, state });
        expect(result.errors).toContain('Missing state.quests');
    });

    it('accepts a save that migration has already repaired', () => {
        const state = GameState.serialize().state;
        delete state.board;
        delete state.quests;
        const migrated = migrateState(state, GAME_VERSION);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).valid).toBe(true);
    });

    it('no longer polices the retired card structures', () => {
        const state = GameState.serialize().state;
        // Counts above 4 were an error while playsets meant card ownership.
        state.collection.playsets = { anything: 99 };
        state.collection.binders = 'not even an object';
        expect(validateSaveData({ version: GAME_VERSION, state }).valid).toBe(true);
    });
    // Gold left the save with its code (Token Lifecycle 9.4, SP-65).
    it('a new save has no currency section, and validates without one', () => {
        const state = GameState.serialize().state;
        expect(state.currency).toBeUndefined();
        expect(INITIAL_STATE.currency).toBeUndefined();
        expect(validateSaveData({ version: GAME_VERSION, state }).valid).toBe(true);
    });

    it('an older save still carrying currency loads, and the section is dropped', () => {
        const state = GameState.serialize().state;
        state.currency = { gold: 1234, influence: 10, totalRecruits: 0 };
        expect(validateSaveData({ version: GAME_VERSION, state }).valid).toBe(true);
        const migrated = migrateState(state, GAME_VERSION);
        expect(migrated.currency).toBeUndefined();
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).valid).toBe(true);
    });

    // The Map bursts and the Map purchase left the save with their code
    // (Token Lifecycle 9.1).
    it('an older save with unopened Maps on the mat loads, and the Maps and their bookkeeping are dropped', () => {
        const state = GameState.serialize().state;
        state.board.maps = [{ id: 'map_abc', typeId: 'token_oak_forest_map', x: 100, y: 100, usesRemaining: 1 }];
        state.cartographer = { purchasedMaps: ['map_oak_forest'] };
        state.progress.mapDiscoveries = { token_oak_tree: true };
        state.progress.guildHallMapOpens = 3;
        expect(validateSaveData({ version: GAME_VERSION, state }).valid).toBe(true);

        const migrated = migrateState(state, GAME_VERSION);
        expect(migrated.board.maps).toBeUndefined();
        expect(migrated.cartographer).toBeUndefined();
        expect(migrated.progress.mapDiscoveries).toBeUndefined();
        expect(migrated.progress.guildHallMapOpens).toBeUndefined();
        // Everything else on the board is kept.
        expect(migrated.board.tokens).toEqual(state.board.tokens);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).valid).toBe(true);
    });
});

describe('Heroes are saved without their runtime scratch (CR2-023)', () => {
    /** A hero as the game holds one in memory: generated, then rehydrated. */
    function liveHero() {
        GameState.initNew();
        const hero = generateHero();
        rehydrateHero(hero);
        GameState.state.heroes = [hero];
        return hero;
    }

    it('leaves the scratch out of the save', () => {
        liveHero();
        const [saved] = GameState.serialize().state.heroes;
        for (const prop of ['aggregator', 'className', 'traitName', 'level', '_rev']) {
            expect(saved).not.toHaveProperty(prop);
        }
    });

    it('leaves the live hero untouched — only the copy is stripped', () => {
        const hero = liveHero();
        GameState.serialize();
        expect(hero.aggregator).toBeTruthy();
        expect(typeof hero.level).toBe('number');
    });

    it('rebuilds every stripped field on load, so nothing is lost', () => {
        const before = liveHero();
        const [saved] = JSON.parse(JSON.stringify(GameState.serialize())).state.heroes;
        rehydrateHero(saved);

        expect(saved.aggregator).toBeTruthy();
        expect(saved.level).toBe(before.level);
        expect(saved.className).toBe(before.className);
        expect(saved.traitName).toBe(before.traitName);
    });

    it('keeps everything rehydration does NOT rebuild — hp, equipment, statuses', () => {
        const hero = liveHero();
        hero.hp.current = 3;
        hero.equipment[4] = 'item_apple';
        hero.statuses = [{ id: 'status_poison', remainingMs: 500 }];
        hero.woundedRemainingMs = 12345;

        const [saved] = GameState.serialize().state.heroes;
        expect(saved.hp.current).toBe(3);
        expect(saved.equipment[4]).toBe('item_apple');
        expect(saved.statuses[0].id).toBe('status_poison');
        expect(saved.woundedRemainingMs).toBe(12345);
    });
});

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { FLAG_COLOURS } from '../systems/board/FlagColours.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { migrateState, IncompatibleSaveError, RETIRED_SECTIONS, RETIRED_FIELDS } from '../systems/core/SaveMigration.js';
import { GAME_VERSION, validateSaveData } from '../state/StateSchema.js';

// CR-053: serialization integrity net (review objective 4). Session 7
// verified a live roundtrip by hand; this locks the contract in CI.

describe('Save serialize/migrate roundtrip (CR-053)', () => {
    beforeEach(() => {
        GameState.initNew();
    });

    it('wraps state with version and savedAt, and stamps meta.lastSavedAt (CR-006)', () => {
        const data = GameState.serialize();
        expect(data.version).toBe(GAME_VERSION);
        expect(typeof data.savedAt).toBe('number');
        expect(data.state.meta.lastSavedAt).toBe(data.savedAt);
    });

    it('produces a save that passes the schema validator (CR-008 target)', () => {
        const result = validateSaveData(GameState.serialize());
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
    });

    it('serialize does not mutate live state', () => {
        const before = JSON.stringify(GameState.state.collection);
        GameState.serialize();
        expect(JSON.stringify(GameState.state.collection)).toBe(before);
    });

    it('survives a JSON write/read cycle with gameplay values intact', () => {
        GameState.state.time.gameTimeMs = 1234;   // a plain number to round-trip (gold left the save in 9.4, the Guild Hall Map counter in 9.1)
        GameState.state.collection.cardUseCounts = { token_forest: 17 };

        // Board state is the thing a lost save would cost the player now: the
        // Tokens they placed, their remaining charges, and who is working what.
        // Re-pointed from areaStates/outposts by the playmat rework (Phase 1);
        // the rule is unchanged, only its subject.
        // Stored by instance id at a mat point since Free Playmat 1.6a.
        GameState.state.board.tokens = {
            tok_a: { id: 'tok_a', typeId: 'token_forest', x: 0, y: 64, placedAt: 0, usesRemaining: 4200, cycleElapsedMs: 0 },
            tok_b: { id: 'tok_b', typeId: 'token_sawmill', x: 864, y: 864, placedAt: 1, usesRemaining: null, cycleElapsedMs: 0 }
        };
        GameState.state.board.nextTokenOrder = 2;

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        const migrated = migrateState(revived.state, revived.version);

        expect(migrated.time.gameTimeMs).toBe(1234);
        expect(migrated.collection.cardUseCounts).toEqual({ token_forest: 17 });

        // A coordinate of 0 is a real point — a save that dropped it because
        // the value is falsy would silently move a Token.
        expect(migrated.board.tokens.tok_a.typeId).toBe('token_forest');
        expect(migrated.board.tokens.tok_a.usesRemaining).toBe(4200);
        expect(migrated.board.tokens.tok_a.x).toBe(0);
        expect(migrated.board.tokens.tok_a.placedAt).toBe(0);
        expect(migrated.board.nextTokenOrder).toBe(2);

        // An unlimited-use Token stores null charges and must not come back as
        // 0, which would read as depleted.
        expect(migrated.board.tokens.tok_b.usesRemaining).toBeNull();
    });

    it('refuses saves from a different schema version (locked no-migration rule)', () => {
        const data = GameState.serialize();
        expect(() => migrateState(data.state, '1.0.0')).toThrow(IncompatibleSaveError);
    });

    it('backfills missing top-level sections from the schema', () => {
        const data = GameState.serialize();
        delete data.state.collection;
        const migrated = migrateState(data.state, GAME_VERSION);
        expect(migrated.collection).toBeDefined();
        expect(migrated.collection.discoveredItems).toEqual({});
    });

    it('tolerates retired Projects fields left in older saves (CR-038)', () => {
        const data = GameState.serialize();
        data.state.progress.projects = { old_project: { level: 2 } };
        data.state.progress.completedProjects = [{ tier: 1 }];
        const migrated = migrateState(data.state, GAME_VERSION);
        expect(migrated.progress.rosterLimit).toBe(0);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).valid).toBe(true);
    });
});

/**
 * ⭐ A save an earlier build of this version wrote still loads: the sections and fields read by
 * nothing are dropped, the ranks of retired upgrade tracks too, and the Tokens on the mat and every
 * other rank are kept.
 */
describe('A save an earlier build of this version wrote still loads', () => {
    /** The earlier shape, built by hand the way such a save sits in storage. */
    function oldSave() {
        GameState.initNew();
        const data = JSON.parse(JSON.stringify(GameState.serialize()));
        const s = data.state;
        s.board.tokens = {
            tok_a: { id: 'tok_a', typeId: 'token_oak_forest', x: 400, y: 300, placedAt: 0, usesRemaining: 10, cycleElapsedMs: 0 }
        };
        s.recruitment = { candidates: [] };
        s.cards = { idCounter: 1 };
        s.inventory.slots = { max: 20, used: 0 };
        s.inventory.maxStack = 1e12;
        s.inventory.maxStackBonus = 0;
        s.inventory.groupDefs['default-loot'].isCustom = false;
        s.progress.unlockedRarities = ['common', 'uncommon'];
        s.progress.discoveredTasksByBiome = {};
        s.quests.active = [];
        s.quests.nextQuestAt = null;
        s.collection.provenance = { token_oak_forest: { item_oak_wood: true } };
        s.ui.newDiscoveries = { item_oak_wood: true };
        s.atlas.regions = { region_1: { id: 'region_1', kind: 'starter', settledAt: 0, ingredients: [], board: null } };
        s.progress.guildUpgrades = { roster_size: 2, bank_slots: 1 };
        return data;
    }

    it('migrates without complaint and passes the validator, with no cards section required', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).errors).toEqual([]);
        const { cards: _cards, ...withoutCards } = migrated;
        expect(validateSaveData({ version: GAME_VERSION, state: withoutCards }).errors).toEqual([]);
    });

    it('drops every retired section and field', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        for (const key of RETIRED_SECTIONS) expect(migrated).not.toHaveProperty(key);
        for (const [key, fields] of Object.entries(RETIRED_FIELDS)) {
            for (const f of fields) expect(migrated[key], `${key}.${f}`).not.toHaveProperty(f);
        }
        expect(migrated.inventory.groupDefs['default-loot']).not.toHaveProperty('isCustom');
        expect(migrated.atlas.regions.region_1).not.toHaveProperty('settledAt');
        expect(migrated.atlas.regions.region_1.ingredients).toEqual([]);
    });

    it('keeps the Tokens on the mat exactly as they were', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        expect(migrated.board.tokens.tok_a).toEqual(data.state.board.tokens.tok_a);
    });

    it('drops the retired Bank Slots ranks, and keeps the rest', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        expect(migrated.progress.guildUpgrades).toEqual({ roster_size: 2 });
    });

    it('⭐ drops the retired Scouting Flags ranks and its radius bonus silently, and keeps the rest (brief 260 O2)', async () => {
        const data = oldSave();
        data.state.progress.guildUpgrades = { roster_size: 2, flag_radius: 3, bank_slots: 1 };
        data.state.progress.flagRadiusBonus = 120;
        const migrated = migrateState(data.state, data.version);
        expect(migrated.progress.guildUpgrades).toEqual({ roster_size: 2 });
        expect(migrated.progress).not.toHaveProperty('flagRadiusBonus');
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).errors).toEqual([]);
        // And loaded, nothing brings it back.
        loadSavedState(migrated);
        expect(GameState.state.progress.guildUpgrades).not.toHaveProperty('flag_radius');
        expect(GameState.state.progress).not.toHaveProperty('flagRadiusBonus');
    });

    it('does not mutate the save handed to it', () => {
        const data = oldSave();
        const before = JSON.stringify(data.state);
        migrateState(data.state, data.version);
        expect(JSON.stringify(data.state)).toBe(before);
    });

    it('loads into a live game, and nothing brings the retired fields back', async () => {
        const data = oldSave();
        loadSavedState(migrateState(data.state, data.version));
        expect(GameState.state.board.tokens.tok_a.typeId).toBe('token_oak_forest');
        expect(GameState.state).not.toHaveProperty('cards');
        expect(GameState.state.quests).not.toHaveProperty('active');
        expect(GameState.serialize().state.inventory).not.toHaveProperty('maxStackBonus');
    });
});

/**
 * ⭐ A hero comes back from a save exactly as they went in (test first/252).
 *
 * ⚠ Not here: a live effect (`hero.effects`) reaching the aggregator after a
 * load. That fails today and lands, red first, with its fix.
 */
describe('a hero round-trips through a save (CR3-266)', () => {
    beforeAll(() => {
        registerEffects({
            fixture_effect_rt_plating: {
                id: 'fixture_effect_rt_plating', name: 'Round-trip Plating',
                statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.ARMOR, bucket: 'flat', value: 3 } }]
            }
        });
        registerItems({
            fixture_rt_plate: { id: 'fixture_rt_plate', name: 'Round-trip Plate', effects: [{ effectId: 'fixture_effect_rt_plating', scale: 1 }] }
        });
    });

    /** Save the live game and load it back the way a slot does. */
    async function saveAndLoad() {
        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        loadSavedState(migrateState(revived.state, revived.version));
        return GameState.state;
    }

    function hero(id) {
        const h = generateHero({ name: id });
        h.id = id;
        return h;
    }

    beforeEach(() => {
        GameState.initNew();
    });

    it('keeps the wound timer and the flag colour; drops the old status engine statuses and the retired hero fields', async () => {
        const a = hero('hero_rt_a');
        a.statuses = [{ id: 'poison', stacks: 2, remaining: 3 }, { id: 'well_fed', stacks: 1 }];
        Object.assign(a, { classId: null, traitId: null, createdAt: 0 });
        a.flagColour = FLAG_COLOURS[3];
        const b = hero('hero_rt_b');
        b.status = 'wounded';
        b.woundedRemainingMs = 12345;
        GameState.state.heroes = [a, b];

        const loaded = await saveAndLoad();
        const [la, lb] = loaded.heroes;

        // Statuses ride on `effects` now and end with their fight; an older save's outlasted it.
        expect(la.statuses).toEqual([]);
        for (const field of ['classId', 'traitId', 'createdAt']) expect(la).not.toHaveProperty(field);
        expect(la.flagColour).toBe(FLAG_COLOURS[3]);
        expect(lb.status).toBe('wounded');
        expect(lb.woundedRemainingMs).toBe(12345);
    });

    it('puts carried gear back on the aggregator combat reads', async () => {
        const a = hero('hero_rt_a');
        a.equipment = Array(9).fill(null);
        a.equipment[2] = 'fixture_rt_plate';
        GameState.state.heroes = [a];
        InventoryManager.init();
        InventoryManager.addItem('fixture_rt_plate', 3);

        const loaded = await saveAndLoad();
        const la = loaded.heroes[0];

        expect(la.equipment[2]).toBe('fixture_rt_plate');
        expect(la.aggregator).toBeDefined();
        expect(la.aggregator.query('ARMOR')).toBe(3);
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { migrateState, IncompatibleSaveError } from '../systems/core/SaveMigration.js';
import { GAME_VERSION, validateSaveData } from '../state/StateSchema.js';

// CR-053: serialization integrity net (review objective 4). Session 7
// verified a live roundtrip by hand; this locks the contract in CI.

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn(() => null),
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

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
        GameState.state.currency.gold = 1234;
        GameState.state.collection.playsets = { t_card: 3 };
        GameState.state.collection.cardUseCounts = { t_card: 17 };
        GameState.state.areaStates.area_test = {
            assignedHeroId: 'hero_1',
            deckSlots: [{ templateId: 't_card', slotType: 'regular', progress: 0, status: 'idle' }],
            activeCardIndex: 0,
            executionTimer: 0,
            onPlaymat: true,
            status: 'paused',
            completedQuestIds: [],
            unlockQuestProgress: {}
        };
        // Outpost banners are their own top-level slice now (D-16) — a save
        // that lost them would drop the player's installed stations.
        GameState.state.outposts = [{
            id: 'outpost_1', onPlaymat: true, assignedHeroId: 'hero_1',
            activeStationCardId: 'station_wood_kiln', selectedRecipeId: 'recipe_flour',
            progress: 0, productionMode: 'infinite', productionLimit: 0,
            producedCount: 9, status: 'crafting'
        }];
        GameState.state.playmatOrder = ['outpost_1', 'area_test'];

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        const migrated = migrateState(revived.state, revived.version);

        expect(migrated.currency.gold).toBe(1234);
        expect(migrated.collection.playsets).toEqual({ t_card: 3 });
        expect(migrated.collection.cardUseCounts).toEqual({ t_card: 17 });
        expect(migrated.areaStates.area_test.deckSlots[0].templateId).toBe('t_card');
        expect(migrated.areaStates.area_test.assignedHeroId).toBe('hero_1');
        expect(migrated.areaStates.area_test.onPlaymat).toBe(true);

        // The Outpost survives whole — card, recipe and tally.
        expect(migrated.outposts).toHaveLength(1);
        expect(migrated.outposts[0].activeStationCardId).toBe('station_wood_kiln');
        expect(migrated.outposts[0].selectedRecipeId).toBe('recipe_flour');
        expect(migrated.outposts[0].producedCount).toBe(9);
        expect(migrated.playmatOrder).toEqual(['outpost_1', 'area_test']);
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
        expect(migrated.collection.playsets).toEqual({});
    });

    it('tolerates retired Projects fields left in older saves (CR-038)', () => {
        const data = GameState.serialize();
        data.state.progress.projects = { old_project: { level: 2 } };
        data.state.progress.completedProjects = [{ tier: 1 }];
        const migrated = migrateState(data.state, GAME_VERSION);
        expect(migrated.progress.rosterLimit).toBe(5);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).valid).toBe(true);
    });
});

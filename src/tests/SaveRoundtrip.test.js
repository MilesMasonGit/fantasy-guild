import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { migrateState, IncompatibleSaveError } from '../systems/core/SaveMigration.js';
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

        // An unlimited-use Token stores null charges (D-176) and must not come
        // back as 0, which would read as depleted.
        expect(migrated.board.tokens.tok_b.usesRemaining).toBeNull();
        // (It also round-tripped the Token Vault and the Tray, which went in
        // Token Lifecycle 9.3 — see the old-save suite below.)
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
        expect(migrated.progress.rosterLimit).toBe(0);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).valid).toBe(true);
    });
});

/**
 * ⭐ Token Lifecycle 9.3: the Token Vault and the dormant Tray are retired. A
 * save written before that still loads; their fields, its Token loot on the
 * floor and its ranks in the two Vault upgrade tracks are dropped. Item loot,
 * the Tokens on the mat and every other upgrade rank are kept.
 */
describe('A save from before the Vault went still loads (Token Lifecycle 9.3)', () => {
    /** The pre-9.3 shape, built by hand the way such a save sits in storage. */
    function oldSave() {
        GameState.initNew();
        const data = JSON.parse(JSON.stringify(GameState.serialize()));
        const board = data.state.board;
        board.tokens = {
            tok_a: { id: 'tok_a', typeId: 'token_oak_forest', x: 400, y: 300, placedAt: 0, usesRemaining: 10, cycleElapsedMs: 0 }
        };
        board.tokenBank = { token_copper_pickaxe: [{ usesRemaining: 20 }, { usesRemaining: 7 }] };
        board.tray = [{ typeId: 'token_coast', usesRemaining: 12, x: 0.5, y: 0.5, z: 3 }];
        board.nextTrayZ = 3;
        board.tokenBankSlots = 96;
        board.tokenTabsUnlocked = 2;
        board.tokenGroups = { groupOrder: ['vault-tab-1'], groupDefs: {}, overrides: {} };
        board.sprites = [
            { id: 's1', kind: 'item', refId: 'item_oak_wood', quantity: 3, x: 10, y: 10, bornAt: 0 },
            { id: 's2', kind: 'token', refId: 'token_copper_woodaxe', quantity: 1, x: 20, y: 20, usesRemaining: 20, bornAt: 0 }
        ];
        data.state.progress.guildUpgrades = { roster_size: 2, token_bank_slots: 1, token_bank_tabs: 1, bank_slots: 1 };
        return data;
    }

    it('migrates without complaint and passes the validator', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).errors).toEqual([]);
    });

    it('drops every Vault and Tray field from the board', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        for (const field of ['tokenBank', 'tray', 'nextTrayZ', 'tokenBankSlots', 'tokenTabsUnlocked', 'tokenGroups']) {
            expect(migrated.board).not.toHaveProperty(field);
        }
    });

    it('drops Token loot from the floor and keeps item loot', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        expect(migrated.board.sprites.map(s => s.id)).toEqual(['s1']);
    });

    it('keeps the Tokens on the mat exactly as they were', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        expect(migrated.board.tokens.tok_a).toEqual(data.state.board.tokens.tok_a);
    });

    it('drops the two Vault upgrade ranks and keeps the rest', () => {
        const data = oldSave();
        const migrated = migrateState(data.state, data.version);
        expect(migrated.progress.guildUpgrades).toEqual({ roster_size: 2, bank_slots: 1 });
    });

    it('does not mutate the save handed to it', () => {
        const data = oldSave();
        const before = JSON.stringify(data.state);
        migrateState(data.state, data.version);
        expect(JSON.stringify(data.state)).toBe(before);
    });

    it('loads into a live game', async () => {
        const data = oldSave();
        await GameState.initFromSave(migrateState(data.state, data.version));
        expect(GameState.state.board.tokens.tok_a.typeId).toBe('token_oak_forest');
        expect(GameState.state.board.tokenBank).toBeUndefined();
        expect(GameState.state.board.tray).toBeUndefined();
    });
});

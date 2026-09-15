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
        GameState.state.currency.gold = 1234;
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
        GameState.state.board.tokenBank = { token_forest: [{ usesRemaining: 5000 }] };
        GameState.state.board.tray = [{ typeId: 'token_bear', usesRemaining: 12 }];

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        const migrated = migrateState(revived.state, revived.version);

        expect(migrated.currency.gold).toBe(1234);
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

        expect(migrated.board.tokenBank.token_forest[0].usesRemaining).toBe(5000);
        expect(migrated.board.tray[0].typeId).toBe('token_bear');
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

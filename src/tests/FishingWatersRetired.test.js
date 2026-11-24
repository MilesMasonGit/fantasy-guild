// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION, INITIAL_STATE } from '../state/StateSchema.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Flags from '../systems/board/Flags.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { DatabaseManager } from '../config/DatabaseManager.js';
import { getTokenType, getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { RETIRED_WATER_TOKENS } from '../config/registries/fishingSpots.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ The fixed waters retire (brief 850 F1, plan points 8 and 16): water is ground and fish come
 * from spots that come and go, so the Coast, River, Lake and Bog Pool Tokens are gone from the
 * game, whatever `data/` still holds until the content pack deletes them. Nothing places one (a new
 * game, a settled place, the QA panel all read the registry), and an older save loads without
 * them, quietly, on every board: a hero ordered onto one is left idle where it stood, as for any
 * Token that leaves.
 */

const SLOT = 0;
const slotKey = () => SaveManager.getSlotKey(SLOT);
const OLD_WATERS = ['token_coast', 'token_river', 'token_lake', 'token_bog_pool'];

const oldWater = (id, typeId, x, y) => ({ id, typeId, x, y, placedAt: 5, usesRemaining: null, cycleElapsedMs: 3000, origin: 'placed' });
const watersIn = (board) => Object.values(board?.tokens || {}).filter(t => OLD_WATERS.includes(t?.typeId));

beforeEach(() => localStorage.clear());

afterEach(() => {
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    localStorage.clear();
});

describe('⭐ the fixed waters are gone from the game', () => {
    it('the list is the Coast, River, Lake and Bog Pool', () => {
        expect([...RETIRED_WATER_TOKENS]).toEqual(OLD_WATERS);
    });

    it('none is a Token type, though the shipped data may still hold them', () => {
        const shipped = Object.values(DatabaseManager.tokenFilesSingle || {}).flatMap(m => Object.keys(m.default || m));
        for (const id of OLD_WATERS) {
            expect(getTokenType(id), id).toBeNull();
            expect(Object.keys(getAllTokenTypes())).not.toContain(id);
        }
        // Proof the registry is doing the dropping, while the content pack has not landed yet.
        if (shipped.includes('token_coast')) expect(getTokenType('token_coast')).toBeNull();
    });

    it('a new game\'s Starter Camp opens without them', () => {
        SaveManager.newGame(SLOT);
        expect(watersIn(GameState.state.board)).toEqual([]);
        const laid = StarterCamp.placementsOf().map(p => p.typeId).filter(id => OLD_WATERS.includes(id));
        // Whatever the camp's file still names, none stands on the mat.
        expect(BoardState.tokens().filter(t => laid.includes(t.typeId))).toEqual([]);
    });
});

describe('⭐ an older save holding them', () => {
    it('every board loses them and nothing else, the save handed in left as it was', () => {
        const old = structuredClone(INITIAL_STATE);
        old.board.tokens.coast = oldWater('coast', 'token_coast', 900, 300);
        old.board.tokens.tree = { id: 'tree', typeId: 'token_oak_tree', x: 300, y: 300, placedAt: 1 };
        old.atlas = {
            ...old.atlas,
            regions: {
                r_away: { id: 'r_away', board: { tokens: {
                    river: oldWater('river', 'token_river', 800, 500),
                    lake: oldWater('lake', 'token_lake', 600, 500),
                    bog: oldWater('bog', 'token_bog_pool', 400, 500),
                    rock: { id: 'rock', typeId: 'token_copper_ore_vein', x: 200, y: 200, placedAt: 2 }
                } } }
            }
        };

        const migrated = migrateState(old, GAME_VERSION);
        expect(Object.keys(migrated.board.tokens)).toEqual(['tree']);
        expect(Object.keys(migrated.atlas.regions.r_away.board.tokens)).toEqual(['rock']);
        expect(Object.keys(old.board.tokens)).toEqual(['coast', 'tree']);
    });

    it('loads from its slot without them; a hero ordered onto one is left idle where it stood', async () => {
        SaveManager.newGame(SLOT);
        const tree = placeAt('fixture_producer', 700, 400);
        const fisher = generateHero({ name: 'Fisher' });
        GameState.state.heroes.push(fisher);
        SaveManager.save(false);

        const data = JSON.parse(localStorage.getItem(slotKey()));
        const s = data.state;
        s.board.tokens.old_coast = oldWater('old_coast', 'token_coast', 1300, 300);
        const heroId = fisher.id;
        s.board.flags[heroId] = { x: 1300, y: 300, pinnedTo: 'old_coast', plantedAt: 1 };
        localStorage.setItem(slotKey(), JSON.stringify(data));

        expect(await SaveManager.loadSlot(SLOT, { catchUp: false })).toBe(true);
        expect(watersIn(GameState.state.board)).toEqual([]);
        expect(GameState.state.board.tokens[tree.id]).toBeTruthy();

        Flags.init();
        BoardRunner.tick(100);
        const flag = BoardState.flagOf(heroId);
        expect(flag.pinnedTo).toBeUndefined();
        expect(flag.needsJob).toBe(true);
        expect({ x: flag.x, y: flag.y }).toEqual({ x: 1300, y: 300 });
        Flags.teardown();
    });
});

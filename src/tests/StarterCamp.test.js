import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import {
    authoredStarterCamp, setStarterCampForTests, resetStarterCampForTests
} from '../config/registries/starterCampRegistry.js';
import { normaliseStarterCamp, isEmptyStarterCamp, emptyStarterCamp } from '../config/starterCampShape.js';
import { resetMatTuning } from '../config/matTuning.js';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The Starter Camp as content: one shape (`starterCampShape.js`) for the file the CMS writes, the
 * loader, and the dev button that saves the live mat; and the boot audit over it.
 */

registerTokenTypes({
    fixture_sc_site: {
        id: 'fixture_sc_site', name: 'Fixture Camp Site', tokenType: 'resource', landmark: true,
        rarity: 'common', theme: 'fixture', uses: null, size: 1, sprite: 'skill_nature'
    }
});

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

const at = (t) => ({ typeId: t.typeId, x: t.x, y: t.y });

beforeEach(() => {
    resetMatTuning();
});

afterEach(() => {
    resetStarterCampForTests();
});

describe('the Starter Camp file\'s shape', () => {
    it('keeps Tokens with a type and a point, rounded, and whole Bank counts above zero', () => {
        const camp = normaliseStarterCamp({
            savedAt: 'then', mat: { w: 1760, h: 1126 }, hall: { x: 880.4, y: 563.6 },
            tokens: [
                { typeId: 'token_a', x: 100.6, y: 200.2 },
                { typeId: '', x: 1, y: 1 },
                { typeId: 'token_b', x: 'left', y: 3 },
                null,
                { typeId: 'token_quest', x: 5, y: 5 }
            ],
            bank: { item_a: 3, item_b: 0, item_c: -2, item_d: 'many', item_e: 2.9 }
        });
        expect(camp).toEqual({
            version: 1, savedAt: 'then', mat: { w: 1760, h: 1126 }, hall: { x: 880, y: 564 },
            tokens: [{ typeId: 'token_a', x: 101, y: 200 }],
            bank: { item_a: 3, item_e: 2 }
        });
    });

    it('a Guild Hall listed among the Tokens becomes the Hall', () => {
        const camp = normaliseStarterCamp({ tokens: [{ typeId: 'token_guild_hall', x: 10, y: 20 }] });
        expect(camp.hall).toEqual({ x: 10, y: 20 });
        expect(camp.tokens).toEqual([]);
    });

    it('anything that is not a camp reads as none', () => {
        expect(normaliseStarterCamp(null)).toBeNull();
        expect(normaliseStarterCamp([])).toBeNull();
        expect(normaliseStarterCamp('camp')).toBeNull();
    });

    it('empty means no Tokens and an empty Bank, whatever the Hall', () => {
        expect(isEmptyStarterCamp(emptyStarterCamp())).toBe(true);
        expect(isEmptyStarterCamp(normaliseStarterCamp({ hall: { x: 1, y: 1 } }))).toBe(true);
        expect(isEmptyStarterCamp(normaliseStarterCamp({ bank: { item_a: 1 } }))).toBe(false);
        expect(isEmptyStarterCamp(null)).toBe(true);
    });
});

describe('the loader', () => {
    it('reads the authored camp through the test seam, and an empty one as none', () => {
        setStarterCampForTests({ tokens: [{ typeId: 'fixture_producer', x: 1, y: 2 }] });
        expect(authoredStarterCamp().tokens).toEqual([{ typeId: 'fixture_producer', x: 1, y: 2 }]);
        setStarterCampForTests({ tokens: [], bank: {} });
        expect(authoredStarterCamp()).toBeNull();
        expect(StarterCamp.isBuiltIn()).toBe(true);
    });
});

describe('the dev button saves the live mat in the shape the loader reads', () => {
    function layOut() {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        placeAt('token_guild_hall', 900, 500);
        placeAt('fixture_sc_site', 200, 200);
        placeAt('fixture_producer', 640.4, 700.6);
        // Spawned Tokens come from the camp's own spawners, so they are not saved.
        const sapling = BoardState.createTokenInstance('fixture_producer', null, null, BoardState.ORIGIN.SPAWNED);
        BoardState.addToken(sapling, 1100, 700);
        // Quest Tokens are the tutorial's, never the camp's.
        const quest = BoardState.createTokenInstance('token_quest');
        quest.quest = { id: 'q_fixture', tutorial: true };
        BoardState.addToken(quest, 1000, 300);
        InventoryManager.addItem('fixture_oak_wood', 12);
        InventoryManager.addItem('fixture_charcoal', 1);
    }

    it('saves the Hall, the placed Tokens and the Bank, and says what it left out', () => {
        layOut();
        const { camp, skipped } = StarterCamp.campFromLiveMat({ savedAt: '2026-10-09T14:02:00.000Z' });
        expect(camp).toEqual({
            version: 1,
            savedAt: '2026-10-09T14:02:00.000Z',
            mat: { w: 1760, h: 1126 },
            hall: { x: 900, y: 500 },
            tokens: [
                { typeId: 'fixture_sc_site', x: 200, y: 200 },
                { typeId: 'fixture_producer', x: 640, y: 701 }
            ],
            bank: { fixture_oak_wood: 12, fixture_charcoal: 1 }
        });
        expect(skipped).toEqual({ spawned: 1, quests: 1 });
    });

    it('a new game from that save, through a JSON file, stands exactly as it was saved', () => {
        layOut();
        const { camp } = StarterCamp.campFromLiveMat({ savedAt: 'then' });
        setStarterCampForTests(JSON.parse(JSON.stringify(camp)));
        newGame();
        expect(BoardState.tokens().map(at)).toEqual([
            { typeId: 'token_guild_hall', x: 900, y: 500 },
            { typeId: 'fixture_sc_site', x: 200, y: 200 },
            { typeId: 'fixture_producer', x: 640, y: 701 }
        ]);
        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(12);
        expect(InventoryManager.getItemCount('fixture_charcoal')).toBe(1);
        // Saving that new game again writes the same camp.
        expect(StarterCamp.campFromLiveMat({ savedAt: 'then' }).camp).toEqual(camp);
    });
});

describe('the boot audit reads the Starter Camp', () => {
    const where = 'The Starter Camp';
    const campFindings = (camp) => auditContent({ starterCamp: normaliseStarterCamp(camp) })
        .filter(f => f.where === where);

    it('names a Token or Bank item that does not exist', () => {
        const found = campFindings({
            mat: { w: 1760, h: 1126 },
            tokens: [{ typeId: 'token_ghost', x: 300, y: 300 }, { typeId: 'fixture_producer', x: 500, y: 300 }],
            bank: { item_ghost: 2, fixture_oak_wood: 1 }
        });
        expect(found.map(f => f.what)).toEqual([
            expect.stringContaining('"token_ghost"'),
            expect.stringContaining('"item_ghost"')
        ]);
    });

    it('names a Token that cannot be placed: a second of a Mythic, one off its mat', () => {
        const found = campFindings({
            mat: { w: 1760, h: 1126 },
            tokens: [
                { typeId: 'fixture_mythic', x: 300, y: 300 },
                { typeId: 'fixture_mythic', x: 600, y: 300 },
                { typeId: 'fixture_producer', x: 1900, y: 300 }
            ]
        }).map(f => f.what);
        expect(found).toHaveLength(2);
        expect(found[0]).toContain('only one Fixture Mythic');
        expect(found[1]).toContain('off the mat');
    });

    it('says nothing about the camp the game actually opens on', () => {
        expect(auditContent({ starterCamp: StarterCamp.starterCamp() }).filter(f => f.where === where)).toEqual([]);
    });
});

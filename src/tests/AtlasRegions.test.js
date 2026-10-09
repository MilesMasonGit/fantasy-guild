import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION, INITIAL_STATE, validateSaveData } from '../state/StateSchema.js';
import { migrateState, IncompatibleSaveError } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatCap from '../systems/board/MatCap.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { REGION_KIND } from '../systems/atlas/Atlas.js';
import * as Names from '../systems/atlas/regionNames.js';
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
 * ⭐ The Atlas's Regions: a new game's first Region holds the live board; every
 * other Region is a record in `state.atlas` with its own frozen board.
 */

registerTokenTypes({
    fixture_atlas_site: {
        id: 'fixture_atlas_site', name: 'Fixture Site', tokenType: 'resource', landmark: true,
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature'
    }
});

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

/** A Region written from two items the test describes itself. */
const describeAs = (table) => (itemId) => table[itemId];

let draws;
beforeEach(() => {
    draws = 0;
    const real = Math.random;
    vi.spyOn(Math, 'random').mockImplementation(() => { draws++; return real(); });
    newGame();
    draws = 0;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('a new game has one Region, holding the live board', () => {
    it('the opening mat is the active Region, the Starter Camp, and its board is the live one', () => {
        const regions = Atlas.list();
        expect(regions).toHaveLength(1);
        const [starter] = regions;
        expect(starter.active).toBe(true);
        expect(starter.kind).toBe(REGION_KIND.STARTER);
        expect(starter.practicalName).toBe(Names.TEXT.STARTER_CAMP);
        expect(Atlas.activeRegionId()).toBe(starter.id);
        // The live board is `state.board`; the record holds no copy of it.
        expect(Atlas.getRegion(starter.id).board).toBeNull();
        expect(BoardState.tokens().map(t => t.typeId)).toContain('token_guild_hall');
        // The Region's own Tokens: the Hall belongs to the guild, so it is not one of them.
        expect(starter.tokens).toBe(BoardState.tokens().length - 1);
    });

    it('the engine exposes the Atlas to the console (Game.Atlas)', () => {
        expect(EngineBootstrap.getEngine().Atlas).toBe(Atlas);
        expect(typeof Atlas.devCreateEmptyRegion).toBe('function');
    });

    it('a board with no Region yet (a hand-built one) becomes the Starter Camp the first time the Atlas is used', () => {
        GameState.initNew();
        placeAt('fixture_producer', 400, 400);
        expect(GameState.state.atlas.activeRegionId).toBeNull();
        // Reading changes nothing.
        expect(Atlas.list()).toEqual([]);
        expect(Atlas.activeRegionId()).toBeNull();
        const away = Atlas.devCreateEmptyRegion().id;
        const [starter, other] = Atlas.list();
        expect(starter).toMatchObject({ kind: REGION_KIND.STARTER, active: true, tokens: 1 });
        expect(other.id).toBe(away);
    });

    it('the Atlas section is declared, and required of a save', () => {
        expect(INITIAL_STATE.atlas).toEqual({ activeRegionId: null, nextRegionNumber: 1, regions: {} });
        const state = GameState.serialize().state;
        delete state.atlas;
        expect(validateSaveData({ version: GAME_VERSION, state }).errors).toContain('Missing state.atlas');
    });
});

describe('the save schema moved: a save from before the Atlas is refused', () => {
    it('the schema is 0.8.1', () => {
        expect(GAME_VERSION).toBe('0.8.1');
    });

    it('a 0.8.0 save is refused, not migrated', () => {
        const data = GameState.serialize();
        data.version = '0.8.0';
        delete data.state.atlas;
        expect(() => migrateState(data.state, data.version)).toThrow(IncompatibleSaveError);
    });
});

describe('names: practical from the ingredients, flavour renamable', () => {
    it('the practical name puts the modifiers before the base maps, each word once', () => {
        expect(Names.practicalName([{ word: 'Forest' }])).toBe('Forest');
        expect(Names.practicalName([{ word: 'Forest' }, { word: 'Overgrown', modifier: true }])).toBe('Overgrown Forest');
        expect(Names.practicalName([
            { word: 'Forest' }, { word: 'Mountain' }, { word: 'Granite', modifier: true }, { word: 'Forest' }
        ])).toBe('Granite Forest and Mountain');
        expect(Names.practicalName([{ word: 'Forest' }, { word: 'Mountain' }, { word: 'Coast' }]))
            .toBe('Forest, Mountain and Coast');
        expect(Names.practicalName([{ word: 'Overgrown', modifier: true }])).toBe(`Overgrown ${Names.TEXT.LAND}`);
        expect(Names.practicalName([])).toBe(Names.TEXT.BLANK_REGION);
    });

    it('a Region written from ingredients is named from them, and keeps that name', () => {
        const describe = describeAs({
            item_map_forest: { word: 'Forest' },
            item_mod_overgrown: { word: 'Overgrown', modifier: true }
        });
        const { success, region } = Atlas.createRegion({
            ingredients: ['item_map_forest', 'item_mod_overgrown'], describe, seed: 42
        });
        expect(success).toBe(true);
        expect(region.practicalName).toBe('Overgrown Forest');
        expect(region.ingredients).toEqual(['item_map_forest', 'item_mod_overgrown']);
        expect(region.kind).toBe(REGION_KIND.SETTLED);
        expect(region.seed).toBe(42);
        // Renaming changes the flavour name only.
        expect(Atlas.rename(region.id, 'Home Wood').success).toBe(true);
        expect(Atlas.getRegion(region.id).practicalName).toBe('Overgrown Forest');
        expect(Atlas.getRegion(region.id).flavourName).toBe('Home Wood');
    });

    it('the flavour name is generated from the seed: the same seed, the same name', () => {
        expect(Names.flavourName(7)).toBe(Names.flavourName(7));
        const many = new Set(Array.from({ length: 40 }, (_, i) => Names.flavourName(i + 1)));
        expect(many.size).toBeGreaterThan(10);
        for (const name of many) expect(name.length).toBeLessThanOrEqual(Names.FLAVOUR_NAME_MAX);
    });

    it('rename trims, refuses an empty name and cuts a long one to the limit', () => {
        const id = Atlas.devCreateEmptyRegion().id;
        expect(Atlas.rename(id, '   ').success).toBe(false);
        expect(Atlas.rename(id, '  Copperbrook  ')).toMatchObject({ success: true, name: 'Copperbrook' });
        const long = 'x'.repeat(Names.FLAVOUR_NAME_MAX + 10);
        expect(Atlas.rename(id, long).name).toHaveLength(Names.FLAVOUR_NAME_MAX);
        expect(Atlas.rename('region_nope', 'A').success).toBe(false);
    });
});

describe('archive hides and restores', () => {
    it('an archived Region leaves the list and comes back when restored', () => {
        const id = Atlas.devCreateEmptyRegion().id;
        expect(Atlas.archive(id).success).toBe(true);
        expect(Atlas.list().map(r => r.id)).not.toContain(id);
        expect(Atlas.list({ archived: true }).map(r => r.id)).toEqual([id]);
        expect(Atlas.restore(id).success).toBe(true);
        expect(Atlas.list().map(r => r.id)).toContain(id);
        expect(Atlas.list({ archived: true })).toEqual([]);
    });

    it('the Region the guild is in cannot be archived, and an archived one cannot be travelled to', () => {
        expect(Atlas.archive(Atlas.activeRegionId())).toMatchObject({ success: false, reason: Names.TEXT.REFUSE_ACTIVE });
        const id = Atlas.devCreateEmptyRegion().id;
        Atlas.archive(id);
        expect(Atlas.travel(id)).toMatchObject({ success: false, reason: Names.TEXT.REFUSE_ARCHIVED });
    });
});

describe('abandon deletes for good', () => {
    it('removes the Region and everything on its board; its id is never handed out again', () => {
        const first = Atlas.devCreateEmptyRegion().id;
        expect(Atlas.abandon(first).success).toBe(true);
        expect(Atlas.getRegion(first)).toBeNull();
        expect(Atlas.list().map(r => r.id)).not.toContain(first);
        const next = Atlas.devCreateEmptyRegion().id;
        expect(next).not.toBe(first);
    });

    it('refuses the Region the guild is in, and the Starter Camp even when the guild is away', () => {
        const starter = Atlas.activeRegionId();
        expect(Atlas.abandon(starter)).toMatchObject({ success: false, reason: Names.TEXT.REFUSE_ACTIVE });
        const away = Atlas.devCreateEmptyRegion().id;
        Atlas.travel(away);
        expect(Atlas.abandon(starter)).toMatchObject({ success: false, reason: Names.TEXT.REFUSE_STARTER });
        expect(Atlas.abandon(away)).toMatchObject({ success: false, reason: Names.TEXT.REFUSE_ACTIVE });
        expect(Atlas.getRegion(starter)).not.toBeNull();
    });

    it('an archived Region can be abandoned', () => {
        const id = Atlas.devCreateEmptyRegion().id;
        Atlas.archive(id);
        expect(Atlas.abandon(id).success).toBe(true);
        expect(Atlas.list({ archived: true })).toEqual([]);
    });
});

describe('the Atlas announces its changes and never touches the random stream', () => {
    it('each change publishes ATLAS_CHANGED with what happened', () => {
        const seen = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, (p) => seen.push(p.reason));
        const id = Atlas.devCreateEmptyRegion().id;
        Atlas.rename(id, 'Fernmere');
        Atlas.archive(id);
        Atlas.restore(id);
        Atlas.travel(id);
        Atlas.travel(Atlas.list().find(r => r.kind === REGION_KIND.STARTER).id);
        Atlas.abandon(id);
        off();
        expect(seen).toEqual(['created', 'renamed', 'archived', 'restored', 'travelled', 'travelled', 'abandoned']);
    });

    it('creating, naming and travelling draw no random number', () => {
        const id = Atlas.devCreateEmptyRegion().id;
        Atlas.rename(id, 'Hazel Dell');
        Atlas.travel(id);
        Atlas.travel(Atlas.list()[0].id);
        Atlas.createRegion({ ingredients: ['item_oak_wood'] });
        expect(draws).toBe(0);
    });
});

describe('the Token cap: 128, and endgame sites stand outside it', () => {
    it('the base cap is 128', () => {
        expect(MatCap.BASE_TOKEN_CAP).toBe(128);
        expect(MatCap.matCap()).toBe(128);
    });

    it('a landmark Token does not count toward the cap', () => {
        const before = MatCap.tokenCount();
        const site = placeAt('fixture_atlas_site', 200, 200);
        expect(MatCap.isLandmark(site)).toBe(true);
        expect(MatCap.countsTowardCap(site)).toBe(false);
        expect(MatCap.tokenCount()).toBe(before);
        placeAt('fixture_producer', 400, 200);
        expect(MatCap.tokenCount()).toBe(before + 1);
    });
});

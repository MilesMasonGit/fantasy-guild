import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrateState } from '../systems/core/SaveMigration.js';
import { followRenames, activeRenames } from '../systems/core/followRenames.js';
import { followRename, normaliseRenames } from '../config/renameTable.js';
import { setRenamesForTests, resetRenamesForTests } from '../config/registries/renameRegistry.js';
import { createInitialState, GAME_VERSION } from '../state/StateSchema.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerEffects, getEffect } from '../config/registries/effectRegistry.js';

/**
 * A save follows the CMS's renames as it loads: every place an item, Token or effect id lives is
 * rewritten from the old id to the new one, when the old id is gone from the data and the new one
 * is there. Fixture content with test-only ids stands in for the renamed content, so these tests
 * never move with the shipped data.
 */

const OLD = { item: 'fixture_r2_oak_wood', token: 'fixture_r2_wolf', effect: 'fixture_r2_slow', den: 'fixture_r2_den' };
const NEW = { item: 'fixture_r2_oak_logs', token: 'fixture_r2_grey_wolf', effect: 'fixture_r2_haste', den: 'fixture_r2_wolf_den' };
const OTHER_ITEM = 'fixture_r2_copper';

registerItems({
    [NEW.item]: { id: NEW.item, name: 'R2 Oak Logs', type: 'material', stackable: true, tags: [] },
    [OTHER_ITEM]: { id: OTHER_ITEM, name: 'R2 Copper', type: 'material', stackable: true, tags: [] }
});
registerTokenTypes({
    [NEW.token]: { id: NEW.token, name: 'R2 Grey Wolf', tokenType: 'enemy', uses: null, enemy: { level: 1, style: 'melee' } },
    [NEW.den]: { id: NEW.den, name: 'R2 Wolf Den', tokenType: 'spawner', uses: null }
});
registerEffects({ [NEW.effect]: { id: NEW.effect, name: 'R2 Haste', statements: [] } });

const TABLE = {
    items: { [OLD.item]: NEW.item },
    tokens: { [OLD.token]: NEW.token, [OLD.den]: NEW.den },
    effects: { [OLD.effect]: NEW.effect }
};

/** A saved state holding the old ids in every place an id lives. */
function oldSave() {
    const state = createInitialState();
    state.inventory.items = {
        [OLD.item]: { itemId: OLD.item, quantity: 500, dur: null },
        [OTHER_ITEM]: { quantity: 3, dur: null }
    };
    state.inventory.groupOrder = ['default-loot', 'bank-tab-2'];
    state.inventory.groupDefs = {
        'default-loot': { title: 'Loot', id: 'default-loot', orderedItems: [OTHER_ITEM, OLD.item] },
        'bank-tab-2': { title: 'Tab 2', id: 'bank-tab-2', orderedItems: [] }
    };
    state.inventory.itemOverrides = { [OLD.item]: 'bank-tab-2' };
    state.heroes = [{
        id: 'hero_1', name: 'Brannor',
        equipment: [OLD.item, null, OTHER_ITEM, null, null, null, null, null, null],
        heldCopies: [true, false, false, false, false, false, false, false, false],
        drinkCycles: { [OLD.item]: 4 },
        elixirFights: { [OLD.item]: 2 },
        effects: [{ effectId: OLD.effect, scale: 1, sourceId: 'tok_1', forCycle: 'tok_1' }]
    }];
    state.board.tokens = {
        tok_1: { id: 'tok_1', typeId: OLD.token, x: 10, y: 10, placedAt: 0, usesRemaining: null, cycleElapsedMs: 0 },
        tok_2: {
            id: 'tok_2', typeId: NEW.den, x: 50, y: 50, placedAt: 1, usesRemaining: null, cycleElapsedMs: 0
        }
    };
    state.board.sprites = [
        { id: 'sprite_1', kind: 'item', refId: OLD.item, quantity: 7, x: 1, y: 2 },
        { id: 'sprite_2', kind: 'gold', refId: OLD.item, quantity: 1, x: 3, y: 4 }
    ];
    state.atlas.regions = {
        region_1: { id: 'region_1', kind: 'starter', board: null },
        region_2: {
            id: 'region_2', kind: 'settled', cellId: '1,0',
            board: {
                tokens: { tok_9: { id: 'tok_9', typeId: OLD.token, x: 5, y: 5, placedAt: 0 } },
                sprites: [{ id: 'sprite_9', kind: 'item', refId: OLD.item, quantity: 2 }]
            }
        }
    };
    state.world = {
        version: 3, seed: 1,
        cells: [
            {
                id: '1,-1', ring: 1,
                origins: [{ id: OLD.den, line: 'beasts', role: 'main' }],
                camps: [OLD.den],
                arrival: [{ typeId: OLD.token, count: 3 }],
                extreme: { kind: 'composition', focus: OLD.den },
                requires: { items: [{ itemId: OLD.item, qty: 40 }], skills: [{ skill: 'forestry', level: 5 }] }
            },
            { id: '2,0', ring: 2, origins: [], camps: [], arrival: [], extreme: { kind: 'layout', layout: OLD.den }, requires: null }
        ],
        problems: []
    };
    state.collection.discoveredItems = { [OLD.item]: true };
    state.collection.itemLifetimeCounts = { [OLD.item]: 900 };
    state.collection.discoveredEnemies = { [OLD.token]: true };
    state.collection.enemyKillCounts = { [OLD.token]: 12 };
    state.collection.cyclesByTokenType = { [OLD.den]: 3 };
    state.collection.tokensHad = { [OLD.den]: true };
    state.collection.tokensBuilt = { [OLD.den]: 1 };
    state.ui.pinnedStubs = [{ itemId: OLD.item, added: 5, removed: 1 }];
    return state;
}

beforeEach(() => setRenamesForTests(TABLE));
afterEach(() => resetRenamesForTests());

describe('the fixture means what it says', () => {
    it('the old ids are gone from the data and the new ones are there', () => {
        for (const id of [OLD.item]) expect(getItem(id)).toBeNull();
        for (const id of [OLD.token, OLD.den]) expect(getTokenType(id)).toBeNull();
        expect(getEffect(OLD.effect)).toBeNull();
        expect(getItem(NEW.item)).not.toBeNull();
        expect(getTokenType(NEW.token)).not.toBeNull();
        expect(getTokenType(NEW.den)).not.toBeNull();
        expect(getEffect(NEW.effect)).not.toBeNull();
    });
});

describe('a renamed id is followed everywhere a save holds it', () => {
    let s;
    beforeEach(() => { s = migrateState(oldSave(), GAME_VERSION); });

    it('the Bank: the stack, its tab order and the tab it is filed in', () => {
        expect(s.inventory.items[OLD.item]).toBeUndefined();
        expect(s.inventory.items[NEW.item]).toMatchObject({ itemId: NEW.item, quantity: 500 });
        expect(s.inventory.items[OTHER_ITEM].quantity).toBe(3);
        expect(s.inventory.groupDefs['default-loot'].orderedItems).toEqual([OTHER_ITEM, NEW.item]);
        expect(s.inventory.itemOverrides).toEqual({ [NEW.item]: 'bank-tab-2' });
    });

    it('a hero: the loadout, the drink and elixir counters and a live effect', () => {
        const hero = s.heroes[0];
        expect(hero.equipment[0]).toBe(NEW.item);
        expect(hero.equipment[2]).toBe(OTHER_ITEM);
        expect(hero.heldCopies[0]).toBe(true);
        expect(hero.drinkCycles).toEqual({ [NEW.item]: 4 });
        expect(hero.elixirFights).toEqual({ [NEW.item]: 2 });
        expect(hero.effects[0]).toMatchObject({ effectId: NEW.effect, forCycle: 'tok_1' });
    });

    it('the live mat: a Token\'s type', () => {
        const { tok_1 } = s.board.tokens;
        expect(tok_1.typeId).toBe(NEW.token);
    });

    it('loot on the floor, and only item loot', () => {
        expect(s.board.sprites[0]).toMatchObject({ kind: 'item', refId: NEW.item, quantity: 7 });
        expect(s.board.sprites[1].refId).toBe(OLD.item);
    });

    it('every other Region\'s mat: its Tokens and its loot', () => {
        const board = s.atlas.regions.region_2.board;
        expect(board.tokens.tok_9.typeId).toBe(NEW.token);
        expect(board.sprites[0].refId).toBe(NEW.item);
        expect(s.atlas.regions.region_1.board).toBeNull();
    });

    it('the world map\'s places: origins, camps, arrivals, a wild focus and the price', () => {
        const [cell, wild] = s.world.cells;
        expect(cell.origins[0]).toEqual({ id: NEW.den, line: 'beasts', role: 'main' });
        expect(cell.camps).toEqual([NEW.den]);
        expect(cell.arrival).toEqual([{ typeId: NEW.token, count: 3 }]);
        expect(cell.extreme.focus).toBe(NEW.den);
        expect(cell.requires.items).toEqual([{ itemId: NEW.item, qty: 40 }]);
        expect(cell.requires.skills).toEqual([{ skill: 'forestry', level: 5 }]);
        // A layout is not content: its name is left alone even when it looks like an id.
        expect(wild.extreme.layout).toBe(OLD.den);
    });

    it('the collection\'s discoveries and counts, and a pinned stub', () => {
        const c = s.collection;
        expect(c.discoveredItems).toEqual({ [NEW.item]: true });
        expect(c.itemLifetimeCounts).toEqual({ [NEW.item]: 900 });
        expect(c.discoveredEnemies).toEqual({ [NEW.token]: true });
        expect(c.enemyKillCounts).toEqual({ [NEW.token]: 12 });
        expect(c.cyclesByTokenType).toEqual({ [NEW.den]: 3 });
        expect(c.tokensHad).toEqual({ [NEW.den]: true });
        expect(c.tokensBuilt).toEqual({ [NEW.den]: 1 });
        expect(s.ui.pinnedStubs).toEqual([{ itemId: NEW.item, added: 5, removed: 1 }]);
    });

    it('leaves the save it was handed as it was', () => {
        const before = oldSave();
        const snapshot = JSON.stringify(before);
        migrateState(before, GAME_VERSION);
        expect(JSON.stringify(before)).toBe(snapshot);
    });

    it('a second load finds nothing left to follow', () => {
        const again = migrateState(structuredClone(s), GAME_VERSION);
        expect(again).toEqual(s);
    });
});

describe('where an old and a new id meet, the two are joined', () => {
    it('stacks and counts add up, a discovery stays found, a list keeps one entry', () => {
        const save = oldSave();
        // The guild played on under the new name before this load.
        save.inventory.items[NEW.item] = { itemId: NEW.item, quantity: 20, dur: null };
        save.inventory.groupDefs['default-loot'].orderedItems = [NEW.item, OTHER_ITEM, OLD.item];
        save.inventory.itemOverrides[NEW.item] = 'default-loot';
        save.collection.itemLifetimeCounts[NEW.item] = 20;
        save.collection.discoveredItems[NEW.item] = true;
        save.ui.pinnedStubs.push({ itemId: NEW.item, added: 2, removed: 0 });
        const s = migrateState(save, GAME_VERSION);
        expect(s.inventory.items[NEW.item].quantity).toBe(520);
        expect(s.inventory.items[OLD.item]).toBeUndefined();
        expect(s.inventory.groupDefs['default-loot'].orderedItems).toEqual([NEW.item, OTHER_ITEM]);
        // The tab the new name was filed in wins.
        expect(s.inventory.itemOverrides).toEqual({ [NEW.item]: 'default-loot' });
        expect(s.collection.itemLifetimeCounts).toEqual({ [NEW.item]: 920 });
        expect(s.collection.discoveredItems).toEqual({ [NEW.item]: true });
        expect(s.ui.pinnedStubs).toEqual([{ itemId: NEW.item, added: 7, removed: 1 }]);
    });
});

describe('what is never followed', () => {
    it('no table: the save comes back as the very same object', () => {
        setRenamesForTests({});
        const save = oldSave();
        expect(followRenames(save)).toBe(save);
        expect(activeRenames()).toBeNull();
    });

    it('an id the data still defines, even when the table names it (a name used again)', () => {
        setRenamesForTests({ items: { [OTHER_ITEM]: NEW.item } });
        const s = migrateState(oldSave(), GAME_VERSION);
        expect(s.inventory.items[OTHER_ITEM].quantity).toBe(3);
        expect(s.heroes[0].equipment[2]).toBe(OTHER_ITEM);
    });

    it('a rename whose new id is gone too (deleted since) leaves the save as it was', () => {
        setRenamesForTests({ items: { [OLD.item]: 'fixture_r2_deleted_since' } });
        const s = migrateState(oldSave(), GAME_VERSION);
        expect(s.inventory.items[OLD.item].quantity).toBe(500);
        expect(s.heroes[0].equipment[0]).toBe(OLD.item);
    });

    it('an item id in a Token\'s place, or a Token id in an item\'s: each kind follows its own renames', () => {
        setRenamesForTests({ tokens: { [OLD.item]: NEW.token } });
        const s = migrateState(oldSave(), GAME_VERSION);
        expect(s.inventory.items[OLD.item].quantity).toBe(500);
    });
});

describe('chains and loops', () => {
    const defined = (ids) => (id) => ids.includes(id);

    it('a renamed twice is followed to the end', () => {
        const map = { a: 'b', b: 'c' };
        expect(followRename(map, 'a', defined(['c']))).toBe('c');
        expect(followRename(map, 'b', defined(['c']))).toBe('c');
    });

    it('stops at the first defined id on the way', () => {
        expect(followRename({ a: 'b', b: 'c' }, 'a', defined(['b', 'c']))).toBe('b');
    });

    it('a loop with nothing defined in it leads nowhere, and ends', () => {
        expect(followRename({ a: 'b', b: 'a' }, 'a', defined([]))).toBeNull();
        expect(followRename({ a: 'a' }, 'a', defined([]))).toBeNull();
        expect(followRename({ a: 'b', b: 'c', c: 'b' }, 'a', defined([]))).toBeNull();
    });

    it('a defined id, or one with no rename, is not followed', () => {
        expect(followRename({ a: 'b' }, 'a', defined(['a', 'b']))).toBeNull();
        expect(followRename({ a: 'b' }, 'z', defined(['b']))).toBeNull();
    });

    it('a chain in the table reaches the save', () => {
        setRenamesForTests({ items: { [OLD.item]: 'fixture_r2_middle', fixture_r2_middle: NEW.item } });
        const s = migrateState(oldSave(), GAME_VERSION);
        expect(s.inventory.items[NEW.item].quantity).toBe(500);
    });

    it('a table read from a file keeps only string renames, per kind', () => {
        expect(normaliseRenames({ items: { a: 'b', c: 7, d: '', e: 'e' }, tokens: null, other: { x: 'y' } }))
            .toEqual({ items: { a: 'b' }, tokens: {}, effects: {} });
        expect(normaliseRenames(null)).toEqual({ items: {}, tokens: {}, effects: {} });
    });
});

import { describe, it, expect } from 'vitest';
import { buildEncyclopedia, encyclopedia, KIND, entryKey } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { HOW, itemKey, tokenKey, recipeKey } from '../systems/progression/ledger/engine.js';
import { getAllItems } from '../config/registries/itemRegistry.js';
import { getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { listRecipes } from '../config/registries/recipePoolRegistry.js';
import { ledgerContent } from './fixtures/ledgerWorld.js';

describe('the encyclopedia over the shipped content', () => {
    const book = encyclopedia();

    it('lists every item, Token, enemy and recipe, each once, by kind', () => {
        const items = Object.keys(getAllItems());
        const tokens = Object.values(getAllTokenTypes());
        expect(book.byKind[KIND.ITEM].length).toBe(items.length);
        expect(book.byKind[KIND.ENEMY].length).toBe(tokens.filter(t => t.enemy).length);
        expect(book.byKind[KIND.TOKEN].length).toBe(tokens.filter(t => !t.enemy).length);
        expect(book.byKind[KIND.RECIPE].length).toBe(listRecipes().filter(r => r.id).length);
    });

    it('finds Iron Ore, Iron Ingot and the Iron Smithy for "iron"', () => {
        const ids = book.search('iron').map(e => e.id);
        expect(ids).toEqual(expect.arrayContaining(['item_iron_ore', 'item_iron_ingot', 'token_iron_smithy']));
        expect(book.search('iron').every(e => /\biron/i.test(e.name))).toBe(true);
    });

    it('traces Iron Ingot to Iron Ore and Coal, and Iron Ore to its vein', () => {
        const smelt = book.sourcesOf(itemKey('item_iron_ingot')).find(s => s.how === HOW.CRAFT);
        expect(smelt.inputs.map(i => i.key).sort()).toEqual([itemKey('item_coal'), itemKey('item_iron_ore')]);
        const ore = book.sourcesOf(itemKey('item_iron_ore'));
        expect(ore).toContainEqual(expect.objectContaining({ how: HOW.WORK, via: tokenKey('token_iron_ore_vein') }));
        // Iron Ore is spent by the ingot's recipe.
        expect(book.usesOf(itemKey('item_iron_ore')).some(u => u.how === HOW.CRAFT && book.kindOfKey(u.by) === KIND.RECIPE)).toBe(true);
    });

    it('names no tier, plan or note anywhere it hands the screen', () => {
        const ore = book.sourcesOf(itemKey('item_iron_ore'))[0];
        expect(Object.keys(ore)).not.toContain('tier');
        expect(book.entryOf(itemKey('item_iron_ore'))).not.toHaveProperty('tier');
    });
});

describe('sources, uses and gives (fixture world)', () => {
    const book = buildEncyclopedia(ledgerContent());

    it('files a recipe under where it is made, and its inputs under what spends them', () => {
        const ingot = book.sourcesOf(itemKey('item_iron_ingot'));
        expect(ingot.some(s => s.how === HOW.CRAFT && s.via === recipeKey('recipe_iron_ingot'))).toBe(true);
        const recipe = book.sourcesOf(recipeKey('recipe_iron_ingot'));
        expect(recipe.some(s => s.how === HOW.STATION && book.nameOf(s.via) === 'Furnace')).toBe(true);
        expect(book.givesOf(recipeKey('recipe_iron_ingot')).map(g => g.key)).toContain(itemKey('item_iron_ingot'));
    });

    it('tells a tool what it is used for', () => {
        const uses = book.usesOf(itemKey('item_copper_pickaxe'));
        expect(uses.some(u => u.how === HOW.HOLD)).toBe(true);
    });

    it('leaves Planned stubs out entirely', () => {
        expect(book.entryOf(recipeKey('recipe_mythril_bar'))).toBeNull();
        expect(book.search('mythril')).toEqual([]);
    });

    it('keys entries by kind', () => {
        expect(entryKey(KIND.ENEMY, 'x')).toBe('token:x');
        expect(entryKey(KIND.RECIPE, 'x')).toBe('recipe:x');
    });
});

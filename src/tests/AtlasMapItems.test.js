import { describe as group, it, expect } from 'vitest';
import { ITEM_TYPES } from '../config/registries/itemRegistry.js';
import {
    MAP_ITEM_TYPES, MODIFIER_EFFECT_KINDS, isMapItem, isBaseMap, isModifier,
    recipeOf, tokenRefsOf, mapItemFindings, whatItWrites, upcycleOf, bountyWeightOf,
    blankCartography, MAP_TEXT
} from '../systems/atlas/mapItems.js';
import { budget, describe as describeBudget } from '../systems/atlas/Budget.js';
import { FOREST, MOUNTAIN, OVERGROWN, FIR_GROVE, GOBLIN_CAMP, RUINS } from './fixtures/atlasMaps.js';

/**
 * Maps and Modifiers are items: a `map` or `modifier` item carries a Cartography block, and
 * `recipeOf` turns it into the generation engine's recipe (the shape in `Budget.js`'s header).
 */

const CAP = 128;
const NAMES = {
    token_oak_tree: 'Oak Tree', token_fir_tree: 'Fir Tree', token_redberry_bush: 'Redberry Bush',
    token_blackberry_bush: 'Blackberry Bush', token_goblin_camp: 'Goblin Camp', token_ruins: 'Ruins',
    token_copper_ore_vein: 'Copper Ore Vein', token_coal_vein: 'Coal Vein', token_stone_outcrop: 'Stone Outcrop'
};
const nameOf = (id) => NAMES[id] || id;
const tokenExists = (id) => id in NAMES;

/** The authored item a recipe fixture stands for: the fixture's fields, kept in a Cartography block. */
function baseItem(recipe, extra = {}) {
    const { id, kind: _kind, ...cartography } = recipe;
    return { id, name: id, type: 'map', sprite: id, stackable: true, cartography: structuredClone(cartography), ...extra };
}
function modifierItem(recipe, extra = {}) {
    return { id: recipe.id, name: recipe.id, type: 'modifier', stackable: true, cartography: { effects: structuredClone(recipe.effects) }, ...extra };
}

group('map item types', () => {
    it('the item types include map and modifier', () => {
        expect(ITEM_TYPES.MAP).toBe('map');
        expect(ITEM_TYPES.MODIFIER).toBe('modifier');
        expect([...MAP_ITEM_TYPES].sort()).toEqual(['map', 'modifier']);
    });

    it('tells a map item from any other item', () => {
        expect(isMapItem(baseItem(FOREST))).toBe(true);
        expect(isMapItem(modifierItem(OVERGROWN))).toBe(true);
        expect(isBaseMap(baseItem(FOREST))).toBe(true);
        expect(isModifier(baseItem(FOREST))).toBe(false);
        expect(isModifier(modifierItem(OVERGROWN))).toBe(true);
        for (const other of [{ type: 'material' }, { type: 'food' }, {}, null, undefined, 'map']) {
            expect(isMapItem(other)).toBe(false);
        }
    });
});

group('recipeOf: an authored map item → the engine recipe', () => {
    it('a Base Map gives the recipe its Cartography block describes', () => {
        expect(recipeOf(baseItem(FOREST))).toEqual(FOREST);
        expect(recipeOf(baseItem(MOUNTAIN))).toEqual(MOUNTAIN);
    });

    it('a Modifier gives its effects, one recipe per kind of effect', () => {
        for (const fixture of [OVERGROWN, FIR_GROVE, GOBLIN_CAMP, RUINS]) {
            expect(recipeOf(modifierItem(fixture))).toEqual(fixture);
        }
    });

    it('so the budget of authored items is the budget of the fixtures', () => {
        const authored = [baseItem(FOREST), modifierItem(OVERGROWN), modifierItem(GOBLIN_CAMP)].map(recipeOf);
        expect(budget(authored, { cap: CAP })).toEqual(budget([FOREST, OVERGROWN, GOBLIN_CAMP], { cap: CAP }));
    });

    it('carries camps, treasures and the ground when a Base Map names them', () => {
        const item = baseItem({
            id: 'map_coast_fixture', kind: 'base', biome: 'coast', points: 12,
            nodes: [{ typeId: 'token_coast', weight: 1 }],
            camps: [{ typeId: 'token_goblin_camp', count: 1 }],
            treasures: [{ typeId: 'token_ruins', count: 2 }],
            terrain: 'sand', water: 0.4
        });
        expect(recipeOf(item)).toEqual({
            id: 'map_coast_fixture', kind: 'base', biome: 'coast', points: 12,
            nodes: [{ typeId: 'token_coast', weight: 1 }],
            camps: [{ typeId: 'token_goblin_camp', count: 1 }],
            treasures: [{ typeId: 'token_ruins', count: 2 }],
            terrain: 'sand', water: 0.4
        });
    });

    it('leaves out what the CMS keeps for later (upcycling, bounties) and blank rows', () => {
        const item = baseItem(FOREST);
        item.cartography.upcycle = { itemId: 'map_mountain', ratio: 10 };
        item.cartography.bountyWeight = 3;
        item.cartography.nodes.push({ typeId: '', weight: 2 });
        item.cartography.camps = [];
        expect(recipeOf(item)).toEqual(FOREST);
    });

    it('is not a map: no recipe', () => {
        expect(recipeOf({ id: 'item_oak_wood', type: 'material' })).toBeNull();
        expect(recipeOf(null)).toBeNull();
    });

    it('never hands back the item\'s own objects', () => {
        const item = baseItem(FOREST);
        const recipe = recipeOf(item);
        recipe.nodes[0].weight = 999;
        recipe.nodes.push({ typeId: 'token_x', weight: 1 });
        expect(item.cartography.nodes).toEqual(FOREST.nodes);
    });

    it('survives a malformed block without throwing', () => {
        const junk = [
            { id: 'a', type: 'map' },
            { id: 'b', type: 'map', cartography: null },
            { id: 'c', type: 'map', cartography: { nodes: 'oak', camps: 7, points: 'lots' } },
            { id: 'd', type: 'modifier', cartography: { effects: [null, 3, { kind: 'density' }] } },
            { id: 'e', type: 'modifier' }
        ];
        for (const item of junk) {
            const recipe = recipeOf(item);
            expect(recipe.id).toBe(item.id);
            expect(() => budget([recipe], { cap: CAP })).not.toThrow();
        }
    });
});

group('the modifier kinds the CMS offers are the ones the engine reads', () => {
    it.each(Object.values(MODIFIER_EFFECT_KINDS))('%s is understood by the budget', (kind) => {
        const effect = { kind, typeId: 'token_oak_tree', from: 'token_oak_tree', to: 'token_fir_tree', points: 4, count: 1 };
        const summary = budget([FOREST, { id: 'mod_x', kind: 'modifier', effects: [effect] }], { cap: CAP });
        expect(summary.ignored).toEqual([]);
    });

    it('a blank Cartography block starts as the shape recipeOf reads', () => {
        expect(recipeOf({ id: 'map_blank', type: 'map', cartography: blankCartography('map') }))
            .toMatchObject({ id: 'map_blank', kind: 'base' });
        expect(recipeOf({ id: 'mod_blank', type: 'modifier', cartography: blankCartography('modifier') }))
            .toEqual({ id: 'mod_blank', kind: 'modifier', effects: [] });
    });
});

group('the Tokens a map names', () => {
    it('lists every Token reference with where it sits', () => {
        const refs = tokenRefsOf(baseItem({
            ...FOREST, camps: [{ typeId: 'token_goblin_camp', count: 1 }], treasures: [{ typeId: 'token_ruins', count: 1 }]
        }));
        expect(refs.map(r => r.typeId)).toEqual([
            'token_oak_tree', 'token_redberry_bush', 'token_blackberry_bush', 'token_goblin_camp', 'token_ruins'
        ]);
        const modRefs = tokenRefsOf(modifierItem({ id: 'mod_all', effects: [...OVERGROWN.effects, ...FIR_GROVE.effects, ...GOBLIN_CAMP.effects, ...RUINS.effects] }));
        expect(modRefs.map(r => r.typeId)).toEqual([
            'token_oak_tree', 'token_oak_tree', 'token_fir_tree', 'token_goblin_camp', 'token_ruins'
        ]);
        expect(new Set(modRefs.map(r => r.role)).size).toBe(5);
    });
});

group('what the content audit says about a map', () => {
    it('a well-made map says nothing', () => {
        expect(mapItemFindings(baseItem(FOREST), { tokenExists })).toEqual([]);
        expect(mapItemFindings(modifierItem(FIR_GROVE), { tokenExists })).toEqual([]);
    });

    it('names a Token that does not exist', () => {
        const item = baseItem({ ...FOREST, nodes: [...FOREST.nodes, { typeId: 'token_dragon_tree', weight: 1 }] });
        const findings = mapItemFindings(item, { tokenExists });
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatch(/token_dragon_tree/);
        expect(mapItemFindings(modifierItem({ id: 'mod_x', effects: [{ kind: 'replace', from: 'token_oak_tree', to: 'token_nope' }] }), { tokenExists })[0])
            .toMatch(/token_nope/);
    });

    it('a Base Map that writes no nodes', () => {
        for (const cartography of [undefined, { biome: 'forest', points: 0, nodes: FOREST.nodes }, { biome: 'forest', points: 40, nodes: [] }]) {
            const findings = mapItemFindings({ id: 'map_empty', type: 'map', cartography }, { tokenExists });
            expect(findings, JSON.stringify(cartography)).toEqual([MAP_TEXT.writesNoNodes]);
        }
        // Camps alone are something to write.
        expect(mapItemFindings({ id: 'map_camp', type: 'map', cartography: { points: 0, camps: [{ typeId: 'token_goblin_camp', count: 1 }] } }, { tokenExists }))
            .toEqual([]);
    });

    it('a Modifier that changes nothing, or has an effect the engine does not know', () => {
        expect(mapItemFindings({ id: 'mod_empty', type: 'modifier', cartography: { effects: [] } }, { tokenExists }))
            .toEqual([MAP_TEXT.changesNothing]);
        expect(mapItemFindings({ id: 'mod_half', type: 'modifier', cartography: { effects: [{ kind: 'density', typeId: '', points: 4 }] } }, { tokenExists }))
            .toEqual([MAP_TEXT.changesNothing]);
        const unknown = mapItemFindings({ id: 'mod_odd', type: 'modifier', cartography: { effects: [...OVERGROWN.effects, { kind: 'leyline' }] } }, { tokenExists });
        expect(unknown).toHaveLength(1);
        expect(unknown[0]).toMatch(/leyline/);
    });

    it('an upcycle that trades into something that is not a map', () => {
        const item = baseItem(FOREST);
        item.cartography.upcycle = { itemId: 'item_oak_wood', ratio: 10 };
        const itemOf = (id) => ({ map_mountain: baseItem(MOUNTAIN), item_oak_wood: { id, type: 'material' } }[id] || null);
        expect(mapItemFindings(item, { tokenExists, itemOf })[0]).toMatch(/item_oak_wood/);
        item.cartography.upcycle = { itemId: 'map_mountain', ratio: 10 };
        expect(mapItemFindings(item, { tokenExists, itemOf })).toEqual([]);
    });
});

group('what a map item writes, for inspection', () => {
    it('a Base Map says its node summary, from the budget', () => {
        const said = whatItWrites(baseItem(FOREST), { cap: CAP, nameOf });
        expect(said).toEqual(describeBudget(budget([FOREST], { cap: CAP }), { nameOf }));
        expect(said.headline).toBe('40 Tokens');
        expect(said.lines.map(l => l.text)).toEqual(['30 × Oak Tree', '5 × Blackberry Bush', '5 × Redberry Bush']);
    });

    it('a Base Map bigger than the cap allows says it is trimmed', () => {
        const said = whatItWrites(baseItem({ ...FOREST, points: 500 }), { cap: CAP, nameOf });
        expect(said.headline).toMatch(/trimmed from 500 to fit/);
    });

    it('a Modifier says each effect', () => {
        const all = modifierItem({ id: 'mod_all', effects: [...OVERGROWN.effects, ...FIR_GROVE.effects, ...GOBLIN_CAMP.effects, ...RUINS.effects] });
        const said = whatItWrites(all, { cap: CAP, nameOf });
        expect(said.headline).toBe(MAP_TEXT.modifierHeadline);
        expect(said.lines.map(l => l.text)).toEqual([
            '+16 × Oak Tree', 'Oak Tree → Fir Tree', '+1 × Goblin Camp (enemy camp)', '+1 × Ruins (treasure)'
        ]);
        const half = whatItWrites(modifierItem({ id: 'mod_half', effects: [{ kind: 'replace', from: 'token_oak_tree', to: 'token_fir_tree', share: 0.5 }] }), { cap: CAP, nameOf });
        expect(half.lines[0].text).toBe('50% of Oak Tree → Fir Tree');
    });

    it('is not a map: null', () => {
        expect(whatItWrites({ id: 'item_oak_wood', type: 'material' }, { cap: CAP, nameOf })).toBeNull();
    });
});

group('fields kept for later slices', () => {
    it('upcycling: a target and a ratio, or nothing', () => {
        const item = baseItem(FOREST);
        expect(upcycleOf(item)).toBeNull();
        item.cartography.upcycle = { itemId: 'map_mountain', ratio: 10 };
        expect(upcycleOf(item)).toEqual({ itemId: 'map_mountain', ratio: 10 });
        item.cartography.upcycle = { itemId: 'map_mountain', ratio: 0 };
        expect(upcycleOf(item)).toBeNull();
        item.cartography.upcycle = { itemId: '', ratio: 10 };
        expect(upcycleOf(item)).toBeNull();
    });

    it('how often a bounty pays it: 1 unless the map says otherwise; never for other items', () => {
        const item = baseItem(FOREST);
        expect(bountyWeightOf(item)).toBe(1);
        item.cartography.bountyWeight = 0;
        expect(bountyWeightOf(item)).toBe(0);
        item.cartography.bountyWeight = 2.5;
        expect(bountyWeightOf(item)).toBe(2.5);
        item.cartography.bountyWeight = -4;
        expect(bountyWeightOf(item)).toBe(0);
        expect(bountyWeightOf({ id: 'item_oak_wood', type: 'material' })).toBe(0);
    });
});

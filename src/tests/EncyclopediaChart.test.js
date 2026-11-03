import { describe, it, expect } from 'vitest';
import { buildEncyclopedia, encyclopedia, KIND } from '../ui/components/encyclopedia/encyclopediaModel.js';
import {
    waysIn, waysOut, madeBy, chartOf, nodesOf, findNode, needText, layoutChart, grownBox, keepInSight, centreOn, clampPan,
    requirementOf, wayInRequirement, wayOutRequirement, entryOfKey, isGrowingStage, oneOffWays, within, CHART_METRICS,
    pathIds, litLinks, litLabels, tabWidth,
    chartMetrics, SHOWN_AT_FIRST, ROOT, STATIONS
} from '../ui/components/encyclopedia/encyclopediaChart.js';
import { HOW, COMBAT, itemKey, tokenKey, recipeKey } from '../systems/progression/ledger/engine.js';
import { ledgerContent, withIronChest } from './fixtures/ledgerWorld.js';
import en from '../i18n/en.json';

/**
 * ⭐ The Encyclopedia's flowchart (brief 300 E3, as the owner chose its display on 1 November):
 * every box is something the player acts on; a sapling, a sprout or a stump folds into a grow mark
 * on the line; a crafted thing's way in is its ingredients and the station that makes it (that
 * station itself, or a type of just the stations that make it); what a step asks of a hero sits on
 * its line; a box's far side opens in place, the line it already had running through; boxes never
 * overlap.
 */

const I = itemKey;
const T = tokenKey;
const R = recipeKey;

/** The fixture with a Fire Elemental that also drops Iron Ore, sometimes: three ways to Iron Ore. */
function threeWaysToIronOre() {
    const ws = withIronChest();
    ws.tokens.token_fire_elemental.config.outputs.push({ itemId: 'item_iron_ore', chance: 40, minQty: 1, maxQty: 1 });
    return ws;
}

/** ...with a second furnace and a second Foundation: recipes made at more than one station. */
function twoOfEach() {
    const ws = threeWaysToIronOre();
    ws.tokens.token_big_furnace = { ...structuredClone(ws.tokens.token_furnace), id: 'token_big_furnace', name: 'Big Furnace' };
    ws.tokens.token_stone_foundation = { ...structuredClone(ws.tokens.token_wood_foundation), id: 'token_stone_foundation', name: 'Stone Foundation' };
    return ws;
}

/** ...with an Oak Forest that plants Oak Saplings, a Seed each. */
function withForest() {
    const ws = threeWaysToIronOre();
    ws.tokens.token_oak_forest = {
        id: 'token_oak_forest', name: 'Oak Forest',
        spawner: { spawns: [{ typeId: 'token_oak_sapling', weight: 1 }], allowance: 3, intervalMs: 30000, upkeep: [{ itemId: 'item_seed', quantity: 1 }] }
    };
    return ws;
}

describe('ways in: one per recipe, stacked "or" branches, the most usual first', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('a smelted ingot: the station that makes it and its ingredients, one way for the recipe', () => {
        const ways = waysIn(book, I('item_iron_ingot'));
        expect(ways).toHaveLength(1);
        const [craft] = ways;
        expect(craft).toMatchObject({ how: HOW.CRAFT, recipe: R('recipe_iron_ingot'), from: T('token_furnace') });
        expect(craft.inputs).toEqual([{ key: I('item_iron_ore'), quantity: 2 }, { key: I('item_coal'), quantity: 2 }]);
    });

    it('an ore: the vein first, then the drop, then the one-off chest', () => {
        const ways = waysIn(book, I('item_iron_ore'));
        expect(ways.map(w => [w.how, w.from])).toEqual([
            [HOW.WORK, T('token_iron_vein')],
            [HOW.DROP, T('token_fire_elemental')],
            [HOW.WORK, T('token_iron_chest')]
        ]);
        expect(ways[1].chance).toBeCloseTo(0.4);
    });

    it('equally likely drops: the first-reached enemy first, then by name', () => {
        const ways = waysIn(book, I('item_bones'));
        expect(ways.every(w => w.how === HOW.DROP)).toBe(true);
        expect(ways.map(w => w.from)).toEqual([T('token_goblin'), T('token_fire_elemental'), T('token_goblin_chief')]);
    });

    it('one-off starts leave the chart (the opening Bank, the Starter Camp); the Shop names itself over its price', () => {
        expect(waysIn(book, I('item_worm')).some(w => w.how === HOW.STARTER_BANK)).toBe(false);
        expect(waysIn(book, T('token_oak_tree')).some(w => w.how === HOW.STARTER_CAMP)).toBe(false);
        expect(oneOffWays(book, I('item_worm'))).toEqual(['starterBank']);
        expect(oneOffWays(book, T('token_oak_tree'))).toEqual(['starterCamp']);
        const [shop] = waysIn(book, T('token_wood_foundation'));
        expect(shop).toMatchObject({ how: HOW.SHOP, caption: 'shop', from: null, inputs: [{ key: I('item_oak_wood'), quantity: 15 }] });
    });

    it('a recipe entry: its station and inputs; a building: the Foundation that builds it', () => {
        expect(waysIn(book, R('recipe_iron_ingot'))).toEqual([expect.objectContaining({ from: T('token_furnace'), recipe: R('recipe_iron_ingot'), inputs: [{ key: I('item_iron_ore'), quantity: 2 }, { key: I('item_coal'), quantity: 2 }] })]);
        expect(waysIn(book, R('recipe_build_smithy'))[0].from).toBe(T('token_wood_foundation'));
    });
});

describe('stations: only the ones that make it', () => {
    it('one station makes it: that station is the way in (the Smithy, never the Idle Anvil that offers nothing)', () => {
        const book = buildEncyclopedia(threeWaysToIronOre());
        expect(waysIn(book, I('item_iron_ingot'))[0].from).toBe(T('token_furnace'));
        expect(waysIn(book, I('item_iron_pickaxe'))[0].from).toBe(T('token_smithy'));
        expect(waysIn(book, R('recipe_build_smithy'))[0].from).toBe(T('token_wood_foundation'));
    });

    it('several: a station type of just those, named for its skill, whose ways in are those stations', () => {
        const book = buildEncyclopedia(twoOfEach());
        const key = waysIn(book, I('item_iron_ingot'))[0].from;
        const type = entryOfKey(book, key);
        expect(type).toMatchObject({ kind: STATIONS, name: 'Smithing Station' });
        expect([...type.members].sort()).toEqual([T('token_big_furnace'), T('token_furnace')]);
        expect(waysIn(book, key).map(w => w.from).sort()).toEqual([T('token_big_furnace'), T('token_furnace')]);
        // The Smithy smiths too, but makes no ingot: the pickaxe's station is the Smithy alone.
        expect(waysIn(book, I('item_iron_pickaxe'))[0].from).toBe(T('token_smithy'));
    });

    it('a building made on several Foundations reads "Foundation"', () => {
        const book = buildEncyclopedia(twoOfEach());
        const type = entryOfKey(book, waysIn(book, R('recipe_build_smithy'))[0].from);
        expect(type).toMatchObject({ kind: STATIONS, name: 'Foundation' });
        expect([...type.members].sort()).toEqual([T('token_stone_foundation'), T('token_wood_foundation')]);
    });

    it('a station type goes into what its stations make', () => {
        const book = buildEncyclopedia(twoOfEach());
        const key = waysIn(book, I('item_iron_ingot'))[0].from;
        expect(waysOut(book, key).map(w => w.to)).toEqual(expect.arrayContaining([I('item_iron_ingot'), I('item_copper_ingot')]));
        expect(waysOut(book, key).map(w => w.to)).not.toContain(I('item_iron_pickaxe'));
    });
});

describe('growing stages fold into the line', () => {
    const book = buildEncyclopedia(withForest());

    it('only a Token nobody works that grows into another is a stage', () => {
        expect([T('token_oak_sapling'), T('token_oak_stump')].map(k => isGrowingStage(book, k))).toEqual([true, true]);
        expect([T('token_oak_tree'), T('token_oak_forest'), I('item_seed')].map(k => isGrowingStage(book, k))).toEqual([false, false, false]);
    });

    it('a tree comes from the forest that plants its saplings: through the sapling, with the forest\'s Seed', () => {
        const ways = waysIn(book, T('token_oak_tree'));
        expect(ways.some(w => w.from === T('token_oak_sapling') || w.from === T('token_oak_stump'))).toBe(false);
        const forest = ways.find(w => w.from === T('token_oak_forest'));
        expect(forest).toMatchObject({ through: [T('token_oak_sapling')], inputs: [{ key: I('item_seed'), quantity: 1 }] });
    });

    it('a chopped tree\'s stump, fed a Seed, grows back: the Seed alone, marked as regrowing', () => {
        const regrow = waysIn(book, T('token_oak_tree')).find(w => w.regrow);
        expect(regrow).toMatchObject({ from: null, through: [T('token_oak_stump'), T('token_oak_sapling')], inputs: [{ key: I('item_seed'), quantity: 1 }] });
    });

    it('uses skip the stages too: the forest and the Seed go into Oak Trees', () => {
        expect(waysOut(book, T('token_oak_forest')).map(w => [w.to, w.through])).toEqual([[T('token_oak_tree'), [T('token_oak_sapling')]]]);
        const seed = waysOut(book, I('item_seed'));
        expect(seed.map(w => w.to)).not.toContain(T('token_oak_stump'));
        expect(seed.find(w => w.to === T('token_oak_tree'))).toMatchObject({ through: [T('token_oak_stump'), T('token_oak_sapling')] });
        expect(waysOut(book, T('token_oak_tree')).map(w => w.to)).not.toContain(T('token_oak_stump'));
    });

    it('a worked Token keeps its box: Oak Wood comes from the Oak Tree', () => {
        expect(waysIn(book, I('item_oak_wood'))[0].from).toBe(T('token_oak_tree'));
    });
});

describe('what a step asks of a hero, on its line', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('a crafted thing: its recipe\'s skill and level, with the stations that make it', () => {
        expect(requirementOf(book, I('item_iron_ingot'))).toEqual({ skill: 'smithing', level: 15, recipe: R('recipe_iron_ingot'), stations: [T('token_furnace')] });
        expect(requirementOf(book, I('item_iron_pickaxe'), R('recipe_iron_pickaxe'))).toMatchObject({ skill: 'smithing', level: 16 });
        expect(requirementOf(book, I('item_iron_ore'))).toBeNull();
    });

    it('a vein or a chest: the skill to work it; an enemy: Combat at its level; a station: nothing', () => {
        expect(requirementOf(book, T('token_iron_vein'))).toEqual({ skill: 'mining', level: 15 });
        expect(requirementOf(book, T('token_iron_chest'))).toEqual({ skill: 'crafting', level: 1 });
        expect(requirementOf(book, T('token_goblin'))).toEqual({ skill: COMBAT, level: 5 });
        expect(requirementOf(book, T('token_furnace'))).toBeNull();
    });

    it('each way in carries its own: the smelt Smithing 15, the vein Mining 15, the fight Combat 17', () => {
        const [smelt] = waysIn(book, I('item_iron_ingot'));
        expect(wayInRequirement(book, smelt)).toMatchObject({ skill: 'smithing', level: 15 });
        const [vein, drop, chest] = waysIn(book, I('item_iron_ore'));
        expect(wayInRequirement(book, vein)).toEqual({ skill: 'mining', level: 15 });
        expect(wayInRequirement(book, drop)).toEqual({ skill: COMBAT, level: 17 });
        expect(wayInRequirement(book, chest)).toEqual({ skill: 'crafting', level: 1 });
        // A map writes, a spawner spawns, the Shop sells: no hero asked.
        expect(waysIn(book, T('token_goblin')).map(w => wayInRequirement(book, w))).toEqual([null]);
    });

    it('each use too: the pickaxe\'s recipe; an enemy\'s drops its level; a tool the vein it works', () => {
        const [pick] = waysOut(book, I('item_iron_ingot'));
        expect(wayOutRequirement(book, I('item_iron_ingot'), pick)).toMatchObject({ skill: 'smithing', level: 16 });
        const banner = waysOut(book, T('token_goblin_chief')).find(w => w.to === I('item_chief_banner'));
        expect(wayOutRequirement(book, T('token_goblin_chief'), banner)).toEqual({ skill: COMBAT, level: 20 });
        const vein = waysOut(book, I('item_copper_pickaxe')).find(w => w.to === T('token_copper_vein'));
        expect(wayOutRequirement(book, I('item_copper_pickaxe'), vein)).toEqual({ skill: 'mining', level: 1 });
    });

    it('a Token worked with a fighting style asks Combat, not the style', () => {
        const ws = threeWaysToIronOre();
        ws.tokens.token_dummy = { id: 'token_dummy', name: 'Dummy', config: { skill: 'melee', skillRequired: 4, cycleTimeMs: 1000, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] } };
        expect(requirementOf(buildEncyclopedia(ws), T('token_dummy'))).toEqual({ skill: COMBAT, level: 4 });
    });
});

describe('ways out: uses and what it gives', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('an ingot goes into what its recipe makes, taking so many', () => {
        const [use] = waysOut(book, I('item_iron_ingot'));
        expect(use).toMatchObject({ how: HOW.CRAFT, to: I('item_iron_pickaxe'), recipe: R('recipe_iron_pickaxe'), takes: 3 });
    });

    it('a vein gives its ore, likelier first, before the rare spawn; an enemy its drops with their odds', () => {
        expect(waysOut(book, T('token_iron_vein')).map(w => w.to)).toEqual([I('item_iron_ore'), T('token_fire_elemental')]);
        const chief = waysOut(book, T('token_goblin_chief'));
        expect(chief.find(w => w.to === I('item_chief_banner'))).toMatchObject({ firstKill: true });
    });

    it('a station gives what its recipes make; a recipe that makes several stays the recipe', () => {
        expect(waysOut(book, T('token_furnace')).map(w => w.to).sort()).toEqual([I('item_copper_ingot'), I('item_iron_ingot')].sort());
        expect(madeBy(book, R('recipe_wheat'))).toBe(R('recipe_wheat'));
        expect(waysOut(book, R('recipe_wheat')).map(w => w.to).sort()).toEqual([I('item_wheat'), I('item_wheat_seed')].sort());
    });

    it('a tool is a use of the Tokens that need it', () => {
        expect(waysOut(book, I('item_copper_pickaxe')).some(w => w.how === HOW.HOLD && w.to === T('token_copper_vein'))).toBe(true);
    });
});

describe('the chart grows a step at a time, and counts what is not on it', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('starts with one step each side: the station and ingredients in, the uses out', () => {
        const chart = chartOf(book, I('item_iron_ingot'));
        expect(chart.id).toBe(ROOT);
        expect(chart.ins).toHaveLength(1);
        expect(chart.ins[0].from.key).toBe(T('token_furnace'));
        expect(chart.ins[0].inputs.map(n => n.key)).toEqual([I('item_iron_ore'), I('item_coal')]);
        expect(chart.outs.map(u => u.node.key)).toEqual([I('item_iron_pickaxe')]);
        expect(nodesOf(chart).filter(n => n.ins || n.outs).map(n => n.id)).toEqual([ROOT]);
    });

    it('each line carries what its step asks: the smelt on the branch, the pickaxe\'s recipe on its use', () => {
        const chart = chartOf(book, I('item_iron_ingot'));
        expect(chart.ins[0].req).toMatchObject({ skill: 'smithing', level: 15 });
        expect(chart.outs[0].req).toMatchObject({ skill: 'smithing', level: 16 });
    });

    it('each side of a box counts its lines not on screen', () => {
        const chart = chartOf(book, I('item_iron_ingot'));
        expect([chart.hiddenIn, chart.hiddenOut]).toEqual([0, 0]);
        // The pickaxe, a use: Iron Ingot is drawn into it; its Smithy and Oak Wood are not;
        // it is a tool for three veins, none drawn.
        const pick = chart.outs[0].node;
        expect([pick.hiddenIn, pick.hiddenOut]).toEqual([2, 3]);
        // Iron Ore, closed: its three ways are not drawn; its use, the ingot, is.
        const ore = chart.ins[0].inputs[0];
        expect([ore.hiddenIn, ore.hiddenOut]).toEqual([3, 0]);
        const grown = findNode(chartOf(book, I('item_iron_ingot'), { grown: new Set([ore.id]) }), ore.id);
        expect(grown.hiddenIn).toBe(0);
    });

    it('a clicked ingredient grows where it comes from; amounts per step, needs per one of the start', () => {
        const start = chartOf(book, I('item_iron_pickaxe'));
        const ingot = start.ins[0].inputs.find(n => n.key === I('item_iron_ingot'));
        expect([ingot.amount, ingot.need]).toEqual([3, 3]);
        const chart = chartOf(book, I('item_iron_pickaxe'), { grown: new Set([ingot.id]) });
        const ore = findNode(chart, ingot.id).ins[0].inputs.find(n => n.key === I('item_iron_ore'));
        expect([ore.amount, ore.need]).toEqual([2, 6]);
        const deeper = chartOf(book, I('item_iron_pickaxe'), { grown: new Set([ingot.id, ore.id]) });
        expect(findNode(deeper, ore.id).ins[0].from.key).toBe(T('token_iron_vein'));
    });

    it('a drop\'s odds sit on the dropping box', () => {
        const ore = chartOf(book, I('item_iron_ore'));
        const elemental = ore.ins.map(b => b.from).find(n => n.key === T('token_fire_elemental'));
        expect(elemental.chance).toBeCloseTo(0.4);
        const chief = chartOf(book, T('token_goblin_chief'));
        expect(chief.outs.find(u => u.node.key === I('item_chief_banner')).node.firstKill).toBe(true);
    });

    it('a station type grows to its stations', () => {
        const two = buildEncyclopedia(twoOfEach());
        const chart = chartOf(two, I('item_iron_ingot'));
        const type = chart.ins[0].from;
        const grown = findNode(chartOf(two, I('item_iron_ingot'), { grown: new Set([type.id]) }), type.id);
        expect(grown.ins.map(b => b.from.key).sort()).toEqual([T('token_big_furnace'), T('token_furnace')]);
    });

    it('a use grows what it goes into next, further right', () => {
        const chart = chartOf(book, I('item_iron_ore'));
        const ingot = chart.outs.find(u => u.node.key === I('item_iron_ingot')).node;
        const grown = chartOf(book, I('item_iron_ore'), { grown: new Set([ingot.id]) });
        expect(findNode(grown, ingot.id).outs.map(u => u.node.key)).toEqual([I('item_iron_pickaxe')]);
        expect(findNode(grown, ingot.id).ins).toBeNull();
    });

    it('an entry already on its own path never grows (seeds that make seeds)', () => {
        const chart = chartOf(book, I('item_wheat_seed'));
        const seed = chart.ins.flatMap(b => b.inputs).find(n => n.key === I('item_wheat_seed'));
        expect(seed.repeat).toBe(true);
        expect(seed.canGrow).toBe(false);
        expect(findNode(chartOf(book, I('item_wheat_seed'), { grown: new Set([seed.id]) }), seed.id).ins).toBeNull();
    });

    it('a long list shows the first few and counts the rest on its side until opened', () => {
        const shipped = encyclopedia();
        const ingot = I('item_iron_ingot');
        const all = waysOut(shipped, ingot).length;
        expect(all).toBeGreaterThan(SHOWN_AT_FIRST);
        const chart = chartOf(shipped, ingot);
        expect(chart.outs).toHaveLength(SHOWN_AT_FIRST);
        expect(chart.hiddenOut).toBe(all - SHOWN_AT_FIRST);
        const opened = chartOf(shipped, ingot, { opened: new Set([`${ROOT}>`]) });
        expect([opened.outs.length, opened.hiddenOut]).toEqual([all, 0]);
    });

    it('knows what a box grew', () => {
        expect([within('s<0.1<0f', 's<0.1'), within('s<0.1', 's<0.1'), within('s<0.10', 's<0.1')]).toEqual([true, true, false]);
    });

    it('shows a need in whole units, rounded up', () => {
        expect([needText(0.1), needText(2), needText(2.0000000001), needText(2.5), needText(null)]).toEqual([1, 2, 2, 3, null]);
    });
});

describe('a box\'s far side opens in place', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());
    const pickOf = (chart) => chart.outs.find(u => u.node.key === I('item_iron_pickaxe')).node;

    it('a use opens its other ways in to its left: the start runs through, its other things are boxes', () => {
        const pick = pickOf(chartOf(book, I('item_iron_ingot')));
        expect(pick.canFar).toBe(true);
        const open = findNode(chartOf(book, I('item_iron_ingot'), { far: new Set([pick.id]) }), pick.id);
        expect(open.farOpen).toBe(true);
        expect(open.outs).toBeNull();
        expect(open.ins).toHaveLength(1);
        const [b] = open.ins;
        expect(b.from.key).toBe(T('token_smithy'));
        expect(b.inputs.map(n => [n.key, n.pass === true])).toEqual([[I('item_iron_ingot'), true], [I('item_oak_wood'), false]]);
        expect(b.req).toMatchObject({ skill: 'smithing', level: 16 });
        // Its things count for one of it: one Oak Wood for one pickaxe.
        expect(b.inputs[1].need).toBe(1);
        expect(open.hiddenIn).toBe(0);
        // A pass is a line, not an entry.
        expect(nodesOf(open).some(n => n.pass)).toBe(false);
    });

    it('an ingredient opens its other uses to its right, the start among them as the line', () => {
        const ore = chartOf(book, I('item_iron_pickaxe'));
        const ingot = ore.ins[0].inputs.find(n => n.key === I('item_iron_ingot'));
        expect(ingot.canFar).toBe(false);
        const coal = chartOf(book, I('item_iron_ingot')).ins[0].inputs.find(n => n.key === I('item_coal'));
        expect(coal.canFar).toBe(true);
        const open = findNode(chartOf(book, I('item_iron_ingot'), { far: new Set([coal.id]) }), coal.id);
        expect(open.outs.map(u => [u.node.key, u.node.pass === true]))
            .toEqual(expect.arrayContaining([[I('item_iron_ingot'), true], [I('item_copper_ingot'), false]]));
        expect(open.ins).toBeNull();
    });

    it('a link that is no way in still reaches its box: a tool\'s vein opens its sources, the tool\'s line above them', () => {
        const start = chartOf(book, I('item_copper_pickaxe'));
        const vein = start.outs.find(u => u.node.key === T('token_copper_vein')).node;
        expect(vein.canFar).toBe(true);
        const open = findNode(chartOf(book, I('item_copper_pickaxe'), { far: new Set([vein.id]) }), vein.id);
        expect(open.ins.length).toBeGreaterThan(0);
        expect(open.ins.flatMap(b => [b.from, ...b.inputs]).some(n => n?.pass)).toBe(false);
        expect(open.passBand).toMatchObject({ side: 'in', key: I('item_copper_pickaxe') });
    });

    it('opens nothing on a box whose far side holds only its neighbour', () => {
        const start = chartOf(book, I('item_iron_ingot'));
        const furnace = start.ins[0].from;
        // The Furnace also makes Copper Ingot: something to open. Iron Ore goes only into the ingot.
        expect(furnace.canFar).toBe(true);
        const ore = start.ins[0].inputs[0];
        expect(ore.canFar).toBe(false);
        expect(findNode(chartOf(book, I('item_iron_ingot'), { far: new Set([ore.id]) }), ore.id).outs).toBeNull();
    });
});

describe('where the boxes sit', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());
    const m = CHART_METRICS;
    const pitch = m.nodeW + m.gapX;
    const half = m.nodeW / 2;
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    /** Iron Ingot with its ore (three ways), its coal, the ore's vein and a use grown. */
    function bigChart() {
        let chart = chartOf(book, I('item_iron_ingot'));
        const ore = chart.ins[0].inputs[0].id;
        const coal = chart.ins[0].inputs[1].id;
        chart = chartOf(book, I('item_iron_ingot'), { grown: new Set([ore, coal]) });
        const vein = findNode(chart, ore).ins[0].from.id;
        const pick = chart.outs[0].node.id;
        return { chart: chartOf(book, I('item_iron_ingot'), { grown: new Set([ore, coal, vein, pick]) }), ore, coal, vein, pick };
    }

    /** Every far side open as well: the pickaxe's ways in, the coal's other uses, the Furnace's. */
    function everythingOpen() {
        const { ore, coal, vein, pick } = bigChart();
        const furnace = chartOf(book, I('item_iron_ingot')).ins[0].from.id;
        const grown = new Set([ore, coal, vein, pick]);
        const far = new Set([pick, coal, furnace]);
        let chart = chartOf(book, I('item_iron_ingot'), { grown, far });
        // ...and, in the pickaxe's ways in, its Oak Wood grown too: three columns between ingot and pickaxe.
        const wood = findNode(chart, pick).ins[0].inputs.find(n => n.key === I('item_oak_wood'));
        grown.add(wood.id);
        chart = chartOf(book, I('item_iron_ingot'), { grown, far });
        return { chart, pick, coal, wood: wood.id, furnace };
    }

    const noOverlaps = (lay) => {
        const boxes = [...lay.nodes, ...lay.stems, ...lay.labels, ...lay.captions.filter(c => !c.label)];
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                expect(overlap(boxes[i], boxes[j]), `${boxes[i].id} / ${boxes[j].id}`).toBe(false);
            }
        }
    };

    it('the start sits at the middle; ways in to its left, uses to its right, a column per step', () => {
        const { chart, ore, vein } = bigChart();
        const lay = layoutChart(chart);
        const at = (id) => lay.nodes.find(n => n.id === id);
        expect(at(ROOT).x).toBe(-half);
        expect(at(ROOT).y).toBe(-m.nodeH / 2);
        expect(at(ore).x).toBe(-pitch - half);
        expect(at(vein).x).toBe(-2 * pitch - half);
        for (const u of chart.outs) expect(at(u.node.id).x).toBe(pitch - half);
    });

    it('no two boxes overlap: entries, stem counts, the marks on the lines, words', () => {
        const lay = layoutChart(bigChart().chart);
        expect(lay.stems.length).toBeGreaterThan(0);
        expect(lay.labels.length).toBeGreaterThan(0);
        noOverlaps(lay);
    });

    it('stacked ways each sit on their own faint band, top to bottom in order; no "or" words', () => {
        const { chart, ore } = bigChart();
        const lay = layoutChart(chart);
        const branches = findNode(chart, ore).ins;
        expect(branches).toHaveLength(3);
        const ys = branches.map(b => lay.nodes.find(n => n.id === b.from.id).y);
        expect([...ys].sort((a, b) => a - b)).toEqual(ys);
        expect(lay.ors).toBeUndefined();
        const oreBox = lay.nodes.find(n => n.id === ore);
        const bands = branches.map(b => lay.bands.find(x => x.id === `${b.id}#`));
        bands.forEach((band, i) => {
            const box = lay.nodes.find(n => n.id === branches[i].from.id);
            expect([band.x, band.y, band.w, band.h].every(Number.isInteger)).toBe(true);
            expect(band.x).toBeLessThan(box.x);
            expect(band.y).toBeLessThan(box.y);
            expect(band.y + band.h).toBeGreaterThan(box.y + box.h);
            // It reaches its mark on the line, and stops short of the trunk the ways share.
            const mark = lay.labels.find(l => l.id === `${branches[i].id}@`);
            expect(band.x + band.w).toBeGreaterThanOrEqual(mark.x + mark.w);
            expect(band.x + band.w).toBeLessThanOrEqual(oreBox.x - m.reach);
        });
        for (let i = 1; i < bands.length; i++) expect(bands[i].y).toBeGreaterThan(bands[i - 1].y + bands[i - 1].h);
        // One way in: nothing to tell apart, no band.
        expect(lay.bands.some(b => b.id === `${chart.ins[0].id}#`)).toBe(false);
    });

    it('resting on a box lights its lines up to the start, and no others', () => {
        const { chart, ore, vein, coal } = bigChart();
        const lay = layoutChart(chart);
        expect(pathIds(vein)).toEqual([vein, ore, ROOT]);
        expect(pathIds(ROOT)).toEqual([ROOT]);
        const veinWay = findNode(chart, ore).ins[0];
        expect(litLinks(lay, vein)).toEqual(new Set([`${vein}>`, `${veinWay.id}>`, `${ore}>`, `${chart.ins[0].id}>`]));
        expect(litLinks(lay, vein).has(`${coal}>`)).toBe(false);
        expect(litLabels(lay, vein)).toEqual(new Set([`${veinWay.id}@`, `${chart.ins[0].id}@`]));
        expect(litLinks(lay, ROOT).size).toBe(0);
    });

    it('every line ends on the middle of a box\'s side, or on its branch\'s join', () => {
        const { chart } = bigChart();
        const lay = layoutChart(chart);
        for (const link of lay.links) {
            const [x, y] = link.points[link.points.length - 1];
            const target = lay.nodes.find(n => n.id === link.into);
            if (!target) continue;
            expect(x).toBe(target.x);
            expect(y).toBe(target.y + target.h / 2);
        }
        expect(lay.links.some(l => !lay.nodes.some(n => n.id === l.into))).toBe(true);
    });

    it('a mark sits on its own line: a branch\'s between its join and the box, a use\'s past the trunk', () => {
        const { chart } = bigChart();
        const lay = layoutChart(chart);
        const branch = lay.labels.find(l => l.id === `${chart.ins[0].id}@`);
        expect(branch.req).toMatchObject({ skill: 'smithing', level: 15 });
        expect(branch.x).toBeGreaterThan(-pitch + half + m.reach);
        expect(branch.x + branch.w).toBeLessThan(-half - m.reach);
        const use = lay.labels.find(l => l.id === `${chart.outs[0].id}@`);
        expect(use.x).toBeGreaterThan(half + m.reach);
        expect(use.x + use.w).toBeLessThan(pitch - half - tabWidth(99, m));
    });

    it('the widest mark, a grow mark and its time, still fits between its join and the trunk', () => {
        const forest = buildEncyclopedia(withForest());
        const lay = layoutChart(chartOf(forest, T('token_oak_tree')), m, () => '2:30');
        const grows = lay.labels.filter(l => l.through);
        expect(grows.length).toBe(2);
        for (const l of grows) {
            expect(l.x).toBeGreaterThan(-pitch + half + m.reach);
            expect(l.x + l.w).toBeLessThan(-half - m.reach);
        }
        expect(lay.labels.find(l => l.regrow)).toBeTruthy();
    });

    it('a stem count sits on its side of its box; the grown box holds what it grew', () => {
        const { chart, ore } = bigChart();
        const lay = layoutChart(chart);
        for (const stem of lay.stems) {
            const box = lay.nodes.find(n => n.id === stem.node.id);
            if (stem.side === 'in') expect(stem.x + stem.w).toBe(box.x);
            else expect(stem.x).toBe(box.x + box.w);
        }
        const grown = grownBox(lay, ore);
        const vein = lay.nodes.find(n => n.node.key === T('token_iron_vein'));
        expect(grown.left).toBeLessThanOrEqual(vein.x);
        expect(grown.right).toBe(lay.nodes.find(n => n.id === ore).x + m.nodeW);
        for (const n of lay.nodes) {
            expect(n.y).toBeGreaterThanOrEqual(lay.box.top);
            expect(n.y + n.h).toBeLessThanOrEqual(lay.box.bottom);
        }
    });

    it('a far side opened: the use moves out a column per column its ways in take, the start\'s line runs through', () => {
        const { chart, pick, wood } = everythingOpen();
        const lay = layoutChart(chart);
        const at = (id) => lay.nodes.find(n => n.id === id);
        const open = findNode(chart, pick);
        // Smithy and Oak Wood one column right of the start, Oak Wood's tree one more: the pickaxe at column 3.
        expect(at(open.ins[0].from.id).x).toBe(2 * pitch - half);
        expect(at(wood).x).toBe(2 * pitch - half);
        expect(at(findNode(chart, wood).ins[0].from.id).x).toBe(pitch - half);
        expect(at(pick).x).toBe(3 * pitch - half);
        // The start's use line ends where the pass line starts, at the left of the pickaxe's block, with no arrow there.
        const use = chart.outs.find(u => u.node.id === pick);
        const into = lay.links.find(l => l.id === `${use.id}>`);
        const pass = open.ins[0].inputs.find(n => n.pass);
        const through = lay.links.find(l => l.id === `${pass.id}>`);
        expect(into.points.at(-1)).toEqual(through.points[0]);
        expect(into.points.at(-1)[0]).toBe(pitch - half);
        expect(into.into).toBe(pass.id);
        // The use's own mark is on the pickaxe's branch, not twice.
        expect(lay.labels.find(l => l.id === `${use.id}@`)).toBeUndefined();
        expect(lay.labels.find(l => l.id === `${open.ins[0].id}@`).req).toMatchObject({ skill: 'smithing', level: 16 });
        // Resting on the pickaxe's Smithy lights the way to the start, through the line that runs through.
        const lit = litLinks(lay, open.ins[0].from.id);
        expect([`${open.ins[0].from.id}>`, `${open.ins[0].id}>`, `${pass.id}>`, `${use.id}>`].every(id => lit.has(id))).toBe(true);
        expect(lit.has(`${open.ins[0].inputs.find(n => !n.pass).id}>`)).toBe(false);
    });

    it('an ingredient\'s far side opened: it moves left, its other uses between it and the start, its line runs through', () => {
        const { chart, coal } = everythingOpen();
        const lay = layoutChart(chart);
        const at = (id) => lay.nodes.find(n => n.id === id);
        const open = findNode(chart, coal);
        expect(at(coal).x).toBe(-2 * pitch - half);
        const copper = open.outs.find(u => u.node.key === I('item_copper_ingot'));
        expect(at(copper.node.id).x).toBe(-pitch - half);
        const pass = open.outs.find(u => u.node.pass);
        const through = lay.links.find(l => l.id === `${pass.id}>`);
        const join = lay.links.find(l => l.id === `${coal}>`);
        expect(through.points.at(-1)).toEqual(join.points[0]);
        expect(join.points[0][0]).toBe(-pitch + half);
    });

    it('everything open: still no two boxes overlap, and every box stays in its own row band', () => {
        const { chart } = everythingOpen();
        const lay = layoutChart(chart);
        noOverlaps(lay);
        // No line runs through a box: every horizontal segment clears every box it is not attached to.
        for (const link of lay.links) {
            for (let k = 1; k < link.points.length; k++) {
                const [[x0, y0], [x1, y1]] = [link.points[k - 1], link.points[k]];
                if (y0 !== y1) continue;
                for (const n of lay.nodes) {
                    const inside = y0 > n.y && y0 < n.y + n.h && Math.max(x0, x1) > n.x + 1 && Math.min(x0, x1) < n.x + n.w - 1;
                    expect(inside, `${link.id} through ${n.id}`).toBe(false);
                }
            }
        }
    });

    it('a tool\'s vein opened: the tool\'s line runs above its sources and enters the vein high on its side', () => {
        const start = chartOf(book, I('item_copper_pickaxe'));
        const use = start.outs.find(u => u.node.key === T('token_copper_vein'));
        const chart = chartOf(book, I('item_copper_pickaxe'), { far: new Set([use.node.id]) });
        const lay = layoutChart(chart);
        const vein = lay.nodes.find(n => n.id === use.node.id);
        const open = findNode(chart, use.node.id);
        const band = lay.links.find(l => l.id === `${open.passBand.id}>`);
        const [x, y] = band.points.at(-1);
        expect([x, band.into]).toEqual([vein.x, vein.node.id]);
        expect(y).toBeLessThan(vein.y + vein.h / 2);
        expect(lay.links.find(l => l.id === `${use.id}>`).points.at(-1)).toEqual(band.points[0]);
        noOverlaps(lay);
    });

    it('the measures grow with the text size', () => {
        expect(chartMetrics(16)).toEqual({ ...CHART_METRICS });
        expect(chartMetrics(20).nodeW).toBe(275);
        expect(chartMetrics(10).nodeW).toBe(CHART_METRICS.nodeW);
    });
});

describe('the view keeps the focus in sight', () => {
    const viewport = { w: 800, h: 600 };

    it('moves nothing when the target already shows', () => {
        expect(keepInSight({ x: 400, y: 300 }, viewport, { left: -100, top: -50, right: 100, bottom: 50 })).toEqual({ x: 400, y: 300 });
    });

    it('moves only as far as needed to bring it in', () => {
        const next = keepInSight({ x: 400, y: 300 }, viewport, { left: 300, top: -50, right: 600, bottom: 50 });
        expect(next).toEqual({ x: 800 - 24 - 600, y: 300 });
    });

    it('too big to show whole: the focus stays in, with the side it grew toward', () => {
        const focus = { left: -1300, top: -30, right: -1100, bottom: 30 };
        const grewLeft = { left: -2400, top: -30, right: -1100, bottom: 30 };
        expect(keepInSight({ x: 400, y: 300 }, viewport, grewLeft, focus).x + focus.right).toBe(800 - 24);
        const tall = { left: -100, top: -900, right: 100, bottom: 900 };
        const mid = { left: -100, top: -30, right: 100, bottom: 30 };
        expect(keepInSight({ x: 400, y: 0 }, viewport, tall, mid).y).toBe(300);
    });

    it('centres a box, and a drag can never lose the chart', () => {
        expect(centreOn(viewport, { left: -100, top: -32, right: 100, bottom: 32 })).toEqual({ x: 400, y: 300 });
        const box = { left: -500, top: -200, right: 500, bottom: 200 };
        expect(clampPan({ x: 5000, y: -5000 }, viewport, box, 96)).toEqual({ x: 800 - 96 + 500, y: 96 - 200 });
    });
});

describe('the shipped content', () => {
    const book = encyclopedia();

    it('Iron Ingot: smelted at the Furnace or the Iron Furnace, a Smithing Station of just those two', () => {
        const ways = waysIn(book, I('item_iron_ingot'));
        const type = entryOfKey(book, ways[0].from);
        expect(type).toMatchObject({ kind: STATIONS, name: 'Smithing Station' });
        expect([...type.members].sort()).toEqual([T('token_furnace'), T('token_iron_furnace')]);
        expect(ways[0].inputs.map(i => i.key).sort()).toEqual([I('item_coal'), I('item_iron_ore')]);
        expect(ways.filter(w => w.how === HOW.CRAFT)).toHaveLength(1);
        expect(wayInRequirement(book, ways[0])).toMatchObject({ skill: 'smithing', level: 15 });
        expect(ways.map(w => w.from)).toEqual(expect.arrayContaining([T('token_fire_elemental_chief'), T('token_iron_chest')]));
    });

    it('the Iron Furnace is built on a Stone Foundation; an Oak Forest on Farmland', () => {
        expect(waysIn(book, T('token_iron_furnace')).find(w => w.recipe)?.from).toBe(T('token_stone_foundation'));
        expect(waysIn(book, T('token_oak_forest')).find(w => w.recipe)?.from).toBe(T('token_farmland'));
    });

    it('an Oak Tree: from the Oak Forest through its sapling, or grown back from its stump; no sapling box', () => {
        const ways = waysIn(book, T('token_oak_tree'));
        expect(ways.some(w => isGrowingStage(book, w.from ?? ''))).toBe(false);
        expect(ways.find(w => w.from === T('token_oak_forest'))?.through).toEqual([T('token_oak_sapling')]);
        expect(ways.find(w => w.regrow)?.inputs.map(i => i.key)).toEqual([I('item_oak_seedling')]);
    });

    it('Iron Ore: its vein first', () => {
        expect(waysIn(book, I('item_iron_ore'))[0].from).toBe(T('token_iron_ore_vein'));
    });

    it('every word a box-less way or a one-off start shows is in the strings file', () => {
        const words = new Set();
        for (const key of book.entries.keys()) {
            for (const w of waysIn(book, key)) if (w.caption) words.add(w.caption);
            for (const w of oneOffWays(book, key)) words.add(w);
        }
        expect([...words].filter(w => typeof en.encyclopedia.via[w] !== 'string')).toEqual([]);
        expect(en.encyclopedia.kindOne[STATIONS]).toBe('Station');
    });
});

describe('the fixture world stays as the tests assume', () => {
    it('has the Smithy built on a Foundation and the Iron Chest as a one-off find', () => {
        const book = buildEncyclopedia(withIronChest());
        expect(book.sourcesOf(I('item_iron_ore')).find(r => r.via === T('token_iron_chest'))?.oneOff).toBe(true);
        expect(buildEncyclopedia(ledgerContent()).sourcesOf(R('recipe_build_smithy'))[0].how).toBe(HOW.BUILD);
        expect(KIND.ITEM).toBe('items');
    });
});

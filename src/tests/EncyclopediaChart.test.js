import { describe, it, expect } from 'vitest';
import { buildEncyclopedia, encyclopedia, KIND } from '../ui/components/encyclopedia/encyclopediaModel.js';
import {
    waysIn, waysOut, madeBy, chartOf, nodesOf, findNode, needText, layoutChart, grownBox, keepInSight, centreOn, clampPan,
    requirementOf, entryOfKey, within, CHART_METRICS, chartMetrics, SHOWN_AT_FIRST, ROOT, STATIONS
} from '../ui/components/encyclopedia/encyclopediaChart.js';
import { HOW, COMBAT, itemKey, tokenKey, recipeKey } from '../systems/progression/ledger/engine.js';
import { ledgerWorkspace, withIronChest } from './fixtures/ledgerWorld.js';
import en from '../i18n/en.json';

/**
 * ⭐ The Encyclopedia's flowchart (brief 300 E3, as the owner reshaped it on 1 November): every box
 * is an entry; a crafted thing's way in is its ingredients and the station type that makes it (one
 * way per recipe, however many stations); what a box asks of a hero sits above it; a drop's odds
 * sit on the dropping box; each side of a box counts the lines not on screen; boxes never overlap.
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

describe('ways in: one per recipe, stacked "or" branches, the most usual first', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('a smelted ingot: its station type and its ingredients, one way for the recipe', () => {
        const ways = waysIn(book, I('item_iron_ingot'));
        expect(ways).toHaveLength(1);
        const [craft] = ways;
        expect(craft).toMatchObject({ how: HOW.CRAFT, recipe: R('recipe_iron_ingot'), from: 'station:smithing' });
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

    it('a way with no entry on its left keeps only its words: the opening Bank; the Shop names itself over its price', () => {
        const bank = waysIn(book, I('item_worm')).find(w => w.how === HOW.STARTER_BANK);
        expect(bank).toMatchObject({ caption: 'starterBank', from: null, inputs: [] });
        const [shop] = waysIn(book, T('token_wood_foundation'));
        expect(shop).toMatchObject({ how: HOW.SHOP, caption: 'shop', from: null, inputs: [{ key: I('item_oak_wood'), quantity: 15 }] });
    });

    it('a recipe entry: its station type and inputs; a building: the Foundations that build it', () => {
        expect(waysIn(book, R('recipe_iron_ingot'))).toEqual([expect.objectContaining({ from: 'station:smithing', inputs: [{ key: I('item_iron_ore'), quantity: 2 }, { key: I('item_coal'), quantity: 2 }] })]);
        expect(waysIn(book, R('recipe_build_smithy'))[0].from).toBe('station:construction');
    });
});

describe('station types: every station whose recipes use a skill', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('is an entry named for its skill, whose ways in are its stations', () => {
        const type = entryOfKey(book, 'station:smithing');
        expect(type).toMatchObject({ kind: STATIONS, name: 'Smithing Station' });
        // The Idle Anvil works nothing (no work of its own), so it offers no recipe.
        expect([...type.members].sort()).toEqual([T('token_furnace'), T('token_smithy')].sort());
        expect(waysIn(book, 'station:smithing').map(w => w.from).sort()).toEqual([...type.members].sort());
        expect(entryOfKey(book, 'station:construction').members).toEqual([T('token_wood_foundation')]);
    });

    it('goes into what its stations make', () => {
        expect(waysOut(book, 'station:smithing').map(w => w.to)).toEqual(expect.arrayContaining([I('item_iron_ingot'), I('item_iron_pickaxe'), I('item_copper_ingot')]));
    });
});

describe('what a box asks of a hero, above it', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('a crafted thing: its recipe\'s skill and level, with the stations that make it', () => {
        expect(requirementOf(book, I('item_iron_ingot'))).toEqual({ skill: 'smithing', level: 15, recipe: R('recipe_iron_ingot'), stations: [T('token_furnace')] });
        expect(requirementOf(book, I('item_iron_pickaxe'), R('recipe_iron_pickaxe'))).toMatchObject({ skill: 'smithing', level: 16 });
        expect(requirementOf(book, I('item_iron_ore'))).toBeNull();
    });

    it('a vein or a chest: the skill to work it; an enemy: Combat at its level; a station or a station type: nothing', () => {
        expect(requirementOf(book, T('token_iron_vein'))).toEqual({ skill: 'mining', level: 15 });
        expect(requirementOf(book, T('token_iron_chest'))).toEqual({ skill: 'crafting', level: 1 });
        expect(requirementOf(book, T('token_goblin'))).toEqual({ skill: COMBAT, level: 5 });
        expect(requirementOf(book, T('token_furnace'))).toBeNull();
        expect(requirementOf(book, 'station:smithing')).toBeNull();
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
        expect(chief.find(w => w.to === I('map_volcano'))).toMatchObject({ firstKill: true });
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

    it('starts with one step each side: the station type and ingredients in, the uses out', () => {
        const chart = chartOf(book, I('item_iron_ingot'));
        expect(chart.id).toBe(ROOT);
        expect(chart.ins).toHaveLength(1);
        expect(chart.ins[0].from.key).toBe('station:smithing');
        expect(chart.ins[0].inputs.map(n => n.key)).toEqual([I('item_iron_ore'), I('item_coal')]);
        expect(chart.outs.map(u => u.node.key)).toEqual([I('item_iron_pickaxe')]);
        expect(nodesOf(chart).filter(n => n.ins || n.outs).map(n => n.id)).toEqual([ROOT]);
    });

    it('each side of a box counts its lines not on screen', () => {
        const chart = chartOf(book, I('item_iron_ingot'));
        expect([chart.hiddenIn, chart.hiddenOut]).toEqual([0, 0]);
        // The pickaxe, a use: Iron Ingot is drawn into it; its station type and Oak Wood are not;
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
        expect(chief.outs.find(u => u.node.key === I('map_volcano')).node.firstKill).toBe(true);
    });

    it('a station type grows to its stations', () => {
        const chart = chartOf(book, I('item_iron_ingot'));
        const type = chart.ins[0].from;
        const grown = findNode(chartOf(book, I('item_iron_ingot'), { grown: new Set([type.id]) }), type.id);
        expect(grown.ins.map(b => b.from.key).sort()).toEqual([T('token_furnace'), T('token_smithy')].sort());
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

describe('the shipped content', () => {
    const book = encyclopedia();

    it('Iron Ingot: smelted from Iron Ore and Coal at a Smithing Station, Smithing 15, then the drop and the chest', () => {
        const ways = waysIn(book, I('item_iron_ingot'));
        expect(ways[0]).toMatchObject({ how: HOW.CRAFT, from: 'station:smithing' });
        expect(ways[0].inputs.map(i => i.key).sort()).toEqual([I('item_coal'), I('item_iron_ore')]);
        expect(ways.filter(w => w.how === HOW.CRAFT)).toHaveLength(1);
        expect(ways.map(w => w.from)).toEqual(expect.arrayContaining([T('token_fire_elemental_chief'), T('token_iron_chest')]));
        expect(requirementOf(book, I('item_iron_ingot'))).toMatchObject({ skill: 'smithing', level: 15 });
    });

    it('Shrimp: one cooking way at the Cooking Station, Cooking 1', () => {
        const crafts = waysIn(book, I('item_shrimp')).filter(w => w.how === HOW.CRAFT);
        expect(crafts).toHaveLength(1);
        expect(crafts[0].from).toBe('station:cooking');
        expect(entryOfKey(book, 'station:cooking').name).toBe('Cooking Station');
        expect(entryOfKey(book, 'station:cooking').members.length).toBeGreaterThan(1);
        expect(requirementOf(book, I('item_shrimp'))).toMatchObject({ skill: 'cooking', level: 1 });
    });

    it('Iron Ore: its vein first', () => {
        expect(waysIn(book, I('item_iron_ore'))[0].from).toBe(T('token_iron_ore_vein'));
    });

    it('every word a box-less way shows is in the strings file', () => {
        const words = new Set();
        for (const key of book.entries.keys()) for (const w of waysIn(book, key)) if (w.caption) words.add(w.caption);
        expect([...words].filter(w => typeof en.encyclopedia.via[w] !== 'string')).toEqual([]);
        expect(en.encyclopedia.kindOne[STATIONS]).toBe('Station');
    });
});

describe('where the boxes sit', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());
    const m = CHART_METRICS;
    const pitch = m.nodeW + m.gapX;
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    /** Iron Ingot with its ore (three ways), its coal, the ore's vein and a use grown. */
    function bigChart() {
        let chart = chartOf(book, I('item_iron_ingot'));
        const ore = chart.ins[0].inputs[0].id;
        const coal = chart.ins[0].inputs[1].id;
        chart = chartOf(book, I('item_iron_ingot'), { grown: new Set([ore, coal]) });
        const vein = findNode(chart, ore).ins[0].from.id;
        const pick = chart.outs[0].node.id;
        return { chart: chartOf(book, I('item_iron_ingot'), { grown: new Set([ore, coal, vein, pick]) }), ore, coal, vein };
    }

    it('the start sits at the middle; ways in to its left, uses to its right, a column per step', () => {
        const { chart, ore, vein } = bigChart();
        const lay = layoutChart(chart);
        const at = (id) => lay.nodes.find(n => n.id === id);
        expect(at(ROOT).x).toBe(-m.nodeW / 2);
        expect(at(ROOT).y).toBe(-(m.reqH + m.nodeH) / 2 + m.reqH);
        expect(at(ore).x).toBe(-pitch - m.nodeW / 2);
        expect(at(vein).x).toBe(-2 * pitch - m.nodeW / 2);
        for (const u of chart.outs) expect(at(u.node.id).x).toBe(pitch - m.nodeW / 2);
    });

    it('no two boxes overlap: entries with the line above them, stem counts, words', () => {
        const { chart } = bigChart();
        const lay = layoutChart(chart);
        const boxes = [
            ...lay.nodes.map(n => ({ ...n, y: n.y - m.reqH, h: n.h + m.reqH })),
            ...lay.stems,
            ...lay.captions.filter(c => !c.label)
        ];
        expect(lay.stems.length).toBeGreaterThan(0);
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                expect(overlap(boxes[i], boxes[j]), `${boxes[i].id} / ${boxes[j].id}`).toBe(false);
            }
        }
    });

    it('"or" branches stack top to bottom in their order, an "or" between each', () => {
        const { chart, ore } = bigChart();
        const lay = layoutChart(chart);
        const branches = findNode(chart, ore).ins;
        expect(branches).toHaveLength(3);
        const ys = branches.map(b => lay.nodes.find(n => n.id === b.from.id).y);
        expect([...ys].sort((a, b) => a - b)).toEqual(ys);
        const ors = lay.ors.filter(o => branches.some(b => o.id === `${b.id}or`));
        expect(ors).toHaveLength(2);
        expect(ors[0].y).toBeGreaterThan(ys[0]);
        expect(ors[0].y).toBeLessThan(ys[1]);
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
            expect(n.y - m.reqH).toBeGreaterThanOrEqual(lay.box.top);
            expect(n.y + n.h).toBeLessThanOrEqual(lay.box.bottom);
        }
    });

    it('a box-less way stands as words where its box would be', () => {
        const chart = chartOf(book, I('item_worm'));
        const lay = layoutChart(chart);
        const words = lay.captions.find(c => c.words === 'starterBank');
        expect(words).toMatchObject({ label: false, x: -pitch - m.nodeW / 2 });
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

describe('the fixture world stays as the tests assume', () => {
    it('has the Smithy built on a Foundation and the Iron Chest as a one-off find', () => {
        const book = buildEncyclopedia(withIronChest());
        expect(book.sourcesOf(I('item_iron_ore')).find(r => r.via === T('token_iron_chest'))?.oneOff).toBe(true);
        expect(buildEncyclopedia(ledgerWorkspace()).sourcesOf(R('recipe_build_smithy'))[0].how).toBe(HOW.BUILD);
        expect(KIND.ITEM).toBe('items');
    });
});

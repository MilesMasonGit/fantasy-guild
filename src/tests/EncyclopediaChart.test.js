import { describe, it, expect } from 'vitest';
import { buildEncyclopedia, encyclopedia, KIND } from '../ui/components/encyclopedia/encyclopediaModel.js';
import {
    waysIn, waysOut, madeBy, chartOf, nodesOf, findNode, needText, layoutChart, grownBox, keepInSight, centreOn, clampPan,
    CHART_METRICS, chartMetrics, SHOWN_AT_FIRST, ROOT
} from '../ui/components/encyclopedia/encyclopediaChart.js';
import { HOW, itemKey, tokenKey, recipeKey } from '../systems/progression/ledger/engine.js';
import { ledgerWorkspace, withIronChest } from './fixtures/ledgerWorld.js';

/**
 * ⭐ The Encyclopedia's flowchart (brief 300 E3): an entry's ways in come from the left as stacked
 * "or" branches, the most usual first, its uses go out to the right; a click grows one step; the
 * boxes never overlap and the view keeps the focus in sight.
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

describe('ways in: stacked "or" branches, the most usual first', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('a smelted ingot: its ingredients feed one link, which names the station and its level', () => {
        const ways = waysIn(book, I('item_iron_ingot'));
        expect(ways).toHaveLength(1);
        const [craft] = ways;
        expect(craft.how).toBe(HOW.CRAFT);
        expect(craft.recipe).toBe(R('recipe_iron_ingot'));
        expect(craft.place).toBe(T('token_furnace'));
        expect(craft.gate).toEqual({ skill: 'smithing', level: 15 });
        expect(craft.inputs).toEqual([{ key: I('item_iron_ore'), quantity: 2 }, { key: I('item_coal'), quantity: 2 }]);
        expect(craft.from).toBeNull();
    });

    it('an ore: the vein first, then the drop, then the one-off chest', () => {
        const ways = waysIn(book, I('item_iron_ore'));
        expect(ways.map(w => [w.words, w.from])).toEqual([
            [HOW.WORK, T('token_iron_vein')],
            [HOW.DROP, T('token_fire_elemental')],
            ['found', T('token_iron_chest')]
        ]);
        expect(ways[0].gate).toEqual({ skill: 'mining', level: 15 });
        expect(ways[1].chance).toBeCloseTo(0.4);
    });

    it('equally likely drops: the first-reached enemy first, then by name', () => {
        const ways = waysIn(book, I('item_bones'));
        expect(ways.every(w => w.how === HOW.DROP)).toBe(true);
        expect(ways.map(w => w.from)).toEqual([T('token_goblin'), T('token_fire_elemental'), T('token_goblin_chief')]);
    });

    it('a way with nothing to draw on its left keeps only its chip: the opening Bank', () => {
        const ways = waysIn(book, I('item_worm'));
        const bank = ways.find(w => w.how === HOW.STARTER_BANK);
        expect(bank).toMatchObject({ words: 'starterBank', from: null, inputs: [] });
    });

    it('a Shop Token: its price feeds the Shop chip', () => {
        const [shop] = waysIn(book, T('token_wood_foundation'));
        expect(shop).toMatchObject({ how: HOW.SHOP, from: null, inputs: [{ key: I('item_oak_wood'), quantity: 15 }] });
    });

    it('a recipe: one branch, its inputs at its station, whatever else offers it', () => {
        const ways = waysIn(book, R('recipe_iron_ingot'));
        expect(ways).toHaveLength(1);
        expect(ways[0]).toMatchObject({ place: T('token_furnace'), places: 0, gate: { skill: 'smithing', level: 15 } });
        expect(ways[0].inputs.map(i => i.key)).toEqual([I('item_iron_ore'), I('item_coal')]);
        const build = waysIn(book, R('recipe_build_smithy'))[0];
        expect(build).toMatchObject({ how: HOW.BUILD, place: T('token_wood_foundation') });
    });
});

describe('ways out: uses and what it gives', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('an ingot goes into what its recipe makes, at that station, taking so many', () => {
        const [use] = waysOut(book, I('item_iron_ingot'));
        expect(use).toMatchObject({ how: HOW.CRAFT, to: I('item_iron_pickaxe'), recipe: R('recipe_iron_pickaxe'), place: T('token_smithy'), takes: 3 });
        expect(use.gate).toEqual({ skill: 'smithing', level: 16 });
    });

    it('a vein gives its ore, likelier first, before the rare spawn', () => {
        const outs = waysOut(book, T('token_iron_vein'));
        expect(outs.map(w => w.to)).toEqual([I('item_iron_ore'), T('token_fire_elemental')]);
        expect(outs[0].gate).toEqual({ skill: 'mining', level: 15 });
    });

    it('a station gives what its recipes make; a recipe that makes several stays the recipe', () => {
        const outs = waysOut(book, T('token_furnace'));
        expect(outs.map(w => w.to).sort()).toEqual([I('item_copper_ingot'), I('item_iron_ingot')].sort());
        expect(madeBy(book, R('recipe_wheat'))).toBe(R('recipe_wheat'));
        expect(waysOut(book, R('recipe_wheat')).map(w => w.to).sort()).toEqual([I('item_wheat'), I('item_wheat_seed')].sort());
    });

    it('a tool is a use of the Tokens that need it', () => {
        const outs = waysOut(book, I('item_copper_pickaxe'));
        expect(outs.some(w => w.words === 'toolFor' && w.to === T('token_copper_vein'))).toBe(true);
    });
});

describe('the chart grows a step at a time', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());

    it('starts with one step each side, nothing further', () => {
        const chart = chartOf(book, I('item_iron_ingot'));
        expect(chart.id).toBe(ROOT);
        expect(chart.ins).toHaveLength(1);
        expect(chart.ins[0].inputs.map(n => n.key)).toEqual([I('item_iron_ore'), I('item_coal')]);
        expect(chart.outs.map(u => u.node.key)).toEqual([I('item_iron_pickaxe')]);
        expect(nodesOf(chart).filter(n => n.ins || n.outs).map(n => n.id)).toEqual([ROOT]);
        expect(chart.ins[0].inputs.every(n => n.side === 'in' && n.canGrow && !n.grown)).toBe(true);
    });

    it('a clicked ingredient grows where it comes from; amounts per step, needs per one of the start', () => {
        const start = chartOf(book, I('item_iron_pickaxe'));
        const ingot = start.ins[0].inputs.find(n => n.key === I('item_iron_ingot'));
        expect([ingot.amount, ingot.need]).toEqual([3, 3]);
        const chart = chartOf(book, I('item_iron_pickaxe'), { grown: new Set([ingot.id]) });
        const grown = findNode(chart, ingot.id);
        expect(grown.grown).toBe(true);
        const ore = grown.ins[0].inputs.find(n => n.key === I('item_iron_ore'));
        expect([ore.amount, ore.need]).toEqual([2, 6]);
        const ore2 = chartOf(book, I('item_iron_pickaxe'), { grown: new Set([ingot.id, ore.id]) });
        // Iron Ore grows its vein: the vein is the branch's own node.
        expect(findNode(ore2, ore.id).ins[0].from.key).toBe(T('token_iron_vein'));
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
        const still = chartOf(book, I('item_wheat_seed'), { grown: new Set([seed.id]) });
        expect(findNode(still, seed.id).ins).toBeNull();
    });

    it('a long list shows the first few and counts the rest until opened', () => {
        const shipped = encyclopedia();
        const ingot = I('item_iron_ingot');
        const all = waysOut(shipped, ingot).length;
        expect(all).toBeGreaterThan(SHOWN_AT_FIRST);
        const chart = chartOf(shipped, ingot);
        expect(chart.outs).toHaveLength(SHOWN_AT_FIRST);
        expect(chart.moreOuts).toBe(all - SHOWN_AT_FIRST);
        const opened = chartOf(shipped, ingot, { opened: new Set([`${ROOT}>`]) });
        expect([opened.outs.length, opened.moreOuts]).toEqual([all, 0]);
    });

    it('shows a need in whole units, rounded up', () => {
        expect([needText(0.1), needText(2), needText(2.0000000001), needText(2.5), needText(null)]).toEqual([1, 2, 2, 3, null]);
    });
});

describe('the shipped content', () => {
    const book = encyclopedia();

    it('Iron Ingot: smelted from Iron Ore and Coal first, the drops and the chest as other ways', () => {
        const ways = waysIn(book, I('item_iron_ingot'));
        expect(ways[0].how).toBe(HOW.CRAFT);
        expect(ways[0].inputs.map(i => i.key).sort()).toEqual([I('item_coal'), I('item_iron_ore')]);
        expect(book.entryOf(ways[0].place)?.kind).toBe(KIND.TOKEN);
        expect(ways.map(w => w.from)).toEqual(expect.arrayContaining([T('token_fire_elemental_chief'), T('token_iron_chest')]));
    });

    it('Iron Ore: its vein first', () => {
        expect(waysIn(book, I('item_iron_ore'))[0].from).toBe(T('token_iron_ore_vein'));
    });
});

describe('where the boxes sit', () => {
    const book = buildEncyclopedia(threeWaysToIronOre());
    const m = CHART_METRICS;
    const pitch = m.nodeW + m.chipW + 2 * m.gapX;
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    /** Iron Pickaxe with its ingot, the ingot's ore and the ore's three ways grown, and a use grown. */
    function bigChart() {
        const first = chartOf(book, I('item_iron_ore'));
        const ingot = first.outs.find(u => u.node.key === I('item_iron_ingot')).node.id;
        let chart = chartOf(book, I('item_iron_ingot'));
        const ore = chart.ins[0].inputs[0].id;
        const coal = chart.ins[0].inputs[1].id;
        chart = chartOf(book, I('item_iron_ingot'), { grown: new Set([ore, coal]) });
        const vein = findNode(chart, ore).ins[0].from.id;
        const pick = chart.outs[0].node.id;
        return { chart: chartOf(book, I('item_iron_ingot'), { grown: new Set([ore, coal, vein, pick]) }), ore, coal, vein, ingot };
    }

    it('the start sits at the middle; ways in to its left, uses to its right, a column per step', () => {
        const { chart, ore, vein } = bigChart();
        const lay = layoutChart(chart);
        const at = (id) => lay.nodes.find(n => n.id === id);
        expect(at(ROOT)).toMatchObject({ x: -m.nodeW / 2, y: -m.nodeH / 2 });
        expect(at(ore).x).toBe(-pitch - m.nodeW / 2);
        expect(at(vein).x).toBe(-2 * pitch - m.nodeW / 2);
        for (const u of chart.outs) expect(at(u.node.id).x).toBe(pitch - m.nodeW / 2);
        for (const c of lay.chips) {
            const parent = at(c.parent);
            if (c.side === 'in') expect(c.x + c.w).toBeLessThanOrEqual(parent.x);
            else expect(c.x).toBeGreaterThanOrEqual(parent.x + parent.w);
        }
    });

    it('no two boxes overlap, chips included', () => {
        const { chart } = bigChart();
        const lay = layoutChart(chart);
        const boxes = [
            ...lay.nodes,
            ...lay.chips.map(c => ({ ...c, y: c.y - c.h / 2 })),
            ...lay.mores
        ];
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
        const ys = branches.map(b => lay.chips.find(c => c.id === b.id).y);
        expect([...ys].sort((a, b) => a - b)).toEqual(ys);
        const ors = lay.ors.filter(o => branches.some(b => o.id === `${b.id}or`));
        expect(ors).toHaveLength(2);
        expect(ors[0].y).toBeGreaterThan(ys[0]);
        expect(ors[0].y).toBeLessThan(ys[1]);
    });

    it('a node stands in the middle of what it grew; every line ends on the box it feeds', () => {
        const { chart, ore } = bigChart();
        const lay = layoutChart(chart);
        const node = lay.nodes.find(n => n.id === ore);
        const kids = lay.chips.filter(c => c.parent === ore);
        const mid = (kids[0].y + kids[kids.length - 1].y) / 2;
        expect(Math.abs(node.y + node.h / 2 - mid)).toBeLessThanOrEqual(1);
        for (const link of lay.links) {
            const [x, y] = link.points[link.points.length - 1];
            const target = lay.nodes.find(n => n.id === link.into) || lay.chips.find(c => c.id === link.into);
            if (target.node) {
                expect([target.x, target.x + target.w]).toContain(x);
                expect(y).toBe(target.y + target.h / 2);
            } else {
                expect([target.x, target.x + target.w]).toContain(x);
                expect(y).toBe(target.y);
            }
        }
    });

    it('everything lies inside the box, and a grown node\'s box holds what it grew', () => {
        const { chart, ore } = bigChart();
        const lay = layoutChart(chart);
        for (const n of lay.nodes) {
            expect(n.x).toBeGreaterThanOrEqual(lay.box.left);
            expect(n.x + n.w).toBeLessThanOrEqual(lay.box.right);
            expect(n.y).toBeGreaterThanOrEqual(lay.box.top);
            expect(n.y + n.h).toBeLessThanOrEqual(lay.box.bottom);
        }
        const box = grownBox(lay, ore);
        const vein = lay.nodes.find(n => n.node.key === T('token_iron_vein'));
        expect(box.left).toBeLessThanOrEqual(vein.x);
        expect(box.right).toBe(lay.nodes.find(n => n.id === ore).x + m.nodeW);
    });

    it('the measures grow with the text size', () => {
        expect(chartMetrics(16)).toEqual({ ...CHART_METRICS });
        expect(chartMetrics(20).nodeW).toBe(250);
        expect(chartMetrics(10).nodeW).toBe(CHART_METRICS.nodeW);
    });
});

describe('the view keeps the focus in sight', () => {
    const viewport = { w: 800, h: 600 };

    it('moves nothing when the target already shows', () => {
        expect(keepInSight({ x: 400, y: 300 }, viewport, { left: -100, top: -50, right: 100, bottom: 50 })).toEqual({ x: 400, y: 300 });
    });

    it('moves only as far as needed to bring it in', () => {
        // The target runs 200 px past the right edge (at 400 + 600 = 1000 > 800 - 24).
        const next = keepInSight({ x: 400, y: 300 }, viewport, { left: 300, top: -50, right: 600, bottom: 50 });
        expect(next).toEqual({ x: 800 - 24 - 600, y: 300 });
    });

    it('too big to show whole: the focus stays in, with the side it grew toward', () => {
        const focus = { left: -1300, top: -30, right: -1100, bottom: 30 };
        const grewLeft = { left: -2400, top: -30, right: -1100, bottom: 30 };
        const next = keepInSight({ x: 400, y: 300 }, viewport, grewLeft, focus);
        expect(next.x + focus.right).toBe(800 - 24);
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
    });
});

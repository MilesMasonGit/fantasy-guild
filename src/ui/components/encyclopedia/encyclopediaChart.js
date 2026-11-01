// the encyclopedia's flowchart: what flows into an entry and out of it, grown a step at a time, and where each box sits

import { HOW, COMBAT, itemKey, tokenKey, recipeKey } from '../../../systems/progression/ledger/engine.js';
import { KIND } from './encyclopediaModel.js';

/**
 * The chart reads left to right around the entry it starts from: its **ways in** come from the
 * left, one stacked "or" branch each, the most usual first (a branch's things all feed one link,
 * whose chip says where it happens: the station, "gathered", "dropped 40%"); its **uses** go out to
 * the right. A node on the left grows further left (where it comes from), a node on the right
 * further right (what it goes into), one click at a time. Reads the encyclopedia only.
 */

/** How many ways in, or uses, a node shows before a "more" row opens the rest. */
export const SHOWN_AT_FIRST = 8;

/** The start's id: every other node's id is its path from here. */
export const ROOT = 's';

/** Ways in that a guild repeats (a station, a vein, a map's Tokens): the usual ones, before chance and finds. */
const REPEATED = new Set([
    HOW.CRAFT, HOW.STATION, HOW.BUILD, HOW.WORK, HOW.CATCH, HOW.TRICKLE, HOW.UPGRADE,
    HOW.MAP, HOW.MODIFIER, HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW
]);
const BY_CHANCE = new Set([HOW.DROP, HOW.BONUS]);
/** Ways in with nothing to draw on their left: the chip alone says it. */
const BARE = new Set([HOW.STARTER_BANK, HOW.STARTER_TOOL, HOW.STARTER_CAMP, HOW.HALL, HOW.TUTORIAL]);

const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);

/**
 * The highest level gate of a rule, or null. A fight's level is left out: it measures how hard
 * the enemy is, and no hero's level is checked to fight it.
 */
function topGate(gates) {
    const top = (Array.isArray(gates) ? gates : []).filter(g => g?.skill !== COMBAT).sort((a, b) => b.level - a.level)[0];
    return top?.skill ? { skill: top.skill, level: top.level } : null;
}

/** Where a recipe is run, the first-reached station first: the station or Foundation rows. */
function stationsOf(book, key) {
    const rows = book.sourcesOf(key).filter(r => (r.how === HOW.STATION || r.how === HOW.BUILD) && book.entryOf(r.via));
    const first = book.reachOf(key)?.via;
    return [...rows].sort((a, b) => (a.via === first ? 0 : 1) - (b.via === first ? 0 : 1));
}

/** A recipe's level: its first station's gate (the station's own and the recipe's), else the recipe's. */
function recipeGate(book, key, stations = stationsOf(book, key)) {
    const fromStation = stations.length ? topGate(stations[0].gates) : null;
    if (fromStation) return fromStation;
    const def = book.entryOf(key)?.def;
    return def?.skill ? { skill: def.skill, level: Math.max(1, Math.floor(finite(Number(def.levelRequirement), 1))) } : null;
}

/** The thing a recipe makes, when it makes one thing; else the recipe itself (it makes several). */
export function madeBy(book, key) {
    const outs = book.givesOf(key).filter(g => g.how === HOW.CRAFT && book.entryOf(g.key));
    return outs.length === 1 ? outs[0].key : key;
}

/** The record an item's price comes from (`valueSource`), as a key: the owner's usual way to have it. */
function anchorOf(book, entry) {
    const id = entry?.kind === KIND.ITEM ? entry.def?.valueSource : null;
    if (typeof id !== 'string' || !id) return null;
    if (book.entryOf(recipeKey(id))) return recipeKey(id);
    if (book.entryOf(tokenKey(id))) return tokenKey(id);
    return null;
}

const usualness = (row) => (row.oneOff ? 2 : REPEATED.has(row.how) ? 0 : BY_CHANCE.has(row.how) ? 1 : 3);
const chanceOf = (row) => (row.firstKill ? 0 : finite(row.chance, 1));

/** The words a chip says for a way in or a thing given (a key under `encyclopedia.chip`). */
function wordsIn(how, oneOff) {
    if (oneOff) return 'found';
    return {
        [HOW.STARTER_BANK]: 'starterBank', [HOW.STARTER_TOOL]: 'starterTool', [HOW.STARTER_CAMP]: 'starterCamp',
        [HOW.HALL]: 'guildHall'
    }[how] || how;
}

/** The words a chip says for a thing spent by what is on its right. */
const WORDS_SPENT = Object.freeze({
    [HOW.WORK]: 'spentWorking', [HOW.CATCH]: 'bait', [HOW.SPAWN]: 'upkeep', [HOW.GROW]: 'feedsGrowth',
    [HOW.SHOP]: 'paysFor', [HOW.UPCYCLE]: 'upcycle', [HOW.HOLD]: 'toolFor'
});

const blankWay = () => ({
    how: null, words: null, place: null, places: 0, chance: null, firstKill: false, gate: null,
    takes: null, makes: null, recipe: null, from: null, fromAmount: null, inputs: [], to: null
});

/** One way in to `key` from a `sourcesOf` row. */
function wayIn(book, row) {
    const way = { ...blankWay(), how: row.how, words: wordsIn(row.how, row.oneOff), chance: row.chance, firstKill: row.firstKill };
    const inputs = (row.inputs || []).filter(i => i.key !== row.via && book.entryOf(i.key));
    if (row.how === HOW.CRAFT) {
        const stations = stationsOf(book, row.via);
        way.recipe = row.via;
        way.place = stations[0]?.via ?? null;
        way.places = Math.max(0, stations.length - 1);
        way.gate = recipeGate(book, row.via, stations);
        way.makes = finite(row.perCycle, 1) > 0 ? finite(row.perCycle, 1) : 1;
        way.inputs = inputs;
        return way;
    }
    if (BARE.has(row.how)) return way;
    if (row.how === HOW.SHOP) {
        way.inputs = inputs;
        return way;
    }
    if (row.how === HOW.UPCYCLE) {
        way.from = row.via;
        way.fromAmount = (row.inputs || []).find(i => i.key === row.via)?.quantity ?? null;
        return way;
    }
    way.from = row.via && book.entryOf(row.via) ? row.via : null;
    way.gate = topGate(row.gates);
    way.inputs = inputs;
    return way;
}

/** A recipe's own way in: its inputs, run at its station (one branch, however many stations offer it). */
function recipeWayIn(book, key) {
    const stations = stationsOf(book, key);
    const way = { ...blankWay(), how: stations[0]?.how ?? HOW.CRAFT, words: stations[0]?.how ?? HOW.CRAFT };
    way.place = stations[0]?.via ?? null;
    way.places = Math.max(0, stations.length - 1);
    way.gate = recipeGate(book, key, stations);
    const inputs = stations[0]?.inputs
        ?? (Array.isArray(book.entryOf(key)?.def?.inputs) ? book.entryOf(key).def.inputs : [])
            .filter(i => typeof i?.itemId === 'string')
            .map(i => ({ key: itemKey(i.itemId), quantity: Math.max(0, finite(Number(i.quantity), 1)) }));
    way.inputs = inputs.filter(i => book.entryOf(i.key));
    return way;
}

const memo = new WeakMap();
const cached = (book, side, key, make) => {
    if (!memo.has(book)) memo.set(book, { in: new Map(), out: new Map() });
    const map = memo.get(book)[side];
    if (!map.has(key)) map.set(key, make());
    return map.get(key);
};

/**
 * Every way to have `key`, the most usual first: the one its price comes from (`valueSource`),
 * then the way the guild first reaches it, then the repeated ways (a station, a vein, a map) before
 * drops, one-off finds and the rest (the Shop, the opening Bank), then the likelier, then by name.
 */
export function waysIn(book, key) {
    return cached(book, 'in', key, () => {
        const entry = book.entryOf(key);
        if (!entry) return [];
        if (entry.kind === KIND.RECIPE) return [recipeWayIn(book, key)];
        const anchor = anchorOf(book, entry);
        const first = book.reachOf(key)?.rule;
        const rank = (row) => [
            row.via && row.via === anchor ? 0 : 1,
            first && first.how === row.how && first.via === row.via ? 0 : 1,
            usualness(row),
            -chanceOf(row)
        ];
        const name = (row) => (row.via ? book.nameOf(row.via) : '');
        return book.sourcesOf(key)
            .map((row, i) => ({ row, i, rank: rank(row) }))
            .sort((a, b) => {
                for (let k = 0; k < a.rank.length; k++) if (a.rank[k] !== b.rank[k]) return a.rank[k] - b.rank[k];
                return name(a.row).localeCompare(name(b.row)) || a.i - b.i;
            })
            .map(({ row }) => wayIn(book, row));
    });
}

/**
 * Everything `key` goes into or gives, each once: what spends it (a recipe's output, the Token it
 * is spent working), what it gives (a vein's ore, an enemy's drops, a station's recipes). Likelier
 * first, then the lower level, then by name.
 */
export function waysOut(book, key) {
    return cached(book, 'out', key, () => {
        if (!book.entryOf(key)) return [];
        const out = [];
        for (const u of book.usesOf(key)) {
            const way = { ...blankWay(), how: u.how };
            if (u.how === HOW.CRAFT) {
                const stations = stationsOf(book, u.by);
                way.words = HOW.CRAFT;
                way.recipe = u.by;
                way.to = madeBy(book, u.by);
                way.place = stations[0]?.via ?? null;
                way.places = Math.max(0, stations.length - 1);
                way.gate = recipeGate(book, u.by, stations);
            } else {
                way.words = u.nearby ? 'growNearby' : WORDS_SPENT[u.how] || u.how;
                way.to = u.by;
            }
            way.takes = Number.isFinite(u.quantity) ? u.quantity : null;
            out.push(way);
        }
        for (const g of book.givesOf(key)) {
            const way = { ...blankWay(), how: g.how, chance: g.chance, firstKill: g.firstKill, gate: topGate(g.gates) };
            if (g.how === HOW.STATION || g.how === HOW.BUILD) {
                way.words = g.how;
                way.recipe = g.key;
                way.to = madeBy(book, g.key);
            } else {
                way.words = g.how === HOW.CRAFT ? 'makes' : wordsIn(g.how, false);
                way.to = g.key;
                if (g.how === HOW.CRAFT) way.makes = finite(g.perCycle, 1);
            }
            out.push(way);
        }
        const seen = new Set();
        const kept = out.filter(w => {
            const k = `${w.how}|${w.to}`;
            if (!w.to || !book.entryOf(w.to) || w.to === key || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
        const chance = (w) => (w.firstKill ? 0 : finite(w.chance, 1));
        return kept
            .map((w, i) => ({ w, i }))
            .sort((a, b) => chance(b.w) - chance(a.w)
                || (a.w.gate?.level ?? 0) - (b.w.gate?.level ?? 0)
                || book.nameOf(a.w.to).localeCompare(book.nameOf(b.w.to))
                || a.i - b.i)
            .map(({ w }) => w);
    });
}

/**
 * The chart from `start`, grown where the player clicked: every node `{ id, key, side, amount,
 * need, repeat, canGrow, grown, ins, outs, moreIns, moreOuts }`. `side` is 'start', 'in' (left of
 * the start: grows further left) or 'out' (right: grows further right). `amount` is how many one
 * step takes (×2 Iron Ore to an ingot); `need` how many one of the start takes, down that path
 * (unrounded). A node `repeat`s an entry already on its path (seeds that make seeds) and never
 * grows. `ins` are branches `{ id, way, from, inputs }` (`from` the Token or thing the way starts
 * at, `inputs` what it spends), `outs` uses `{ id, way, node }`; each shows `SHOWN_AT_FIRST`
 * until its list is opened, the rest counted in `moreIns` / `moreOuts`.
 *
 * @param {Set<string>} grown   node ids clicked to grow
 * @param {Set<string>} opened  node ids whose long list ("more") was opened, as `${id}<` or `${id}>`
 */
export function chartOf(book, start, { grown = new Set(), opened = new Set() } = {}) {
    const make = (id, key, side, path, amount, need) => {
        const repeat = path.includes(key);
        const ways = side === 'in' ? waysIn(book, key) : side === 'out' ? waysOut(book, key) : null;
        return {
            id, key, side, amount, need, repeat,
            canGrow: !repeat && !!ways && ways.length > 0,
            grown: side === 'start',
            ins: null, outs: null, moreIns: 0, moreOuts: 0
        };
    };

    const growIn = (node, path) => {
        const all = waysIn(book, node.key);
        const shown = opened.has(`${node.id}<`) ? all : all.slice(0, SHOWN_AT_FIRST);
        node.moreIns = all.length - shown.length;
        const here = [...path, node.key];
        const per = Number.isFinite(node.need) ? node.need : 1;
        node.ins = shown.map((way, i) => {
            const id = `${node.id}<${i}`;
            const makes = way.makes > 0 ? way.makes : 1;
            const from = way.from
                ? make(`${id}f`, way.from, 'in', here, way.fromAmount, way.fromAmount != null ? per * way.fromAmount : null)
                : null;
            const inputs = way.inputs.map((input, j) => make(`${id}.${j}`, input.key, 'in', here, input.quantity, per * input.quantity / makes));
            for (const child of [from, ...inputs]) if (child) visit(child, here);
            return { id, way, from, inputs };
        });
    };

    const growOut = (node, path) => {
        const all = waysOut(book, node.key);
        const shown = opened.has(`${node.id}>`) ? all : all.slice(0, SHOWN_AT_FIRST);
        node.moreOuts = all.length - shown.length;
        const here = [...path, node.key];
        node.outs = shown.map((way, i) => {
            const id = `${node.id}>${i}`;
            const child = make(`${id}n`, way.to, 'out', here, null, null);
            visit(child, here);
            return { id, way, node: child };
        });
    };

    const visit = (node, path) => {
        if (!node.canGrow || !grown.has(node.id)) return;
        node.grown = true;
        if (node.side === 'in') growIn(node, path);
        else growOut(node, path);
    };

    const root = make(ROOT, start, 'start', [], null, 1);
    root.canGrow = false;
    if (book.entryOf(start)) {
        growIn(root, []);
        growOut(root, []);
    }
    return root;
}

/** Every node of a chart, the start first, then down each side in order. */
export function nodesOf(chart) {
    const out = [];
    const walk = (node) => {
        out.push(node);
        for (const b of node.ins || []) for (const child of [b.from, ...b.inputs]) if (child) walk(child);
        for (const u of node.outs || []) walk(u.node);
    };
    walk(chart);
    return out;
}

/** The node with `id`, or null. */
export const findNode = (chart, id) => nodesOf(chart).find(n => n.id === id) ?? null;

/** A need as the screen shows it: whole units, rounded up (half an ingot is still an ingot to make). */
export const needText = (need) => (Number.isFinite(need) ? Math.max(1, Math.ceil(need - 1e-9)) : null);

// ── where everything sits ─────────────────────────────────────────────────────────────────────

/**
 * The chart's measures in screen pixels at the default text size. `chartMetrics` scales them with
 * the Text size setting so the words keep their room.
 */
export const CHART_METRICS = Object.freeze({
    nodeW: 200,
    nodeH: 64,
    chipW: 132,
    /** A branch is never shorter than its chip's words. */
    chipH: 64,
    gapX: 24,
    rowGap: 8,
    /** Between two "or" branches: room for the word. */
    orGap: 24,
    moreH: 28
});

/** `CHART_METRICS` at a body text size of `bodyPx` (16 by default), in whole pixels. */
export function chartMetrics(bodyPx = 16) {
    const k = Math.max(1, (Number(bodyPx) || 16) / 16);
    const out = {};
    for (const [name, value] of Object.entries(CHART_METRICS)) out[name] = Math.round(value * k);
    return out;
}

/**
 * Where every box of a chart sits, in pixels around the start's centre (0, 0):
 * `{ nodes: [{ id, node, x, y, w, h }], chips: [{ id, way, side, x, y, w, h, parent }],
 * links: [{ id, points: [[x, y], …], into }], ors: [{ id, x, y }], mores: [{ id, open, count, x, y, w, h }],
 * box: { left, top, right, bottom } }`. A chip's y is its centre (its words set its own height).
 *
 * Each node stands in the middle of the block its grown side takes; branches stack top to bottom
 * in order, an "or" between each. Lines run from a thing's edge to its chip and on into the node
 * it feeds, square-cornered.
 */
export function layoutChart(chart, m = CHART_METRICS) {
    const pitch = m.nodeW + m.chipW + 2 * m.gapX;
    const nodes = [];
    const chips = [];
    const links = [];
    const ors = [];
    const mores = [];

    const branchItems = (b) => (b.from ? [b.from, ...b.inputs] : b.inputs);

    // Heights, memoised per node and side.
    const leftMemo = new Map();
    const rightMemo = new Map();
    const stackH = (list, gap, each) => list.reduce((sum, x) => sum + each(x), 0) + gap * Math.max(0, list.length - 1);
    const branchH = (b) => Math.max(m.chipH, stackH(branchItems(b), m.rowGap, leftH));
    const leftBlock = (node) => {
        if (!node.ins) return 0;
        return stackH(node.ins, m.orGap, branchH) + (node.moreIns ? m.rowGap + m.moreH : 0);
    };
    const leftH = (node) => {
        if (!leftMemo.has(node.id)) leftMemo.set(node.id, Math.max(m.nodeH, leftBlock(node)));
        return leftMemo.get(node.id);
    };
    const useH = (u) => Math.max(m.chipH, rightH(u.node));
    const rightBlock = (node) => {
        if (!node.outs) return 0;
        return stackH(node.outs, m.rowGap, useH) + (node.moreOuts ? m.rowGap + m.moreH : 0);
    };
    const rightH = (node) => {
        if (!rightMemo.has(node.id)) rightMemo.set(node.id, Math.max(m.nodeH, rightBlock(node)));
        return rightMemo.get(node.id);
    };

    const putNode = (node, cx, cy) => nodes.push({ id: node.id, node, x: Math.round(cx - m.nodeW / 2), y: Math.round(cy - m.nodeH / 2), w: m.nodeW, h: m.nodeH });
    const r = (v) => Math.round(v);

    const placeLeft = (node, cx, cy) => {
        if (!node.ins) return;
        const total = leftBlock(node);
        let top = cy - total / 2;
        const intoX = cx - m.nodeW / 2;
        const chipCx = intoX - m.gapX - m.chipW / 2;
        const trunkX = intoX - m.gapX / 2;
        node.ins.forEach((b, i) => {
            const h = branchH(b);
            const by = top + h / 2;
            chips.push({ id: b.id, way: b.way, side: 'in', parent: node.id, x: r(chipCx - m.chipW / 2), y: r(by), w: m.chipW, h: m.chipH });
            links.push({ id: `${b.id}>`, into: node.id, points: [[r(chipCx + m.chipW / 2), r(by)], [r(trunkX), r(by)], [r(trunkX), r(cy)], [r(intoX), r(cy)]] });
            const items = branchItems(b);
            const itemsH = stackH(items, m.rowGap, leftH);
            let itemTop = by - itemsH / 2;
            const childCx = cx - pitch;
            const feedX = childCx + m.nodeW / 2 + m.gapX / 2;
            for (const item of items) {
                const ih = leftH(item);
                const icy = itemTop + ih / 2;
                putNode(item, childCx, icy);
                links.push({ id: `${item.id}>`, into: b.id, points: [[r(childCx + m.nodeW / 2), r(icy)], [r(feedX), r(icy)], [r(feedX), r(by)], [r(chipCx - m.chipW / 2), r(by)]] });
                placeLeft(item, childCx, icy);
                itemTop += ih + m.rowGap;
            }
            top += h;
            if (i < node.ins.length - 1) {
                ors.push({ id: `${b.id}or`, x: r(chipCx), y: r(top + m.orGap / 2) });
                top += m.orGap;
            }
        });
        if (node.moreIns) {
            mores.push({ id: `${node.id}<`, side: 'in', count: node.moreIns, x: r(chipCx - m.chipW / 2), y: r(top + m.rowGap), w: m.chipW, h: m.moreH });
        }
    };

    const placeRight = (node, cx, cy) => {
        if (!node.outs) return;
        const total = rightBlock(node);
        let top = cy - total / 2;
        const fromX = cx + m.nodeW / 2;
        const trunkX = fromX + m.gapX / 2;
        const chipCx = fromX + m.gapX + m.chipW / 2;
        const childCx = cx + pitch;
        node.outs.forEach((u) => {
            const h = useH(u);
            const uy = top + h / 2;
            chips.push({ id: u.id, way: u.way, side: 'out', parent: node.id, x: r(chipCx - m.chipW / 2), y: r(uy), w: m.chipW, h: m.chipH });
            links.push({ id: `${u.id}<`, into: u.id, points: [[r(fromX), r(cy)], [r(trunkX), r(cy)], [r(trunkX), r(uy)], [r(chipCx - m.chipW / 2), r(uy)]] });
            links.push({ id: `${u.id}>`, into: u.node.id, points: [[r(chipCx + m.chipW / 2), r(uy)], [r(childCx - m.nodeW / 2), r(uy)]] });
            putNode(u.node, childCx, uy);
            placeRight(u.node, childCx, uy);
            top += h + m.rowGap;
        });
        if (node.moreOuts) {
            mores.push({ id: `${node.id}>`, side: 'out', count: node.moreOuts, x: r(childCx - m.nodeW / 2), y: r(top), w: m.nodeW, h: m.moreH });
        }
    };

    putNode(chart, 0, 0);
    placeLeft(chart, 0, 0);
    placeRight(chart, 0, 0);

    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const grow = (x0, y0, x1, y1) => {
        box.left = Math.min(box.left, x0); box.top = Math.min(box.top, y0);
        box.right = Math.max(box.right, x1); box.bottom = Math.max(box.bottom, y1);
    };
    for (const n of nodes) grow(n.x, n.y, n.x + n.w, n.y + n.h);
    for (const c of chips) grow(c.x, c.y - c.h / 2, c.x + c.w, c.y + c.h / 2);
    for (const mo of mores) grow(mo.x, mo.y, mo.x + mo.w, mo.y + mo.h);
    return { nodes, chips, links, ors, mores, box };
}

/** The box a node and everything grown from it take, from a layout. */
export function grownBox(layout, id) {
    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const within = (other) => other === id || other.startsWith(id + '<') || other.startsWith(id + '>');
    const add = (x0, y0, x1, y1) => {
        box.left = Math.min(box.left, x0); box.top = Math.min(box.top, y0);
        box.right = Math.max(box.right, x1); box.bottom = Math.max(box.bottom, y1);
    };
    for (const n of layout.nodes) if (within(n.id)) add(n.x, n.y, n.x + n.w, n.y + n.h);
    for (const c of layout.chips) if (within(c.id)) add(c.x, c.y - c.h / 2, c.x + c.w, c.y + c.h / 2);
    return Number.isFinite(box.left) ? box : null;
}

/**
 * The pan that keeps `target` (chart pixels) in sight with the least move: none when it already
 * shows inside `pad`; when it is bigger than the view, `focus` (its own node) is kept in sight,
 * as near the side the target grew toward as it goes. `view` is the chart's offset in the
 * viewport (`w` × `h`): a chart point p shows at p + view.
 */
export function keepInSight(view, viewport, target, focus = target, pad = 24) {
    const axis = (offset, size, lo, hi, flo, fhi) => {
        const room = size - 2 * pad;
        if (hi - lo <= room) {
            if (lo + offset < pad) return pad - lo;
            if (hi + offset > size - pad) return size - pad - hi;
            return offset;
        }
        // Too big: keep the focus in, with as much of the rest on the side it grew as fits;
        // grown both ways about evenly (a tall stack around it), centred.
        const before = flo - lo;
        const after = hi - fhi;
        if (Math.abs(before - after) <= pad) return size / 2 - (flo + fhi) / 2;
        return before > after ? size - pad - fhi : pad - flo;
    };
    return {
        x: Math.round(axis(view.x, viewport.w, target.left, target.right, focus.left, focus.right)),
        y: Math.round(axis(view.y, viewport.h, target.top, target.bottom, focus.top, focus.bottom))
    };
}

/** The pan that centres a box. */
export const centreOn = (viewport, box) => ({
    x: Math.round(viewport.w / 2 - (box.left + box.right) / 2),
    y: Math.round(viewport.h / 2 - (box.top + box.bottom) / 2)
});

/** A pan held so some of the chart (`margin` px) always shows: a drag can't lose it. */
export function clampPan(view, viewport, box, margin = 96) {
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    return {
        x: Math.round(clamp(view.x, margin - box.right, viewport.w - margin - box.left)),
        y: Math.round(clamp(view.y, margin - box.bottom, viewport.h - margin - box.top))
    };
}

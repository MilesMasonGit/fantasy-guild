// the encyclopedia's flowchart: what flows into an entry and out of it, grown a step at a time, and where each box sits

import { HOW, COMBAT, itemKey, tokenKey, recipeKey } from '../../../systems/progression/ledger/engine.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';
import { getSkill, isCombatSkill } from '../../../config/registries/skillRegistry.js';
import { KIND } from './encyclopediaModel.js';

/**
 * The chart reads left to right around the entry it starts from: its **ways in** come from the
 * left, one stacked "or" branch each, the most usual first; its **uses** go out to the right. Every
 * box is an entry: a crafted thing's way in is its ingredients and the **station type** that makes
 * it (every station of its recipe's skill, an entry of its own whose ways in are those stations). What a
 * box asks of a hero (a skill and level) sits above it; a drop's odds sit on the dropping box. A box
 * on the left grows further left, one on the right further right; an open box folds away again.
 * Reads the encyclopedia only.
 */

/** How many ways in, or uses, a node shows before its stem count opens the rest. */
export const SHOWN_AT_FIRST = 8;

/** The start's id: every other node's id is its path from here. */
export const ROOT = 's';

/** The kind of a station-type entry: every station of one skill (Cooking: Campfire, Cooking Pot, …). */
export const STATIONS = 'stations';

/** A way in from a station type to one of its stations. */
const MEMBER = 'member';

/** Ways in that a guild repeats (a station, a vein, a map's Tokens): the usual ones, before chance and finds. */
const REPEATED = new Set([
    HOW.CRAFT, HOW.STATION, HOW.BUILD, HOW.WORK, HOW.CATCH, HOW.TRICKLE, HOW.UPGRADE,
    HOW.MAP, HOW.MODIFIER, HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW
]);
const BY_CHANCE = new Set([HOW.DROP, HOW.BONUS]);
/** Ways in with nothing to draw on their left: only their words say it. */
const BARE = new Set([HOW.STARTER_BANK, HOW.STARTER_TOOL, HOW.STARTER_CAMP, HOW.HALL, HOW.TUTORIAL]);

const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/** Where a recipe is run, the first-reached station first, then by name: the station or Foundation rows. */
function stationsOf(book, key) {
    const rows = book.sourcesOf(key).filter(r => (r.how === HOW.STATION || r.how === HOW.BUILD) && book.entryOf(r.via));
    const first = book.reachOf(key)?.via;
    return [...rows].sort((a, b) => (a.via === first ? 0 : 1) - (b.via === first ? 0 : 1) || book.nameOf(a.via).localeCompare(book.nameOf(b.via)));
}

const memo = new WeakMap();
const store = (book) => {
    if (!memo.has(book)) memo.set(book, { in: new Map(), out: new Map(), types: null, typeOf: new Map() });
    return memo.get(book);
};
const cached = (book, side, key, make) => {
    const map = store(book)[side];
    if (!map.has(key)) map.set(key, make());
    return map.get(key);
};

/**
 * The station type a recipe is made at: every station whose recipes use its skill (a Cooking
 * Station is the Campfire, the Cooking Pot, the Kitchen, the Brewery…), read from what offers
 * each recipe. Null for a recipe nothing offers.
 */
function stationTypeOfRecipe(book, key) {
    const s = store(book);
    if (s.typeOf.has(key)) return s.typeOf.get(key);
    const def = book.entryOf(key)?.def;
    const rows = def?.skill ? stationsOf(book, key) : [];
    const type = rows.length
        ? {
            key: `station:${def.skill}`, kind: STATIONS, id: `station:${def.skill}`,
            name: `${getSkill(def.skill)?.name || capital(def.skill)} Station`, def: { skill: def.skill },
            members: [...new Set(rows.map(r => r.via))]
        }
        : null;
    s.typeOf.set(key, type);
    return type;
}

/** Every station type, by key (built once per encyclopedia, from every recipe). */
function stationTypes(book) {
    const s = store(book);
    if (!s.types) {
        s.types = new Map();
        for (const recipe of book.byKind[KIND.RECIPE]) {
            const type = stationTypeOfRecipe(book, recipe.key);
            if (!type) continue;
            const known = s.types.get(type.key);
            if (!known) s.types.set(type.key, { ...type, members: [...type.members] });
            else for (const m of type.members) if (!known.members.includes(m)) known.members.push(m);
        }
    }
    return s.types;
}

/** The entry behind any chart key: an item, Token, enemy, recipe, or a station type. */
export function entryOfKey(book, key) {
    return book.entryOf(key) ?? (typeof key === 'string' && key.startsWith('station:') ? stationTypes(book).get(key) ?? null : null);
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

/** The words for a way with no box on its left (the opening Bank, the Shop): a key under `encyclopedia.via`. */
function captionOf(how) {
    return {
        [HOW.STARTER_BANK]: 'starterBank', [HOW.STARTER_TOOL]: 'starterTool', [HOW.STARTER_CAMP]: 'starterCamp',
        [HOW.HALL]: 'guildHall', [HOW.TUTORIAL]: 'tutorial', [HOW.SHOP]: 'shop'
    }[how] ?? null;
}

const blankWay = () => ({
    how: null, recipe: null, from: null, fromAmount: null, inputs: [], to: null,
    chance: null, firstKill: false, takes: null, makes: null, caption: null
});

/** A recipe's inputs as the ledger spends them (a crop's seed per harvest), else as authored. */
function recipeInputs(book, key, row = null) {
    const inputs = row?.inputs
        ?? stationsOf(book, key)[0]?.inputs
        ?? (Array.isArray(book.entryOf(key)?.def?.inputs) ? book.entryOf(key).def.inputs : [])
            .filter(i => typeof i?.itemId === 'string')
            .map(i => ({ key: itemKey(i.itemId), quantity: Math.max(0, finite(Number(i.quantity), 1)) }));
    return inputs.filter(i => book.entryOf(i.key));
}

/** One way in from a `sourcesOf` row. */
function wayIn(book, row) {
    const way = { ...blankWay(), how: row.how, chance: row.chance, firstKill: row.firstKill, caption: captionOf(row.how) };
    if (row.how === HOW.CRAFT) {
        way.recipe = row.via;
        way.from = stationTypeOfRecipe(book, row.via)?.key ?? null;
        way.makes = finite(row.perCycle, 1) > 0 ? finite(row.perCycle, 1) : 1;
        way.inputs = recipeInputs(book, row.via, row);
        return way;
    }
    if (BARE.has(row.how)) return way;
    const inputs = (row.inputs || []).filter(i => i.key !== row.via && book.entryOf(i.key));
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
    way.inputs = inputs;
    return way;
}

/**
 * Every way to have `key`, the most usual first: the one its price comes from (`valueSource`),
 * then the way the guild first reaches it, then the repeated ways (a recipe, a vein, a map) before
 * drops, one-off finds and the rest (the Shop, the opening Bank), then the likelier, then by name.
 * A recipe is one way however many stations make it; a recipe entry's own way is its station type
 * and inputs; a station type's ways are its stations.
 */
export function waysIn(book, key) {
    return cached(book, 'in', key, () => {
        const entry = entryOfKey(book, key);
        if (!entry) return [];
        if (entry.kind === STATIONS) {
            return [...entry.members]
                .sort((a, b) => book.nameOf(a).localeCompare(book.nameOf(b)))
                .map(member => ({ ...blankWay(), how: MEMBER, from: member }));
        }
        if (entry.kind === KIND.RECIPE) {
            return [{ ...blankWay(), how: HOW.CRAFT, from: stationTypeOfRecipe(book, key)?.key ?? null, inputs: recipeInputs(book, key) }];
        }
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
 * is spent working), what it gives (a vein's ore, an enemy's drops, a station's recipes; a station
 * type gives what its stations make). Likelier first, then the lower level, then by name.
 */
export function waysOut(book, key) {
    return cached(book, 'out', key, () => {
        const entry = entryOfKey(book, key);
        if (!entry) return [];
        const out = [];
        if (entry.kind === STATIONS) {
            for (const member of entry.members) {
                for (const g of book.givesOf(member)) {
                    if (g.how === HOW.STATION || g.how === HOW.BUILD) out.push({ ...blankWay(), how: g.how, recipe: g.key, to: madeBy(book, g.key) });
                }
            }
        }
        for (const u of book.usesOf(key)) {
            const way = { ...blankWay(), how: u.nearby ? 'growNearby' : u.how };
            if (u.how === HOW.CRAFT) {
                way.recipe = u.by;
                way.to = madeBy(book, u.by);
            } else {
                way.to = u.by;
            }
            way.takes = Number.isFinite(u.quantity) ? u.quantity : null;
            out.push(way);
        }
        for (const g of book.givesOf(key)) {
            const way = { ...blankWay(), how: g.how, chance: g.chance, firstKill: g.firstKill };
            if (g.how === HOW.STATION || g.how === HOW.BUILD) {
                way.recipe = g.key;
                way.to = madeBy(book, g.key);
            } else {
                way.to = g.key;
                if (g.how === HOW.CRAFT) way.makes = finite(g.perCycle, 1);
            }
            out.push(way);
        }
        const seen = new Set();
        const kept = out.filter(w => {
            if (!w.to || !book.entryOf(w.to) || w.to === key || seen.has(w.to)) return false;
            seen.add(w.to);
            return true;
        });
        const chance = (w) => (w.firstKill ? 0 : finite(w.chance, 1));
        const level = (w) => requirementOf(book, w.to, w.recipe)?.level ?? 0;
        return kept
            .map((w, i) => ({ w, i }))
            .sort((a, b) => chance(b.w) - chance(a.w)
                || level(a.w) - level(b.w)
                || book.nameOf(a.w.to).localeCompare(book.nameOf(b.w.to))
                || a.i - b.i)
            .map(({ w }) => w);
    });
}

/** A skill as a requirement names it: any fighting style is Combat. */
const requirementSkill = (skill) => (skill === COMBAT || isCombatSkill(skill) ? COMBAT : skill);

/** A recipe's skill and level, with the stations that make it (named on hover). */
function recipeRequirement(book, key) {
    const def = book.entryOf(key)?.def;
    if (!def?.skill) return null;
    return {
        skill: requirementSkill(def.skill),
        level: Math.max(1, Math.floor(finite(Number(def.levelRequirement), 1))),
        recipe: key,
        stations: stationsOf(book, key).map(r => r.via).filter((k, i, all) => all.indexOf(k) === i)
    };
}

/**
 * What a box asks of a hero, shown above it: a crafted thing its recipe's skill and level (the
 * recipe it is reached through, else its most usual one), a vein or a chest the skill to work it,
 * an enemy Combat at its level. Null for a station or a station type (their recipes ask it), and
 * for what asks nothing.
 */
export function requirementOf(book, key, recipe = null) {
    if (recipe) return recipeRequirement(book, recipe);
    const entry = entryOfKey(book, key);
    if (!entry || entry.kind === STATIONS) return null;
    if (entry.kind === KIND.RECIPE) return recipeRequirement(book, key);
    if (entry.kind === KIND.ITEM) {
        const craft = waysIn(book, key).find(w => w.recipe);
        return craft ? recipeRequirement(book, craft.recipe) : null;
    }
    if (entry.kind === KIND.ENEMY) {
        const level = Math.floor(finite(Number(entry.def?.enemy?.level), 0));
        return level > 0 ? { skill: COMBAT, level } : null;
    }
    if (stationSkillOf(entry.def)) return null;
    const skill = entry.def?.config?.skill;
    if (typeof skill !== 'string' || !skill) return null;
    return { skill: requirementSkill(skill), level: Math.max(1, Math.floor(finite(Number(entry.def.config.skillRequired), 1))) };
}

/** How many lines a way draws into the box it feeds: its things, or its words alone. */
const linksOfWay = (way) => (way.from ? 1 : 0) + way.inputs.length + (way.from || way.inputs.length ? 0 : 1);

/**
 * The chart from `start`, grown where the player clicked: every node `{ id, key, side, amount,
 * need, recipe, chance, firstKill, repeat, canGrow, grown, ins, outs, hiddenIn, hiddenOut }`.
 * `side` is 'start', 'in' (left of the start: grows further left) or 'out' (right: grows further
 * right). `amount` is how many one step takes (×2 Iron Ore to an ingot); `need` how many one of the
 * start takes, down that path (unrounded). `recipe` is the recipe a use is made by (its level
 * shows above it); `chance` the odds of the line that reaches it (a drop). A node `repeat`s an
 * entry already on its path (seeds that make seeds) and never grows. `ins` are branches
 * `{ id, way, from, inputs }`, `outs` uses `{ id, way, node }`; each shows `SHOWN_AT_FIRST` until
 * opened. `hiddenIn` / `hiddenOut` count the lines on each side of a box not on screen.
 *
 * @param {Set<string>} grown   node ids clicked open
 * @param {Set<string>} opened  node ids whose long list was opened, as `${id}<` or `${id}>`
 */
export function chartOf(book, start, { grown = new Set(), opened = new Set() } = {}) {
    const make = (id, key, side, path, link) => {
        const repeat = path.includes(key);
        const ways = side === 'in' ? waysIn(book, key) : side === 'out' ? waysOut(book, key) : null;
        return {
            id, key, side, repeat,
            amount: link.amount ?? null,
            need: link.need ?? null,
            recipe: link.recipe ?? null,
            chance: link.chance ?? null,
            firstKill: link.firstKill === true,
            neighbour: link.neighbour ?? null,
            canGrow: !repeat && !!ways && ways.length > 0,
            grown: side === 'start',
            ins: null, outs: null, hiddenIn: 0, hiddenOut: 0
        };
    };

    const growIn = (node, path) => {
        const all = waysIn(book, node.key);
        const shown = opened.has(`${node.id}<`) ? all : all.slice(0, SHOWN_AT_FIRST);
        const here = [...path, node.key];
        const per = Number.isFinite(node.need) ? node.need : 1;
        node.ins = shown.map((way, i) => {
            const id = `${node.id}<${i}`;
            const makes = way.makes > 0 ? way.makes : 1;
            const from = way.from
                ? make(`${id}f`, way.from, 'in', here, {
                    amount: way.fromAmount,
                    need: way.fromAmount != null ? per * way.fromAmount : null,
                    chance: way.chance, firstKill: way.firstKill, neighbour: node.key
                })
                : null;
            const inputs = way.inputs.map((input, j) => make(`${id}.${j}`, input.key, 'in', here, {
                amount: input.quantity, need: per * input.quantity / makes, neighbour: node.key
            }));
            for (const child of [from, ...inputs]) if (child) visit(child, here);
            return { id, way, from, inputs };
        });
    };

    const growOut = (node, path) => {
        const all = waysOut(book, node.key);
        const shown = opened.has(`${node.id}>`) ? all : all.slice(0, SHOWN_AT_FIRST);
        const here = [...path, node.key];
        node.outs = shown.map((way, i) => {
            const id = `${node.id}>${i}`;
            const child = make(`${id}n`, way.to, 'out', here, {
                recipe: way.recipe, chance: way.chance, firstKill: way.firstKill, neighbour: node.key
            });
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

    const root = make(ROOT, start, 'start', [], { need: 1 });
    root.canGrow = false;
    if (entryOfKey(book, start)) {
        growIn(root, []);
        growOut(root, []);
    }
    for (const node of nodesOf(root)) countHidden(book, node);
    return root;
}

/** The lines on each side of a box that are not on screen. */
function countHidden(book, node) {
    const ins = waysIn(book, node.key);
    const outs = waysOut(book, node.key);
    const totalIn = ins.reduce((n, w) => n + linksOfWay(w), 0);
    let drawnIn = 0;
    if (node.ins) drawnIn = node.ins.reduce((n, b) => n + linksOfWay(b.way), 0);
    else if (node.side === 'out' && node.neighbour) {
        drawnIn = ins.some(w => w.from === node.neighbour || w.inputs.some(i => i.key === node.neighbour)) ? 1 : 0;
    }
    let drawnOut = 0;
    if (node.outs) drawnOut = node.outs.length;
    else if (node.side === 'in' && node.neighbour) drawnOut = outs.some(w => w.to === node.neighbour) ? 1 : 0;
    node.hiddenIn = Math.max(0, totalIn - drawnIn);
    node.hiddenOut = Math.max(0, outs.length - drawnOut);
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

/** Whether `id` is `of` or lies in what `of` grew. */
export const within = (id, of) => id === of || id.startsWith(`${of}<`) || id.startsWith(`${of}>`);

/** A need as the screen shows it: whole units, rounded up (half an ingot is still an ingot to make). */
export const needText = (need) => (Number.isFinite(need) ? Math.max(1, Math.ceil(need - 1e-9)) : null);

// ── where everything sits ─────────────────────────────────────────────────────────────────────

/**
 * The chart's measures in screen pixels at the default text size. `chartMetrics` scales them with
 * the Text size setting so the words keep their room.
 */
export const CHART_METRICS = Object.freeze({
    /** Room for a two-line name in capitals ("Fire Elemental Chief") beside the sprite and the inspect mark. */
    nodeW: 220,
    nodeH: 60,
    /** The skill-and-level line above a box. */
    reqH: 20,
    /** Between two columns: the lines, and a stem count on each side. */
    gapX: 72,
    stemW: 26,
    stemH: 16,
    rowGap: 8,
    /** Between two "or" branches: room for the word. */
    orGap: 20
});

/** `CHART_METRICS` at a body text size of `bodyPx` (16 by default), in whole pixels. */
export function chartMetrics(bodyPx = 16) {
    const k = Math.max(1, (Number(bodyPx) || 16) / 16);
    const out = {};
    for (const [name, value] of Object.entries(CHART_METRICS)) out[name] = Math.round(value * k);
    return out;
}

/**
 * Where every box of a chart sits, in pixels around the start (its box centred on x = 0, its
 * slot, the requirement line and box, centred on y = 0):
 * `{ nodes: [{ id, node, x, y, w, h }], captions: [{ id, words, x, y, w, h, label }],
 * links: [{ id, points: [[x, y], …], into }], ors: [{ id, x, y }], stems: [{ id, node, side, x, y, w, h }],
 * box: { left, top, right, bottom } }`. A node's x, y, w, h are its box; its requirement line sits
 * the `reqH` above it.
 *
 * Each node stands in the middle of the block its grown side takes; branches stack top to bottom
 * in order, an "or" between each. A branch's things join one line, which meets the other
 * branches' lines just before the box they feed; lines are square-cornered.
 */
export function layoutChart(chart, m = CHART_METRICS) {
    const pitch = m.nodeW + m.gapX;
    const slot = m.reqH + m.nodeH;
    const reach = Math.round(m.gapX * 0.4);
    const nodes = [];
    const captions = [];
    const links = [];
    const ors = [];
    const stems = [];
    const r = (v) => Math.round(v);

    const branchItems = (b) => (b.from ? [b.from, ...b.inputs] : b.inputs);
    const leftMemo = new Map();
    const rightMemo = new Map();
    const stackH = (list, gap, each) => list.reduce((sum, x) => sum + each(x), 0) + gap * Math.max(0, list.length - 1);
    const branchH = (b) => (branchItems(b).length ? stackH(branchItems(b), m.rowGap, leftH) : slot);
    const leftBlock = (node) => (node.ins ? stackH(node.ins, m.orGap, branchH) : 0);
    const leftH = (node) => {
        if (!leftMemo.has(node.id)) leftMemo.set(node.id, Math.max(slot, leftBlock(node)));
        return leftMemo.get(node.id);
    };
    const rightBlock = (node) => (node.outs ? stackH(node.outs, m.rowGap, u => rightH(u.node)) : 0);
    const rightH = (node) => {
        if (!rightMemo.has(node.id)) rightMemo.set(node.id, Math.max(slot, rightBlock(node)));
        return rightMemo.get(node.id);
    };

    /** A node centred in the block at `c`: its box's middle is half a requirement line below. */
    const anchorOf = (c) => r(c + m.reqH / 2);
    const putNode = (node, cx, c) => {
        const box = { id: node.id, node, x: r(cx - m.nodeW / 2), y: r(c - slot / 2 + m.reqH), w: m.nodeW, h: m.nodeH };
        nodes.push(box);
        const sy = box.y + box.h - m.stemH - 4;
        if (node.hiddenIn) stems.push({ id: `${node.id}|in`, node, side: 'in', count: node.hiddenIn, x: box.x - m.stemW, y: sy, w: m.stemW, h: m.stemH });
        if (node.hiddenOut) stems.push({ id: `${node.id}|out`, node, side: 'out', count: node.hiddenOut, x: box.x + box.w, y: sy, w: m.stemW, h: m.stemH });
    };

    const placeLeft = (node, cx, c) => {
        if (!node.ins) return;
        const a = anchorOf(c);
        let top = c - leftBlock(node) / 2;
        const intoX = r(cx - m.nodeW / 2);
        const trunkX = intoX - reach;
        const childCx = cx - pitch;
        const childRight = r(childCx + m.nodeW / 2);
        const joinX = childRight + reach;
        node.ins.forEach((b, i) => {
            const h = branchH(b);
            const bc = top + h / 2;
            const items = branchItems(b);
            let wayY;
            if (!items.length) {
                wayY = anchorOf(bc);
                captions.push({ id: b.id, words: b.way.caption, label: false, x: r(childCx - m.nodeW / 2), y: r(bc - slot / 2 + m.reqH), w: m.nodeW, h: m.nodeH });
                links.push({ id: `${b.id}~`, into: b.id, points: [[childRight, wayY], [joinX, wayY]] });
            } else {
                let itemTop = bc - stackH(items, m.rowGap, leftH) / 2;
                const anchors = [];
                for (const item of items) {
                    const ih = leftH(item);
                    const ic = itemTop + ih / 2;
                    putNode(item, childCx, ic);
                    anchors.push(anchorOf(ic));
                    placeLeft(item, childCx, ic);
                    itemTop += ih + m.rowGap;
                }
                wayY = r((anchors[0] + anchors[anchors.length - 1]) / 2);
                items.forEach((item, j) => {
                    links.push({ id: `${item.id}>`, into: b.id, points: [[childRight, anchors[j]], [joinX, anchors[j]], [joinX, wayY]] });
                });
                if (b.way.caption) captions.push({ id: `${b.id}~`, words: b.way.caption, label: true, x: r((joinX + trunkX) / 2), y: wayY - 10, w: 0, h: 0 });
            }
            links.push({ id: `${b.id}>`, into: node.id, points: [[joinX, wayY], [trunkX, wayY], [trunkX, a], [intoX, a]] });
            top += h;
            if (i < node.ins.length - 1) {
                ors.push({ id: `${b.id}or`, x: joinX, y: r(top + m.orGap / 2) });
                top += m.orGap;
            }
        });
    };

    const placeRight = (node, cx, c) => {
        if (!node.outs) return;
        const a = anchorOf(c);
        let top = c - rightBlock(node) / 2;
        const fromX = r(cx + m.nodeW / 2);
        const trunkX = fromX + reach;
        const childCx = cx + pitch;
        const childLeft = r(childCx - m.nodeW / 2);
        node.outs.forEach((u) => {
            const h = rightH(u.node);
            const uc = top + h / 2;
            const ua = anchorOf(uc);
            putNode(u.node, childCx, uc);
            links.push({ id: `${u.id}>`, into: u.node.id, points: [[fromX, a], [trunkX, a], [trunkX, ua], [childLeft, ua]] });
            placeRight(u.node, childCx, uc);
            top += h + m.rowGap;
        });
    };

    putNode(chart, 0, 0);
    placeLeft(chart, 0, 0);
    placeRight(chart, 0, 0);

    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const grow = (x0, y0, x1, y1) => {
        box.left = Math.min(box.left, x0); box.top = Math.min(box.top, y0);
        box.right = Math.max(box.right, x1); box.bottom = Math.max(box.bottom, y1);
    };
    for (const n of nodes) grow(n.x, n.y - m.reqH, n.x + n.w, n.y + n.h);
    for (const c of captions) if (!c.label) grow(c.x, c.y, c.x + c.w, c.y + c.h);
    for (const s of stems) grow(s.x, s.y, s.x + s.w, s.y + s.h);
    return { nodes, captions, links, ors, stems, box, reqH: m.reqH };
}

/** The box a node and everything grown from it take, from a layout. */
export function grownBox(layout, id) {
    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const add = (x0, y0, x1, y1) => {
        box.left = Math.min(box.left, x0); box.top = Math.min(box.top, y0);
        box.right = Math.max(box.right, x1); box.bottom = Math.max(box.bottom, y1);
    };
    const reqH = layout.reqH ?? 0;
    for (const n of layout.nodes) if (within(n.id, id)) add(n.x, n.y - reqH, n.x + n.w, n.y + n.h);
    for (const c of layout.captions || []) if (!c.label && within(c.id, id)) add(c.x, c.y, c.x + c.w, c.y + c.h);
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

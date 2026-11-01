// the encyclopedia's flowchart: what flows into an entry and out of it, grown a step at a time, and where each box sits

import { HOW, COMBAT, itemKey, tokenKey, recipeKey, parseKey } from '../../../systems/progression/ledger/engine.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';
import { getSkill, isCombatSkill } from '../../../config/registries/skillRegistry.js';
import { t } from '../../../i18n/index.js';
import { KIND } from './encyclopediaModel.js';

/**
 * The chart reads left to right around the entry it starts from: its **ways in** come from the
 * left, one stacked "or" branch each, the most usual first; its **uses** go out to the right. A box
 * is something the player acts on: an item, a Token a hero works, an enemy and its camp, a station,
 * a map. A Token that only waits to grow into another (a sapling, a sprout, a stump) is no box: it
 * folds into a grow mark on the line. A crafted thing's way in is its ingredients and the station
 * that makes it: that station when one does, else a station type of just the stations that do.
 * What a step asks of a hero (a skill and level) sits on its line; a drop's odds sit on the
 * dropping box.
 *
 * A box on the left grows further left, one on the right further right; its **far side** (a left
 * box's other uses, a right box's other ways in) opens in place, between it and its neighbour:
 * the box moves out a column per column its far side takes, and the line to its neighbour runs
 * through. Clicking an open box folds both. Reads the encyclopedia only.
 */

/** How many ways in, or uses, a node shows before its stem count opens the rest. */
export const SHOWN_AT_FIRST = 8;

/** The start's id: every other node's id is its path from here. */
export const ROOT = 's';

/** The kind of a station-type entry: the stations that make one recipe (Smithing: Furnace, Iron Furnace). */
export const STATIONS = 'stations';

/** A way in from a station type to one of its stations. */
const MEMBER = 'member';

/** Ways in that a guild repeats (a station, a vein, a map's Tokens): the usual ones, before chance and finds. */
const REPEATED = new Set([
    HOW.CRAFT, HOW.STATION, HOW.BUILD, HOW.WORK, HOW.CATCH, HOW.TRICKLE, HOW.UPGRADE,
    HOW.MAP, HOW.MODIFIER, HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW
]);
const BY_CHANCE = new Set([HOW.DROP, HOW.BONUS]);

/** Ways the player cannot take again (the opening Bank, the Starter Camp): off the chart, named in the card. */
const ONE_OFF = new Set([HOW.STARTER_BANK, HOW.STARTER_TOOL, HOW.STARTER_CAMP, HOW.HALL, HOW.TUTORIAL]);

/** Ways no hero takes: a map writes, a spawner spawns, a stage grows, the Shop sells. */
const NO_HERO = new Set([HOW.MAP, HOW.MODIFIER, HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW, HOW.TRICKLE, HOW.UPCYCLE, HOW.BOUNTY, HOW.SHOP, HOW.UPGRADE, MEMBER]);

/** How deep growing stages fold (a stump grows a sapling grows a tree). */
const FOLD_DEPTH = 4;

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
    if (!memo.has(book)) memo.set(book, { in: new Map(), out: new Map(), types: null, stationOf: new Map() });
    return memo.get(book);
};
const cached = (book, side, key, make) => {
    const map = store(book)[side];
    if (!map.has(key)) map.set(key, make());
    return map.get(key);
};

/** A station type's name: "Smithing Station"; a building's "Foundation". */
const stationTypeName = (skill) => (skill === 'construction'
    ? t('encyclopedia.foundation')
    : t('encyclopedia.stationType', { skill: getSkill(skill)?.name || capital(skill) }));

/**
 * Where a recipe is made, as the key of one entry: the station itself when only one makes it (the
 * Iron Furnace's Stone Foundation), else a station type of just the stations that make it, named
 * for its skill. Null for a recipe nothing offers.
 */
function stationOfRecipe(book, key) {
    const s = store(book);
    if (s.stationOf.has(key)) return s.stationOf.get(key);
    const def = book.entryOf(key)?.def;
    const members = def?.skill ? [...new Set(stationsOf(book, key).map(r => r.via))] : [];
    let station = null;
    if (members.length === 1) station = { key: members[0], single: true };
    else if (members.length > 1) {
        const id = `station:${def.skill}:${members.map(k => parseKey(k).id).sort().join('+')}`;
        station = { key: id, kind: STATIONS, id, name: stationTypeName(def.skill), def: { skill: def.skill }, members };
    }
    s.stationOf.set(key, station);
    return station;
}

/** Every station type, by key (built once per encyclopedia, from every recipe). */
function stationTypes(book) {
    const s = store(book);
    if (!s.types) {
        s.types = new Map();
        for (const recipe of book.byKind[KIND.RECIPE]) {
            const station = stationOfRecipe(book, recipe.key);
            if (station && !station.single && !s.types.has(station.key)) s.types.set(station.key, station);
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

/** The words for a way with no box on its left, or a one-off start: a key under `encyclopedia.via`. */
function captionOf(how) {
    return {
        [HOW.STARTER_BANK]: 'starterBank', [HOW.STARTER_TOOL]: 'starterTool', [HOW.STARTER_CAMP]: 'starterCamp',
        [HOW.HALL]: 'guildHall', [HOW.TUTORIAL]: 'tutorial', [HOW.SHOP]: 'shop'
    }[how] ?? null;
}

const blankWay = () => ({
    how: null, recipe: null, from: null, fromAmount: null, inputs: [], to: null,
    chance: null, firstKill: false, takes: null, makes: null, caption: null, through: null, regrow: false
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
        way.from = stationOfRecipe(book, row.via)?.key ?? null;
        way.makes = finite(row.perCycle, 1) > 0 ? finite(row.perCycle, 1) : 1;
        way.inputs = recipeInputs(book, row.via, row);
        return way;
    }
    if (ONE_OFF.has(row.how)) return way;
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

/** A Token nobody works that only grows into another after a while: a sapling, a sprout, a stump. */
export function isGrowingStage(book, key) {
    const entry = book.entryOf(key);
    return entry?.kind === KIND.TOKEN && typeof entry.def?.grows?.into === 'string' && !!entry.def.grows.into && !entry.def?.config?.skill;
}

/**
 * Ways in with every growing stage folded: a way from a sapling becomes the ways to the sapling
 * (the forest that plants it, with its seed), `through` the sapling; a way that comes back to the
 * entry itself (its stump, fed a seedling, grows back) keeps only its cost, marked `regrow`.
 */
function foldStages(book, key, ways) {
    const out = [];
    const unfold = (way, through, depth) => {
        if (!way.from || !isGrowingStage(book, way.from)) {
            out.push(through.length ? { ...way, through } : way);
            return;
        }
        if (depth >= FOLD_DEPTH) return;
        for (const row of book.sourcesOf(way.from)) {
            const deeper = wayIn(book, row);
            unfold({ ...deeper, inputs: [...deeper.inputs, ...way.inputs] }, [way.from, ...through], depth + 1);
        }
    };
    for (const way of ways) unfold(way, [], 0);
    return out.map(w => (w.from === key && w.through ? { ...w, from: null, how: HOW.REGROW, regrow: true } : w));
}

/**
 * Every way to have `key`, the most usual first: the one its price comes from (`valueSource`),
 * then the way the guild first reaches it, then the repeated ways (a recipe, a vein, a map) before
 * drops, one-off finds and the rest (the Shop), then the likelier, then by name. Growing stages fold
 * away; one-off starts leave (`oneOffWays` names them). A recipe is one way however many stations
 * make it; a recipe entry's own way is its station and inputs; a station type's ways are its stations.
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
            return [{ ...blankWay(), how: HOW.CRAFT, recipe: key, from: stationOfRecipe(book, key)?.key ?? null, inputs: recipeInputs(book, key) }];
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
        const ways = book.sourcesOf(key)
            .filter(row => !ONE_OFF.has(row.how))
            .map((row, i) => ({ row, i, rank: rank(row) }))
            .sort((a, b) => {
                for (let k = 0; k < a.rank.length; k++) if (a.rank[k] !== b.rank[k]) return a.rank[k] - b.rank[k];
                return name(a.row).localeCompare(name(b.row)) || a.i - b.i;
            })
            .map(({ row }) => wayIn(book, row));
        return foldStages(book, key, ways);
    });
}

/** The one-off starts `key` had (the opening Bank, the Starter Camp), as `encyclopedia.via` keys. */
export function oneOffWays(book, key) {
    return [...new Set(book.sourcesOf(key).filter(r => ONE_OFF.has(r.how)).map(r => captionOf(r.how)).filter(Boolean))];
}

/**
 * Everything `key` goes into or gives, each once: what spends it (a recipe's output, the Token it
 * is spent working), what it gives (a vein's ore, an enemy's drops, a station's recipes; a station
 * type gives what its stations make). A growing stage it goes into is skipped for what that grows
 * into (`through` it). Likelier first, then the lower level, then by name.
 */
export function waysOut(book, key) {
    return cached(book, 'out', key, () => {
        const entry = entryOfKey(book, key);
        if (!entry) return [];
        const out = [];
        if (entry.kind === STATIONS) {
            for (const member of entry.members) {
                for (const g of book.givesOf(member)) {
                    if (g.how === HOW.STATION || g.how === HOW.BUILD) out.push({ ...blankWay(), how: g.how, recipe: g.key, to: madeBy(book, g.key), gives: true });
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
            const way = { ...blankWay(), how: g.how, chance: g.chance, firstKill: g.firstKill, gives: true };
            if (g.how === HOW.STATION || g.how === HOW.BUILD) {
                way.recipe = g.key;
                way.to = madeBy(book, g.key);
            } else {
                way.to = g.key;
                if (g.how === HOW.CRAFT) way.makes = finite(g.perCycle, 1);
            }
            out.push(way);
        }
        for (const way of out) {
            const through = [];
            while (way.to && isGrowingStage(book, way.to) && through.length < FOLD_DEPTH) {
                through.push(way.to);
                way.to = tokenKey(book.entryOf(way.to).def.grows.into);
            }
            if (through.length) way.through = through;
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
 * What a box asks of a hero: a crafted thing its recipe's skill and level (the recipe it is reached
 * through, else its most usual one), a vein or a chest the skill to work it, an enemy Combat at its
 * level. Null for a station or a station type (their recipes ask it), and for what asks nothing.
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

/** What a hero needs to take one way in (its line): a recipe's skill, a vein's or chest's, an enemy's level. */
export function wayInRequirement(book, way) {
    if (way.recipe) return recipeRequirement(book, way.recipe);
    if (!way.from || NO_HERO.has(way.how) || ONE_OFF.has(way.how)) return null;
    return requirementOf(book, way.from);
}

/** What a hero needs to take one use of `key` (its line): the recipe, working what gives it, the Token a tool works. */
export function wayOutRequirement(book, key, way) {
    if (way.recipe) return recipeRequirement(book, way.recipe);
    if (way.gives) return [HOW.WORK, HOW.CATCH, HOW.REGROW, HOW.DROP].includes(way.how) ? requirementOf(book, key) : null;
    return [HOW.WORK, HOW.CATCH, HOW.HOLD].includes(way.how) ? requirementOf(book, way.to) : null;
}

/** How many lines a way draws into the box it feeds: its things, or its words alone. */
const linksOfWay = (way) => (way.from ? 1 : 0) + way.inputs.length + (way.from || way.inputs.length ? 0 : 1);

/** Whether a branch item or a use's node is the line running through to the neighbour, not a box. */
export const isPass = (x) => x?.pass === true;

/** The far side of a node: a box on the left opens its other uses, one on the right its other ways in. */
export const farSideOf = (node) => (node.side === 'in' ? 'out' : node.side === 'out' ? 'in' : null);

/**
 * The chart from `start`, grown where the player clicked: every node `{ id, key, side, amount,
 * need, recipe, chance, firstKill, repeat, canGrow, canFar, grown, farOpen, ins, outs, hiddenIn,
 * hiddenOut, passBand }`. `side` is 'start', 'in' (left of its neighbour: grows further left) or
 * 'out' (right: grows further right). `amount` is how many one step takes (×2 Iron Ore to an
 * ingot); `need` how many one of the start takes, down that path (one of the box whose far side
 * opened, inside it). `recipe` is the recipe a use is made by; `chance` the odds of the line that
 * reaches it. A node `repeat`s an entry already on its path and never grows. `ins` are branches
 * `{ id, way, from, inputs, req, through }`, `outs` uses `{ id, way, node, req, through }`; each
 * shows `SHOWN_AT_FIRST` until opened. On an opened far side the neighbour is a pass, `{ id, key,
 * pass: true }`, where it would stand: the line it already has runs through; when the neighbour is
 * no way in or use there (a tool and the vein it works), `passBand` carries its line above the rest.
 * `hiddenIn` / `hiddenOut` count the lines on each side of a box not on screen.
 *
 * @param {Set<string>} grown   node ids clicked open (their own side)
 * @param {Set<string>} far     node ids whose far side was opened
 * @param {Set<string>} opened  node ids whose long list was opened, as `${id}<` or `${id}>`
 */
export function chartOf(book, start, { grown = new Set(), far = new Set(), opened = new Set() } = {}) {
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
            canFar: false,
            grown: side === 'start',
            farOpen: false,
            ins: null, outs: null, hiddenIn: 0, hiddenOut: 0, passBand: null
        };
    };

    /** The first `SHOWN_AT_FIRST` of a list, or all once opened; the pass's own way is always among them. */
    const shownOf = (all, isOpen, holdsPass) => {
        const list = all.map((way, i) => ({ way, i }));
        if (isOpen) return list;
        const first = list.slice(0, SHOWN_AT_FIRST);
        const pass = holdsPass ? list.find(x => holdsPass(x.way)) : null;
        return pass && pass.i >= SHOWN_AT_FIRST ? [...first, pass] : first;
    };

    const growIn = (node, path, per, passKey = null) => {
        const all = waysIn(book, node.key);
        const holds = passKey ? (w) => w.from === passKey || w.inputs.some(i => i.key === passKey) : null;
        const here = [...path, node.key];
        let passed = false;
        const child = (id, key, link) => {
            if (passKey && !passed && key === passKey) {
                passed = true;
                return { id, key, pass: true };
            }
            const n = make(id, key, 'in', here, { ...link, neighbour: node.key });
            visit(n, here);
            return n;
        };
        node.ins = shownOf(all, opened.has(`${node.id}<`), holds).map(({ way, i }) => {
            const id = `${node.id}<${i}`;
            const makes = way.makes > 0 ? way.makes : 1;
            const from = way.from
                ? child(`${id}f`, way.from, {
                    amount: way.fromAmount,
                    need: way.fromAmount != null ? per * way.fromAmount : null,
                    chance: way.chance, firstKill: way.firstKill
                })
                : null;
            const inputs = way.inputs.map((input, j) => child(`${id}.${j}`, input.key, {
                amount: input.quantity, need: per * input.quantity / makes
            }));
            return { id, way, from, inputs, req: wayInRequirement(book, way), through: way.through };
        });
        if (passKey && !passed) node.passBand = { id: `${node.id}<p`, key: passKey, side: 'in' };
    };

    const growOut = (node, path, passKey = null) => {
        const all = waysOut(book, node.key);
        const here = [...path, node.key];
        let passed = false;
        node.outs = shownOf(all, opened.has(`${node.id}>`), passKey ? (w) => w.to === passKey : null).map(({ way, i }) => {
            const id = `${node.id}>${i}`;
            const req = wayOutRequirement(book, node.key, way);
            if (passKey && !passed && way.to === passKey) {
                passed = true;
                return { id, way, node: { id: `${id}n`, key: way.to, pass: true }, req, through: way.through };
            }
            const n = make(`${id}n`, way.to, 'out', here, {
                recipe: way.recipe, chance: way.chance, firstKill: way.firstKill, neighbour: node.key
            });
            visit(n, here);
            return { id, way, node: n, req, through: way.through };
        });
        if (passKey && !passed) node.passBand = { id: `${node.id}>p`, key: passKey, side: 'out' };
    };

    const visit = (node, path) => {
        if (node.repeat) return;
        if (node.canGrow && grown.has(node.id)) {
            node.grown = true;
            if (node.side === 'in') growIn(node, path, Number.isFinite(node.need) ? node.need : 1);
            else growOut(node, path);
        }
        if (far.has(node.id) && farLinks(book, node) > 0) {
            node.farOpen = true;
            if (node.side === 'in') growOut(node, path, node.neighbour);
            else growIn(node, path, 1, node.neighbour);
        }
    };

    const root = make(ROOT, start, 'start', [], { need: 1 });
    root.canGrow = false;
    if (entryOfKey(book, start)) {
        growIn(root, [], 1);
        growOut(root, []);
    }
    for (const node of nodesOf(root)) countHidden(book, node);
    return root;
}

/** The lines on a node's far side besides the one to its neighbour. */
function farLinks(book, node) {
    if (node.side === 'in') return waysOut(book, node.key).filter(w => w.to !== node.neighbour).length;
    if (node.side === 'out') {
        return waysIn(book, node.key).reduce((n, w) => n + linksOfWay(w)
            - (w.from === node.neighbour ? 1 : 0) - w.inputs.filter(i => i.key === node.neighbour).length, 0);
    }
    return 0;
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
    node.canFar = !node.repeat && !node.farOpen && node.side !== 'start' && farLinks(book, node) > 0;
}

/** Every node of a chart, the start first, then down each side in order (a pass is a line, not a node). */
export function nodesOf(chart) {
    const out = [];
    const walk = (node) => {
        out.push(node);
        for (const b of node.ins || []) for (const child of [b.from, ...b.inputs]) if (child && !isPass(child)) walk(child);
        for (const u of node.outs || []) if (!isPass(u.node)) walk(u.node);
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
    /** Room for a two-line name in capitals ("Fire Elemental Chief") beside the sprite. */
    nodeW: 220,
    nodeH: 60,
    /** Between two columns: a stem count each side, the join and trunk, and a mark on the line between. */
    gapX: 148,
    /** From a box's side to the line that joins or splits there: room for its stem count. */
    reach: 40,
    stemW: 34,
    stemH: 20,
    /** A mark on a line: its height, and the ink words' size it is measured in. */
    markH: 20,
    ink: 16,
    rowGap: 8,
    /** Between two "or" branches: room for the word. */
    orGap: 20,
    /** Where a line that is no way in meets its box: this far down its side. */
    highEntry: 14
});

/** `CHART_METRICS` at a body text size of `bodyPx` (16 by default), in whole pixels. */
export function chartMetrics(bodyPx = 16) {
    const k = Math.max(1, (Number(bodyPx) || 16) / 16);
    const out = {};
    for (const [name, value] of Object.entries(CHART_METRICS)) out[name] = Math.round(value * k);
    return out;
}

/**
 * How wide a mark on a line is: the grow mark and its time, the skill icon and the level, the
 * padding. Measured in the ink words' size (`m.ink`): an icon is one size wide, a figure 0.75.
 */
export function markWidth(mark, m = CHART_METRICS) {
    const u = m.ink;
    let w = 0.5 * u;
    if (mark.through) w += 1.25 * u + 0.75 * u * (mark.growText?.length ?? 4);
    if (mark.req) w += 1.25 * u + 0.75 * u * String(mark.req.level).length;
    return Math.round(w);
}

/**
 * Where every box of a chart sits, in pixels around the start (its box centred on 0, 0):
 * `{ nodes: [{ id, node, x, y, w, h }], captions, links: [{ id, points: [[x, y], …], into }],
 * ors: [{ id, x, y }], stems: [{ id, node, side, count, x, y, w, h }], labels: [{ id, side, x, y, w,
 * h, req, through, regrow }], box }`.
 *
 * Columns are `nodeW + gapX` apart. Each node stands in the middle of the row band its sides take;
 * branches stack top to bottom in order, an "or" between each. A box's left side takes as many
 * columns as its deepest way in, its right side as its deepest use; a far side opened pushes the box
 * out by its width, so a use with its ways in open stands further right, its things between it and
 * its neighbour, and the neighbour's line runs through the pass's band to the branch it joins.
 * Lines are square-cornered; a mark sits on its own line (a branch's between its join and the trunk,
 * a use's just past the trunk); `growText(mark)` gives a grow mark's words, for its width.
 */
export function layoutChart(chart, m = CHART_METRICS, growText = () => null) {
    const pitch = m.nodeW + m.gapX;
    const slot = m.nodeH;
    const half = m.nodeW / 2;
    const reach = m.reach;
    const nodes = [];
    const captions = [];
    const links = [];
    const ors = [];
    const stems = [];
    const labels = [];
    const r = (v) => Math.round(v);

    const itemsOf = (b) => (b.from ? [b.from, ...b.inputs] : b.inputs);
    const stackH = (list, gap, each) => list.reduce((sum, x) => sum + each(x), 0) + gap * Math.max(0, list.length - 1);
    const memoOn = (fn) => {
        const seen = new Map();
        return (n) => {
            if (!seen.has(n.id)) seen.set(n.id, fn(n));
            return seen.get(n.id);
        };
    };
    const bandIn = (n) => n.passBand?.side === 'in';
    const bandOut = (n) => n.passBand?.side === 'out';

    // How many columns each side of a node takes.
    const colsL = memoOn((n) => {
        if (!n.ins) return 0;
        let most = bandIn(n) ? 1 : 0;
        for (const b of n.ins) {
            const items = itemsOf(b);
            if (!items.length) most = Math.max(most, 1);
            for (const it of items) most = Math.max(most, isPass(it) ? 1 : 1 + colsR(it) + colsL(it));
        }
        return most;
    });
    const colsR = memoOn((n) => {
        if (!n.outs) return 0;
        let most = bandOut(n) ? 1 : 0;
        for (const u of n.outs) most = Math.max(most, isPass(u.node) ? 1 : 1 + colsL(u.node) + colsR(u.node));
        return most;
    });

    // How tall each side, and a node's whole band, is.
    const itemH = (it) => (isPass(it) ? slot : bandH(it));
    const branchH = (b) => (itemsOf(b).length ? stackH(itemsOf(b), m.rowGap, itemH) : slot);
    const leftH = (n) => (n.ins ? stackH(n.ins, m.orGap, branchH) + (bandIn(n) ? slot + m.rowGap : 0) : 0);
    const rightH = (n) => (n.outs ? stackH(n.outs, m.rowGap, u => itemH(u.node)) + (bandOut(n) ? slot + m.rowGap : 0) : 0);
    const bandH = memoOn((n) => Math.max(slot, leftH(n), rightH(n)));

    const leftEdge = (col) => col * pitch - half;
    const rightEdge = (col) => col * pitch + half;

    /** Where the line from a node's left neighbour reaches it (a pass, or the box), and where its line to a right neighbour leaves. */
    const entry = new Map();
    const exit = new Map();

    const mark = (id, side, x, y, req, through, regrow, anchor) => {
        if (!req && !through) return;
        const label = { id, side, req: req ?? null, through: through ?? null, regrow: !!regrow };
        label.growText = through ? growText(label) : null;
        const w = markWidth(label, m);
        labels.push({ ...label, x: r(anchor === 'start' ? x : x - w / 2), y: r(y - m.markH / 2), w, h: m.markH });
    };

    const place = (node, col, cy) => {
        const box = { id: node.id, node, x: r(leftEdge(col)), y: r(cy - slot / 2), w: m.nodeW, h: m.nodeH };
        nodes.push(box);
        const sy = box.y + box.h - m.stemH;
        if (node.hiddenIn) stems.push({ id: `${node.id}|in`, node, side: 'in', count: node.hiddenIn, x: box.x - m.stemW, y: sy, w: m.stemW, h: m.stemH });
        if (node.hiddenOut) stems.push({ id: `${node.id}|out`, node, side: 'out', count: node.hiddenOut, x: box.x + box.w, y: sy, w: m.stemW, h: m.stemH });
        placeLeft(node, col, cy, box);
        placeRight(node, col, cy, box);
    };

    const placeLeft = (node, col, cy, box) => {
        if (!node.ins) return;
        const a = r(cy);
        const intoX = box.x;
        const trunkX = intoX - reach;
        const itemsRight = rightEdge(col - 1);
        const joinX = itemsRight + reach;
        const blockLeft = leftEdge(col - colsL(node));
        let top = cy - leftH(node) / 2;
        if (bandIn(node)) {
            // The neighbour is no way in: its line runs above them and meets the box high on its side.
            const y = r(top + slot / 2);
            const high = box.y + m.highEntry;
            links.push({ id: `${node.passBand.id}>`, into: node.id, points: [[blockLeft, y], [intoX - 8, y], [intoX - 8, high], [intoX, high]] });
            entry.set(node.id, { y, into: node.passBand.id });
            top += slot + m.rowGap;
        }
        node.ins.forEach((b, i) => {
            const h = branchH(b);
            const bc = top + h / 2;
            const items = itemsOf(b);
            let wayY;
            if (!items.length) {
                wayY = r(bc);
                captions.push({ id: b.id, words: b.way.caption, label: false, x: r(leftEdge(col - 1)), y: r(bc - slot / 2), w: m.nodeW, h: m.nodeH });
                links.push({ id: `${b.id}~`, into: b.id, points: [[itemsRight, wayY], [joinX, wayY]] });
            } else {
                let itemTop = bc - stackH(items, m.rowGap, itemH) / 2;
                const ends = [];
                for (const it of items) {
                    const ih = itemH(it);
                    const ic = itemTop + ih / 2;
                    if (isPass(it)) {
                        const y = r(ic);
                        ends.push([blockLeft, y]);
                        entry.set(node.id, { y, into: it.id });
                    } else {
                        place(it, col - 1 - colsR(it), ic);
                        ends.push([itemsRight, exit.get(it.id) ?? r(ic)]);
                    }
                    itemTop += ih + m.rowGap;
                }
                wayY = r((ends[0][1] + ends[ends.length - 1][1]) / 2);
                items.forEach((it, j) => {
                    links.push({ id: `${it.id}>`, into: b.id, points: [ends[j], [joinX, ends[j][1]], [joinX, wayY]] });
                });
                if (b.way.caption) captions.push({ id: `${b.id}~`, words: b.way.caption, label: true, x: r((joinX + trunkX) / 2), y: wayY - 10, w: 0, h: 0 });
            }
            links.push({ id: `${b.id}>`, into: node.id, points: [[joinX, wayY], [trunkX, wayY], [trunkX, a], [intoX, a]] });
            mark(`${b.id}@`, 'in', (joinX + trunkX) / 2, wayY, b.req, b.through, b.way.regrow);
            top += h;
            if (i < node.ins.length - 1) {
                ors.push({ id: `${b.id}or`, x: joinX, y: r(top + m.orGap / 2) });
                top += m.orGap;
            }
        });
    };

    const placeRight = (node, col, cy, box) => {
        if (!node.outs) return;
        const a = r(cy);
        const fromX = box.x + box.w;
        const trunkX = fromX + reach;
        const usesLeft = leftEdge(col + 1);
        const blockRight = rightEdge(col + colsR(node));
        let top = cy - rightH(node) / 2;
        if (bandOut(node)) {
            // The neighbour is no use of it: its line leaves high on its side and runs above them.
            const y = r(top + slot / 2);
            const high = box.y + m.highEntry;
            links.push({ id: `${node.passBand.id}>`, into: node.passBand.id, points: [[fromX, high], [fromX + 8, high], [fromX + 8, y], [blockRight, y]] });
            exit.set(node.id, y);
            top += slot + m.rowGap;
        }
        for (const u of node.outs) {
            const h = itemH(u.node);
            const uc = top + h / 2;
            if (isPass(u.node)) {
                const y = r(uc);
                links.push({ id: `${u.id}>`, into: u.node.id, points: [[fromX, a], [trunkX, a], [trunkX, y], [blockRight, y]] });
                exit.set(node.id, y);
            } else {
                place(u.node, col + 1 + colsL(u.node), uc);
                const into = entry.get(u.node.id);
                const y = into?.y ?? r(uc);
                links.push({ id: `${u.id}>`, into: into?.into ?? u.node.id, points: [[fromX, a], [trunkX, a], [trunkX, y], [usesLeft, y]] });
                // An opened far side carries this step's mark on its own branch.
                const onBranch = !!into && !u.node.passBand;
                if (!onBranch) mark(`${u.id}@`, 'out', trunkX + 6, y, u.req, u.through, false, 'start');
            }
            top += h + m.rowGap;
        }
    };

    place(chart, 0, 0);

    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const grow = (x0, y0, x1, y1) => {
        box.left = Math.min(box.left, x0); box.top = Math.min(box.top, y0);
        box.right = Math.max(box.right, x1); box.bottom = Math.max(box.bottom, y1);
    };
    for (const n of nodes) grow(n.x, n.y, n.x + n.w, n.y + n.h);
    for (const c of captions) if (!c.label) grow(c.x, c.y, c.x + c.w, c.y + c.h);
    for (const s of stems) grow(s.x, s.y, s.x + s.w, s.y + s.h);
    for (const l of labels) grow(l.x, l.y, l.x + l.w, l.y + l.h);
    return { nodes, captions, links, ors, stems, labels, box };
}

/** The box a node and everything grown from it take, from a layout. */
export function grownBox(layout, id) {
    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const add = (x0, y0, x1, y1) => {
        box.left = Math.min(box.left, x0); box.top = Math.min(box.top, y0);
        box.right = Math.max(box.right, x1); box.bottom = Math.max(box.bottom, y1);
    };
    for (const n of layout.nodes) if (within(n.id, id)) add(n.x, n.y, n.x + n.w, n.y + n.h);
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

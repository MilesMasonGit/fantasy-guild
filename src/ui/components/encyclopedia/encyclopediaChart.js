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

/** A use of a Token that another one's growing needs standing beside it. */
const NEARBY = 'growNearby';

/** Ways in that a guild repeats (a station, a vein, a place's Tokens): the usual ones, before chance and finds. */
const REPEATED = new Set([
    HOW.CRAFT, HOW.STATION, HOW.BUILD, HOW.WORK, HOW.CATCH, HOW.TRICKLE, HOW.UPGRADE,
    HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW, HOW.WORLD
]);
const BY_CHANCE = new Set([HOW.DROP, HOW.BONUS]);

/** Ways the player cannot take again (the opening Bank, the Starter Camp): off the chart, named in the card. */
const ONE_OFF = new Set([HOW.STARTER_BANK, HOW.STARTER_TOOL, HOW.STARTER_CAMP, HOW.HALL]);

/** Ways no hero takes: a spawner spawns, a stage grows, the Shop sells. */
const NO_HERO = new Set([HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW, HOW.TRICKLE, HOW.SHOP, HOW.UPGRADE, MEMBER]);

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

const usualness = (row) => (row.oneOff ? 2 : row.maybe ? 1 : REPEATED.has(row.how) ? 0 : BY_CHANCE.has(row.how) ? 1 : 3);
const chanceOf = (row) => finite(row.chance, 1);

/** The words for a way with no box on its left, or a one-off start: a key under `encyclopedia.via`. */
function captionOf(how) {
    return {
        [HOW.STARTER_BANK]: 'starterBank', [HOW.STARTER_TOOL]: 'starterTool', [HOW.STARTER_CAMP]: 'starterCamp',
        [HOW.HALL]: 'guildHall', [HOW.SHOP]: 'shop'
    }[how] ?? null;
}

const blankWay = () => ({
    how: null, recipe: null, from: null, fromAmount: null, inputs: [], to: null,
    chance: null, takes: null, makes: null, caption: null, captionArgs: null, through: null, regrow: false,
    place: null
});

/**
 * The world cells that place `key`, as ways in: one per ring every world holds it at (its wedge
 * named when only one wedge does), and, before the first of those, the first ring only some worlds
 * hold it at. `place.wedges` are the cells, likeliest first; `place.maybe` that only some worlds do.
 */
function worldWays(book, rows) {
    const byRing = new Map();
    for (const row of rows) {
        const place = book.placeOf(row.via);
        if (!place) continue;
        const at = byRing.get(place.ring) || { sure: [], maybe: [] };
        at[row.maybe ? 'maybe' : 'sure'].push(place);
        byRing.set(place.ring, at);
    }
    const rings = [...byRing.keys()].sort((a, b) => a - b);
    const firstSure = rings.find(ring => byRing.get(ring).sure.length) ?? Infinity;
    const firstMaybe = rings.find(ring => byRing.get(ring).maybe.length && ring < firstSure);
    const way = (ring, places, maybe) => {
        const lines = [...new Set(places.map(p => p.lineName))];
        const one = lines.length === 1;
        return {
            ...blankWay(), how: HOW.WORLD,
            caption: `${maybe ? 'someWorlds' : 'world'}${one ? 'Line' : 'Ring'}`,
            captionArgs: one ? { line: lines[0], ring } : { ring },
            place: { ring, maybe, wedges: places.map(p => p.key), line: one ? lines[0] : null }
        };
    };
    const out = [];
    if (firstMaybe != null) out.push(way(firstMaybe, byRing.get(firstMaybe).maybe, true));
    for (const ring of rings) if (byRing.get(ring).sure.length) out.push(way(ring, byRing.get(ring).sure, false));
    return out;
}

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
    const way = { ...blankWay(), how: row.how, chance: row.chance, caption: captionOf(row.how) };
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
 * then the way the guild first reaches it, then the repeated ways (a recipe, a vein, a world cell) before
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
        const rows = book.sourcesOf(key)
            .filter(row => !ONE_OFF.has(row.how))
            .map((row, i) => ({ row, i, rank: rank(row) }))
            .sort((a, b) => {
                for (let k = 0; k < a.rank.length; k++) if (a.rank[k] !== b.rank[k]) return a.rank[k] - b.rank[k];
                return name(a.row).localeCompare(name(b.row)) || a.i - b.i;
            })
            .map(({ row }) => row);
        // The world's cells stand together, where the likeliest of them ranks.
        const world = worldWays(book, rows.filter(row => row.how === HOW.WORLD));
        const ways = [];
        for (const row of rows) {
            if (row.how !== HOW.WORLD) ways.push(wayIn(book, row));
            else if (world.length) ways.push(...world.splice(0));
        }
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
            const way = { ...blankWay(), how: u.nearby ? NEARBY : u.how };
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
            const way = { ...blankWay(), how: g.how, chance: g.chance, gives: true };
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
        const chance = (w) => finite(w.chance, 1);
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

/**
 * What a hero needs to take one way in (its line): a recipe's skill, a vein's or chest's, an enemy's
 * level, the level settling a world cell asks (one wedge's only: wedges ask their own skills).
 */
export function wayInRequirement(book, way) {
    if (way.recipe) return recipeRequirement(book, way.recipe);
    if (way.how === HOW.WORLD) {
        if (!way.place?.line) return null;
        const top = (book.placeOf(way.place.wedges[0])?.gates || []).reduce((a, g) => (!a || g.level > a.level ? g : a), null);
        // The skill itself, never folded into Combat: settling Arcane asks Magic, not a fight.
        return top ? { skill: top.skill, level: top.level } : null;
    }
    if (!way.from || NO_HERO.has(way.how) || ONE_OFF.has(way.how)) return null;
    return requirementOf(book, way.from);
}

/** What a hero needs to take one use of `key` (its line): the recipe, working what gives it, the Token a tool works. */
export function wayOutRequirement(book, key, way) {
    if (way.recipe) return recipeRequirement(book, way.recipe);
    if (way.gives) return [HOW.WORK, HOW.CATCH, HOW.REGROW, HOW.DROP].includes(way.how) ? requirementOf(book, key) : null;
    return [HOW.WORK, HOW.CATCH, HOW.HOLD].includes(way.how) ? requirementOf(book, way.to) : null;
}

/**
 * What a line means when nothing along it is used up: `word` the small word written on it
 * (`encyclopedia.line.*`), `tip` the sentence its hover says (`encyclopedia.lineTip.*`, naming
 * `from` and `to`). A line that is used up (an ingredient, a seed planted, bait, a price) has none.
 */
const lineWord = (word, tip = word) => ({ word, tip });

/** Whether a recipe is built on a Foundation rather than made at a station. */
const isBuilt = (book, recipe) => stationsOf(book, recipe).some(r => r.how === HOW.BUILD);

/** The word for what comes out of a box (`key`) by `how`: a vein gives, a chest opens, an enemy drops. */
function givesWord(book, key, how) {
    switch (how) {
        case HOW.WORK: return book.isTreasure(key) ? lineWord('opens') : lineWord('gives');
        case HOW.TRICKLE:
        case HOW.UPGRADE: return lineWord('gives', 'givesPassive');
        case HOW.CATCH: return lineWord('catch');
        case HOW.DROP: return lineWord('drops');
        case HOW.BONUS: return lineWord('bonus');
        case HOW.SPAWN: return lineWord('spawns');
        case HOW.GROW: return lineWord('grows');
        case HOW.TURN: return lineWord('turns');
        case HOW.REGROW: return lineWord('leaves');
        default: return null;
    }
}

/** The word on a way in's line from its box (`way.from`): "made at" a station, "drops" from an enemy; null without a box. */
export function wayInWord(book, way) {
    if (!way?.from) return null;
    if (way.how === HOW.CRAFT) return isBuilt(book, way.recipe) ? lineWord('builtOn') : lineWord('madeAt');
    if (way.how === MEMBER) return lineWord('oneOf');
    return givesWord(book, way.from, way.how);
}

/** The word on the line from `key` to one of its uses: "tool for", "makes", "gives"; null when the use spends it. */
export function wayOutWord(book, key, way) {
    if (!way) return null;
    if (!way.gives) {
        if (way.how === HOW.HOLD) return lineWord('toolFor');
        if (way.how === NEARBY) return lineWord('beside');
        return null;
    }
    if (way.how === HOW.STATION) return lineWord('makes', 'madeAt');
    if (way.how === HOW.BUILD) return lineWord('builds', 'builtOn');
    if (way.how === HOW.CRAFT) return lineWord('makes', 'recipeMakes');
    return givesWord(book, key, way.how);
}

/** How many lines a way draws into the box it feeds: its things, or its words alone. */
const linksOfWay = (way) => (way.from ? 1 : 0) + way.inputs.length + (way.from || way.inputs.length ? 0 : 1);

/** Whether a branch item or a use's node is the line running through to the neighbour, not a box. */
export const isPass = (x) => x?.pass === true;

/** The far side of a node: a box on the left opens its other uses, one on the right its other ways in. */
export const farSideOf = (node) => (node.side === 'in' ? 'out' : node.side === 'out' ? 'in' : null);

/**
 * The chart from `start`, grown where the player clicked: every node `{ id, key, side, amount,
 * need, recipe, chance, repeat, canGrow, canFar, grown, farOpen, ins, outs, hiddenIn,
 * hiddenOut, passBand }`. `side` is 'start', 'in' (left of its neighbour: grows further left) or
 * 'out' (right: grows further right). `amount` is how many one step takes (×2 Iron Ore to an
 * ingot); `need` how many one of the start takes, down that path (one of the box whose far side
 * opened, inside it). `recipe` is the recipe a use is made by; `chance` the odds of the line that
 * reaches it. A node `repeat`s an entry already on its path and never grows. `ins` are branches
 * `{ id, way, from, inputs, req, through, word }`, `outs` uses `{ id, way, node, req, through, word }`
 * (`word`: what the line from `from`, or to the use, means, when it is not used up); each
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
                    chance: way.chance
                })
                : null;
            const inputs = way.inputs.map((input, j) => child(`${id}.${j}`, input.key, {
                amount: input.quantity, need: per * input.quantity / makes
            }));
            return { id, way, from, inputs, req: wayInRequirement(book, way), through: way.through, word: wayInWord(book, way) };
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
            const word = wayOutWord(book, node.key, way);
            if (passKey && !passed && way.to === passKey) {
                passed = true;
                return { id, way, node: { id: `${id}n`, key: way.to, pass: true }, req, through: way.through, word };
            }
            const n = make(`${id}n`, way.to, 'out', here, {
                recipe: way.recipe, chance: way.chance, neighbour: node.key
            });
            visit(n, here);
            return { id, way, node: n, req, through: way.through, word };
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
    /**
     * Between two columns: an arrow tab each side, the join and trunk, and between them a mark and
     * a line's word side by side, never one over the other: a use's grow mark and its time ("5:00")
     * with "spawns", or a two-figure skill mark with "tool for", in the widest of the game's fonts.
     */
    gapX: 260,
    /** From a box's side to the line that joins or splits there: room for its arrow tab ("›30"). */
    reach: 48,
    stemH: 20,
    /** A mark on a line: its height; its icon (a 16 px skill icon at 2×) and its words' size (the title size). */
    markH: 32,
    markIcon: 32,
    markText: 18,
    /** The tabs' ink words' size. */
    ink: 16,
    /** A line's word: the small size; how far a word on the left rides above its line, and its room from what it sits beside. */
    word: 14,
    wordLift: 4,
    wordPad: 6,
    /** A use's word ends this far before the box: the arrowhead, a little thicker on the lit path, and a stretch of line. */
    wordStop: 16,
    rowGap: 8,
    /** Between two ways in: the plain page between their bands. */
    orGap: 20,
    /** A way's band reaches this far round its boxes. */
    bandPad: 4,
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

/** Ink words' widths in the game's font, in `u` (the words' size): a figure 0.8, a colon 0.4, else 0.7. */
const wordsWidth = (s, u) => [...String(s)].reduce((w, c) => w + (c === ':' ? 0.4 : /\d/.test(c) ? 0.8 : 0.7), 0) * u;

/**
 * How wide a mark on a line is: the grow mark and its time, the skill icon and the level, the
 * padding. Measured against the game's own font: an icon (`m.markIcon`) and a 4 px gap, then the
 * words at `m.markText`, a figure 0.8 of the size (the pixel font's figures are wide), a colon 0.4.
 */
export function markWidth(mark, m = CHART_METRICS) {
    const u = m.markText;
    const icon = m.markIcon + 4;
    let w = 8;
    if (mark.through) w += icon + wordsWidth(mark.growText ?? '0:00', u);
    if (mark.req) w += icon + wordsWidth(mark.req.level, u) + (mark.through ? 4 : 0);
    return Math.round(w);
}

/** How wide the arrow tab with `count` inside is: its arrow, the figures, padding and its outer edge. */
export function tabWidth(count, m = CHART_METRICS) {
    const u = m.ink;
    return Math.round(0.5 * u + 0.5 * u + wordsWidth(count, u) + 2);
}

/**
 * How much room a line's word takes, with 2 px of page each side: a letter 0.8 of the size, a space
 * 0.4. ⚠️ Set by the widest of the game's fonts in capitals (Silkscreen's "spawns", 66.5 px at 14):
 * the default font leaves room to spare.
 */
export function wordWidth(words, m = CHART_METRICS) {
    return Math.ceil([...String(words)].reduce((w, c) => w + (c === ' ' ? 0.4 : 0.8), 0) * m.word + 4);
}

/** A node id and the ids above it, to the start: `s<0.1<0f` → [`s<0.1<0f`, `s<0.1`, `s`]. */
export function pathIds(id) {
    const out = [id];
    let at = id;
    for (;;) {
        const cut = Math.max(at.lastIndexOf('<'), at.lastIndexOf('>'));
        if (cut <= 0) return out;
        at = at.slice(0, cut);
        out.push(at);
    }
}

const parentOf = (id) => pathIds(id)[1] ?? null;
const onPath = (items, id) => {
    const path = new Set(pathIds(id));
    return new Set(items.filter(x => (x.pairs || []).some(([child, parent]) => path.has(child) && path.has(parent))).map(x => x.id));
};

/** The lines that carry `id` to the start: each joins two boxes on its path. */
export const litLinks = (layout, id) => onPath(layout.links, id);

/** The marks on those lines. */
export const litLabels = (layout, id) => onPath(layout.labels, id);

/** The words on those lines. */
export const litWords = (layout, id) => onPath(layout.words, id);

/**
 * Where every box of a chart sits, in pixels around the start (its box centred on 0, 0):
 * `{ nodes: [{ id, node, x, y, w, h }], captions, links: [{ id, points: [[x, y], …], into, pairs }],
 * bands: [{ id, x, y, w, h }], stems: [{ id, node, side, count, x, y, w, h }], labels: [{ id, side,
 * x, y, w, h, req, through, regrow, pairs }], words: [{ id, side, word, tip, from, to, onLine,
 * overMark, x, y, w, h, pairs }], box }`. A line's, mark's or word's `pairs` are the boxes it joins, `[child,
 * parent]` ids: on the path from a box to the start when both are.
 *
 * Columns are `nodeW + gapX` apart. Each node stands in the middle of the row band its sides take;
 * ways in stack top to bottom in order, each on a faint band of its own when there are several. A
 * box's left side takes as many columns as its deepest way in, its right side as its deepest use; a
 * far side opened pushes the box out by its width, so a use with its ways in open stands further
 * right, its things between it and its neighbour, and the neighbour's line runs through the pass's
 * row to the branch it joins. Lines are square-cornered; a mark sits on its own line (a branch's
 * between its join and the trunk, a use's just past the trunk); `growText(mark)` gives a grow mark's
 * words, for its width.
 *
 * A line that is not used up carries its word once, on the stretch only it draws: a way in's from
 * its box, just above it by the box; a use's on the line itself (`onLine`, breaking it like a mark),
 * right-aligned before the arrow, or before the far side's bands when the line runs on through a
 * pass. A line running through a pass carries none: its word is on the stretch it continues. A word
 * with no room on its line beside the mark rides above the mark instead. `wordText(key)` gives a
 * word's text, for its width.
 */
export function layoutChart(chart, m = CHART_METRICS, growText = () => null, wordText = (key) => t(`encyclopedia.line.${key}`)) {
    const pitch = m.nodeW + m.gapX;
    const slot = m.nodeH;
    const half = m.nodeW / 2;
    const reach = m.reach;
    const nodes = [];
    const captions = [];
    const links = [];
    const bands = [];
    const stems = [];
    const labels = [];
    const words = [];
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

    const mark = (id, side, x, y, req, through, regrow, pairs, anchor, onBand = false) => {
        if (!req && !through) return null;
        const label = { id, side, req: req ?? null, through: through ?? null, regrow: !!regrow };
        label.growText = through ? growText(label) : null;
        const w = markWidth(label, m);
        const placed = { ...label, pairs, onBand, x: r(anchor === 'start' ? x : x - w / 2), y: r(y - m.markH / 2), w, h: m.markH };
        labels.push(placed);
        return placed;
    };

    const word = (id, side, line, from, to, pairs, at) => {
        const w = wordWidth(wordText(line.word), m);
        const { onLine, overMark = false, x, y } = at(w);
        words.push({ id, side, word: line.word, tip: line.tip, from, to, pairs, onLine, overMark, x: r(x), y: r(y), w, h: m.word });
    };

    const place = (node, col, cy) => {
        const box = { id: node.id, node, x: r(leftEdge(col)), y: r(cy - slot / 2), w: m.nodeW, h: m.nodeH };
        nodes.push(box);
        const sy = box.y + box.h - m.stemH;
        if (node.hiddenIn) {
            const w = tabWidth(node.hiddenIn, m);
            stems.push({ id: `${node.id}|in`, node, side: 'in', count: node.hiddenIn, x: box.x - w, y: sy, w, h: m.stemH });
        }
        if (node.hiddenOut) {
            const w = tabWidth(node.hiddenOut, m);
            stems.push({ id: `${node.id}|out`, node, side: 'out', count: node.hiddenOut, x: box.x + box.w, y: sy, w, h: m.stemH });
        }
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
        // The line through a pass joins this node to its own neighbour, the one it opened toward.
        const passPair = [node.id, parentOf(node.id)];
        let top = cy - leftH(node) / 2;
        if (bandIn(node)) {
            // The neighbour is no way in: its line runs above them and meets the box high on its side.
            const y = r(top + slot / 2);
            const high = box.y + m.highEntry;
            links.push({ id: `${node.passBand.id}>`, into: node.id, pairs: [passPair], points: [[blockLeft, y], [intoX - 8, y], [intoX - 8, high], [intoX, high]] });
            entry.set(node.id, { y, into: node.passBand.id });
            top += slot + m.rowGap;
        }
        const several = node.ins.length > 1;
        node.ins.forEach((b) => {
            const h = branchH(b);
            const bc = top + h / 2;
            const items = itemsOf(b);
            const pairOf = (it) => (isPass(it) ? passPair : [it.id, node.id]);
            let wayY;
            let fromEnd = null;
            let leftmost = col - 1;
            if (!items.length) {
                wayY = r(bc);
                captions.push({ id: b.id, words: b.way.caption, args: b.way.captionArgs, label: false, x: r(leftEdge(col - 1)), y: r(bc - slot / 2), w: m.nodeW, h: m.nodeH });
                links.push({ id: `${b.id}~`, into: b.id, pairs: [], points: [[itemsRight, wayY], [joinX, wayY]] });
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
                        leftmost = Math.min(leftmost, col - colsL(node));
                    } else {
                        const at = col - 1 - colsR(it);
                        place(it, at, ic);
                        ends.push([itemsRight, exit.get(it.id) ?? r(ic)]);
                        leftmost = Math.min(leftmost, at - colsL(it));
                    }
                    itemTop += ih + m.rowGap;
                }
                wayY = r((ends[0][1] + ends[ends.length - 1][1]) / 2);
                items.forEach((it, j) => {
                    links.push({ id: `${it.id}>`, into: b.id, pairs: [pairOf(it)], points: [ends[j], [joinX, ends[j][1]], [joinX, wayY]] });
                });
                // The box is the branch's first thing: its join only ever runs down from its line.
                if (b.from && !isPass(b.from)) fromEnd = ends[0];
                if (b.way.caption) captions.push({ id: `${b.id}~`, words: b.way.caption, args: b.way.captionArgs, label: true, x: r((joinX + trunkX) / 2), y: wayY - 10, w: 0, h: 0 });
            }
            const pairs = items.map(pairOf);
            links.push({ id: `${b.id}>`, into: node.id, pairs, points: [[joinX, wayY], [trunkX, wayY], [trunkX, a], [intoX, a]] });
            const placed = mark(`${b.id}@`, 'in', (joinX + trunkX) / 2, wayY, b.req, b.through, b.way.regrow, pairs, 'centre', several);
            if (b.word && fromEnd) {
                const [x, y] = fromEnd;
                word(`${b.id}^`, 'in', b.word, b.from.key, node.key, [pairOf(b.from)], (w) => {
                    const at = { onLine: false, x: x + m.wordPad, y: y - m.wordLift - m.word };
                    const clash = placed && at.x + w + m.wordPad > placed.x && at.y < placed.y + placed.h && at.y + m.word > placed.y;
                    return clash ? { ...at, overMark: true, y: placed.y - m.wordLift - m.word } : at;
                });
            }
            if (several) {
                // Each way on its own faint band: its boxes, their tabs, its line and mark; the trunk stays bare.
                const x0 = r(leftEdge(leftmost) - reach + m.bandPad);
                const y0 = r(top - m.bandPad);
                bands.push({ id: `${b.id}#`, x: x0, y: y0, w: r(trunkX - 2) - x0, h: r(top + h + m.bandPad) - y0 });
            }
            top += h + m.orGap;
        });
    };

    const placeRight = (node, col, cy, box) => {
        if (!node.outs) return;
        const a = r(cy);
        const fromX = box.x + box.w;
        const trunkX = fromX + reach;
        const usesLeft = leftEdge(col + 1);
        const blockRight = rightEdge(col + colsR(node));
        const passPair = [node.id, parentOf(node.id)];
        let top = cy - rightH(node) / 2;
        if (bandOut(node)) {
            // The neighbour is no use of it: its line leaves high on its side and runs above them.
            const y = r(top + slot / 2);
            const high = box.y + m.highEntry;
            links.push({ id: `${node.passBand.id}>`, into: node.passBand.id, pairs: [passPair], points: [[fromX, high], [fromX + 8, high], [fromX + 8, y], [blockRight, y]] });
            exit.set(node.id, y);
            top += slot + m.rowGap;
        }
        for (const u of node.outs) {
            const h = itemH(u.node);
            const uc = top + h / 2;
            if (isPass(u.node)) {
                const y = r(uc);
                links.push({ id: `${u.id}>`, into: u.node.id, pairs: [passPair], points: [[fromX, a], [trunkX, a], [trunkX, y], [blockRight, y]] });
                exit.set(node.id, y);
            } else {
                place(u.node, col + 1 + colsL(u.node), uc);
                const into = entry.get(u.node.id);
                const y = into?.y ?? r(uc);
                const pairs = [[u.node.id, node.id]];
                links.push({ id: `${u.id}>`, into: into?.into ?? u.node.id, pairs, points: [[fromX, a], [trunkX, a], [trunkX, y], [usesLeft, y]] });
                // An opened far side carries this step's mark on its own branch.
                const onBranch = !!into && !u.node.passBand;
                const placed = onBranch ? null : mark(`${u.id}@`, 'out', trunkX + 6, y, u.req, u.through, false, pairs, 'start');
                if (u.word) {
                    // Before the arrow; or, running on through a pass, before the bands its ways lie on.
                    const stop = !into ? usesLeft - m.wordStop : onBranch ? usesLeft - reach : usesLeft - m.wordPad;
                    const after = (placed ? placed.x + placed.w : trunkX) + m.wordPad;
                    word(`${u.id}^`, 'out', u.word, node.key, u.node.key, pairs, (w) => (stop - w >= after
                        ? { onLine: true, x: stop - w, y: y - m.word / 2 }
                        : { onLine: false, overMark: !!placed, x: Math.max(stop - w, trunkX + m.wordPad), y: (placed ? placed.y : y) - m.wordLift - m.word }));
                }
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
    for (const w of words) grow(w.x, w.y, w.x + w.w, w.y + w.h);
    for (const b of bands) grow(b.x, b.y, b.x + b.w, b.y + b.h);
    for (const l of links) for (const [x, y] of l.points) grow(x, y, x, y);
    return { nodes, captions, links, bands, stems, labels, words, box };
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

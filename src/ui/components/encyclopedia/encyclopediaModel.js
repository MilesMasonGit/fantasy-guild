// the encyclopedia's facts: every item, Token, enemy and recipe, where each comes from and what uses it

import { buildLedger, HOW, itemKey, tokenKey, recipeKey, parseKey } from '../../../systems/progression/ledger/engine.js';
import { getAllItems } from '../../../config/registries/itemRegistry.js';
import { getAllTokenTypes } from '../../../config/registries/tokenRegistry.js';
import { listRecipes } from '../../../config/registries/recipePoolRegistry.js';
import { EFFECTS } from '../../../config/registries/effectRegistry.js';
import { starterCamp } from '../../../systems/atlas/StarterCamp.js';
import { worldTables } from '../../../config/registries/worldTablesRegistry.js';
import { GUILD_UPGRADES } from '../../../config/guildUpgrades.js';
import { eventTable } from '../../../config/registries/eventRegistry.js';
import { normaliseEventTable, isRunnable } from '../../../config/eventTable.js';
import { toolItemFor, toolKindLabel } from '../../../config/registries/toolKinds.js';
import { linesOf } from '../../../systems/board/PassiveProduction.js';
// The authored sky goes in as this loads: the Hall's tracks are read from it.
import '../../../config/registries/hallStarRegistry.js';
import { wordStartsMatch } from '../drawer/bankSort.js';

/**
 * The encyclopedia reads the progression ledger's world (`ledger/engine.js`) over the game's own
 * registries: one picture of what makes what, shared with the CMS. Built the first time the screen
 * opens and kept, so a closed screen costs nothing.
 *
 * ⚠️ Only the world's rules are shown, never a reach tier: tiers come from the owner's plan, which
 * is not the player's business (and is stripped from the game's data). `reachOf` is for ordering.
 */

export const KIND = Object.freeze({ ITEM: 'items', TOKEN: 'tokens', ENEMY: 'enemies', RECIPE: 'recipes' });

/** A way in the ledger does not model, the encyclopedia's own: a special event lands the Token. */
export const EVENT_WAY = 'event';

const GUILD_HALL = 'token_guild_hall';

/** The kinds in tab order. */
export const KINDS = Object.freeze([KIND.ITEM, KIND.TOKEN, KIND.ENEMY, KIND.RECIPE]);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * What each Guild Hall track pays the Hall at each of its ranks, worked out by the game's own Passive
 * Production lines (`PassiveProduction.linesOf`) with that track alone ranked, no Token lines and no
 * live rank: `[{ trackId, name, itemId, ranks: [{ rank, quantity }] }]`, the ranks that pay the item.
 *
 * @param {object[]} tracks the upgrade tracks (`guildUpgrades.GUILD_UPGRADES`: `{ id, name, maxRank }`)
 */
export function hallLinesByRank(tracks) {
    const hall = { typeId: GUILD_HALL };
    const out = [];
    for (const track of Array.isArray(tracks) ? tracks : []) {
        const top = Math.floor(Number(track?.maxRank) || 0);
        const byItem = new Map();
        for (let rank = 1; rank <= top; rank++) {
            for (const line of linesOf(hall, {}, { [track.id]: rank })) {
                if (!byItem.has(line.itemId)) byItem.set(line.itemId, []);
                byItem.get(line.itemId).push({ rank, quantity: line.quantity });
            }
        }
        for (const [itemId, ranks] of byItem) out.push({ trackId: track.id, name: track.name || track.id, itemId, ranks });
    }
    return out;
}

/**
 * The game's content in the shape the ledger reads, with what only the encyclopedia reads beside it:
 * the events table, and what each Guild Hall track pays the Hall at each rank (`hallProduction`).
 */
export function gameContent() {
    return {
        items: getAllItems(),
        tokens: getAllTokenTypes(),
        recipes: listRecipes(),
        effects: EFFECTS,
        starterCamp: starterCamp(),
        worldTables: worldTables(),
        events: eventTable(),
        hallProduction: hallLinesByRank(GUILD_UPGRADES)
    };
}

/** The ledger key of an entry. */
export function entryKey(kind, id) {
    if (kind === KIND.ITEM) return itemKey(id);
    if (kind === KIND.RECIPE) return recipeKey(id);
    return tokenKey(id);
}

/** A rule that only says "holding this tool answers that need": not a source of anything shown. */
const UNSHOWN = new Set([HOW.HOLD]);

/**
 * A fishing spot coming to a place: its events show as events (`EVENT_WAY`), and the screen has no
 * words yet for a spot drifting in by itself, so neither is a row.
 */
const NOT_SHOWN = new Set([HOW.ARRIVE, HOW.EVENT]);

/** The ledger's rules written one per statement (`buildWorld`'s bonus drops and spawns by a rule). */
const PER_STATEMENT = /^(bonus|effect-spawn):/;

/** The ways something is spent: each names what spends it (the recipe, the Token, what a price buys). */
const SPENT_BY = new Set([HOW.CRAFT, HOW.WORK, HOW.CATCH, HOW.SPAWN, HOW.GROW, HOW.SHOP]);

function sortByName(list) {
    return list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/**
 * Every entry and its links, over `content` (the game's by default).
 *
 * Every way the game pays something out is a row, none dropped: a Token that gives an item twice (its
 * outputs and its rare table) gives two rows, a water one per catch pool (`bait`, also an input, and
 * its tool: `tool`, the first item of the kind, and `toolKind`'s words), told apart by `slot`. `min` and
 * `max` are a row's amount as the card shows it, `rare` a rare find. Beside the ledger's rules:
 * - `content.hallProduction` ({@link hallLinesByRank}): a Guild Hall track paying the
 *   Hall an item, `star` (`{ id, name }`) and `ranks` (`[{ rank, quantity }]`) on the row; given, it
 *   stands for the ledger's Wishing Well rule, which knows only rank 1;
 * - `content.events`: an event that can land (`eventTable.isRunnable`) is a way in to its Token
 *   (`how: EVENT_WAY`, `event: { id, name, renamed }`).
 *
 * @returns {{
 *   entries: Map<string, {key, kind, id, name, def}>,
 *   byKind: Record<string, object[]>,
 *   entryOf(key): object|null,
 *   kindOfKey(key): string|null,
 *   sourcesOf(key): {how, via, chance, perCycle, min, max, rare, slot, inputs, gates, oneOff, maybe, tool, toolKind, bait, star, ranks, event}[],
 *   usesOf(key): {how, by, quantity?, nearby?}[],
 *   givesOf(key): {how, key, chance, perCycle, min, max, rare, slot, gates, tool, toolKind, bait, star, ranks}[],
 *   placeOf(key): {key, line, lineName, ring, gates}|null,
 *   search(term): object[]
 * }}
 */
export function buildEncyclopedia(content = gameContent()) {
    const ledger = buildLedger(content);
    const { world } = ledger;
    const entries = new Map();
    const add = (kind, key, id, def) => entries.set(key, { key, kind, id, name: world.names.get(key) ?? id, def });
    for (const [id, def] of Object.entries(world.items)) add(KIND.ITEM, itemKey(id), id, def);
    for (const [id, def] of Object.entries(world.tokens)) add(isObject(def.enemy) ? KIND.ENEMY : KIND.TOKEN, tokenKey(id), id, def);
    for (const [id, def] of Object.entries(world.recipes)) add(KIND.RECIPE, recipeKey(id), id, def);

    const byKind = Object.fromEntries(KINDS.map(k => [k, []]));
    for (const entry of entries.values()) byKind[entry.kind].push(entry);
    for (const list of Object.values(byKind)) sortByName(list);

    const shown = (key) => key == null || entries.has(key);

    // A world cell (a wedge at a ring) is no entry: a Token placed there names it as a place, with
    // the levels settling it asks.
    const lineNames = new Map((world.worldTables?.lines || []).map(line => [line.id, line.name || line.id]));
    const settleGates = new Map();
    for (const rule of world.rules) {
        if (rule.how === HOW.SETTLE) for (const give of rule.gives) settleGates.set(give.key, rule.gates);
    }
    const placeOf = (key) => {
        if (typeof key !== 'string' || !key.startsWith('wedge:')) return null;
        const cut = key.lastIndexOf(':');
        const line = key.slice('wedge:'.length, cut);
        return { key, line, lineName: lineNames.get(line) ?? line, ring: Number(key.slice(cut + 1)), gates: settleGates.get(key) || [] };
    };

    // Built once: who gives each key, who spends it, and what each record does.
    const sources = new Map();
    const uses = new Map();
    const gives = new Map();
    const push = (map, key, row, dedupe) => {
        if (!map.has(key)) map.set(key, []);
        const rows = map.get(key);
        if (!rows.some(r => dedupe(r) === dedupe(row))) rows.push(row);
    };
    const toolUsers = new Map();
    for (const rule of world.rules) {
        if (rule.tool) {
            if (!toolUsers.has(rule.tool)) toolUsers.set(rule.tool, new Set());
            if (rule.via) toolUsers.get(rule.tool).add(rule.via);
        }
    }

    const hallKey = entries.has(tokenKey(GUILD_HALL)) ? tokenKey(GUILD_HALL) : null;
    const hallRows = Array.isArray(content.hallProduction) ? content.hallProduction : null;

    for (const rule of world.rules) {
        // The Hall's tracks, at every rank, stand for the ledger's Well (rank 1 only).
        if (hallRows && rule.how === HOW.UPGRADE) continue;
        if (NOT_SHOWN.has(rule.how)) continue;
        if (UNSHOWN.has(rule.how)) {
            // A tool is used by every Token whose work asks for what it answers.
            for (const give of rule.gives) {
                for (const by of toolUsers.get(give.key) || []) {
                    if (shown(by)) push(uses, rule.via, { how: HOW.HOLD, by }, r => `${r.how}|${r.by}`);
                }
            }
            continue;
        }
        const placed = rule.how === HOW.WORLD;
        if (!placed && !shown(rule.via)) continue;
        const pool = rule.how === HOW.CATCH && rule.pool ? rule.pool : null;
        const toolId = pool ? toolItemFor({ kind: pool.tool, minTier: 1 }, world.items) : null;
        const seen = new Map();
        for (const give of rule.gives) {
            // The same item twice in one rule is two rows; a rare find rolls whatever the pool or recipe;
            // a rule the ledger writes per statement (a bonus drop, a spawn by a rule) is a way of its own.
            const lane = give.rare ? 'rare' : pool ? `pool:${pool.tool}|${pool.bait || ''}` : PER_STATEMENT.test(rule.id) ? rule.id : 'own';
            const n = seen.get(`${lane}|${give.key}`) || 0;
            seen.set(`${lane}|${give.key}`, n + 1);
            if (!entries.has(give.key)) continue;
            const ofPool = pool && !give.rare;
            const row = {
                chance: give.chance, perCycle: give.perCycle ?? null,
                min: Number.isFinite(give.min) ? give.min : null, max: Number.isFinite(give.max) ? give.max : null,
                rare: give.rare === true, slot: `${lane}:${n}`, gates: rule.gates,
                tool: ofPool && toolId && entries.has(itemKey(toolId)) ? itemKey(toolId) : null,
                toolKind: ofPool ? toolKindLabel(pool.tool) : null,
                bait: ofPool && pool.bait ? itemKey(pool.bait) : null
            };
            push(sources, give.key, {
                how: rule.how, via: rule.via, ...row,
                inputs: pool && give.rare ? [] : rule.inputs, oneOff: rule.oneOff === true, maybe: give.maybe === true
            }, r => `${r.how}|${r.via}|${r.slot}`);
            if (rule.via && !placed) push(gives, rule.via, { how: rule.how, key: give.key, ...row }, r => `${r.how}|${r.key}|${r.slot}`);
        }
        if (SPENT_BY.has(rule.how)) {
            const by = rule.how === HOW.SHOP ? rule.gives[0]?.key : rule.via;
            if (!shown(by)) continue;
            for (const input of rule.inputs) {
                if (input.key === by) continue;
                push(uses, input.key, { how: rule.how, by, quantity: input.quantity }, r => `${r.how}|${r.by}`);
            }
        }
        // A Token another one needs standing nearby (growth beside a tree, say).
        if (rule.how === HOW.GROW) {
            for (const need of rule.needs) {
                if (need !== rule.via && need.startsWith('token:') && entries.has(need)) {
                    push(uses, need, { how: HOW.GROW, by: rule.via, nearby: true }, r => `${r.how}|${r.by}|n`);
                }
            }
        }
    }

    for (const line of hallRows || []) {
        const key = itemKey(line.itemId);
        if (!entries.has(key) || !Array.isArray(line.ranks) || !line.ranks.length) continue;
        const row = {
            chance: 1, perCycle: null, min: null, max: null, rare: false, slot: `star:${line.trackId}`, gates: [],
            tool: null, toolKind: null, bait: null, star: { id: line.trackId, name: line.name }, ranks: line.ranks
        };
        push(sources, key, { how: HOW.UPGRADE, via: hallKey, ...row, inputs: [], oneOff: false, maybe: false }, r => `${r.how}|${r.via}|${r.slot}`);
        if (hallKey) push(gives, hallKey, { how: HOW.UPGRADE, key, ...row }, r => `${r.how}|${r.key}|${r.slot}`);
    }

    for (const event of Object.values(normaliseEventTable(content.events))) {
        const key = tokenKey(event.typeId);
        if (!isRunnable(event) || !entries.has(key)) continue;
        push(sources, key, {
            how: EVENT_WAY, via: null, chance: null, perCycle: null, min: null, max: null, rare: false, slot: `event:${event.id}`,
            inputs: [], gates: [], oneOff: false, maybe: false, tool: null, toolKind: null, bait: null,
            // `renamed`: the event goes by another name than the Token it lands.
            event: { id: event.id, name: event.name, renamed: event.name !== entries.get(key).name }
        }, r => `${r.how}|${r.slot}`);
    }

    return {
        entries,
        byKind,
        /** When `key` is first reachable, for ordering only: a tier is never shown. */
        reachOf: (key) => ledger.reach.get(key) ?? null,
        entryOf: (key) => entries.get(key) ?? null,
        kindOfKey: (key) => entries.get(key)?.kind ?? null,
        nameOf: (key) => entries.get(key)?.name ?? world.names.get(key) ?? (key ? parseKey(key).id : ''),
        sourcesOf: (key) => sources.get(key) || [],
        usesOf: (key) => uses.get(key) || [],
        givesOf: (key) => gives.get(key) || [],
        /** A world cell's place (`wedge:` keys only): its line, ring and the levels settling it asks. */
        placeOf,
        /** Entries whose name has words starting with the typed words, in kind order then by name. */
        search: (term) => KINDS.flatMap(k => byKind[k].filter(e => wordStartsMatch(e.name, term)))
    };
}

/**
 * Whether an entry belongs in its kind's total: something this world can give. A Planned stub is no
 * entry at all (the ledger's world leaves it out). An entry nothing reaches (half-authored content,
 * an item no rule makes yet) and one only some worlds hold (a chest) stay out of the total, so a
 * bar can always fill; once this run has one it counts all the same.
 */
export function countsTowardTotal(book, entry, got) {
    if (isCollected(got, entry)) return true;
    const at = book.reachOf(entry.key);
    return Number.isInteger(at?.tier) && at.maybe !== true;
}

function isCollected(got, entry) {
    return !!got?.[entry.kind]?.has(entry.id);
}

/**
 * This run's progress per kind, in tab order: `{ kind, found, total }`, `found` never above `total`.
 * `got` is `collectedOf()`'s sets. Reads only; the screen calls it once when the book opens.
 */
export function progressOf(book, got) {
    return KINDS.map(kind => {
        let found = 0;
        let total = 0;
        for (const entry of book.byKind[kind]) {
            if (!countsTowardTotal(book, entry, got)) continue;
            total += 1;
            if (isCollected(got, entry)) found += 1;
        }
        return { kind, found, total };
    });
}

let cached = null;

/** The game's encyclopedia, built on first use. */
export function encyclopedia() {
    if (!cached) cached = buildEncyclopedia();
    return cached;
}

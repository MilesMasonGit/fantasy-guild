// the encyclopedia's facts: every item, Token, enemy and recipe, where each comes from and what uses it

import { buildLedger, HOW, itemKey, tokenKey, recipeKey, parseKey, ingredientTree } from '../../../systems/progression/ledger/engine.js';
import { getAllItems } from '../../../config/registries/itemRegistry.js';
import { getAllTokenTypes } from '../../../config/registries/tokenRegistry.js';
import { listRecipes } from '../../../config/registries/recipePoolRegistry.js';
import { EFFECTS } from '../../../config/registries/effectRegistry.js';
import { starterCamp } from '../../../systems/atlas/StarterCamp.js';
import { wordStartsMatch } from '../drawer/bankSort.js';

/**
 * The encyclopedia reads the progression ledger's world (`ledger/engine.js`) over the game's own
 * registries: one picture of what makes what, shared with the CMS. Built the first time the screen
 * opens and kept, so a closed screen costs nothing.
 *
 * ⚠️ Only the world's rules and the ingredient tree are shown, never a reach tier: tiers come from
 * the owner's plan, which is not the player's business (and is stripped from the game's data).
 */

export const KIND = Object.freeze({ ITEM: 'items', TOKEN: 'tokens', ENEMY: 'enemies', RECIPE: 'recipes' });

/** The kinds in tab order. */
export const KINDS = Object.freeze([KIND.ITEM, KIND.TOKEN, KIND.ENEMY, KIND.RECIPE]);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The game's content in the shape the ledger reads. */
export function gameContent() {
    return {
        items: getAllItems(),
        tokens: getAllTokenTypes(),
        recipes: listRecipes(),
        effects: EFFECTS,
        starterCamp: starterCamp()
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

/** The ways something is spent: each names what spends it (the recipe, the Token, what a price buys). */
const SPENT_BY = new Set([HOW.CRAFT, HOW.WORK, HOW.CATCH, HOW.SPAWN, HOW.GROW, HOW.SHOP, HOW.UPCYCLE]);

function sortByName(list) {
    return list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/**
 * Every entry and its links, over `content` (the game's by default).
 *
 * @returns {{
 *   entries: Map<string, {key, kind, id, name, def}>,
 *   byKind: Record<string, object[]>,
 *   entryOf(key): object|null,
 *   kindOfKey(key): string|null,
 *   sourcesOf(key): {how, via, chance, firstKill, inputs}[],
 *   usesOf(key): {how, by, inputs?}[],
 *   givesOf(key): {how, key, chance, firstKill}[],
 *   treeOf(itemId): object|null,
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

    for (const rule of world.rules) {
        if (UNSHOWN.has(rule.how)) {
            // A tool is used by every Token whose work asks for what it answers.
            for (const give of rule.gives) {
                for (const by of toolUsers.get(give.key) || []) {
                    if (shown(by)) push(uses, rule.via, { how: HOW.HOLD, by }, r => `${r.how}|${r.by}`);
                }
            }
            continue;
        }
        if (!shown(rule.via)) continue;
        for (const give of rule.gives) {
            if (!entries.has(give.key)) continue;
            push(sources, give.key, {
                how: rule.how, via: rule.via, chance: give.chance, firstKill: give.firstKill === true,
                inputs: rule.how === HOW.SHOP ? rule.inputs : []
            }, r => `${r.how}|${r.via}`);
            if (rule.via) push(gives, rule.via, { how: rule.how, key: give.key, chance: give.chance, firstKill: give.firstKill === true }, r => `${r.how}|${r.key}`);
        }
        if (SPENT_BY.has(rule.how)) {
            const by = rule.how === HOW.SHOP || rule.how === HOW.UPCYCLE ? rule.gives[0]?.key : rule.via;
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

    const treeOf = (itemId) => {
        if (!world.items[itemId]) return null;
        const tree = ingredientTree(world, ledger.reach, itemId);
        return tree.children.length ? tree : null;
    };

    return {
        entries,
        byKind,
        entryOf: (key) => entries.get(key) ?? null,
        kindOfKey: (key) => entries.get(key)?.kind ?? null,
        nameOf: (key) => entries.get(key)?.name ?? world.names.get(key) ?? (key ? parseKey(key).id : ''),
        sourcesOf: (key) => sources.get(key) || [],
        usesOf: (key) => uses.get(key) || [],
        givesOf: (key) => gives.get(key) || [],
        treeOf,
        /** A recipe's inputs, each as its tree for one unit (`tree`) and how many one craft takes (`quantity`). */
        recipeTreesOf: (recipeId) => {
            const recipe = world.recipes[recipeId];
            if (!recipe) return [];
            return (Array.isArray(recipe.inputs) ? recipe.inputs : [])
                .filter(i => typeof i?.itemId === 'string' && world.items[i.itemId])
                .map(i => ({ tree: ingredientTree(world, ledger.reach, i.itemId), quantity: Math.max(0, Number(i.quantity) || 1) }));
        },
        /** Entries whose name has words starting with the typed words, in kind order then by name. */
        search: (term) => KINDS.flatMap(k => byKind[k].filter(e => wordStartsMatch(e.name, term)))
    };
}

let cached = null;

/** The game's encyclopedia, built on first use. */
export function encyclopedia() {
    if (!cached) cached = buildEncyclopedia();
    return cached;
}

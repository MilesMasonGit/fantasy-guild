// map ingredients → how many of each Token a Region gets

import { tokenName } from '../../config/registries/tokenRegistry.js';
import { TERRAIN, DEFAULT_TERRAIN } from './TerrainMap.js';

/**
 * The node budget: what the Cartography table's Node Summary shows, and what a layout then places.
 * A pure function of the ingredients and the Token cap. It takes no seed, so a reroll (a new seed
 * for `Layout.js`) can never change it, and slot order does not matter.
 *
 * ## The recipe shape (internal; A5's adapter turns authored maps into it)
 *
 * An ingredient is one slotted map item, either a Base Map:
 *
 *     { id: 'map_forest', kind: 'base', biome: 'forest', points: 40,
 *       nodes:     [{ typeId: 'token_oak_tree', weight: 6 }, { typeId: 'token_redberry_bush', weight: 1 }],
 *       camps:     [{ typeId: 'token_goblin_camp', count: 1 }],   // optional, the map's own
 *       treasures: [{ typeId: 'token_ruins', count: 1 }],         // optional, the map's own
 *       terrain: 'grass', water: 0 }                              // optional, see BIOME_GROUND
 *
 * or a Modifier, holding one or more effects:
 *
 *     { id: 'mod_overgrown', kind: 'modifier', effects: [
 *         { kind: 'density',  typeId: 'token_oak_tree', points: 16 },             // more of a node
 *         { kind: 'replace',  from: 'token_oak_tree', to: 'token_fir_tree',
 *                             share: 1 },                                         // a better node instead
 *         { kind: 'threat',   typeId: 'token_goblin_camp', count: 1 },            // an enemy camp
 *         { kind: 'treasure', typeId: 'token_ruins', count: 1 } ] }               // a treasure
 *
 * `share` (0–1, default 1) and `count` (default 1) are optional. Ids must be unique per distinct
 * ingredient: two slots holding the same map carry the same id.
 *
 * Either kind may also carry a `name` (what the Region's practical name calls it: "Forest",
 * "Overgrown") and `rules`, statements in force all over the Region while the guild is there
 * (`RegionRules.js`; today a `Provides`). Neither changes the budget.
 *
 * ## The rules
 * 1. **Base Maps blend.** Each writes `points / (number of Base Maps)` nodes, split by its weights,
 *    so a hybrid keeps the density of one map and two copies of a map write what one does. Their
 *    own camps and treasures take the most any one of them has, per Token.
 * 2. **Density** adds points of its node, on top, whether or not a Base Map has that node.
 * 3. **Replace** moves `share` of a node's points (densities included) to another node, all
 *    replaces at once (Oak → Fir and Fir → Birch never chain). Several replaces of one node split
 *    what they move between them. Nodes only, never camps or treasures.
 * 4. **Threat** and **treasure** add their count, per modifier slotted.
 * 5. **The cap**: the whole budget, camps and treasures included, is clamped to
 *    {@link nodeLimit}: the cap less {@link buildReserve}. Camps and treasures are kept and nodes
 *    trimmed in proportion; only if camps and treasures alone overflow are they trimmed too.
 * 6. Counts are whole numbers by largest remainder ({@link apportion}).
 * 7. **Biomes and ground.** Each node entry carries the biome that writes most of its points (a
 *    replaced node keeps its source's biome; a density node with no Base Map takes the main
 *    biome). The summary's `ground` says which terrain each biome's ground is, how much of the
 *    mat is water (blended like points) and which biomes bring the water; `Layout.js` builds the
 *    terrain grid from it. Camps and treasures take the ground where they land.
 *
 * An effect kind the engine does not know is skipped and listed in `ignored`, never guessed at.
 */

/**
 * The ground each of the first Base Maps writes, unless the map names its own `terrain` and
 * `water`. ⚠️ The Coast's water share is a placeholder until the owner tunes maps in the CMS.
 */
export const BIOME_GROUND = Object.freeze({
    forest: Object.freeze({ terrain: TERRAIN.GRASS, water: 0 }),
    mountain: Object.freeze({ terrain: TERRAIN.ROCK, water: 0 }),
    coast: Object.freeze({ terrain: TERRAIN.SAND, water: 0.3 })
});

function groundOf(map) {
    const known = BIOME_GROUND[map.biome] || {};
    const water = Number.isFinite(map.water) ? map.water : (known.water || 0);
    return { terrain: map.terrain || known.terrain || DEFAULT_TERRAIN, water: Math.min(1, Math.max(0, water)) };
}

/** What a budget entry is for: a node to work, an enemy camp, or a one-time treasure. */
export const ROLE = Object.freeze({ NODE: 'node', CAMP: 'camp', TREASURE: 'treasure' });

const ROLE_ORDER = [ROLE.NODE, ROLE.CAMP, ROLE.TREASURE];

/**
 * The share of the Token cap kept back from map nodes, for what the player builds (and the enemies
 * camps spawn). Half: a cap upgrade then gives the map and the base room alike.
 */
export const BUILD_RESERVE_SHARE = 0.5;

/** How many Tokens of the cap a map leaves for building. */
export function buildReserve(cap) {
    return Math.ceil(Math.floor(cap) * BUILD_RESERVE_SHARE);
}

/** The most Tokens a map may write: the cap less the building reserve. */
export function nodeLimit(cap) {
    return Math.max(0, Math.floor(cap) - buildReserve(cap));
}

/**
 * Whole-number shares of `total` in proportion to `weights` (`{ key: weight }`), by largest
 * remainder: everyone gets the whole part of their quota, then the seats left go to the largest
 * fractions. Ties go to the key that sorts first, so the answer never depends on input order.
 */
export function apportion(weights, total) {
    const keys = Object.keys(weights).sort();
    const sum = keys.reduce((n, k) => n + Math.max(0, weights[k]), 0);
    const out = Object.fromEntries(keys.map(k => [k, 0]));
    if (!(sum > 0) || !(total > 0)) return out;

    const rest = [];
    let given = 0;
    for (const k of keys) {
        const quota = total * Math.max(0, weights[k]) / sum;
        const whole = Math.floor(quota);
        out[k] = whole;
        given += whole;
        rest.push({ k, frac: quota - whole });
    }
    rest.sort((a, b) => b.frac - a.frac || byText(a.k, b.k));
    for (let i = 0; i < total - given; i++) out[rest[i % rest.length].k]++;
    return out;
}

const positive = (n, fallback) => (Number.isFinite(n) && n > 0 ? n : fallback);
const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n);

/** The key with the most weight in a Map (ties to the key that sorts first), or `fallback`. */
function heaviest(map, fallback = null) {
    let best = fallback;
    let bestWeight = 0;
    for (const [key, weight] of map) {
        if (weight > bestWeight || (weight === bestWeight && best !== fallback && byText(key, best) < 0)) {
            best = key;
            bestWeight = weight;
        }
    }
    return best;
}

/** Code-unit order: `localeCompare` may sort differently on another machine's locale data. */
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Ingredients in one fixed order, so float sums (and so every count) come out bit-identical. */
function canonical(ingredients) {
    const rank = (i) => (i?.kind === 'base' ? 0 : 1);
    return [...(ingredients || [])]
        .filter(i => i && typeof i === 'object')
        .sort((a, b) => rank(a) - rank(b) || byText(String(a.id), String(b.id)));
}

/**
 * The node budget for these ingredients under a Token cap.
 *
 * @param {object[]} ingredients  in the recipe shape above
 * @param {{cap: number}} options  the Token cap, given explicitly (the caller reads `MatCap`)
 * @returns {{
 *   entries: {typeId: string, role: string, count: number, biome: string|null}[],
 *   total: number, wanted: number, limit: number, clamped: boolean,
 *   biomes: Record<string, number>,
 *   ground: {main: string|null, terrains: Record<string, string>, water: number, shore: string[]},
 *   ingredients: string[], ignored: {ingredientId: string, kind: string}[]
 * }}
 */
export function budget(ingredients, { cap } = {}) {
    if (!Number.isFinite(cap) || cap < 0) throw new TypeError('budget() needs the Token cap: { cap }');

    const slots = canonical(ingredients);
    const bases = slots.filter(i => i.kind === 'base');
    const modifiers = slots.filter(i => i.kind === 'modifier');
    const ignored = [];

    // Node points per Token, kept per biome ('' for none) so each node knows whose ground it is.
    const points = new Map();
    const addPoints = (typeId, biome, n) => {
        if (!points.has(typeId)) points.set(typeId, new Map());
        add(points.get(typeId), biome, n);
    };
    const pointsOf = (typeId) => [...(points.get(typeId)?.values() || [])].reduce((a, b) => a + b, 0);
    const camps = new Map();
    const treasures = new Map();
    const biomes = {};
    const terrains = {};
    const shore = new Set();
    let water = 0;

    for (const map of bases) {
        if (map.biome) biomes[map.biome] = (biomes[map.biome] || 0) + 1;
        const ground = groundOf(map);
        if (map.biome && !(map.biome in terrains)) terrains[map.biome] = ground.terrain;
        if (map.biome && ground.water > 0) shore.add(map.biome);
        water += ground.water / bases.length;
        const share = positive(map.points, 0) / bases.length;
        const entries = (map.nodes || []).filter(n => n?.typeId && positive(n.weight, 0) > 0);
        const weightSum = entries.reduce((n, e) => n + e.weight, 0);
        for (const e of entries) addPoints(e.typeId, map.biome || '', share * e.weight / weightSum);
        for (const [list, into] of [[map.camps, camps], [map.treasures, treasures]]) {
            for (const poi of list || []) {
                if (!poi?.typeId) continue;
                into.set(poi.typeId, Math.max(into.get(poi.typeId) || 0, Math.floor(positive(poi.count, 1))));
            }
        }
    }
    for (const map of slots) {
        if (map.kind !== 'base' && map.kind !== 'modifier') ignored.push({ ingredientId: map.id, kind: map.kind });
    }
    // The main biome writes the most nodes (the Forest of a Forest and a small Coast), else, with no
    // nodes at all, it is the one slotted most.
    const biomePoints = new Map();
    for (const byBiome of points.values()) {
        for (const [biome, n] of byBiome) if (biome) add(biomePoints, biome, n);
    }
    const mainBiome = heaviest(biomePoints) || heaviest(new Map(Object.entries(biomes)));

    const replaces = [];
    for (const modifier of modifiers) {
        for (const effect of modifier.effects || []) {
            switch (effect?.kind) {
                case 'density':
                    if (effect.typeId) {
                        const home = points.has(effect.typeId) ? heaviest(points.get(effect.typeId), '') : (mainBiome || '');
                        addPoints(effect.typeId, home, positive(effect.points, 0));
                    }
                    break;
                case 'replace':
                    if (effect.from && effect.to && effect.from !== effect.to) {
                        replaces.push({ from: effect.from, to: effect.to, share: Math.min(1, positive(effect.share, 1)) });
                    }
                    break;
                case 'threat':
                    if (effect.typeId) add(camps, effect.typeId, Math.floor(positive(effect.count, 1)));
                    break;
                case 'treasure':
                    if (effect.typeId) add(treasures, effect.typeId, Math.floor(positive(effect.count, 1)));
                    break;
                default:
                    ignored.push({ ingredientId: modifier.id, kind: effect?.kind });
            }
        }
    }

    // All at once: what each replace moves is measured before any of them moves anything. What
    // moves keeps its biome: Fir written over a Forest's Oak stands on forest ground.
    const before = new Map([...points].map(([typeId, byBiome]) => [typeId, new Map(byBiome)]));
    const byFrom = new Map();
    for (const r of replaces) {
        if (!byFrom.has(r.from)) byFrom.set(r.from, []);
        byFrom.get(r.from).push(r);
    }
    for (const [from, group] of byFrom) {
        const shareSum = group.reduce((n, r) => n + r.share, 0);
        const fraction = Math.min(1, shareSum);
        for (const [biome, had] of before.get(from) || []) {
            const moved = had * fraction;
            if (!(moved > 0)) continue;
            addPoints(from, biome, -moved);
            for (const r of group) addPoints(r.to, biome, moved * r.share / shareSum);
        }
    }

    const limit = nodeLimit(cap);
    const fixedWanted = {};
    for (const [typeId, n] of camps) fixedWanted[`${ROLE.CAMP}|${typeId}`] = n;
    for (const [typeId, n] of treasures) fixedWanted[`${ROLE.TREASURE}|${typeId}`] = n;
    const fixedTotal = Object.values(fixedWanted).reduce((a, b) => a + b, 0);
    const fixed = fixedTotal > limit ? apportion(fixedWanted, limit) : fixedWanted;
    const fixedKept = Object.values(fixed).reduce((a, b) => a + b, 0);

    const nodeWeights = Object.fromEntries([...points.keys()].map(t => [t, pointsOf(t)]).filter(([, p]) => p > 1e-9));
    const nodesWanted = Math.round(Object.values(nodeWeights).reduce((a, b) => a + b, 0));
    const nodes = apportion(nodeWeights, Math.min(nodesWanted, limit - fixedKept));

    const entries = [];
    for (const [typeId, count] of Object.entries(nodes)) {
        entries.push({ typeId, role: ROLE.NODE, count, biome: heaviest(points.get(typeId), '') || null });
    }
    for (const [key, count] of Object.entries(fixed)) {
        const cut = key.indexOf('|');
        entries.push({ typeId: key.slice(cut + 1), role: key.slice(0, cut), count, biome: null });
    }
    const listed = entries
        .filter(e => e.count > 0)
        .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
            || b.count - a.count
            || byText(a.typeId, b.typeId));

    const total = listed.reduce((n, e) => n + e.count, 0);
    const wanted = nodesWanted + fixedTotal;
    return {
        entries: listed,
        total,
        wanted,
        limit,
        clamped: total < wanted,
        biomes,
        ground: { main: mainBiome, terrains, water, shore: [...shore].sort(byText) },
        ingredients: slots.map(i => i.id),
        ignored
    };
}

/** Player-facing words of the Node Summary, kept together for translation. */
export const SUMMARY_TEXT = Object.freeze({
    line: (count, name) => `${count} × ${name}`,
    headline: (total) => `${total} Tokens`,
    trimmed: (total, wanted) => `${total} Tokens (trimmed from ${wanted} to fit the Token cap)`
});

/**
 * The Node Summary in words, for the Cartography preview (A6) and a map item's "What it writes"
 * (A5): one line per Token in budget order (nodes, then camps, then treasures).
 *
 * @param {object|object[]} nodeSummary  a {@link budget} result, or just its `entries`
 * @param {{nameOf?: (typeId: string) => string}} [options]  Token names; the registry's by default
 * @returns {{headline: string, lines: {role: string, typeId: string, count: number, text: string}[], text: string}}
 */
export function describe(nodeSummary, { nameOf = tokenName } = {}) {
    const entries = Array.isArray(nodeSummary) ? nodeSummary : (nodeSummary?.entries || []);
    const total = entries.reduce((n, e) => n + e.count, 0);
    const wanted = Array.isArray(nodeSummary) ? total : (nodeSummary?.wanted ?? total);
    const headline = wanted > total ? SUMMARY_TEXT.trimmed(total, wanted) : SUMMARY_TEXT.headline(total);
    const lines = entries.map(e => ({
        role: e.role, typeId: e.typeId, count: e.count,
        text: SUMMARY_TEXT.line(e.count, nameOf(e.typeId) || e.typeId)
    }));
    return { headline, lines, text: [headline, ...lines.map(l => l.text)].join('\n') };
}

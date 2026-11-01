// what a world cell's mat holds: its kit's work, its specialty's better things, its hidden extras and its wild oddness (pure)

import { STRICT_RINGS, heroTokensOf, kitById, lineById } from '../../config/worldTablesShape.js';
import { mulberry32, seedFromText } from '../atlas/seededRandom.js';
import { ORIGIN_ROLE, EXTREME } from './generate.js';

/**
 * A settled place's mat, worked out from its world cell and the world tables (owner, the world map
 * concept's "What goes on a mat"): natural work for about four to six heroes, and room left for building.
 *
 * 1. **The kit** (`kit.work`, heroes per skill) covers most skills in its own balance. A skill's
 *    heroes become Tokens by `heroTokens` (about five veins, four trees, two waters, one camp keep
 *    one hero busy). Its Tokens are the cell's own origins of that skill (its line and its
 *    specialty three times as heavily as a blend), else the everyday ones: that skill's origins of
 *    the earlier rings and the Hall's cell, materials the guild already has.
 * 2. **The specialty** means better things, not more: its skill gets at least `specialtyHeroes` of
 *    work, all of it the cell's own origins of that skill (never the everyday ones), one of them
 *    the rarest origin of its line's table for the ring. A combat specialty makes one of the kit's
 *    camps its boss camp (`kit.bossCamps`).
 * 3. Work for a skill nothing fills goes to the cell's own line, so the heroes kept busy hold;
 *    every origin the map shows stands on the mat at least once; and past {@link MAX_HEROES} the
 *    kit's largest everyday share gives way.
 * 4. **Hidden extras**: the cell's modifiers and treasures, as generated (`generate.js`, step 7). A
 *    modifier's extra work, its "more of" nodes (`density`) and its camps (`threat`), is natural
 *    work like the rest: written here, inside the cap, and taken out of the recipe Budget reads
 *    (`cellRegion.js`; owner: they count inside the six heroes).
 * 5. **Wild extremes**: one origin almost everywhere (`wild.compositionShare` of the nodes), or an
 *    odd layout ({@link LAYOUT_GROUND}).
 * 6. **Stone**: the kit's Stone terrain outcrops; **arrival**: the enemies the place arrives with.
 *
 * The camps and the rare node are picked by the cell's own seed, so a cell always writes the same.
 *
 * Pure: reads only what it is handed. `skillOf(typeId)` is a Token's work skill.
 */

/** The work that is camps rather than nodes. */
export const COMBAT = 'combat';

/** How heavily each kind of origin takes its skill's work: the cell's line and specialty first. */
export const ROLE_WEIGHT = Object.freeze({
    [ORIGIN_ROLE.MAIN]: 3,
    [ORIGIN_ROLE.KEY]: 3,
    [ORIGIN_ROLE.SPECIALTY]: 3,
    [ORIGIN_ROLE.BLEND]: 1,
    [ORIGIN_ROLE.HALL]: 1
});

/** How many heroes' work a cell gets when its kit names none: all of it on its own origins. */
export const DEFAULT_HEROES = 5;

/** The most heroes a mat's natural work keeps busy (owner: four to six); the rest is built. */
export const MAX_HEROES = 6;

/** The ground each placeholder kit stands on when its row names none. */
export const KIT_BIOME = Object.freeze({
    highland: 'mountain',
    woodland: 'forest',
    plains: 'meadow',
    wetland: 'bog',
    riverside: 'coast'
});

export const DEFAULT_BIOME = 'meadow';

/** The odd layouts a wild cell may have (owner: islands, a chasm, mostly water, little building room). */
export const WILD_LAYOUT = Object.freeze({ ISLANDS: 'islands', CHASM: 'chasm', MOSTLY_WATER: 'mostly_water', CRAMPED: 'cramped' });

/**
 * What each odd layout does to the mat: `water` the sea's share and `inland` its inland water,
 * `ridge` a band of Stone across the mat, `stone` outcrops added, `nodes` the nodes multiplied.
 * ⚠️ First values, for the owner's look.
 */
export const LAYOUT_GROUND = Object.freeze({
    [WILD_LAYOUT.ISLANDS]: Object.freeze({ water: 0.4, inland: 'lake' }),
    [WILD_LAYOUT.MOSTLY_WATER]: Object.freeze({ water: 0.45 }),
    [WILD_LAYOUT.CHASM]: Object.freeze({ ridge: true }),
    [WILD_LAYOUT.CRAMPED]: Object.freeze({ stone: 8, nodes: 1.5 })
});

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Whole-number shares of `total` by weight, largest remainder first, ties to the key that sorts
 * first (`Budget.apportion`'s rule, restated so this file stays import-light for the ledger).
 */
export function shares(weights, total) {
    const keys = Object.keys(weights).sort(byText);
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

/** The ground a kit stands on. */
export function kitBiome(tables, kitId) {
    return kitById(tables, kitId)?.biome || KIT_BIOME[kitId] || DEFAULT_BIOME;
}

/** The everyday origins of `skill` for a cell of tier `tier`: earlier rings' and the Hall's, weighted. */
function everydayOf(skill, tier, tables, skillOf, hallOrigins) {
    const out = new Map();
    for (const id of hallOrigins) if (skillOf(id) === skill) out.set(id, (out.get(id) || 0) + 1);
    for (const line of tables.lines) {
        for (let n = 1; n < tier; n++) {
            for (const o of line.origins[n] || []) {
                if (skillOf(o.id) === skill) out.set(o.id, (out.get(o.id) || 0) + o.weight);
            }
        }
    }
    return out;
}

/** The cell's own origins of `skill`, weighted by role. */
function ownOf(cell, skill, skillOf) {
    const out = new Map();
    for (const o of cell.origins || []) {
        if (skillOf(o.id) !== skill) continue;
        out.set(o.id, Math.max(out.get(o.id) || 0, ROLE_WEIGHT[o.role] ?? 1));
    }
    return out;
}

/** The rarest origin of the specialty's line for a tier: the lowest weight, the first listed of a tie. */
function rarestOf(tables, skill, tier, skillOf) {
    const line = tables.lines.find(l => l.skill === skill);
    let best = null;
    for (const o of line?.origins[tier] || []) {
        if (skillOf(o.id) !== skill) continue;
        if (!best || o.weight < best.weight) best = o;
    }
    return best?.id || null;
}

/** Add `n` of `typeId` to a node map. */
const addTo = (map, typeId, n) => {
    if (n > 0) map.set(typeId, (map.get(typeId) || 0) + n);
};

/** How many Tokens `heroes` of `skill` is: at least one for any work at all. */
function tokensFor(tables, skill, heroes) {
    return heroes > 0 ? Math.max(1, Math.round(heroes * heroTokensOf(tables, skill))) : 0;
}

/**
 * The mat a cell writes.
 *
 * @param {object} cell a world cell (`generate.js`)
 * @param {object} tables normalised world tables
 * @param {object} lookups
 * @param {(typeId: string) => string|null} lookups.skillOf a Token's work skill
 * @param {string[]} [lookups.hallOrigins] the Hall's cell's origins (the Starter Camp's)
 * @param {(itemId: string) => object|null} [lookups.modifierRecipe] a modifier extra's recipe, or null
 * @returns {{
 *   biome: string, heroes: Record<string, number>,
 *   nodes: {typeId: string, count: number, skill: string|null}[],
 *   camps: {typeId: string, count: number}[], treasures: {typeId: string, count: number}[],
 *   modifiers: string[], arrival: {typeId: string, count: number, boss?: boolean}[],
 *   stone: {outcrops: number, ridge: boolean}, water: number|null, inland: string|null,
 *   rare: string|null, extreme: object|null
 * }}
 */
export function cellMat(cell, tables, { skillOf = () => null, hallOrigins = [], modifierRecipe = () => null } = {}) {
    const tier = Math.min(Math.max(1, cell?.ring || 1), STRICT_RINGS);
    const kit = kitById(tables, cell?.kit);
    const random = mulberry32(seedFromText(`${cell?.seed >>> 0}|mat`));
    const specialty = cell?.specialty || null;

    const heroes = { ...(kit?.work || {}) };
    if (!Object.keys(heroes).length) {
        const line = lineById(tables, cell?.wedge);
        if (line?.skill) heroes[line.skill] = DEFAULT_HEROES;
    }
    if (specialty) heroes[specialty] = Math.max(heroes[specialty] || 0, tables.specialtyHeroes ?? 1);

    const nodes = new Map();
    const skillOfNode = new Map();
    const camps = new Map();
    let leftover = 0;
    let rare = null;
    let bossCamp = null;
    const fromHeroes = (skill, h) => tokensFor(tables, skill, h);

    for (const skill of Object.keys(heroes).sort(byText)) {
        const count = tokensFor(tables, skill, heroes[skill]);
        if (!count) continue;
        if (skill === COMBAT) {
            const everyday = kit?.camps || [];
            const boss = specialty === COMBAT ? (kit?.bossCamps || []) : [];
            let left = count;
            if (boss.length) {
                bossCamp = boss[Math.floor(random() * boss.length)];
                addTo(camps, bossCamp, 1);
                left--;
            }
            for (let i = 0; i < left && everyday.length; i++) addTo(camps, everyday[Math.floor(random() * everyday.length)], 1);
            continue;
        }
        let pool = ownOf(cell, skill, skillOf);
        if (skill === specialty) {
            const candidate = rarestOf(tables, skill, tier, skillOf);
            if (candidate && !pool.has(candidate) && count > 1) {
                rare = candidate;
                addTo(nodes, rare, 1);
                skillOfNode.set(rare, skill);
            }
        } else if (!pool.size) {
            pool = everydayOf(skill, tier, tables, skillOf, hallOrigins);
        }
        const want = rare && skill === specialty ? count - 1 : count;
        if (!pool.size) {
            leftover += heroes[skill] * want / count;
            continue;
        }
        for (const [typeId, n] of Object.entries(shares(Object.fromEntries(pool), want))) {
            addTo(nodes, typeId, n);
            skillOfNode.set(typeId, skill);
        }
    }

    // Work nothing could fill goes to the cell's own line, as heroes, so the heroes kept busy hold.
    if (leftover > 0) {
        const own = new Map();
        for (const o of cell?.origins || []) if (o.role !== ORIGIN_ROLE.BLEND) own.set(o.id, ROLE_WEIGHT[o.role] ?? 1);
        if (!own.size) for (const o of cell?.origins || []) own.set(o.id, 1);
        const weight = [...own.values()].reduce((a, b) => a + b, 0);
        for (const [typeId, w] of [...own].sort(([a], [b]) => byText(a, b))) {
            const skill = skillOf(typeId);
            addTo(nodes, typeId, fromHeroes(skill, leftover * w / weight));
            if (!skillOfNode.has(typeId)) skillOfNode.set(typeId, skill);
        }
    }

    // Every origin the map shows stands on the mat: one its kit gave no Token gets one (half a
    // hero's work when its skill is none of the kit's).
    for (const o of cell?.origins || []) {
        if (nodes.has(o.id)) continue;
        const skill = skillOf(o.id);
        addTo(nodes, o.id, heroes[skill] ? 1 : Math.max(1, Math.round(heroTokensOf(tables, skill) / 2)));
        skillOfNode.set(o.id, skill);
    }

    // The hidden modifiers' extra work, each modifier once: more of a node, or a camp.
    const modifierIds = new Set((cell?.extras || []).filter(e => e.kind === 'modifier').map(e => e.id));
    for (const id of modifierIds) {
        for (const effect of modifierRecipe(id)?.effects || []) {
            if (!effect?.typeId) continue;
            if (effect.kind === 'density') {
                const n = Math.round(Number(effect.points) || 0);
                if (n <= 0) continue;
                addTo(nodes, effect.typeId, n);
                if (!skillOfNode.has(effect.typeId)) skillOfNode.set(effect.typeId, skillOf(effect.typeId));
            } else if (effect.kind === 'threat') {
                addTo(camps, effect.typeId, Math.max(1, Math.floor(Number(effect.count) || 1)));
            }
        }
    }

    // At most `MAX_HEROES` of natural work: the largest share of nodes that is not the
    // specialty's gives way first, then, if that is not enough, the specialty's own; never an
    // origin's or the rare node's last Token.
    const busyNow = () => busyOf(nodes, skillOfNode, camps, tables);
    const keep = new Set([...(cell?.origins || []).map(o => o.id), ...(rare ? [rare] : [])]);
    for (const spareSpecialty of [true, false]) {
        for (let guard = 0; guard < 500 && busyNow() > MAX_HEROES + 1e-9; guard++) {
            let cut = null;
            for (const [typeId, n] of nodes) {
                const skill = skillOfNode.get(typeId);
                if ((spareSpecialty && skill === specialty) || n <= (keep.has(typeId) ? 1 : 0)) continue;
                const load = n / heroTokensOf(tables, skill);
                if (!cut || load > cut.load || (load === cut.load && byText(typeId, cut.typeId) < 0)) cut = { typeId, load };
            }
            if (!cut) break;
            nodes.set(cut.typeId, nodes.get(cut.typeId) - 1);
            if (!nodes.get(cut.typeId)) nodes.delete(cut.typeId);
        }
    }
    // Last, when camps alone keep it over: the camps give way, the most of one kind first, never
    // the specialty's boss camp.
    for (let guard = 0; guard < 100 && busyNow() > MAX_HEROES + 1e-9; guard++) {
        const cut = [...camps].filter(([id, n]) => n > (id === bossCamp ? 1 : 0))
            .sort(([a, x], [b, y]) => y - x || byText(a, b))[0];
        if (!cut) break;
        camps.set(cut[0], cut[1] - 1);
        if (!camps.get(cut[0])) camps.delete(cut[0]);
    }

    const extreme = cell?.extreme || null;
    const ground = extreme?.kind === EXTREME.LAYOUT ? (LAYOUT_GROUND[extreme.layout] || {}) : {};
    let counts = Object.fromEntries(nodes);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // One origin almost everywhere: the focus takes its share, the rest keep their balance.
    if (extreme?.kind === EXTREME.COMPOSITION && extreme.focus && total > 0) {
        const focus = Math.round(total * (tables.wild?.compositionShare ?? 0.75));
        const rest = { ...counts };
        delete rest[extreme.focus];
        counts = { ...shares(rest, total - focus), [extreme.focus]: focus };
        if (!skillOfNode.has(extreme.focus)) skillOfNode.set(extreme.focus, skillOf(extreme.focus));
    }
    if (ground.nodes > 1 && total > 0) counts = shares(counts, Math.round(total * ground.nodes));

    const treasures = new Map();
    const modifiers = [];
    for (const extra of cell?.extras || []) {
        if (extra.kind === 'treasure') addTo(treasures, extra.id, 1);
        else if (extra.kind === 'modifier' && !modifiers.includes(extra.id)) modifiers.push(extra.id);
    }

    const list = (map) => [...map].map(([typeId, count]) => ({ typeId, count }));
    return {
        biome: kitBiome(tables, cell?.kit),
        heroes,
        nodes: Object.entries(counts).filter(([, n]) => n > 0).sort(([a], [b]) => byText(a, b))
            .map(([typeId, count]) => ({ typeId, count, skill: skillOfNode.get(typeId) ?? null })),
        camps: list(camps),
        treasures: list(treasures),
        modifiers,
        arrival: (cell?.arrival || []).map(r => ({ ...r })),
        stone: { outcrops: (kit?.stone || 0) + (ground.stone || 0), ridge: !!ground.ridge },
        water: Number.isFinite(ground.water) ? ground.water : null,
        inland: ground.inland || null,
        rare,
        extreme
    };
}

/** The heroes nodes and camps keep busy: each skill's Tokens over what one hero keeps busy. */
function busyOf(nodes, skillOfNode, camps, tables) {
    let sum = 0;
    for (const [typeId, n] of nodes) sum += n / heroTokensOf(tables, skillOfNode.get(typeId));
    let campCount = 0;
    for (const n of camps.values()) campCount += n;
    return sum + campCount / heroTokensOf(tables, COMBAT);
}

/** The heroes a mat's natural work keeps busy: each skill's Tokens over what one hero keeps busy. */
export function busyHeroes(mat, tables) {
    return busyOf(new Map(mat.nodes.map(n => [n.typeId, n.count])), new Map(mat.nodes.map(n => [n.typeId, n.skill])),
        new Map(mat.camps.map(c => [c.typeId, c.count])), tables);
}

// the ledger meets the world: origins' wedges and rings, a world for a seed read as places, checks F, many worlds swept (pure)

import { PLAN_STATUS, statusOf, planPlaceOf } from './plan.js';
import { HOW, buildLedger, computeReach, itemKey, tokenKey, recipeKey, isOneOff } from './engine.js';
import { SEVERITY, ruleIndex, whyNever } from './checks.js';
import { generateWorld, priceTemplateOf } from '../../world/generate.js';
import { worldFindings, WORLD_CHECK } from '../../world/checks.js';
import { cellMat, COMBAT } from '../../world/cellMat.js';
import { materialsFromTokens, hallOriginsOf } from '../../world/materials.js';
import { STRICT_RINGS, heroTokensOf, kitById, lineById } from '../../../config/worldTablesShape.js';
import { normaliseStarterCamp } from '../../../config/starterCampShape.js';
import { isMapItem, isModifier, recipeOf as mapRecipeOf } from '../../atlas/mapItems.js';
import { stationSkillOf } from '../../effects/statements.js';

/**
 * The world map's side of the ledger (brief 330 W5).
 *
 * - **Wedge and ring on origins.** An origin's plan block may place it (`plan.wedge`, `plan.ring`);
 *   {@link plannedTables} lays those places on the world tables the game generates from, so the
 *   World plan shows the world the plan makes. With no place set it is exactly the game's world.
 * - **A world for a seed, read as places** ({@link worldPlan}): the generated world, each cell's mat
 *   (`cellMat.js`, as settling writes it), and a reach over the content with the retired map items
 *   taken out and each inner cell put in: a cell places what its mat holds (origins, everyday nodes,
 *   camps, treasures, its arrival, its hidden modifiers' Tokens) at its ring.
 * - **Checks F** on that world: a ring-N cell asking ring-N materials; a key material not a step from
 *   every frontier; the inner rings not covering every Live entry; a wild origin no wedge places; a
 *   cell's extras off its ring's value. The world's own rules (`world/checks.js`) are read here too:
 *   the four that are checks F under these names, the rest as "another rule of the world".
 * - **Many worlds** ({@link sweepWorlds}): how many pass, each rule's failures grouped by what fails
 *   across worlds, per-skill bands (cells offering a skill's new work, heroes it keeps busy) and
 *   price spreads per ring (items and hero time). A coverage finding says whether the entry was
 *   reachable before the world (`before`: its tier through the map items, or null), which tells
 *   what the world lost from content that was never finished.
 *
 * ⚠️ Coverage reads what the inner rings place and make as if every inner cell were settled: whether
 * a cell's price can be paid is the price checks' to say, so one bad price is one finding, not every
 * entry behind it.
 * ⚠️ A ring is a tier: the Hall's cell (the Starter Camp) is tier 0, ring n tier n.
 *
 * Pure: reads only what it is handed.
 */

/** The checks F, by id; their group and words are `checks.js`'s. */
export const WORLD_F = Object.freeze({
    PRICE_RING: 'world-price-ring',
    KEY_REACH: 'world-key-reach',
    COVERAGE: 'world-coverage',
    NO_WEDGE: 'world-no-wedge',
    VALUE: 'world-value',
    RULE: 'world-rule'
});

/** The five checks F the owner named; a world passes when none of them finds anything. */
export const F_CHECKS = Object.freeze([WORLD_F.PRICE_RING, WORLD_F.KEY_REACH, WORLD_F.COVERAGE, WORLD_F.NO_WEDGE, WORLD_F.VALUE]);

/** The world's own checks that are checks F; any other is "another rule of the world". */
const AS_F = Object.freeze({
    [WORLD_CHECK.PRICE_RING]: WORLD_F.PRICE_RING,
    [WORLD_CHECK.KEY_REACH]: WORLD_F.KEY_REACH,
    [WORLD_CHECK.COVERAGE]: WORLD_F.COVERAGE,
    [WORLD_CHECK.VALUE]: WORLD_F.VALUE
});

/** Author-facing words, kept together for translation. */
export const WORLD_PLAN_TEXT = Object.freeze({
    noWedge: (materials) => `Looks like a wild origin (its work yields ${materials}), but no wedge places it and nothing makes it: give it a wedge and a ring, a way to be built, or Park it.`,
    unknownWedge: (wedge) => `Its plan puts it in the wedge "${wedge}", which the world tables do not have.`,
    priceRing: (cell, name, ring, at) => `Cell ${cell} (ring ${ring}) asks for ${name}, first had at ring ${at}: not an earlier ring.`,
    priceNever: (cell, name) => `Cell ${cell} asks for ${name}, which the inner rings never give.`,
    notCovered: (why) => `Not reachable from the inner rings: ${why}`,
    lost: (tier) => `reachable before the world map (tier ${tier}, through map items)`,
    neverBefore: 'never reachable before the world map either',
    noMain: (line, ring) => `no-main: ${line} ring ${ring}`,
    ring: (ring) => `ring ${ring}`,
    cell: (id, kit, line) => [kit, line].filter(Boolean).join(' ') + ` (${id})`,
    hall: 'The Starter Camp'
});

/** Item and Token rules that only placed through map items, which the world retired. */
const RETIRED = new Set([HOW.MAP, HOW.MODIFIER, HOW.TUTORIAL, HOW.BOUNTY, HOW.UPCYCLE]);

/** Rules that place a Token where it stands rather than make it. */
const PLACING = new Set([...RETIRED, HOW.STARTER_CAMP]);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const cellKey = (id) => `cell:${id}`;

/** A keyed collection or a list, as `[id, def]` pairs. */
function entriesOf(collection) {
    if (Array.isArray(collection)) return collection.filter(d => isObject(d) && d.id).map(d => [d.id, d]);
    return isObject(collection) ? Object.entries(collection).filter(([, d]) => isObject(d)).map(([id, d]) => [d.id ?? id, d]) : [];
}

/** Every place the tables list each origin: id → `[{ line, ring }]`, strict rings only. */
function listingsOf(tables) {
    const out = new Map();
    for (const line of tables.lines) {
        for (let ring = 1; ring <= STRICT_RINGS; ring++) {
            for (const o of line.origins[ring] || []) {
                if (!out.has(o.id)) out.set(o.id, []);
                out.get(o.id).push({ line: line.id, ring, weight: o.weight });
            }
        }
    }
    return out;
}

/**
 * The tables the World plan generates from: `baseTables` with each origin its plan places (wedge and
 * ring both set, the wedge a line of the tables) moved there from wherever the base listed it,
 * keeping its weight. A Planned stub placed by its plan joins the tables: the World plan is the plan.
 *
 * @returns {{ tables: object, moved: {id, from: {line, ring}|null, to: {line, ring}}[], unknown: {id, wedge}[] }}
 *   `moved` the origins placed elsewhere than the base tables have them; `unknown` the plans naming
 *   a wedge the tables lack (not placed). With nothing moved, `tables` is `baseTables` itself.
 */
export function plannedTables(baseTables, tokens = {}) {
    const lineIds = new Set(baseTables.lines.map(l => l.id));
    const listings = listingsOf(baseTables);
    const moves = [];
    const unknown = [];
    for (const [id, def] of entriesOf(tokens)) {
        const { wedge, ring } = planPlaceOf(def);
        if (!wedge || ring === null) continue;
        if (!lineIds.has(wedge)) {
            unknown.push({ id, wedge });
            continue;
        }
        const listed = listings.get(id) || [];
        if (listed.length === 1 && listed[0].line === wedge && listed[0].ring === ring) continue;
        moves.push({ id, line: wedge, ring, weight: Math.max(1, ...listed.map(l => l.weight)) });
    }
    if (!moves.length) return { tables: baseTables, moved: [], unknown };
    const moving = new Set(moves.map(m => m.id));
    const lines = baseTables.lines.map(line => {
        const origins = {};
        for (let ring = 1; ring <= STRICT_RINGS; ring++) {
            origins[ring] = (line.origins[ring] || []).filter(o => !moving.has(o.id)).map(o => ({ ...o }));
            for (const m of moves) if (m.line === line.id && m.ring === ring) origins[ring].push({ id: m.id, weight: m.weight });
        }
        return { ...line, origins };
    });
    const moved = moves.map(m => {
        const first = (listings.get(m.id) || [])[0];
        return { id: m.id, from: first ? { line: first.line, ring: first.ring } : null, to: { line: m.line, ring: m.ring } };
    });
    return { tables: { ...baseTables, lines }, moved, unknown };
}

/** Where the tables put each origin: id → `{ line, ring }`, its earliest listing. */
export function placementOf(tables) {
    const out = new Map();
    for (const [id, listed] of listingsOf(tables)) {
        const first = [...listed].sort((a, b) => a.ring - b.ring)[0];
        out.set(id, { line: first.line, ring: first.ring });
    }
    return out;
}

/** The Token ids a generated cell may hold as a treasure: the tables' treasure extras and the maps' treasures. */
function treasureIdsOf(tables, ledgerWorld) {
    const out = new Set(tables.extras.filter(e => e.kind === 'treasure').map(e => e.id));
    for (const def of Object.values(ledgerWorld.items)) {
        if (!isMapItem(def)) continue;
        for (const t of def.cartography?.treasures || []) if (t?.typeId) out.add(t.typeId);
        for (const e of def.cartography?.effects || []) if (e?.kind === 'treasure' && e.typeId) out.add(e.typeId);
    }
    return out;
}

/**
 * The Tokens that are had only in the wild: their own work yields a material, nothing in the content
 * makes them (no growth, turn, spawn, build, Shop or Hall: only a place), and they are no enemy,
 * camp, station, Foundation or treasure.
 */
function wildOriginIds(ledgerWorld, materialsOf, treasures) {
    const made = new Set();
    for (const rule of ledgerWorld.rules) {
        if (PLACING.has(rule.how)) continue;
        for (const g of rule.gives) if (g.key.startsWith('token:')) made.add(g.key);
    }
    const out = [];
    for (const [id, def] of Object.entries(ledgerWorld.tokens)) {
        if (isObject(def.enemy) || isObject(def.spawner) || isObject(def.foundation) || stationSkillOf(def)) continue;
        if (treasures.has(id) || made.has(tokenKey(id)) || !materialsOf(id).length) continue;
        out.push(id);
    }
    return out;
}

/**
 * What the World plan reads of the content, worked out once for any number of seeds.
 *
 * @param {object} content `{ items, tokens, recipePools | recipes, effects, starterCamp }`, as the ledger takes it
 * @param {{ baseTables: object, ledger?: object }} options the world tables in force (normalised) and,
 *   if already built, the ledger over the same content
 */
export function worldContext(content, { baseTables, ledger = null } = {}) {
    if (!baseTables || !Array.isArray(baseTables.lines)) throw new TypeError('worldContext() needs normalised world tables');
    const base = ledger ?? buildLedger(content);
    const lw = base.world;
    const rawTokens = Object.fromEntries(entriesOf(content.tokens));
    const { tables, moved, unknown } = plannedTables(baseTables, rawTokens);
    // The game's own lookups (`World.lookups`, `Settling.skillOf`), over the Tokens the game would have.
    const live = (id) => (lw.tokens[id] ? rawTokens[id] : undefined);
    const materialsOf = materialsFromTokens(live);
    const skillOf = (id) => live(id)?.config?.skill || null;
    const modifierRecipe = (id) => (isModifier(lw.items[id]) ? mapRecipeOf(lw.items[id]) : null);
    const camp = normaliseStarterCamp(content.starterCamp);
    const hallOrigins = hallOriginsOf(camp?.tokens, materialsOf);
    const campTokens = new Set((camp?.tokens || []).map(t => t.typeId));

    const records = new Map();
    for (const [id, def] of entriesOf(content.items)) records.set(itemKey(id), def);
    for (const [id, def] of entriesOf(content.tokens)) records.set(tokenKey(id), def);
    const pools = Array.isArray(content.recipes) ? { all: content.recipes } : (isObject(content.recipePools) ? content.recipePools : {});
    for (const pool of Object.values(pools)) for (const [id, def] of entriesOf(pool)) records.set(recipeKey(id), def);

    const nameOf = (key) => lw.names.get(key) ?? key.slice(key.indexOf(':') + 1);
    const lineName = (id) => lineById(tables, id)?.name || id;
    const kitName = (id) => kitById(tables, id)?.name || id || '';
    const cellName = (cell) => (cell.ring === 0 ? WORLD_PLAN_TEXT.hall : WORLD_PLAN_TEXT.cell(cell.id, kitName(cell.kit), lineName(cell.wedge)));

    // Seed-free: the wild origins no wedge places.
    const placed = placementOf(tables);
    const parked = (id) => statusOf(rawTokens[id]) === PLAN_STATUS.PARKED;
    const origins = [];
    for (const { id, wedge } of unknown) {
        if (!parked(id)) origins.push({ check: WORLD_F.NO_WEDGE, key: tokenKey(id), severity: SEVERITY.WARN, message: WORLD_PLAN_TEXT.unknownWedge(wedge), related: [] });
    }
    const said = new Set(unknown.map(u => u.id));
    for (const id of wildOriginIds(lw, materialsOf, treasureIdsOf(tables, lw))) {
        if (placed.has(id) || campTokens.has(id) || said.has(id) || parked(id)) continue;
        const yields = materialsOf(id).map(m => nameOf(itemKey(m))).join(', ');
        origins.push({ check: WORLD_F.NO_WEDGE, key: tokenKey(id), severity: SEVERITY.WARN, message: WORLD_PLAN_TEXT.noWedge(yields), related: materialsOf(id).map(itemKey) });
    }

    const effort = new Map();
    const effortOf = (itemId) => {
        if (!effort.has(itemId)) effort.set(itemId, lw.items[itemId] ? base.treeOf(itemId).effortMs : 0);
        return effort.get(itemId);
    };

    return {
        content, base, tables, baseTables, moved, unknown, materialsOf, skillOf, modifierRecipe, hallOrigins,
        records, nameOf, lineName, kitName, cellName, origins, effortOf,
        keptRules: lw.rules.filter(r => !RETIRED.has(r.how))
    };
}

/**
 * The check F that needs no world: each Live wild origin no wedge places (neither the tables nor its
 * plan, and not the Starter Camp's), and each plan naming a wedge the tables lack. In the checks'
 * `extra` shape, for the Ledger's problems list.
 *
 * @param {object} content as {@link worldContext} takes it
 * @param {{ baseTables: object, ledger?: object }} options
 */
export function originFindings(content, { baseTables, ledger = null } = {}) {
    return worldContext(content, { baseTables, ledger }).origins;
}

/** Every Token a cell's mat stands on it: nodes, camps, treasures, its arrival and its modifiers' own Tokens. */
function placedTokens(mat, modifierRecipe) {
    const out = new Set();
    for (const n of mat.nodes) out.add(n.typeId);
    for (const c of mat.camps) out.add(c.typeId);
    for (const t of mat.treasures) out.add(t.typeId);
    for (const a of mat.arrival) out.add(a.typeId);
    for (const id of mat.modifiers) {
        for (const effect of modifierRecipe(id)?.effects || []) {
            if (effect?.kind === 'replace' && effect.to) out.add(effect.to);
            else if (effect?.typeId) out.add(effect.typeId);
        }
    }
    return [...out];
}

const ruleOf = (rule) => ({ needs: [], tool: null, gives: [], floor: 0, gates: [], cycleMs: null, inputs: [], passive: false, oneOff: false, ...rule });

/**
 * Reach over the content with the world's inner cells as its places: the retired map rules out, and
 * each inner cell settled at its ring placing what its mat holds. A one-off find only cells place is
 * kept on the side, as the engine does for one only maps placed.
 */
function worldReach(ctx, world, mats) {
    const lw = ctx.base.world;
    const rules = ctx.keptRules.map(r => ({ ...r, oneOff: false }));
    const names = new Map(lw.names);
    for (const cell of world.cells) {
        if (cell.ring < 1 || cell.ring > STRICT_RINGS) continue;
        const key = cellKey(cell.id);
        names.set(key, ctx.cellName(cell));
        const gates = (cell.requires?.skills || []).map(s => ({ skill: s.skill, level: s.level }));
        rules.push(ruleOf({ id: `settle:${cell.id}`, how: HOW.SETTLE, via: null, floor: cell.ring, gates, gives: [{ key, chance: 1 }] }));
        const placed = placedTokens(mats.get(cell.id), ctx.modifierRecipe);
        if (placed.length) {
            rules.push(ruleOf({ id: `world:${cell.id}`, how: HOW.WORLD, via: key, needs: [key], floor: cell.ring, gives: placed.map(t => ({ key: tokenKey(t), chance: 1 })) }));
        }
    }
    const placers = new Map();
    for (const rule of rules) {
        for (const give of rule.gives) {
            if (!placers.has(give.key)) placers.set(give.key, []);
            placers.get(give.key).push(rule.how);
        }
    }
    for (const rule of rules) {
        if ((rule.how !== HOW.WORK && rule.how !== HOW.CATCH) || !rule.via?.startsWith('token:')) continue;
        const by = placers.get(rule.via) || [];
        rule.oneOff = isOneOff(lw.tokens[rule.via.slice(6)]) && by.length > 0 && by.every(how => how === HOW.WORLD);
    }
    const world2 = { ...lw, rules, names };
    return { reach: computeReach(world2), index: ruleIndex(world2), names };
}

/** Each generated cell's mat, as settling writes it. */
function matsOf(ctx, world) {
    const hallCell = world.cells.find(c => c.ring === 0);
    const hallOrigins = (hallCell?.origins || []).map(o => o.id);
    const out = new Map();
    for (const cell of world.cells) {
        if (cell.ring >= 1) out.set(cell.id, cellMat(cell, ctx.tables, { skillOf: ctx.skillOf, hallOrigins, modifierRecipe: ctx.modifierRecipe }));
    }
    return out;
}

/** A finding of checks F in the World plan's shape. */
function finding(check, message, { cellId = null, key = null, subject, name, related = [], before } = {}) {
    const out = { check, severity: SEVERITY.WARN, cellId, key, subject, name: name ?? subject, message, related };
    if (before !== undefined) out.before = before;
    return out;
}

/** Every finding of checks F (and the world's other rules) on one world. */
function checksOn(ctx, world, mats, { reach, index, names }) {
    const out = [];
    const byId = new Map(world.cells.map(c => [c.id, c]));
    const nameOf = (key) => names.get(key) ?? ctx.nameOf(key);

    // The world's own rules, read from the outside.
    for (const f of worldFindings(world, ctx.tables, { materialsOf: ctx.materialsOf, hallOrigins: ctx.hallOrigins })) {
        const check = AS_F[f.check] || WORLD_F.RULE;
        const cell = f.cellId ? byId.get(f.cellId) : null;
        let subject;
        if (f.itemId) subject = itemKey(f.itemId);
        else if (f.origin) subject = tokenKey(f.origin);
        else if (check === WORLD_F.VALUE) subject = WORLD_PLAN_TEXT.ring(cell?.ring);
        else if (f.check === WORLD_CHECK.NO_MAIN && cell) subject = WORLD_PLAN_TEXT.noMain(ctx.lineName(cell.wedge), cell.ring);
        else subject = `${f.check}${Number.isInteger(f.ring ?? cell?.ring) ? `: ${WORLD_PLAN_TEXT.ring(f.ring ?? cell.ring)}` : ''}`;
        const key = /^(item|token):/.test(subject) ? subject : null;
        out.push(finding(check, f.message, { cellId: f.cellId ?? null, key, subject, name: key ? nameOf(key) : subject }));
    }

    // A price slot naming an item: first had at an earlier ring than the cell's.
    for (const cell of world.cells) {
        if (cell.ring < 1) continue;
        for (const slot of priceTemplateOf(ctx.tables, cell.ring).items) {
            if (!slot.item) continue;
            const key = itemKey(slot.item);
            const tier = reach.get(key)?.tier;
            if (Number.isInteger(tier) && tier < cell.ring) continue;
            const message = Number.isInteger(tier)
                ? WORLD_PLAN_TEXT.priceRing(cell.id, nameOf(key), cell.ring, tier)
                : WORLD_PLAN_TEXT.priceNever(cell.id, nameOf(key));
            out.push(finding(WORLD_F.PRICE_RING, message, { cellId: cell.id, key, subject: key, name: nameOf(key) }));
        }
    }

    // The inner rings cover every Live entry (map items and modifiers are retired, Parked ones kept on purpose).
    for (const [key, def] of ctx.records) {
        const status = statusOf(def);
        if (status === PLAN_STATUS.PLANNED || status === PLAN_STATUS.PARKED) continue;
        if (key.startsWith('item:') && isMapItem(def)) continue;
        if (Number.isInteger(reach.get(key)?.tier)) continue;
        // Was it reachable before the world, through the map items? Then the world lost it; else it was never finished.
        const was = ctx.base.reach.get(key)?.tier;
        const before = Number.isInteger(was) ? was : null;
        out.push(finding(WORLD_F.COVERAGE, WORLD_PLAN_TEXT.notCovered(whyNever(key, reach, index, nameOf)), { key, subject: key, name: nameOf(key), before }));
    }

    for (const f of ctx.origins) out.push(finding(f.check, f.message, { key: f.key, subject: f.key, name: nameOf(f.key), related: f.related }));
    // Coverage: what the world lost ahead of what was never finished.
    return out.sort((a, b) => (a.before === null ? 1 : 0) - (b.before === null ? 1 : 0));
}

/** What a seed's world offers per skill and ring, and what each cell costs. */
function statsOf(ctx, world, mats) {
    const skills = skillsOf(ctx.tables);
    const bands = [];
    for (let ring = 1; ring <= Math.min(STRICT_RINGS, world.rings); ring++) {
        const cells = world.cells.filter(c => c.ring === ring);
        for (const skill of skills) {
            let offering = 0;
            let heroes = 0;
            for (const cell of cells) {
                const mat = mats.get(cell.id);
                if (skill === COMBAT) {
                    const boss = kitById(ctx.tables, cell.kit)?.bossCamps || [];
                    if (mat.camps.some(c => boss.includes(c.typeId))) offering++;
                    heroes += mat.camps.reduce((n, c) => n + c.count, 0) / heroTokensOf(ctx.tables, COMBAT);
                } else {
                    if (cell.origins.some(o => o.role !== 'hall' && ctx.skillOf(o.id) === skill)) offering++;
                    for (const n of mat.nodes) if (n.skill === skill) heroes += n.count / heroTokensOf(ctx.tables, skill);
                }
            }
            bands.push({ ring, skill, cells: offering, heroes });
        }
    }
    const prices = [];
    for (const cell of world.cells) {
        if (cell.ring < 1) continue;
        const items = cell.requires?.items || [];
        prices.push({
            cellId: cell.id,
            ring: cell.ring,
            items: items.reduce((n, i) => n + i.qty, 0),
            effortMs: items.reduce((n, i) => n + i.qty * ctx.effortOf(i.itemId), 0),
            level: Math.max(0, ...(cell.requires?.skills || []).map(s => s.level))
        });
    }
    return { bands, prices };
}

/** The skills the bands are kept for: each line's, then each specialty, once. */
function skillsOf(tables) {
    const out = [];
    for (const s of [...tables.lines.map(l => l.skill), ...tables.specialties]) if (s && !out.includes(s)) out.push(s);
    return out;
}

/** One seed's world read through a context ({@link worldContext}). */
export function planWith(ctx, seed) {
    const world = generateWorld({ seed, tables: ctx.tables, materialsOf: ctx.materialsOf, hallOrigins: ctx.hallOrigins });
    const mats = matsOf(ctx, world);
    const read = worldReach(ctx, world, mats);
    const findings = checksOn(ctx, world, mats, read);
    const byCell = new Map();
    for (const f of findings) {
        if (!f.cellId) continue;
        if (!byCell.has(f.cellId)) byCell.set(f.cellId, []);
        byCell.get(f.cellId).push(f);
    }
    return {
        seed: world.seed, world, tables: ctx.tables, moved: ctx.moved, unknown: ctx.unknown, mats,
        reach: read.reach, findings, byCell, problems: world.problems, stats: statsOf(ctx, world, mats), context: ctx
    };
}

/**
 * One seed's world as the ledger reads it.
 *
 * @param {object} content as {@link worldContext} takes it
 * @param {{ seed: number, baseTables: object, ledger?: object }} options
 * @returns {{ seed, world, tables, moved, unknown, mats: Map, reach: Map, findings: object[], byCell: Map,
 *   problems: object[], stats: { bands, prices }, context }} each finding
 *   `{ check, severity, cellId, key, subject, name, message, related }`: `subject` what fails, the same
 *   across worlds (an entry key, a line and ring), for {@link sweepWorlds} to group by
 */
export function worldPlan(content, { seed, baseTables, ledger = null } = {}) {
    return planWith(worldContext(content, { baseTables, ledger }), seed);
}

/**
 * The checks over a world as it stands now: for a plan whose world was changed after it was made
 * (the tests break one rule at a time this way). Mats and reach are worked out again.
 */
export function worldChecks(plan) {
    const mats = matsOf(plan.context, plan.world);
    return checksOn(plan.context, plan.world, mats, worldReach(plan.context, plan.world, mats));
}

/** `{ min, median, max }` of numbers (the lower middle for an even count); zeros with none. */
export function spread(values) {
    if (!values.length) return { min: 0, median: 0, max: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    return { min: sorted[0], median: sorted[Math.floor((sorted.length - 1) / 2)], max: sorted[sorted.length - 1] };
}

/**
 * Many worlds at once: how many pass checks F (`passed`) and every rule of the world too
 * (`passedAll`); each rule's failures grouped by subject with how many worlds each fails in; per
 * skill and strict ring, the band over the worlds of how many cells offer its new work and how many
 * heroes its natural work keeps busy (`zero`: worlds with no cell offering it); per ring, the spread
 * of a cell's price in items and in hero time and the skill levels asked; and what the generation
 * could not meet, grouped.
 *
 * @param {object} content as {@link worldContext} takes it
 * @param {{ seeds: number[], baseTables: object, ledger?: object, context?: object }} options
 */
export function sweepWorlds(content, { seeds, baseTables, ledger = null, context = null } = {}) {
    const ctx = context ?? worldContext(content, { baseTables, ledger });
    const rules = Object.fromEntries([...F_CHECKS, WORLD_F.RULE].map(check => [check, { worlds: 0, subjects: new Map() }]));
    const bandValues = new Map();
    const priceValues = new Map();
    const generation = new Map();
    let passed = 0;
    let passedAll = 0;
    for (const seed of seeds) {
        const p = planWith(ctx, seed);
        const failed = new Set(p.findings.map(f => f.check));
        if (!F_CHECKS.some(c => failed.has(c))) passed++;
        if (!p.findings.length) passedAll++;
        for (const check of failed) rules[check].worlds++;
        const seen = new Set();
        for (const f of p.findings) {
            const group = rules[f.check].subjects;
            if (!group.has(f.subject)) {
                group.set(f.subject, { subject: f.subject, name: f.name, key: f.key, worlds: 0, findings: 0, example: { seed: p.seed, cellId: f.cellId, message: f.message } });
                if (f.before !== undefined) group.get(f.subject).before = f.before;
            }
            const row = group.get(f.subject);
            row.findings++;
            const once = `${f.check}|${f.subject}`;
            if (!seen.has(once)) { seen.add(once); row.worlds++; }
        }
        for (const b of p.stats.bands) {
            const k = `${b.ring}|${b.skill}`;
            if (!bandValues.has(k)) bandValues.set(k, { ring: b.ring, skill: b.skill, cells: [], heroes: [] });
            bandValues.get(k).cells.push(b.cells);
            bandValues.get(k).heroes.push(b.heroes);
        }
        for (const c of p.stats.prices) {
            if (!priceValues.has(c.ring)) priceValues.set(c.ring, { items: [], effortMs: [], levels: new Map() });
            const at = priceValues.get(c.ring);
            at.items.push(c.items);
            at.effortMs.push(c.effortMs);
            at.levels.set(c.level, (at.levels.get(c.level) || 0) + 1);
        }
        const kinds = new Set();
        for (const problem of p.problems) {
            const k = [problem.kind, problem.line, problem.ring, problem.origin].filter(v => v !== undefined).join('|');
            if (!generation.has(k)) generation.set(k, { kind: problem.kind, message: problem.message, worlds: 0 });
            if (!kinds.has(k)) { kinds.add(k); generation.get(k).worlds++; }
        }
    }
    // What the world lost (reachable before it) ahead of what was never finished, then the most worlds first.
    const unfinished = (s) => (s.before === null ? 1 : 0);
    const byWorlds = (a, b) => unfinished(a) - unfinished(b) || b.worlds - a.worlds || b.findings - a.findings || String(a.name).localeCompare(String(b.name));
    return {
        seeds: seeds.length,
        passed,
        passedAll,
        moved: ctx.moved,
        rules: Object.fromEntries(Object.entries(rules).map(([check, r]) => [check, { worlds: r.worlds, subjects: [...r.subjects.values()].sort(byWorlds) }])),
        bands: [...bandValues.values()].map(b => ({
            ring: b.ring, skill: b.skill, cells: spread(b.cells), heroes: spread(b.heroes), zero: b.cells.filter(n => n === 0).length
        })),
        prices: [...priceValues].sort(([a], [b]) => a - b).map(([ring, v]) => ({
            ring, items: spread(v.items), effortMs: spread(v.effortMs),
            skills: [...v.levels].sort(([a], [b]) => a - b).map(([level, cells]) => ({ level, cells }))
        })),
        generation: [...generation.values()].sort((a, b) => b.worlds - a.worlds || a.message.localeCompare(b.message))
    };
}

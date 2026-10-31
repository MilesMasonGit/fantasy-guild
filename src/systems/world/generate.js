// the world's generation: a seeded hex world of origins around the Guild Hall (pure)

import { mulberry32, seedFromText } from '../atlas/seededRandom.js';
import { cellId, cellsWithin, neighbours, sideOf } from './hex.js';
import { STRICT_RINGS, PRICE_FROM, SKILL_OF, lineById } from '../../config/worldTablesShape.js';

/**
 * One run's world, from its seed and the world tables (`worldTablesShape.js`), all at once at a new
 * game: nothing about it changes while the run is played, and nothing here runs per tick.
 *
 * 1. **Wedges.** The six lines take the six hex sides in an order shuffled from the seed, each
 *    order weighted by how many natural neighbours it puts side by side (`neighbourStrength` to
 *    the power of their weight), then turned to a random side.
 * 2. **Main origins.** In the strict rings each wedge's ring-n table is dealt across its n cells:
 *    every origin once before any twice, so the inner rings hold every origin the tables list.
 *    Each cell gets at least `mainPerCell`. A wild cell draws from all of its line's strict tables.
 * 3. **Blends.** A cell takes `blendsPerNeighbour` origins from each other wedge it touches, from
 *    that line's table of the cell's own ring.
 * 4. **Key origins.** Each key origin of ring n is put on enough ring-n cells that every cell of
 *    ring n − 1 (the Hall's cell for ring 1) touches one: whichever way the guild went, the next
 *    ring's keys are a step away.
 * 5. **Specialties.** Each strict ring draws from its own bag (every specialty ⌊cells / kinds⌋
 *    times, the rest one each), walking the rings outward; once `pityWindow` cells are drawn, a
 *    specialty the ring's bag still holds that none of the last `pityWindow` cells had comes next,
 *    the longest missing first. With more specialties than the window that is always so, and the
 *    specialties go round in turn. Wild cells draw freely.
 * 6. **Kits** by the line's lean.
 * 7. **Extras** (the hidden modifiers and treasures): a strict cell's are worth its ring's value
 *    within `valueTolerance`; a wild cell's aim at the last strict ring's value grown per ring.
 * 8. **Requirements.** A cell's price is gathered from one cell one ring in (the Hall's for ring 1)
 *    and, where its ring's template says, the Hall's cell: two places at most, all of earlier rings.
 *    Its skill levels follow the template. Wild rings grow the last strict ring's template.
 * 9. **Wild extremes.** Each wild cell is either one origin almost everywhere (`composition`) or
 *    an odd layout.
 *
 * Every step draws from its own stream, seeded from the run seed, the step and the ring, never from
 * `Math.random`, so a world is the same on every machine and a ring added outward later would not
 * move anything inside it. What cannot be met is listed in `problems`, never papered over.
 *
 * Pure: reads only what it is handed. The game passes the registry's Tokens; the ledger its own.
 */

export const WORLD_VERSION = 1;

/** How an origin came to be in a cell. */
export const ORIGIN_ROLE = Object.freeze({ HALL: 'hall', MAIN: 'main', BLEND: 'blend', KEY: 'key' });

/** A wild cell's oddness. */
export const EXTREME = Object.freeze({ COMPOSITION: 'composition', LAYOUT: 'layout' });

/** What the generation could not meet. */
export const PROBLEM = Object.freeze({
    EMPTY_TABLE: 'empty-table',
    KEY_UNPLACED: 'key-unplaced',
    NO_SPECIALTIES: 'no-specialties',
    VALUE: 'value',
    NO_PRICE_MATERIAL: 'no-price-material'
});

/** Author-facing words, kept together for translation. */
export const WORLD_GEN_TEXT = Object.freeze({
    emptyTable: (line, ring) => `The ${line} line has no origins for ring ${ring}: its cells there have no main origin`,
    keyUnplaced: (key, ring) => `The key origin ${key} could not be put within reach of every ring ${ring - 1} cell`,
    noSpecialties: 'The tables list no specialties: no cell has one',
    value: (cell, value, target) => `Cell ${cell}'s extras are worth ${value}, not within the tolerance of its ring's ${target}`,
    noPriceMaterial: (cell) => `Cell ${cell}'s price found no material to ask for in the places it is gathered from`
});

const HALL_ID = cellId(0, 0);
const MAX_LEVEL = 99;
const VALUE_ATTEMPTS = 32;

/** A random stream for one step of one ring, from the run seed. */
function streamOf(seed, step, ring = '') {
    return mulberry32(seedFromText(`${seed}|${step}|${ring}`));
}

function pickIndex(random, n) {
    return Math.floor(random() * n);
}

/** One entry by weight (`weightOf`), or null from an empty list. */
function pickWeighted(random, list, weightOf) {
    let total = 0;
    for (const e of list) total += weightOf(e);
    if (!(total > 0)) return list.length ? list[pickIndex(random, list.length)] : null;
    let x = random() * total;
    for (const e of list) {
        x -= weightOf(e);
        if (x < 0) return e;
    }
    return list[list.length - 1];
}

function shuffled(random, list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = pickIndex(random, i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** `base` to a whole power, by multiplying: `Math.pow` may round differently between engines. */
function power(base, exponent) {
    let out = 1;
    for (let i = 0; i < exponent; i++) out *= base;
    return out;
}

function permutations(list) {
    if (list.length <= 1) return [list];
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const rest = [...list.slice(0, i), ...list.slice(i + 1)];
        for (const tail of permutations(rest)) out.push([list[i], ...tail]);
    }
    return out;
}

/** The six lines around the sides: `order[side]` is a line id. */
export function arrangeWedges(tables, random) {
    const pair = new Map();
    const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    for (const n of tables.neighbours) pair.set(key(n.a, n.b), (pair.get(key(n.a, n.b)) || 0) + n.weight);
    const scoreOf = (cycle) => {
        let score = 0;
        for (let i = 0; i < cycle.length; i++) score += pair.get(key(cycle[i], cycle[(i + 1) % cycle.length])) || 0;
        return score;
    };
    const [first, ...rest] = tables.lines.map(l => l.id);
    const orders = permutations(rest).map(tail => [first, ...tail]);
    const chosen = pickWeighted(random, orders, (cycle) => power(tables.neighbourStrength, scoreOf(cycle)));
    const turn = pickIndex(random, chosen.length);
    return chosen.map((_, side) => chosen[(side + turn) % chosen.length]);
}

/** How many of each wedge pair's natural-neighbour weight an order puts side by side. */
export function neighbourScore(tables, order) {
    let score = 0;
    for (let side = 0; side < order.length; side++) {
        const a = order[side];
        const b = order[(side + 1) % order.length];
        for (const n of tables.neighbours) {
            if ((n.a === a && n.b === b) || (n.a === b && n.b === a)) score += n.weight;
        }
    }
    return score;
}

/** A line's origins for a cell of `ring`: its own table in the strict rings, all of them pooled beyond. */
function originPool(line, ring) {
    if (ring <= STRICT_RINGS) return line.origins[ring] || [];
    const pooled = new Map();
    for (let n = 1; n <= STRICT_RINGS; n++) {
        for (const o of line.origins[n] || []) if (!pooled.has(o.id)) pooled.set(o.id, o);
    }
    return [...pooled.values()];
}

const hasOrigin = (cell, id) => cell.origins.some(o => o.id === id);

/** The cells around `cell` that exist in this world. */
function around(cell, byId) {
    return neighbours(cell).map(n => byId.get(cellId(n.q, n.r))).filter(Boolean);
}

/** Every material the origins of `cells` yield, each once, in origin order. */
function materialsAt(cells, materialsOf) {
    const out = [];
    for (const cell of cells) {
        for (const o of cell.origins) {
            for (const m of materialsOf(o.id) || []) if (!out.includes(m)) out.push(m);
        }
    }
    return out;
}

/** The value a wild ring's extras aim at: the last strict ring's, grown per ring beyond. */
function valueTarget(tables, ring) {
    if (ring <= STRICT_RINGS) return tables.ringValue[ring] || 0;
    return (tables.ringValue[STRICT_RINGS] || 0) * power(tables.wild.valueGrowth, ring - STRICT_RINGS);
}

/** A ring's price template: its own in the strict rings, the last strict ring's grown beyond. */
export function priceTemplateOf(tables, ring) {
    if (ring <= STRICT_RINGS) return tables.prices[ring];
    const base = tables.prices[STRICT_RINGS];
    const beyond = ring - STRICT_RINGS;
    const growth = power(tables.wild.priceGrowth, beyond);
    return {
        items: base.items.map(s => ({ ...s, qty: Math.round(s.qty * growth) })),
        skills: base.skills.map(s => ({ ...s, level: Math.min(MAX_LEVEL, s.level + tables.wild.levelStep * beyond) }))
    };
}

/**
 * Generate one run's world.
 *
 * @param {object} options
 * @param {number} options.seed the run seed
 * @param {object} options.tables normalised world tables (`normaliseWorldTables`)
 * @param {(originId: string) => string[]} [options.materialsOf] the items an origin yields, for prices
 * @param {string[]} [options.hallOrigins] the origins of the Hall's cell (the Starter Camp's)
 * @returns {{version: number, seed: number, strictRings: number, rings: number, wedges: string[],
 *   cells: object[], problems: object[]}}
 */
export function generateWorld({ seed, tables, materialsOf = () => [], hallOrigins = [] }) {
    if (!tables || !Array.isArray(tables.lines)) throw new TypeError('generateWorld() needs normalised world tables');
    const runSeed = (Number(seed) >>> 0);
    const rings = STRICT_RINGS + tables.wild.rings;
    const problems = [];
    const lineOfOrigin = new Map();
    for (const line of tables.lines) {
        for (let n = 1; n <= STRICT_RINGS; n++) {
            for (const o of line.origins[n] || []) if (!lineOfOrigin.has(o.id)) lineOfOrigin.set(o.id, line.id);
        }
    }

    const wedges = arrangeWedges(tables, streamOf(runSeed, 'wedges'));
    const cells = cellsWithin(rings).map(c => {
        const id = cellId(c.q, c.r);
        return {
            id, q: c.q, r: c.r, ring: c.ring,
            tier: Math.min(c.ring, STRICT_RINGS),
            wedge: c.ring === 0 ? null : wedges[c.side],
            wild: c.ring > STRICT_RINGS,
            seed: seedFromText(`${runSeed}|cell|${id}`),
            origins: [],
            kit: null,
            specialty: null,
            extras: [],
            value: 0,
            requires: null,
            payFrom: [],
            extreme: null
        };
    });
    const byId = new Map(cells.map(c => [c.id, c]));
    const ringOf = (n) => cells.filter(c => c.ring === n);
    const hall = byId.get(HALL_ID);
    for (const id of hallOrigins) {
        if (!hasOrigin(hall, id)) hall.origins.push({ id, line: lineOfOrigin.get(id) || null, role: ORIGIN_ROLE.HALL });
    }

    // 2. Main origins.
    for (let n = 1; n <= rings; n++) {
        const random = streamOf(runSeed, 'main', n);
        for (const line of tables.lines) {
            const wedgeCells = ringOf(n).filter(c => c.wedge === line.id);
            const pool = originPool(line, n);
            if (!pool.length) {
                if (n <= STRICT_RINGS) problems.push({ kind: PROBLEM.EMPTY_TABLE, line: line.id, ring: n, message: WORLD_GEN_TEXT.emptyTable(line.name, n) });
                continue;
            }
            const dealt = n <= STRICT_RINGS ? shuffled(random, pool) : [];
            const slots = Math.max(wedgeCells.length * tables.mainPerCell, dealt.length);
            for (let i = 0; i < slots; i++) {
                const cell = wedgeCells[i % wedgeCells.length];
                const origin = i < dealt.length
                    ? dealt[i]
                    : pickWeighted(random, pool.filter(o => !hasOrigin(cell, o.id)), o => o.weight);
                if (origin && !hasOrigin(cell, origin.id)) cell.origins.push({ id: origin.id, line: line.id, role: ORIGIN_ROLE.MAIN });
            }
        }
    }

    // 3. Blends from each other wedge a cell touches.
    if (tables.blendsPerNeighbour > 0) {
        for (let n = 1; n <= rings; n++) {
            const random = streamOf(runSeed, 'blend', n);
            for (const cell of ringOf(n)) {
                // Read from the grid, not the cells generated, so a ring added outward later would
                // leave this one's blends as they are.
                const touched = [];
                for (const spot of neighbours(cell)) {
                    const side = sideOf(spot);
                    const wedge = side === null ? null : wedges[side];
                    if (wedge && wedge !== cell.wedge && !touched.includes(wedge)) touched.push(wedge);
                }
                touched.sort((a, b) => wedges.indexOf(a) - wedges.indexOf(b));
                for (const lineId of touched) {
                    const line = lineById(tables, lineId);
                    for (let b = 0; b < tables.blendsPerNeighbour; b++) {
                        const pick = pickWeighted(random, originPool(line, n).filter(o => !hasOrigin(cell, o.id)), o => o.weight);
                        if (pick) cell.origins.push({ id: pick.id, line: line.id, role: ORIGIN_ROLE.BLEND });
                    }
                }
            }
        }
    }

    // 4. Key origins within a step of every cell one ring in.
    for (let n = 1; n <= STRICT_RINGS; n++) {
        const random = streamOf(runSeed, 'keys', n);
        const inner = ringOf(n - 1);
        const outer = ringOf(n);
        for (const key of tables.keys[n] || []) {
            const outward = (cell) => around(cell, byId).filter(c => c.ring === n);
            const uncovered = () => inner.filter(c => !outward(c).some(o => hasOrigin(o, key)));
            let open = uncovered();
            while (open.length) {
                let best = [];
                let bestGain = 0;
                for (const cell of outer) {
                    if (hasOrigin(cell, key)) continue;
                    const gain = open.filter(c => outward(c).includes(cell)).length;
                    if (gain > bestGain) { best = [cell]; bestGain = gain; } else if (gain === bestGain && gain > 0) best.push(cell);
                }
                if (!best.length) {
                    problems.push({ kind: PROBLEM.KEY_UNPLACED, origin: key, ring: n, message: WORLD_GEN_TEXT.keyUnplaced(key, n) });
                    break;
                }
                const fewest = Math.min(...best.map(c => c.origins.length));
                const pool = best.filter(c => c.origins.length === fewest);
                const cell = pool[pickIndex(random, pool.length)];
                cell.origins.push({ id: key, line: lineOfOrigin.get(key) || null, role: ORIGIN_ROLE.KEY });
                open = uncovered();
            }
        }
    }

    // 5. Specialties: a bag per strict ring with the pity rule; wild cells draw freely.
    const skills = tables.specialties;
    if (!skills.length) {
        problems.push({ kind: PROBLEM.NO_SPECIALTIES, message: WORLD_GEN_TEXT.noSpecialties });
    } else {
        // ⚠️ The pity rule's history runs on from one strict ring into the next ("the last 4
        // options"): kept per ring, a ring's first draws are free and could bunch one specialty.
        const lastSeen = new Map();
        let drawn = 0;
        const window = tables.pityWindow;
        for (let n = 1; n <= rings; n++) {
            const random = streamOf(runSeed, 'specialty', n);
            const ring = ringOf(n);
            if (n > STRICT_RINGS) {
                for (const cell of ring) cell.specialty = skills[pickIndex(random, skills.length)];
                continue;
            }
            const bag = new Map(skills.map(s => [s, Math.floor(ring.length / skills.length)]));
            for (const s of shuffled(random, skills).slice(0, ring.length % skills.length)) bag.set(s, bag.get(s) + 1);
            for (const cell of ring) {
                const left = skills.filter(s => bag.get(s) > 0);
                const due = drawn >= window ? left.filter(s => !((lastSeen.get(s) ?? -Infinity) >= drawn - window)) : [];
                let pick;
                if (due.length) {
                    const oldest = Math.min(...due.map(s => lastSeen.get(s) ?? -1));
                    const longest = due.filter(s => (lastSeen.get(s) ?? -1) === oldest);
                    pick = longest[pickIndex(random, longest.length)];
                } else {
                    pick = pickWeighted(random, left, s => bag.get(s));
                }
                cell.specialty = pick;
                bag.set(pick, bag.get(pick) - 1);
                lastSeen.set(pick, drawn);
                drawn++;
            }
        }
    }

    // 6. Kits by the line's lean.
    const kitIds = tables.kits.map(k => k.id);
    for (let n = 1; n <= rings; n++) {
        const random = streamOf(runSeed, 'kit', n);
        for (const cell of ringOf(n)) {
            const lean = Object.entries(lineById(tables, cell.wedge)?.kits || {});
            const pick = lean.length ? pickWeighted(random, lean, ([, weight]) => weight)?.[0] : kitIds[pickIndex(random, kitIds.length)];
            cell.kit = pick ?? null;
        }
    }

    // 7. Extras within the ring's value.
    for (let n = 1; n <= rings; n++) {
        const random = streamOf(runSeed, 'extras', n);
        const tier = Math.min(n, STRICT_RINGS);
        const target = valueTarget(tables, n);
        const low = target * (1 - tables.valueTolerance);
        const high = target * (1 + tables.valueTolerance);
        for (const cell of ringOf(n)) {
            if (!(target > 0)) continue;
            const lines = new Set([cell.wedge, ...cell.origins.map(o => o.line).filter(Boolean)]);
            const copies = [];
            for (const extra of tables.extras) {
                if (extra.rings && !extra.rings.includes(tier)) continue;
                if (extra.lines && !extra.lines.some(l => lines.has(l))) continue;
                for (let k = 0; k < extra.max; k++) copies.push(extra);
            }
            let best = null;
            for (let attempt = 0; attempt < VALUE_ATTEMPTS; attempt++) {
                const left = [...copies];
                const picked = [];
                let sum = 0;
                while (left.length) {
                    const extra = pickWeighted(random, left, e => e.weight);
                    left.splice(left.indexOf(extra), 1);
                    if (sum + extra.value <= high) {
                        picked.push(extra);
                        sum += extra.value;
                    }
                    if (sum >= low) break;
                }
                if (!best || Math.abs(sum - target) < Math.abs(best.sum - target)) best = { picked, sum };
                if (sum >= low) break;
            }
            cell.extras = best.picked.map(e => ({ id: e.id, kind: e.kind, value: e.value }));
            cell.value = best.sum;
            if (n <= STRICT_RINGS && (best.sum < low || best.sum > high)) {
                problems.push({ kind: PROBLEM.VALUE, cellId: cell.id, message: WORLD_GEN_TEXT.value(cell.id, best.sum, target) });
            }
        }
    }

    // 8. Requirements, gathered from one cell one ring in and, where the template says, the Hall's.
    const hallMaterials = materialsAt([hall], materialsOf);
    for (let n = 1; n <= rings; n++) {
        const random = streamOf(runSeed, 'requires', n);
        const template = priceTemplateOf(tables, n);
        for (const cell of ringOf(n)) {
            const inward = around(cell, byId).filter(c => c.ring === n - 1);
            const stocked = inward.filter(c => materialsAt([c], materialsOf).length);
            const choices = stocked.length ? stocked : inward;
            const source = choices[pickIndex(random, choices.length)];
            const placeMaterials = { [PRICE_FROM.SOURCE]: materialsAt([source], materialsOf), [PRICE_FROM.HALL]: hallMaterials };
            const placeId = { [PRICE_FROM.SOURCE]: source.id, [PRICE_FROM.HALL]: HALL_ID };
            const items = [];
            const used = new Set();
            const places = new Set();
            const ask = (itemId, qty) => {
                const row = items.find(i => i.itemId === itemId);
                if (row) row.qty += qty; else items.push({ itemId, qty });
                used.add(itemId);
            };
            for (const slot of template.items) {
                if (slot.item) { ask(slot.item, slot.qty); continue; }
                const other = slot.from === PRICE_FROM.HALL ? PRICE_FROM.SOURCE : PRICE_FROM.HALL;
                let from = slot.from;
                let fresh = placeMaterials[from].filter(m => !used.has(m));
                if (!fresh.length) {
                    const elsewhere = placeMaterials[other].filter(m => !used.has(m));
                    if (elsewhere.length) { from = other; fresh = elsewhere; }
                }
                const pool = fresh.length ? fresh : placeMaterials[from].filter(m => used.has(m));
                if (!pool.length) continue;
                ask(pool[pickIndex(random, pool.length)], slot.qty);
                places.add(placeId[from]);
            }
            if (template.items.some(s => !s.item) && !places.size) {
                problems.push({ kind: PROBLEM.NO_PRICE_MATERIAL, cellId: cell.id, message: WORLD_GEN_TEXT.noPriceMaterial(cell.id) });
            }
            const skillsAsked = [];
            for (const slot of template.skills) {
                const skill = slot.skill === SKILL_OF.LINE ? lineById(tables, cell.wedge)?.skill
                    : slot.skill === SKILL_OF.SPECIALTY ? cell.specialty
                        : slot.skill;
                if (!skill) continue;
                const row = skillsAsked.find(s => s.skill === skill);
                if (row) row.level = Math.max(row.level, slot.level); else skillsAsked.push({ skill, level: slot.level });
            }
            cell.requires = { items, skills: skillsAsked };
            cell.payFrom = [...new Set([placeId[PRICE_FROM.SOURCE], placeId[PRICE_FROM.HALL]])].filter(id => places.has(id));
        }
    }

    // 9. Wild extremes.
    for (let n = STRICT_RINGS + 1; n <= rings; n++) {
        const random = streamOf(runSeed, 'wild', n);
        for (const cell of ringOf(n)) {
            const mains = cell.origins.filter(o => o.role === ORIGIN_ROLE.MAIN);
            const layouts = tables.wild.layouts;
            const composition = mains.length && (!layouts.length || random() < tables.wild.extremeShare);
            if (composition) cell.extreme = { kind: EXTREME.COMPOSITION, focus: mains[pickIndex(random, mains.length)].id };
            else if (layouts.length) cell.extreme = { kind: EXTREME.LAYOUT, layout: pickWeighted(random, layouts, l => l.weight).id };
        }
    }

    return { version: WORLD_VERSION, seed: runSeed, strictRings: STRICT_RINGS, rings, wedges, cells, problems };
}

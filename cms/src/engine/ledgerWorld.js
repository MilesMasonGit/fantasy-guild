import { normaliseWorldTables } from '../../../src/config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../../../src/config/worldPlaceholder.js';
import {
    worldContext, planWith, sweepWorlds, placementOf, plannedTables, F_CHECKS, WORLD_F,
} from '../../../src/systems/progression/ledger/world.js';
import { planPlaceOf } from '../../../src/systems/progression/ledger/plan.js';
import { CHECKS } from '../../../src/systems/progression/ledger/checks.js';
import { formatMinutes } from '../../../src/systems/progression/ledger/settings.js';

/**
 * The World plan over the CMS workspace (`src/systems/progression/ledger/world.js` does the work).
 *
 * ⚠️ The CMS holds no world tables yet (brief 330 W6 brings them), so the World plan generates from
 * the game's placeholder tables (`src/config/worldPlaceholder.js`), exactly as a new game does
 * while `data/world.json` is absent, with the origins' planned wedges and rings laid on.
 */

/** Where the base tables come from, in words for the page. */
export const WORLD_TABLES_SOURCE = 'the placeholder world tables (the CMS holds none yet; the game generates from the same)';

const PLACEHOLDER = normaliseWorldTables(PLACEHOLDER_WORLD_TABLES);

/** The world tables the game generates from today. */
export function baseWorldTables() {
    return PLACEHOLDER;
}

/** The workspace as the World plan reads it. */
const worldContent = (state) => ({
    items: state.items || {},
    tokens: state.tokens || {},
    recipePools: state.recipePools || {},
    effects: state.effects || {},
    starterCamp: state.starterCamp ?? null,
});

/**
 * The World plan's reading of the workspace, once for any number of seeds. `ledger`: one already
 * built from the same state; `baseTables`: other tables to generate from (the tests' fixtures).
 */
export function workspaceWorldContext(state, ledger = null, baseTables = baseWorldTables()) {
    return worldContext(worldContent(state), { baseTables, ledger });
}

/** The seed-free check F (wild origins no wedge places) as findings for the ledger's report. */
export function workspaceOriginFindings(state, ledger = null) {
    return workspaceWorldContext(state, ledger).origins;
}

/** One seed's world over a context. */
export function worldForSeed(context, seed) {
    return planWith(context, seed);
}

/** The seeds a sweep of `count` worlds runs: 1 to `count`, so a sweep is the same each time. */
export function sweepSeeds(count) {
    const n = Math.max(1, Math.min(1000, Math.floor(Number(count)) || 100));
    return Array.from({ length: n }, (_, i) => i + 1);
}

/** Many worlds over a context. */
export function sweepWorkspace(context, count = 100) {
    return sweepWorlds(context.content, { seeds: sweepSeeds(count), context });
}

/**
 * Where each Token sits on the world map, for the Entries list: id → `{ wedge, ring, planned }`,
 * `planned` when the place is its plan's own (else the game's tables'). Tokens neither places are absent.
 */
export function originPlaces(tokens = {}) {
    const base = placementOf(baseWorldTables());
    const out = new Map();
    for (const [id, place] of base) out.set(id, { wedge: place.line, ring: place.ring, planned: false });
    const { tables } = plannedTables(baseWorldTables(), tokens);
    const planned = placementOf(tables);
    for (const [key, def] of Object.entries(tokens || {})) {
        const id = def?.id ?? key;
        const { wedge, ring } = planPlaceOf(def);
        if (wedge && ring !== null && planned.has(id)) out.set(id, { wedge, ring, planned: true });
    }
    return out;
}

/** The lines the tables offer as wedges: `[{ id, name }]`. */
export function wedgeChoices() {
    return baseWorldTables().lines.map((l) => ({ id: l.id, name: l.name }));
}

/** Hero time in words, for the price spreads: seconds under a minute. */
export const heroTime = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)} s` : formatMinutes(ms / 60000));

/**
 * A sweep in plain lines, for the change-pack tool's `world` command and the report: how many
 * worlds pass, each rule's failures by subject, the per-skill bands and the price spreads.
 */
export function sweepText(sweep, { nameOfCheck = (c) => CHECKS[c]?.label || c } = {}) {
    const out = [];
    out.push(`${sweep.passed} of ${sweep.seeds} worlds pass checks F; ${sweep.passedAll} keep every rule of the world.`);
    if (sweep.moved.length) out.push(`${sweep.moved.length} origins are placed by their plan, not where the game's tables have them.`);
    for (const check of [...F_CHECKS, WORLD_F.RULE]) {
        const rule = sweep.rules[check];
        out.push('');
        out.push(`${nameOfCheck(check)}: fails in ${rule.worlds} of ${sweep.seeds} worlds${rule.subjects.length ? `, ${rule.subjects.length} subjects` : ''}`);
        for (const s of rule.subjects) {
            const before = s.before === undefined ? '' : s.before === null ? ' [never reachable before the world map]' : ` [lost: tier ${s.before} through map items]`;
            out.push(`  ${String(s.worlds).padStart(4)} worlds  ${s.name}${s.key && s.name !== s.key ? ` (${s.key})` : ''}${before}`);
            out.push(`               e.g. world ${s.example.seed}: ${s.example.message}`);
        }
    }
    if (sweep.generation.length) {
        out.push('');
        out.push('What the generation could not meet:');
        for (const g of sweep.generation) out.push(`  ${String(g.worlds).padStart(4)} worlds  ${g.message}`);
    }
    out.push('');
    out.push('Per skill and ring (cells offering its new work; heroes its natural work keeps busy): min / median / max');
    for (const b of sweep.bands) {
        const h = (n) => n.toFixed(1);
        out.push(`  ring ${b.ring} ${b.skill.padEnd(10)} cells ${b.cells.min}/${b.cells.median}/${b.cells.max}   heroes ${h(b.heroes.min)}/${h(b.heroes.median)}/${h(b.heroes.max)}${b.zero ? `   none in ${b.zero} worlds` : ''}`);
    }
    out.push('');
    out.push('Price per cell, by ring (items; hero time at the content\'s own rates): min / median / max');
    for (const p of sweep.prices) {
        const levels = p.skills.map((s) => `level ${s.level}`).join(', ');
        out.push(`  ring ${p.ring}  items ${p.items.min}/${p.items.median}/${p.items.max}   hero time ${heroTime(p.effortMs.min)} / ${heroTime(p.effortMs.median)} / ${heroTime(p.effortMs.max)}   ${levels}`);
    }
    return out.join('\n');
}


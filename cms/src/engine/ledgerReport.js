import { buildLedger, parseKey, itemKey, tokenKey, recipeKey, HOW } from '../../../src/systems/progression/ledger/engine.js';
import { runChecks, SEVERITY } from '../../../src/systems/progression/ledger/checks.js';
import { isPlanned } from '../../../src/systems/progression/ledger/plan.js';
import { mapItemFindings, isMapItem } from '../../../src/systems/atlas/mapItems.js';
import { SKILLS, expandBearer, auditLifecycleBlocks, findUnknownRefs, toolFindings } from '../utils/constants';

/**
 * The ledger's engines over the CMS workspace (`src/systems/progression/ledger/engine.js`): every entry's
 * reach and any item's tree. Planned stubs are in the workspace, so they come back marked Planned.
 *
 * Effort runs at the records' own cycle times, which every Recalculate writes from the simulator;
 * hand it a `recalculateEconomy` result as `sim` to use that run's times for anything edited since.
 * ⚠️ A workspace that never loaded a Starter Camp (`starterCamp: null`) has nothing placed at the
 * start, so almost everything reads "never" until Backups → Restore from Game brings the camp in.
 */

/** The work whose cycle the simulator times: a Token's own work, water, a recipe. */
const TIMED = new Set([HOW.WORK, HOW.CATCH, HOW.CRAFT]);

const contentOf = (state) => ({
    items: state.items,
    tokens: state.tokens,
    recipePools: state.recipePools,
    effects: state.effects,
    starterCamp: state.starterCamp,
});

export function workspaceLedger(state = {}, { sim = null } = {}) {
    const cycleTimes = sim?.sim?.cycleTimes ?? sim?.cycleTimes ?? null;
    const cycleTimeOf = cycleTimes
        ? (rule) => (TIMED.has(rule.how) && rule.via ? cycleTimes.get(parseKey(rule.via).id) ?? null : null)
        : null;
    return buildLedger(contentOf(state), { cycleTimeOf });
}

const ENTITY_KEY = { Token: tokenKey, Item: itemKey, Recipe: recipeKey };

/**
 * The game's own content rules (the same ones the Economy Audit and the game's boot audit run: a
 * lifecycle block the game refuses, a skill or job it does not have, a tool no hero can hold, a map
 * naming a missing Token) as ledger findings on the entry they name. Planned stubs are left out:
 * they are unfinished on purpose.
 */
export function gameRuleFindings(state = {}) {
    const library = state.effects || {};
    const items = {};
    const tokens = {};
    for (const [id, def] of Object.entries(state.items || {})) if (def && !isPlanned(def)) items[id] = def;
    for (const [id, def] of Object.entries(state.tokens || {})) if (def && !isPlanned(def)) tokens[id] = expandBearer(def, library);
    const recipes = [];
    for (const [skill, pool] of Object.entries(state.recipePools || {})) {
        for (const recipe of Array.isArray(pool) ? pool : []) {
            if (recipe && !isPlanned(recipe)) recipes.push(recipe.skill ? recipe : { ...recipe, skill });
        }
    }
    const out = [];
    const push = (f, severity) => {
        const keyOf = ENTITY_KEY[f.entityType];
        if (!keyOf || !f.entityId) return;
        const text = String(f.message || '');
        out.push({ check: 'game-rule', key: keyOf(f.entityId), severity, message: text.charAt(0).toUpperCase() + text.slice(1) });
    };
    // ⚠️ The lifecycle checker's warnings are notes on allowed choices (a spawner with no upkeep), so they are Info here.
    for (const f of auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })) push(f, f.severity === 'warning' ? SEVERITY.INFO : SEVERITY.BLOCK);
    for (const f of findUnknownRefs({ tokens, items, recipes })) push(f, SEVERITY.BLOCK);
    for (const f of toolFindings({ items, tokens, recipes })) push(f, SEVERITY.WARN);
    for (const def of Object.values(items)) {
        if (!isMapItem(def)) continue;
        for (const message of mapItemFindings(def, { tokenExists: (id) => !!tokens[id], itemOf: (id) => items[id] || null })) {
            push({ entityType: 'Item', entityId: def.id, message }, SEVERITY.WARN);
        }
    }
    return out;
}

/**
 * The simulator's refusals from the last Recalculate (`useSimulationStore.simRows`) as ledger
 * findings: what it could not price. A row naming nothing the workspace has is filed under no entry
 * and dropped.
 */
export function pricingFindings(simRows = [], state = {}) {
    const out = [];
    for (const row of simRows || []) {
        if (!row || (row.severity !== 'critical' && row.severity !== 'warning')) continue;
        const id = row.itemId || row.entityId;
        const key = state.items?.[id] ? itemKey(id) : state.tokens?.[id] ? tokenKey(id) : null;
        if (!key) continue;
        out.push({ check: 'pricing', key, severity: row.severity === 'critical' ? SEVERITY.WARN : SEVERITY.INFO, message: `${row.message}${row.code ? ` [${row.code}]` : ''}` });
    }
    return out;
}

/**
 * The ledger and every check over the workspace: `{ ledger, findings }`.
 * @param {{ simRows?: object[] }} options  the last Recalculate's rows, for the pricing findings
 */
export function workspaceReport(state = {}, { simRows = [] } = {}) {
    const ledger = workspaceLedger(state);
    const extra = [...gameRuleFindings(state), ...pricingFindings(simRows, state)];
    const findings = runChecks(ledger, contentOf(state), { extra });
    return { ledger, findings };
}

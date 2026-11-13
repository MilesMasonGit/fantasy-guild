import { runSim } from './sim/simRunner';
import { buildChurnReport } from './sim/churn';
import { buildSimAnswers } from './sim/answers';
import { buildChainTrails } from './sim/chain';
import { migrateLegacyIntent, applyItemResults, applyTokenResults, applyRecipePoolResults } from './sim/writeBack';
import { auditConnectivity } from './connectivityAuditor';
import { composeTokenDescription } from './descriptionDictionary';
import { deriveTokenType, expandBearer, expandAll } from '../utils/constants';
import { splitPlanned, rejoinPlanned } from './planFile';
import { seedEffectLibrary } from './workspaceSeeds';

/**
 * Recalculate, as a function: the economic simulator's whole line (TIME → ANCHOR → PRICE → TUNE →
 * MAP + XP) run on a workspace, its results written back into the fields the game reads
 * (`sim/writeBack.js`), and every Token's type and description derived. The CMS's Recalculate
 * button (the store's `recalculateEconomy`) and the command line (`npm run cms -- recalc`, `sync`)
 * both run it, so they write the same workspace.
 *
 * ⚠️ The write-back also strips retired fields: Sync writes from the workspace, so a stale workspace heals on its first Recalculate.
 */

const SEVERITY_WORD = { critical: 'Critical', warning: 'Warning', info: 'Info' };

/** A keyed collection keyed by each record's own id. */
function byId(collection) {
    const out = {};
    for (const [key, record] of Object.entries(collection || {})) {
        if (!record) continue;
        out[record.id ?? key] = record;
    }
    return out;
}

/**
 * One simulator row, as an audit-panel row.
 * ⚠️ It keeps the row's severity rather than flattening every row to a string badged Warning, which made a Critical (an item nothing produces) read exactly like an Info note.
 */
function describeRow(row) {
    const remedies = (row.remedies || []).length > 0 ? `  → ${row.remedies.join('  → ')}` : '';
    return {
        severity: SEVERITY_WORD[row.severity] || 'Warning',
        entityName: row.entityId || row.itemId || 'Balance Solver',
        details: `[${row.code}] ${row.message}${remedies}`,
        // Carried so the auditor can recognise a problem it would otherwise
        // report a second time in its own words — see `auditConnectivity`.
        code: row.code,
        itemId: row.itemId,
    };
}

/** Every recipe the simulator sees, keyed by id: the skill pools flattened. */
function flatten(pools) {
    const recipes = {};
    for (const [skillId, pool] of Object.entries(pools || {})) {
        (pool || []).forEach((r, idx) => {
            // A recipe's synthetic `pooled_<skill>_<idx>` key is only a fallback for older workspaces that predate `id`.
            const id = r.id || `pooled_${skillId}_${idx}`;
            recipes[id] = { ...r, id, skill: r.skill || skillId };
        });
    }
    return recipes;
}

/**
 * @param {object} workspace the store's collections (`items`, `tokens`, `effects`, `recipePools`, and the rest, which pass through)
 * @param {object} [dials] the simulator's dials (`simDials`)
 * @param {{ previousChurn?: object|null, now?: () => number }} [options] the last run's churn report, for its refusal diff
 * @returns {{ workspace: object, report: object }} the workspace as Recalculate leaves it, and what the run found:
 *   `{ items, tokens, recipePools, recipes, effects, sim, auditIssues, churnReport, simAnswers, simChains, ranAt, planned }`
 *   (`items`, `tokens`, `recipePools` without the Planned stubs, as Sync writes them)
 */
export function recalculateWorkspace(workspace, dials = {}, { previousChurn = null, now = Date.now } = {}) {
    // ⚠️ Planned stubs never reach the game, so the line never sees them: no price, no audit row, no description naming one. They are set aside here and put back unchanged at the end.
    const { live, planned } = splitPlanned(workspace);
    const state = { ...workspace, ...live };

    // The legacy `isPrimarySource` flag becomes the `anchor` intent flag BEFORE the passes run, because the anchor election reads `anchor`.
    const migrated = migrateLegacyIntent(state);

    /** ⚠️ Migrate to the library FIRST, then expand; the order is not cosmetic. `finalTokens` below strips `statements` on the way to the file, which is correct once the rules are in the library and silent data loss before it. Expanding matters because several passes read a Token's rules (`writeBack`'s `deriveTokenType` decides whether a Token is a station); unexpanded, every station reprices as an ordinary resource. */
    const seeded = seedEffectLibrary({
        items: state.items,
        tokens: migrated.tokens,
        effects: state.effects,
    });
    const library = seeded.effects;
    migrated.tokens = expandAll(seeded.tokens, library);

    const sim = runSim(
        {
            items: state.items,
            tokens: migrated.tokens,
            recipes: flatten(migrated.recipePools),
        },
        dials || {}
    );

    const items = applyItemResults(state.items, sim);
    const tokens = applyTokenResults(migrated.tokens, sim);
    const recipePools = applyRecipePoolResults(migrated.recipePools, sim);
    const recipes = flatten(recipePools);

    // Every Token's type and description are DERIVED here, on the way to the file: a description is its rules, rendered, so the two cannot drift.
    // ⚠️ The description says nothing about Tempo or Purpose: those are authoring tags, not something a player is told.
    // ⚠️ Each is expanded against the library on the way through and the expansion is deliberately NOT kept: writing resolved statements into `data/tokens.json` would put a second copy of every rule beside the library. The file keeps the references.
    const finalTokens = {};
    // Every Token expanded, so a description can name the tool a requirement asks for.
    const expandedTokens = Object.fromEntries(
        Object.entries(tokens).map(([tokenId, token]) => [tokenId, expandBearer(token, library)])
    );
    for (const [tokenId, token] of Object.entries(tokens)) {
        const expanded = expandedTokens[tokenId];
        const next = { ...token, tokenType: deriveTokenType(expanded).type };
        next.description = composeTokenDescription(expanded, items, recipePools, expandedTokens);
        delete next.descriptionOverride;
        delete next.statements;
        // An empty "Stands on" means anywhere dry, which is what no list says too.
        if (Array.isArray(next.standsOn) && next.standsOn.length === 0) delete next.standsOn;
        // A "Stands near" row left blank names nothing; none left means no such rule.
        if (Array.isArray(next.standsNear)) {
            const near = next.standsNear.filter((id) => typeof id === 'string' && id);
            if (near.length) next.standsNear = near; else delete next.standsNear;
        }
        finalTokens[tokenId] = next;
    }

    // The simulator's rows reach the graph audit through its refusal channel, one line of prose per row.
    const auditIssues = auditConnectivity({
        items,
        tokens: finalTokens,
        recipes,
        // For the skill check, which must expand a Token to recognise a Promotion Token. Read-only; nothing is written.
        effects: library,
        skillPerks: state.skillPerks,
        // The Guild Hall's sky, for its stars' checks; none when the workspace never held one.
        hallSky: state.hallStars || state.hallConstellations
            ? { constellations: state.hallConstellations || {}, stars: state.hallStars || {} }
            : null,
        // The events table, for its rows' checks; none when the workspace never held one.
        events: state.events ?? null,
    }, sim.rows.map(describeRow));

    // The churn report diffs against the previous report's refusal keys, and `state.items` is the only record of every value before this run wrote over it, so both are read here.
    const ranAt = now();
    const churnReport = buildChurnReport(sim, {
        itemsBefore: state.items,
        previous: previousChurn,
        ranAt,
    });
    // Fingerprinted against the records as written, so any later edit shows the panel's stale badge.
    const simAnswers = buildSimAnswers(sim, {
        tokens: byId(finalTokens),
        // ⚠️ The pool records, not the flattened copies: flattening injects `id` and `skill`, and a fingerprint over an injected field would read as an edit the author never made.
        recipes: byId(Object.values(recipePools).flat().filter(Boolean)),
    }, ranAt);

    return {
        workspace: { ...workspace, ...rejoinPlanned(workspace, { items, tokens: finalTokens, recipePools }), effects: library },
        report: {
            items,
            tokens: finalTokens,
            recipePools,
            recipes,
            effects: library,
            sim,
            auditIssues,
            churnReport,
            simAnswers,
            simChains: Object.fromEntries(buildChainTrails(sim)),
            ranAt,
            planned,
        },
    };
}

/**
 * What Sync builds its files from (`recipeSync.js`'s `syncFiles`): the line's output without the
 * Planned stubs, the stubs set aside, and the collections the line does not touch.
 */
export function balancedForSync(workspace, report) {
    return {
        items: report.items,
        tokens: report.tokens,
        recipePools: report.recipePools,
        recipes: report.recipes,
        sim: report.sim,
        effects: report.effects,
        starterCamp: workspace.starterCamp,
        skillPerks: workspace.skillPerks ?? null,
        hallConstellations: workspace.hallConstellations ?? null,
        hallStars: workspace.hallStars ?? null,
        world: workspace.world ?? null,
        events: workspace.events ?? null,
        planned: report.planned,
        planSettings: workspace.planSettings ?? null,
    };
}

/** The audit's rows counted by severity, and the rows themselves: what the command line prints after a Recalculate. */
export function auditSummary(auditIssues = []) {
    const counts = { Critical: 0, Warning: 0, Info: 0 };
    for (const issue of auditIssues) counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    return counts;
}

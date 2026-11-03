/**
 * Economic simulator: the runner. Orchestrates the assembly line adapt → TIME → ANCHOR → PRICE → TUNE → XP → CHECK, so one Recalculate settles cycle times, item values, output quantities, tuning and XP.
 * ⚠️ XP runs last and reads only settled numbers (the cycle time TUNE may have moved).
 * ⚠️ TUNE runs after PRICE and never writes a value: it moves what a source produces and how often, and item values are read-only by then. That ordering keeps the line one-way.
 */

import { adaptCorpus } from './fieldAdapter.js';
import { normaliseDials } from './dials.js';
import { runTempoPass } from './tempoPass.js';
import { runAnchorPass } from './anchorPass.js';
import { runPricingPass } from './pricingPass.js';
import { runTuningPass } from './tuningPass.js';
import { runXpPass } from './xpPass.js';
import { runCheckPass } from './checkPass.js';
import { sortRows } from './rows.js';

/** Every id in a keyed object or an array of records. */
function idsOf(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection.map((d, i) => d?.id ?? String(i));
    return Object.keys(collection).map(k => collection[k]?.id ?? k);
}

/** The items the simulator prices, keyed, from a list or a keyed collection. */
function keyedItems(items) {
    return Array.isArray(items) ? Object.fromEntries(items.map((def, i) => [def?.id ?? String(i), def])) : { ...(items || {}) };
}

/**
 * Run the whole line over a corpus.
 * @param {object} corpus  `{ tokens, recipes, items }`, keyed objects or arrays
 * @param {object} dialOverrides  the dials; defaults in `dials.js`
 * Re-running on identical input returns identical output: every pass iterates sorted collections and nothing reads its own previous output, except a stored anchor election.
 */
export function runSim({ tokens = {}, recipes = {}, items = {} } = {}, dialOverrides = {}) {
    const dials = normaliseDials(dialOverrides);
    const priced = keyedItems(items);
    const entities = adaptCorpus({ tokens, recipes });
    const tokenIds = new Set(idsOf(tokens));

    const time = runTempoPass(entities);
    const anchor = runAnchorPass(entities, { skipped: time.skipped, items: priced, tokenIds });
    const price = runPricingPass(entities, {
        timing: time.timing,
        elections: anchor.elections,
        refused: anchor.refused,
        skipped: time.skipped,
        dials,
    });

    const tune = runTuningPass(entities, {
        timing: time.timing,
        elections: anchor.elections,
        candidates: anchor.candidates,
        values: price.values,
        details: price.details,
        refused: anchor.refused,
        skipped: time.skipped,
        dials,
    });

    // The TIME pass chose every cycle from the middle of its band; the TUNE pass may have moved one. The tuned time is the one the game gets, so it wins here: `writeBack` reads this single map.
    const cycleTimes = new Map(time.cycleTimes);
    for (const [id, ms] of tune.cycleTimes) cycleTimes.set(id, ms);

    // The XP pass, the last derivation: it reads the tuned cycle times and writes nothing.
    const xpPass = runXpPass(entities, {
        cycleTimes,
        skipped: time.skipped,
        dials,
    });

    // The check pass derives nothing and writes nothing: it reads the settled line and the dial set. It runs last because the charge half needs the cycle times TUNE may have moved.
    const check = runCheckPass(entities, { cycleTimes, skipped: time.skipped, tokens, dials });

    return {
        entities,
        dials,
        lifetimes: check.lifetimes,
        cycleTimes,
        timing: time.timing,
        tunings: tune.tunings,
        skipped: time.skipped,
        elections: anchor.elections,
        candidates: anchor.candidates,
        refused: anchor.refused,
        values: price.values,
        details: price.details,
        downcycles: price.downcycles,
        xp: xpPass.xp,
        projection: xpPass.projection,
        masteryHours: xpPass.masteryHours,
        rows: sortRows([
            ...time.rows, ...anchor.rows, ...price.rows, ...tune.rows,
            ...xpPass.rows, ...check.rows,
        ]),
    };
}

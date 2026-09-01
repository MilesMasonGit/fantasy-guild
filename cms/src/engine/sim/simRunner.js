/**
 * Economic simulator — the runner (phase P3+4).
 *
 * Orchestrates the first three passes of the assembly line (plan §2):
 *
 * ```
 * adapt → 1. TIME → 2. ANCHOR → 3. PRICE
 * ```
 *
 * Passes 4 (TUNE, the lever policy) and 5 (CHECK, Maps and XP) are later
 * phases and are not called from here.
 *
 * ## What this does not do
 *
 * **It writes nothing.** No store, no file, no mutation of the corpus handed
 * in. Every result is returned. `recalculateEconomy` is the CMS's caller, and
 * `sim/writeBack.js` is the one place a result is turned into stored fields.
 */

import { adaptCorpus } from './fieldAdapter.js';
import { normaliseDials } from './dials.js';
import { runTempoPass } from './tempoPass.js';
import { runAnchorPass } from './anchorPass.js';
import { runPricingPass } from './pricingPass.js';
import { sortRows } from './rows.js';

/** Every id in a keyed object or an array of records. */
function idsOf(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection.map((d, i) => d?.id ?? String(i));
    return Object.keys(collection).map(k => collection[k]?.id ?? k);
}

/**
 * Run TIME → ANCHOR → PRICE over a corpus.
 *
 * @param {object} corpus  `{ tokens, recipes, items }` — keyed objects or arrays
 * @param {object} dialOverrides  the §14 dials; defaults in `dials.js`
 * @returns {{ cycleTimes: Map, elections: Map, values: Map, rows: Array,
 *             entities: Array, timing: Map, skipped: Map, details: Map,
 *             downcycles: Map, dials: object }}
 *
 * Re-running on identical input returns identical output (plan §11). That is
 * an acceptance criterion, and it holds because every pass iterates sorted
 * collections and nothing reads its own previous output — with the single
 * deliberate exception of a stored anchor election (plan §3.2).
 */
export function runSim({ tokens = {}, recipes = {}, items = {} } = {}, dialOverrides = {}) {
    const dials = normaliseDials(dialOverrides);
    const entities = adaptCorpus({ tokens, recipes });
    const tokenIds = new Set(idsOf(tokens));

    const time = runTempoPass(entities);
    const anchor = runAnchorPass(entities, { skipped: time.skipped, items, tokenIds });
    const price = runPricingPass(entities, {
        timing: time.timing,
        elections: anchor.elections,
        refused: anchor.refused,
        skipped: time.skipped,
        dials,
    });

    return {
        entities,
        dials,
        cycleTimes: time.cycleTimes,
        timing: time.timing,
        skipped: time.skipped,
        elections: anchor.elections,
        candidates: anchor.candidates,
        refused: anchor.refused,
        values: price.values,
        details: price.details,
        downcycles: price.downcycles,
        rows: sortRows([...time.rows, ...anchor.rows, ...price.rows]),
    };
}

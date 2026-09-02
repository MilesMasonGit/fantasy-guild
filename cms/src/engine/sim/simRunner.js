/**
 * Economic simulator — the runner (phase P3+4).
 *
 * Orchestrates the first four passes of the assembly line (plan §2):
 *
 * ```
 * adapt → 1. TIME → 2. ANCHOR → 3. PRICE → 4. TUNE → 5. MAP
 * ```
 *
 * Pass 5's **Map** half runs here (P7). Its **XP** half does not exist yet, and
 * authored `xp` still passes through untouched.
 *
 * ⚠️ **TUNE runs after PRICE and never writes a value.** It moves what a source
 * produces and how often, which changes what that source *earns*; item values
 * are settled by then and are read only. That ordering is what keeps the line
 * one-way and is why nothing here iterates (plan §3.4).
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
import { runTuningPass } from './tuningPass.js';
import { runMapPass } from './mapPass.js';
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
 *             downcycles: Map, tunings: Map, dials: object,
 *             maps: Map, mapWeights: Map, scrapValues: Map }}
 *
 * Re-running on identical input returns identical output (plan §11). That is
 * an acceptance criterion, and it holds because every pass iterates sorted
 * collections and nothing reads its own previous output — with the single
 * deliberate exception of a stored anchor election (plan §3.2).
 */
export function runSim({ tokens = {}, recipes = {}, items = {}, maps = {}, enemies = {} } = {}, dialOverrides = {}) {
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

    // The TIME pass chose every cycle from the middle of its band; the TUNE
    // pass may have moved one off that middle. The tuned time is the one the
    // game gets, so it wins here — `writeBack` reads this single map and has no
    // idea two passes had opinions.
    const cycleTimes = new Map(time.cycleTimes);
    for (const [id, ms] of tune.cycleTimes) cycleTimes.set(id, ms);

    // Pass 5 — the Map check. It reads the tuned cycle times and the settled
    // item values and **writes nothing back to a Map's authored fields**: every
    // input to it is authored, so its findings are refusals, not adjustments.
    const mapPass = runMapPass(maps, {
        entities,
        values: price.values,
        cycleTimes,
        items,
        tokens,
        enemies,
        dials,
    });

    return {
        entities,
        dials,
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
        maps: mapPass.reports,
        mapWeights: mapPass.weights,
        scrapValues: mapPass.scrapValues,
        rows: sortRows([...time.rows, ...anchor.rows, ...price.rows, ...tune.rows, ...mapPass.rows]),
    };
}

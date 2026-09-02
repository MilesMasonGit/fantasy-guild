/**
 * Economic simulator — the runner (phase P3+4).
 *
 * Orchestrates the first four passes of the assembly line (plan §2):
 *
 * ```
 * adapt → 1. TIME → 2. ANCHOR → 3. PRICE → 4. TUNE → 5. MAP + XP → CHECK
 * ```
 *
 * **The line is complete as of P8.** Pass 5's Map half (P7) and its XP half
 * (P8) both run here, so one Recalculate settles cycle times, item values,
 * output quantities, tuning, the Map check and XP.
 *
 * ⚠️ **XP runs last, and reads only settled numbers.** It needs the cycle time
 * TUNE may have moved, and it needs the Map costs the Map check computed, so it
 * cannot run earlier — and nothing downstream reads it, so it does not need to.
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
import { runXpPass } from './xpPass.js';
import { runCheckPass } from './checkPass.js';
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
 *             maps: Map, mapWeights: Map, scrapValues: Map, xp: Map,
 *             projection: object, masteryHours: number, lifetimes: Map }}
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

    // Pass 5's XP half (P8) — the last derivation. It reads the tuned cycle
    // times and the Map check's costs, writes nothing, and closes the line.
    const xpPass = runXpPass(entities, {
        cycleTimes,
        skipped: time.skipped,
        mapReports: mapPass.reports,
        dials,
    });

    // The Map reports gain their "estimated day in reach" here rather than
    // inside either pass: the Map check knows the cost and the XP pass knows the
    // pacing curves, and neither should have to know the other.
    const mapReports = new Map();
    for (const [id, report] of mapPass.reports) {
        mapReports.set(id, report.skipped
            ? report
            : { ...report, dayInReach: xpPass.mapDays.get(id) ?? null });
    }

    // The check pass (P9). It derives nothing and writes nothing: it reads the
    // settled line and the dial set, and says out loud what looks wrong — the
    // progression guard (§13.5) and the hours-first charge outliers (CMS-135).
    // It runs last because the charge half needs the cycle times TUNE may have
    // moved, and the guard half needs nothing at all.
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
        maps: mapReports,
        mapWeights: mapPass.weights,
        scrapValues: mapPass.scrapValues,
        xp: xpPass.xp,
        projection: xpPass.projection,
        masteryHours: xpPass.masteryHours,
        rows: sortRows([
            ...time.rows, ...anchor.rows, ...price.rows, ...tune.rows,
            ...mapPass.rows, ...xpPass.rows, ...check.rows,
        ]),
    };
}

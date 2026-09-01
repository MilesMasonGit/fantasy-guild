/**
 * Economic simulator — pass 2 of 5: **ANCHOR** (phase P3+4).
 *
 * ```
 * 2. ANCHOR   Elect exactly one anchor source per item.        (no values needed)
 * ```
 *
 * The rule (plan §3.2, CMS-119):
 *
 * > **An item's anchor is its lowest-level source; ties break to the more
 * > common rarity, then Token before Recipe. A designer can override with an
 * > explicit Anchor flag on one output. Passive and deferred Token kinds can
 * > never anchor.**
 *
 * In plain language: *an item is worth what its everyday source makes it
 * worth.* The lowest-level, commonest producer is the one most players meet
 * first, and the one that must never be net-negative to run. Anchoring there
 * preserves that Token's authored feel exactly, and pushes the tuning burden
 * onto the rarer, higher-level sources — which are the ones with room to be
 * tuned.
 *
 * Like the TIME pass, this is **value-independent**: nothing here asks what
 * anything is worth. That is deliberate — CMS-45's "cheapest acquisition path"
 * was struck precisely because it was circular.
 *
 * An election is written back to the item's `valueSource` by
 * `sim/writeBack.js`, which is also what makes the next run's stickiness work.
 * This pass itself writes nothing — a caller gets a Map.
 */

import { TOKEN_RARITIES } from '../../../../src/config/registries/tokenConstants.js';
import { isDeferredKind } from './fieldAdapter.js';
import { makeRow, SEVERITY } from './rows.js';

/**
 * Where a rarity sits on the ladder — lower is commoner. `TOKEN_RARITIES` is
 * imported from the game because **the array order is the tier order**
 * (common → uncommon → rare → epic → mythic).
 *
 * A source with no rarity — every Recipe — ranks as `common`. That keeps the
 * stated tie-break order intact: a Recipe only ever loses to a Token of the
 * same rarity through the *next* tie-break, "Token before Recipe", rather than
 * through an invented rarity.
 */
export function rarityRank(entity) {
    const index = TOKEN_RARITIES.indexOf(entity?.rarity);
    return index === -1 ? 0 : index;
}

/** Token before Recipe (plan §3.2's third tie-break). */
function kindRank(entity) {
    return entity?.kind === 'recipe' ? 1 : 0;
}

/**
 * The election comparator, in the plan's stated order:
 * level → rarity → kind → id.
 *
 * The final id comparison is not in the plan; it is there so that two
 * genuinely indistinguishable candidates always elect the same one. Without it
 * the result would depend on iteration order and re-running the simulator
 * could churn (plan §11 requires byte-identical re-runs).
 */
export function compareCandidates(a, b) {
    if (a.entity.level !== b.entity.level) return a.entity.level - b.entity.level;
    const rarity = rarityRank(a.entity) - rarityRank(b.entity);
    if (rarity !== 0) return rarity;
    const kind = kindRank(a.entity) - kindRank(b.entity);
    if (kind !== 0) return kind;
    return a.entity.id < b.entity.id ? -1 : a.entity.id > b.entity.id ? 1 : 0;
}

/** "lowest level (1) · common · Token" — the reason shown beside an election. */
function describeReason(candidate, viaFlag) {
    if (viaFlag) return 'explicit anchor flag';
    const kindWord = candidate.entity.kind === 'recipe' ? 'Recipe' : 'Token';
    const rarity = candidate.entity.rarity ?? 'no rarity';
    return `lowest level (${candidate.entity.level}) · ${rarity} · ${kindWord}`;
}

/** Accept a keyed object or an array of records, and yield `[id, def]`. */
function itemEntries(items) {
    if (!items) return [];
    if (Array.isArray(items)) return items.map((def, i) => [def?.id ?? String(i), def]);
    return Object.entries(items);
}

/**
 * Run the ANCHOR pass.
 *
 * @param {Array} entities  adapted entities (from `adaptCorpus`)
 * @param {object} ctx
 * @param {Map} ctx.skipped  entity id → 'inert' | 'untagged' (from the TIME pass)
 * @param {object|Array} ctx.items  the item corpus, for orphans and stickiness
 * @param {Set<string>} ctx.tokenIds  every Token id, for the Token-output refusal
 * @returns {{ elections: Map, candidates: Map, refused: Set, rows: Array }}
 */
export function runAnchorPass(entities, { skipped = new Map(), items = {}, tokenIds = new Set() } = {}) {
    const rows = [];
    const refused = new Set();

    // ── The Token-output refusal (plan §3.3 / CMS-128) ───────────────────────
    // Pricing a Token-as-product needs its *productive lifetime value*, which
    // is not known until after the tuning pass — that would tangle the one-way
    // ordering this design's convergence rests on. So it is refused as a named
    // deferral.
    //
    // ⚠️ The plan files this refusal under pricing, but it has to be decided
    // *here*: a refused recipe must not be allowed to anchor anything either.
    // ⚠️ No shipped recipe outputs a Token (finding S15), so this path is
    // fixture-proven only.
    for (const entity of entities) {
        if (skipped.has(entity.id)) continue;
        const tokenOutputs = entity.outputs.filter(o => tokenIds.has(o.itemId));
        if (tokenOutputs.length > 0) {
            refused.add(entity.id);
            rows.push(makeRow(
                SEVERITY.CRITICAL,
                'token-output-recipe',
                `${entity.name} outputs a Token (${tokenOutputs.map(o => o.itemId).join(', ')}) — deferred shape, outputs must be items for now.`,
                {
                    entityId: entity.id,
                    remedies: ['Output items instead, for now.', 'Wait for the Token-as-product pass — it is a named v1 deferral (CMS-128).'],
                }
            ));
        }
    }

    // ── Gather candidates, per item ──────────────────────────────────────────
    const candidates = new Map();   // itemId → [{ entity, output, eligible, reason }]
    const noteCandidate = (itemId, record) => {
        if (!candidates.has(itemId)) candidates.set(itemId, []);
        candidates.get(itemId).push(record);
    };

    for (const entity of entities) {
        const skipReason = skipped.get(entity.id);
        // Inert entities produce nothing, so they are not sources at all and
        // are not mentioned anywhere — the silent skip (finding B11/S21).
        if (skipReason === 'inert') continue;
        for (const output of entity.outputs) {
            if (!output.itemId) continue;
            let ineligible = null;
            if (skipReason === 'untagged') ineligible = 'untagged';
            else if (refused.has(entity.id)) ineligible = 'refused';
            else if (isDeferredKind(entity)) ineligible = 'deferred';
            else if (entity.downcycle) ineligible = 'downcycle';
            noteCandidate(output.itemId, { entity, output, ineligible });
        }
    }

    // ── Elect, per item ──────────────────────────────────────────────────────
    const itemRecords = new Map(itemEntries(items).map(([id, def]) => [def?.id ?? id, def]));
    // Every item in the corpus, plus anything an output references that the
    // corpus does not contain.
    const allItemIds = [...new Set([...itemRecords.keys(), ...candidates.keys()])].sort();

    const elections = new Map();

    for (const itemId of allItemIds) {
        const all = candidates.get(itemId) || [];
        const eligible = all.filter(c => !c.ineligible);

        // A deferred-kind producer never anchors, but must not be silently
        // forgotten either — the "Wind Trap wrinkle" (plan §3.2).
        for (const c of all.filter(c => c.ineligible === 'deferred')) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'deferred-scope-source',
                `${c.entity.name} produces ${itemId} but is a ${c.entity.tokenType} — out of scope for v1, so it neither anchors nor is tuned.`,
                { entityId: c.entity.id, itemId }
            ));
        }

        if (eligible.length === 0) {
            if (all.length === 0) {
                // Orphan: no source at all (CMS-86).
                rows.push(makeRow(
                    SEVERITY.CRITICAL,
                    'orphan-item',
                    `${itemId} has no source at all — nothing derives its value.`,
                    { itemId, remedies: ['Give it a producer (a Token cycle or a recipe output).'] }
                ));
            } else if (all.every(c => c.ineligible === 'untagged')) {
                // A10: every source skipped as untagged is an **Info** row
                // during the transition, not the Critical an orphan gets.
                rows.push(makeRow(
                    SEVERITY.INFO,
                    'untagged-only-item',
                    `${itemId} is produced only by untagged sources (${all.map(c => c.entity.id).join(', ')}) — not priced this run.`,
                    { itemId, remedies: ['Tag one of its sources with a Tempo and a Purpose.'] }
                ));
            } else {
                // Deferred-only (or refused-only): no derivation chain at all.
                rows.push(makeRow(
                    SEVERITY.CRITICAL,
                    'deferred-only-item',
                    `${itemId} is produced only by out-of-scope sources (${all.map(c => `${c.entity.id}: ${c.ineligible}`).join(', ')}) — no derivation chain.`,
                    { itemId, remedies: ['Give it an in-scope source, or accept that it stays unpriced.'] }
                ));
            }
            continue;
        }

        // The explicit flag overrides the rule (plan §3.2).
        const flagged = eligible.filter(c => c.output.anchor);
        const pool = flagged.length > 0 ? flagged : eligible;
        if (flagged.length > 1) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'multiple-anchor-flags',
                `${itemId} has ${flagged.length} outputs flagged as its anchor (${flagged.map(c => c.entity.id).join(', ')}) — the election rule picked between them.`,
                { itemId, remedies: ['Leave the flag on exactly one output.'] }
            ));
        }
        const winner = [...pool].sort(compareCandidates)[0];
        const reason = describeReason(winner, flagged.length > 0);

        // ── Stickiness (plan §3.2, problem P9) ───────────────────────────────
        // An existing election is read from the item's `valueSource` and kept,
        // even when a newer source would now out-rank it. A different winner
        // becomes an Info row and a one-click re-election, never a silent
        // re-price: adding one Token must not quietly re-price a chain.
        //
        // ⚠️ This is the single deliberate exception to "the simulator never
        // reads its own output". Everything else is regenerated from authored
        // intent on every run.
        const stored = itemRecords.get(itemId)?.valueSource ?? null;
        const storedCandidate = stored ? eligible.find(c => c.entity.id === stored) : null;

        if (stored && !storedCandidate) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'stale-election',
                `${itemId}'s stored anchor ${stored} is no longer an eligible source — re-electing ${winner.entity.name}.`,
                { itemId, entityId: stored }
            ));
        }

        if (storedCandidate && storedCandidate.entity.id !== winner.entity.id) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'anchor-candidate-changed',
                `${winner.entity.name} would now out-rank ${storedCandidate.entity.name} as ${itemId}'s anchor — click to re-elect.`,
                {
                    itemId,
                    entityId: winner.entity.id,
                    remedies: ['Re-elect (re-prices this item\'s whole chain).', 'Dismiss — keeping the current anchor costs nothing.'],
                    detail: { kept: storedCandidate.entity.id, wouldElect: winner.entity.id },
                }
            ));
        }

        const elected = storedCandidate ?? winner;
        elections.set(itemId, {
            itemId,
            sourceId: elected.entity.id,
            sourceName: elected.entity.name,
            kind: elected.entity.kind,
            level: elected.entity.level,
            reason: storedCandidate ? `kept: stored election (${describeReason(elected, elected.output.anchor)})` : reason,
            sticky: Boolean(storedCandidate),
            output: elected.output,
        });
    }

    return { elections, candidates, refused, rows };
}

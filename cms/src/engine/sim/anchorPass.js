/** Economic simulator, pass 2 of 5: ANCHOR. Elects exactly one anchor source per item: the lowest-level source, ties breaking to the more common rarity, then Token before Recipe. A designer can override with an explicit Anchor flag on one output; passive and deferred Token kinds never anchor. Value-independent: nothing here asks what anything is worth. An election is written back to the item's `valueSource` by `sim/writeBack.js`; this pass itself writes nothing, a caller gets a Map. */

import { TOKEN_RARITIES } from '../../../../src/config/registries/tokenConstants.js';
import { isDeferredKind } from './fieldAdapter.js';
import { makeRow, SEVERITY } from './rows.js';
import { makeRefusal } from './refusals.js';

/** Where a rarity sits on the ladder; lower is commoner. `TOKEN_RARITIES` is imported from the game because the array order is the tier order. A source with no rarity (every Recipe) ranks as common, so a Recipe loses to a Token only through the Token-before-Recipe tie-break. */
export function rarityRank(entity) {
    const index = TOKEN_RARITIES.indexOf(entity?.rarity);
    return index === -1 ? 0 : index;
}

function kindRank(entity) {
    return entity?.kind === 'recipe' ? 1 : 0;
}

/** The election comparator: level, rarity, kind, then id. The id comparison makes indistinguishable candidates elect the same one, so re-runs are byte-identical. */
export function compareCandidates(a, b) {
    if (a.entity.level !== b.entity.level) return a.entity.level - b.entity.level;
    const rarity = rarityRank(a.entity) - rarityRank(b.entity);
    if (rarity !== 0) return rarity;
    const kind = kindRank(a.entity) - kindRank(b.entity);
    if (kind !== 0) return kind;
    return a.entity.id < b.entity.id ? -1 : a.entity.id > b.entity.id ? 1 : 0;
}

function describeReason(candidate, viaFlag) {
    if (viaFlag) return 'explicit anchor flag';
    const kindWord = candidate.entity.kind === 'recipe' ? 'Recipe' : 'Token';
    const rarity = candidate.entity.rarity ?? 'no rarity';
    return `lowest level (${candidate.entity.level}) · ${rarity} · ${kindWord}`;
}

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

    // The Token-output refusal: pricing a Token-as-product needs its productive lifetime value, which is not known until after the tuning pass, so it is refused as a named deferral.
    // ⚠️ It must be decided here, not in pricing: a refused recipe must not anchor anything either.
    for (const entity of entities) {
        if (skipped.has(entity.id)) continue;
        const tokenOutputs = entity.outputs.filter(o => tokenIds.has(o.itemId));
        if (tokenOutputs.length > 0) {
            refused.add(entity.id);
            rows.push(makeRefusal('token-output-recipe', {
                what: `${entity.name} outputs a Token (${tokenOutputs.map(o => o.itemId).join(', ')}).`,
                why: 'That is a deferred shape — outputs must be items for now, because pricing a Token as a product needs its productive lifetime value, which nothing knows this early in the run.',
            }, { entityId: entity.id }));
        }
    }

    const candidates = new Map();
    const noteCandidate = (itemId, record) => {
        if (!candidates.has(itemId)) candidates.set(itemId, []);
        candidates.get(itemId).push(record);
    };

    for (const entity of entities) {
        const skipReason = skipped.get(entity.id);
        // Inert entities produce nothing, so they are not sources and are not mentioned anywhere.
        if (skipReason === 'inert') continue;
        for (const output of entity.outputs) {
            if (!output.itemId) continue;
            // ⚠️ An output that can never drop (a quantity range of 0-0, or a chance of 0) is not a source: letting it anchor would price an item from a supply that does not exist. It is treated as absent, so the item falls through to the orphan Critical, which says the true thing and offers the remedy.
            if (output.abundance <= 0) continue;
            let ineligible = null;
            if (skipReason === 'untagged') ineligible = 'untagged';
            else if (refused.has(entity.id)) ineligible = 'refused';
            else if (isDeferredKind(entity)) ineligible = 'deferred';
            else if (entity.downcycle) ineligible = 'downcycle';
            noteCandidate(output.itemId, { entity, output, ineligible });
        }
    }

    const itemRecords = new Map(itemEntries(items).map(([id, def]) => [def?.id ?? id, def]));
    // Every item in the corpus, plus anything an output references that the corpus does not contain.
    const allItemIds = [...new Set([...itemRecords.keys(), ...candidates.keys()])].sort();

    const elections = new Map();

    for (const itemId of allItemIds) {
        const all = candidates.get(itemId) || [];
        const eligible = all.filter(c => !c.ineligible);

        // A deferred-kind producer never anchors, but must not be silently forgotten either.
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
                rows.push(makeRefusal('orphan-item', {
                    what: `${itemId} has no source at all.`,
                    why: 'Nothing produces it, so nothing derives its value and it stays unpriced.',
                }, { itemId }));
            } else if (all.every(c => c.ineligible === 'untagged')) {
                // Every source skipped as untagged is an Info row during the transition, not the Critical an orphan gets.
                rows.push(makeRow(
                    SEVERITY.INFO,
                    'untagged-only-item',
                    `${itemId} is produced only by untagged sources (${all.map(c => c.entity.id).join(', ')}) — not priced this run.`,
                    { itemId, remedies: ['Tag one of its sources with a Tempo and a Purpose.'] }
                ));
            } else {
                rows.push(makeRefusal('deferred-only-item', {
                    what: `${itemId} is produced only by out-of-scope sources (${all.map(c => `${c.entity.id}: ${c.ineligible}`).join(', ')}).`,
                    why: 'None of them can anchor, so there is no derivation chain and the item stays unpriced.',
                }, { itemId }));
            }
            continue;
        }

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

        // Stickiness: an existing election is read from the item's `valueSource` and kept even when a newer source would now out-rank it; a different winner becomes an Info row and a one-click re-election, never a silent re-price.
        // ⚠️ The single deliberate exception to the simulator never reading its own output.
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
            rows.push(makeRefusal('anchor-candidate-changed', {
                what: `${winner.entity.name} would now out-rank ${storedCandidate.entity.name} as ${itemId}'s anchor.`,
                why: 'The stored election is kept until you say otherwise, because adding one Token must never silently re-price a chain.',
            }, {
                itemId,
                entityId: winner.entity.id,
                detail: { kept: storedCandidate.entity.id, wouldElect: winner.entity.id },
            }));
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

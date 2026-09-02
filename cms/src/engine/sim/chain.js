/**
 * Economic simulator — the **chain inspector** (plan §15.2, phase P9).
 *
 * Criterion 11 is explainability: *"why is this worth that?"* must have an
 * answer a designer can read. The plan asks for the answer as a sentence trail
 * rather than a table:
 *
 * > "Oak Wood 3g ← anchors: Oakwood Grove (L1, Medium, GPH) → Charcoal 6g =
 * > 4×3g inputs ÷ 2 + margin…"
 *
 * So this module turns a `runSim` result into one small record per item: what
 * set its value, out of what, and what is priced downstream of it. The rendering
 * is a component's job; every word of economics is decided here, so the CMS
 * cannot grow a second vocabulary for the same numbers.
 *
 * ## Why it reads `details` rather than recomputing anything
 *
 * `pricingPass` already records, per priced item, the source that set it, that
 * source's level and Purpose, the input value it started from, whether the
 * craft-margin floor engaged, and the ideal it rounded off. Recomputing any of
 * that here would be a second implementation of the pricing rule, and the two
 * would drift. Everything below is a re-reading of what the pass already said.
 *
 * Pure: it writes nothing and reads no store.
 */

/** `3g`, or `—` for an item that has no value. */
function gold(value) {
    return Number.isFinite(value) ? `${value}g` : '—';
}

/** "L1, Medium, GPH" — the three things about a source that set the price. */
function sourceTag(entity) {
    if (!entity) return '';
    const tempo = entity.tempo ? entity.tempo[0].toUpperCase() + entity.tempo.slice(1) : 'untagged';
    const purpose = entity.purpose ? entity.purpose.toUpperCase() : 'untagged';
    return `L${entity.level}, ${tempo}, ${purpose}`;
}

/**
 * The arithmetic clause — the "= 4×3g inputs ÷ 2 + margin" half of the sentence.
 *
 * Three shapes, because there are three ways a value gets set:
 * - out of nothing (a gathering source): the target and the yield decide it;
 * - out of inputs, with the Purpose target on top;
 * - out of inputs, with the **craft-margin floor** deciding instead — which is
 *   worth saying out loud, because it is the case where re-tagging the Purpose
 *   would change nothing.
 */
function arithmetic(detail, inputs, values) {
    if (!detail) return null;
    const parts = [];

    if (inputs.length > 0) {
        const terms = inputs.map((i) => `${i.quantity}×${gold(values.get(i.itemId))} ${i.itemId}`);
        parts.push(`${terms.join(' + ')} in`);
    }

    if (detail.floorEngaged) {
        parts.push('craft-margin floor over inputs (its Purpose target was lower)');
    } else {
        parts.push(`${detail.purpose ? detail.purpose.toUpperCase() : 'untagged'} target ${Math.round(detail.targetPerHour)}g/h`);
    }

    if (Number.isFinite(detail.unitsPerHour) && detail.unitsPerHour > 0) {
        parts.push(`÷ ${detail.unitsPerHour.toFixed(1)} a hour`);
    }

    const ideal = Number.isFinite(detail.ideal) ? detail.ideal : null;
    if (ideal !== null && Math.abs(ideal - detail.value) > 0.005) {
        parts.push(`= ${ideal.toFixed(2)}g, kept at whole gold`);
    }

    return parts.join(' · ');
}

/**
 * Build one trail per item the run saw — priced or not.
 *
 * @param {object} sim  a `runSim` result
 * @returns {Map<string, object>} itemId → `{ itemId, value, sentence, … }`
 *
 * An unpriced item still gets a record, carrying the row that explains why
 * rather than a blank: "no source at all" is an answer to "why is this worth
 * that?", and the inspector that goes quiet on exactly the items a designer is
 * puzzling over is the one that fails criterion 11.
 */
export function buildChainTrails(sim) {
    const trails = new Map();
    if (!sim) return trails;

    const byId = new Map((sim.entities ?? []).map((e) => [e.id, e]));
    const values = sim.values ?? new Map();

    // Which items feed which sources, so a trail can point downstream.
    const consumedBy = new Map();       // itemId → [entityId]
    for (const entity of sim.entities ?? []) {
        for (const input of entity.inputs ?? []) {
            if (!input.itemId) continue;
            if (!consumedBy.has(input.itemId)) consumedBy.set(input.itemId, []);
            consumedBy.get(input.itemId).push(entity.id);
        }
    }
    for (const list of consumedBy.values()) list.sort();

    // What each source anchors, so "→ Charcoal 6g" can name the item rather
    // than the recipe that makes it.
    const anchoredBy = new Map();       // entityId → [itemId]
    for (const election of (sim.elections ?? new Map()).values()) {
        if (!anchoredBy.has(election.sourceId)) anchoredBy.set(election.sourceId, []);
        anchoredBy.get(election.sourceId).push(election.itemId);
    }
    for (const list of anchoredBy.values()) list.sort();

    const rowsByItem = new Map();
    for (const row of sim.rows ?? []) {
        if (!row.itemId) continue;
        if (!rowsByItem.has(row.itemId)) rowsByItem.set(row.itemId, []);
        rowsByItem.get(row.itemId).push(row);
    }

    const itemIds = new Set([
        ...values.keys(),
        ...(sim.elections ?? new Map()).keys(),
        ...rowsByItem.keys(),
    ]);

    for (const itemId of [...itemIds].sort()) {
        const election = sim.elections?.get(itemId) ?? null;
        const detail = sim.details?.get(itemId) ?? null;
        const entity = election ? byId.get(election.sourceId) : null;
        const value = values.has(itemId) ? values.get(itemId) : null;
        const inputs = (entity?.inputs ?? []).filter((i) => i.itemId);

        // Upstream: the priced ingredients this item's own price was built out
        // of. One level only — the inspector is a sentence, not a tree, and each
        // named ingredient is itself clickable.
        const upstream = inputs.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            value: values.has(i.itemId) ? values.get(i.itemId) : null,
            sourceId: sim.elections?.get(i.itemId)?.sourceId ?? null,
        }));

        // Downstream: what this item's value goes on to set.
        const downstream = [];
        for (const consumerId of consumedBy.get(itemId) ?? []) {
            for (const madeId of anchoredBy.get(consumerId) ?? []) {
                if (madeId === itemId) continue;
                downstream.push({
                    itemId: madeId,
                    via: consumerId,
                    viaName: byId.get(consumerId)?.name ?? consumerId,
                    value: values.has(madeId) ? values.get(madeId) : null,
                });
            }
        }

        const clause = arithmetic(detail, inputs, values);
        const head = `${itemId} ${gold(value)}`;
        const middle = election
            ? ` ← ${election.sticky ? 'kept anchor' : 'anchors'}: ${election.sourceName} (${sourceTag(entity)})`
            : ' ← nothing prices it';
        const tail = downstream.length > 0
            ? ` → ${downstream.slice(0, 3).map((d) => `${d.itemId} ${gold(d.value)}`).join(', ')}${downstream.length > 3 ? `, +${downstream.length - 3} more` : ''}`
            : '';

        trails.set(itemId, {
            itemId,
            value,
            sourceId: election?.sourceId ?? null,
            sourceName: election?.sourceName ?? null,
            sourceKind: election?.kind ?? null,
            sourceTag: entity ? sourceTag(entity) : null,
            sticky: election?.sticky === true,
            reason: election?.reason ?? null,
            arithmetic: clause,
            upstream,
            downstream,
            // The loudest thing the run said about this item. `what` where the
            // row is a catalogued refusal, the whole line otherwise — a plain
            // row carries no `what`, and reading only that field left the
            // inspector silent about items a Warning had already explained.
            unpricedReason: value === null
                ? (() => {
                    const row = (rowsByItem.get(itemId) ?? []).find((r) => r.severity !== 'info');
                    return row ? (row.what ?? row.message ?? null) : null;
                })()
                : null,
            sentence: `${head}${middle}${clause ? ` = ${clause}` : ''}${tail}`,
        });
    }

    return trails;
}

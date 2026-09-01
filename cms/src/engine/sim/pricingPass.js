/**
 * Economic simulator — pass 3 of 5: **PRICE** (phase P3+4).
 *
 * ```
 * 3. PRICE    Walk the chain bottom-up: anchors set item values,
 *             crafted items price as inputs + purpose profit.  (each value set once)
 * ```
 *
 * ## The property this file must not break
 *
 * Each item's value is **set exactly once**, reading only values already set.
 * There is no feedback loop and nothing iterates toward a fixed point:
 * convergence is a property of the ordering, not of repetition (plan §3.4,
 * CMS-118). The two places iteration could have crept in are closed
 * deliberately — a genuine recipe cycle is *refused* rather than iterated, and
 * anchor election is value-independent.
 *
 * If a future change here wants a "repeat until stable" loop, that is the exact
 * design this one replaced.
 *
 * This pass writes nothing: a caller gets a Map, and `sim/writeBack.js` lands
 * the numbers on each item's `value`.
 */

import { gphAt, purposeGoldFactor, toleranceFor, DEFAULT_DIALS } from './dials.js';
import { makeRow, SEVERITY } from './rows.js';
import { makeRefusal } from './refusals.js';

/**
 * Pick the integer value for an ideal (plan §3.3, problem P4).
 *
 * Item values are integers, so the ideal almost never lands on one. The rule:
 * try the two neighbouring integers; if either lands inside the tolerance band,
 * take it, preferring the closer. If neither lands — routine at values of 1–4g,
 * where a ±1 step is a huge relative move — keep the **nearer** integer and
 * record the residual.
 *
 * The lever policy that *closes* a residual lives in `tuningPass.js`, which runs
 * after this pass and judges the source's total earnings. This pass records the
 * residual and files one Info row; it never decides whether the residual
 * matters, because that question is about the whole source, not one output.
 */
export function chooseInteger(ideal, band) {
    const safeIdeal = Number.isFinite(ideal) && ideal > 0 ? ideal : 0;
    const neighbours = [...new Set([Math.floor(safeIdeal), Math.ceil(safeIdeal)])]
        .filter(v => v >= 1);
    // Below 1g there is no smaller integer to fall to; 1 is the floor.
    if (neighbours.length === 0) neighbours.push(1);

    const scored = neighbours.map(value => ({
        value,
        deviation: safeIdeal > 0 ? Math.abs(value - safeIdeal) / safeIdeal : Infinity,
    }));
    scored.sort((a, b) => (a.deviation - b.deviation) || (a.value - b.value));

    const inBand = scored.filter(s => s.deviation <= band);
    if (inBand.length > 0) {
        return { value: inBand[0].value, deviation: inBand[0].deviation, inBand: true, ideal: safeIdeal };
    }
    return { value: scored[0].value, deviation: scored[0].deviation, inBand: false, ideal: safeIdeal };
}

/**
 * Split a per-cycle target across the outputs an entity anchors,
 * **inversely proportional to abundance** (plan §3.3, the Trout Stream shape).
 *
 * The scarcer output takes the bigger per-unit slice — "the rare drop is the
 * valuable one", which is how a designer reads it without any arithmetic.
 *
 * Note what that compounds to: the *target* splits inversely to abundance, and
 * the per-unit value is then that slice divided by abundance again — so a 10×
 * scarcer output is worth 100× per unit, not 10×. Written out: each output's
 * weight is `1 / abundance`, its slice of the target is `target × weight ÷ Σ
 * weights`, and its per-unit value is that slice ÷ abundance. The square is
 * deliberate, and it is the arithmetic the plan says this inherits.
 */
export function splitByScarcity(target, abundances) {
    const weights = abundances.map(a => (a > 0 ? 1 / a : 0));
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) return abundances.map(() => 0);
    return weights.map(w => (target * w) / total);
}

/** Sum an entity's inputs at current values. Returns null if any is unpriced. */
function inputValuePerCycle(entity, values) {
    let total = 0;
    for (const input of entity.inputs) {
        if (!input.itemId) continue;
        if (!values.has(input.itemId)) return null;
        total += values.get(input.itemId) * input.quantity;
    }
    return total;
}

/**
 * Run the PRICE pass.
 *
 * @param {Array} entities  adapted entities
 * @param {object} ctx
 * @param {Map} ctx.timing     from the TIME pass
 * @param {Map} ctx.elections  from the ANCHOR pass
 * @param {Set} ctx.refused    entity ids refused outright (Token outputs)
 * @param {Map} ctx.skipped    entity id → skip reason
 * @param {object} ctx.dials
 * @returns {{ values: Map, details: Map, downcycles: Map, rows: Array }}
 */
export function runPricingPass(entities, { timing = new Map(), elections = new Map(), refused = new Set(), skipped = new Map(), dials = DEFAULT_DIALS } = {}) {
    const rows = [];
    const values = new Map();
    const details = new Map();
    const downcycles = new Map();

    const byId = new Map(entities.map(e => [e.id, e]));

    // Which items does each entity anchor?
    const anchoredBy = new Map();   // entity id → [itemId]
    for (const election of elections.values()) {
        if (!anchoredBy.has(election.sourceId)) anchoredBy.set(election.sourceId, []);
        anchoredBy.get(election.sourceId).push(election.itemId);
    }
    for (const list of anchoredBy.values()) list.sort();

    // ── Downcycle recipes stand entirely outside the walk (CMS-130) ──────────
    // They never price anything — every item they touch already has a value —
    // so they are neither nodes nor edges here, and they take no part in cycle
    // detection. That is what makes a backwards-pointing loop safe: the return
    // leg only ever reads values.
    const downcycleEntities = entities.filter(e => e.downcycle && !skipped.has(e.id) && !refused.has(e.id));

    const pending = [...anchoredBy.keys()]
        .filter(id => byId.has(id) && !refused.has(id) && !byId.get(id).downcycle)
        .sort();

    // ── The topological walk ─────────────────────────────────────────────────
    // Root items first (produced from nothing), then each crafted item once all
    // its inputs are priced. Every sweep that prices at least one entity is
    // progress; when a sweep makes none, whatever is left is either a cycle or
    // is blocked behind an item that will never have a value. Either way the
    // loop stops — the termination proof is that `remaining` strictly shrinks
    // or the loop exits.
    let remaining = pending;
    for (;;) {
        const remainingSet = new Set(remaining);
        const ready = remaining.filter(id =>
            inputValuePerCycle(byId.get(id), values) !== null
            && coOutputsSettled(byId.get(id), anchoredBy.get(id), values, remainingSet, anchoredBy)
        );
        if (ready.length === 0) break;
        for (const id of ready) {
            priceEntity(byId.get(id), anchoredBy.get(id), { timing, values, details, dials, rows });
        }
        const done = new Set(ready);
        remaining = remaining.filter(id => !done.has(id));
        if (remaining.length === 0) break;
    }

    // ── What is left: cycles, and chains blocked on an unpriceable input ─────
    if (remaining.length > 0) {
        reportStuck(remaining, { byId, elections, values, rows });
    }

    for (const entity of downcycleEntities) {
        priceDowncycle(entity, { values, dials, rows, downcycles });
    }

    return { values, details, downcycles, rows };
}

/**
 * Is every output this entity does NOT anchor already settled?
 *
 * ⚠️ **A co-output is a dependency edge, exactly like an input.** `priceEntity`
 * subtracts the value of the outputs it does not anchor (`inherited`) from its
 * target before splitting the rest. Reading that value before the item has been
 * priced silently counts it as zero — so an entity must wait for its
 * co-outputs, not just for its inputs.
 *
 * Without this the walk was **order-dependent on entity id**: two economically
 * identical corpora priced differently depending on what the entities were
 * named, because sorted-id order decided whether the co-output happened to be
 * priced first. Found by the P3+4 verification pass; it was invisible on the
 * shipped corpus because no shipped producer mixes anchored and non-anchored
 * outputs, and idempotence held throughout (the wrong ordering was at least a
 * *stable* wrong ordering).
 *
 * An unpriced co-output that **no still-pending entity anchors** will never
 * gain a value, so waiting for it would deadlock. That case proceeds and
 * contributes nothing, which is correct — the item genuinely has no value.
 *
 * A mutual co-output dependency (A waits on B, B waits on A) makes neither
 * ready, the sweep prices nothing, and `reportStuck` takes them — the same
 * termination path a recipe cycle uses. No iteration is introduced: this only
 * widens the edge set of the existing Kahn walk.
 */
function coOutputsSettled(entity, anchoredItemIds, values, remainingSet, anchoredBy) {
    if (!entity) return true;
    const anchored = new Set(anchoredItemIds || []);
    for (const output of entity.outputs) {
        if (!output.itemId || anchored.has(output.itemId)) continue;
        if (values.has(output.itemId)) continue;
        for (const pendingId of remainingSet) {
            if (pendingId === entity.id) continue;
            if ((anchoredBy.get(pendingId) || []).includes(output.itemId)) return false;
        }
    }
    return true;
}

/** Price one anchoring entity, setting each item it anchors exactly once. */
function priceEntity(entity, anchoredItemIds, { timing, values, details, dials, rows }) {
    const t = timing.get(entity.id);
    if (!t) return;

    const inputValue = inputValuePerCycle(entity, values) ?? 0;

    // target profit/hour = GPH curve(required level) × purpose factor(Purpose tag)
    const targetPerHour = gphAt(entity.level, dials) * purposeGoldFactor(entity.purpose, dials);
    const targetPerCycle = targetPerHour / t.cyclesPerHour;

    // Crafted anchors: value × units = input value + target profit per cycle,
    // floored at input value × (1 + craft margin per step) (plan §3.3, CMS-122).
    //
    // ⚠️ Interpretation: the plan words this rule for "the anchor is a Recipe",
    // but the floor is really about *consuming inputs* — a station Token that
    // eats 4 Oak Wood is as crafted as a recipe is, and the passes deliberately
    // never branch on entity kind. So the floor applies whenever an entity has
    // priced inputs, of either kind.
    let gross = inputValue + targetPerCycle;
    const floor = inputValue * (1 + dials.craftMarginPerStep);
    let floorEngaged = false;
    if (inputValue > 0 && floor > gross) {
        gross = floor;
        floorEngaged = true;
        rows.push(makeRow(
            SEVERITY.INFO,
            'craft-margin-floor',
            `${entity.name}: the craft-margin floor set its price, not its Purpose target — ${(dials.craftMarginPerStep * 100).toFixed(0)}% over inputs beat a ${entity.purpose.toUpperCase()} target.`,
            {
                entityId: entity.id,
                remedies: ['Lower the craft-margin dial to let Purpose targets decide.', 'Re-tag its Purpose.'],
                detail: { inputValue, targetPerCycle, floor },
            }
        ));
    }

    // Outputs this entity does NOT anchor contribute the value they inherited
    // from elsewhere; only the rest of the target is split across the outputs
    // it does anchor.
    const anchored = new Set(anchoredItemIds || []);
    let inherited = 0;
    for (const output of entity.outputs) {
        if (!output.itemId || anchored.has(output.itemId)) continue;
        if (values.has(output.itemId)) inherited += output.abundance * values.get(output.itemId);
    }

    const mine = entity.outputs.filter(o => o.itemId && anchored.has(o.itemId));
    if (mine.length === 0) return;

    const remainingTarget = gross - inherited;
    const shares = splitByScarcity(Math.max(remainingTarget, 0), mine.map(o => o.abundance));
    const band = toleranceFor(entity.level, dials, { isAnchor: true });

    mine.forEach((output, i) => {
        // Already set? Then something elected two anchors for one item, which
        // the anchor pass makes impossible. Guard rather than double-price.
        if (values.has(output.itemId)) return;

        const ideal = output.abundance > 0 ? shares[i] / output.abundance : 0;
        const chosen = chooseInteger(ideal, band);
        values.set(output.itemId, chosen.value);
        details.set(output.itemId, {
            itemId: output.itemId,
            sourceId: entity.id,
            sourceName: entity.name,
            level: entity.level,
            purpose: entity.purpose,
            cycleTimeMs: t.cycleTimeMs,
            unitsPerHour: (t.outputs.find(o => o.itemId === output.itemId) || {}).unitsPerHour ?? 0,
            targetPerHour,
            inputValue,
            floorEngaged,
            ideal: chosen.ideal,
            value: chosen.value,
            deviation: chosen.deviation,
            inBand: chosen.inBand,
        });

        if (!chosen.inBand) {
            // ⚠️ **Info, not Warning, and the reason is the TUNE pass.**
            // Until P6 this row was the only voice on an off-ideal price, so it
            // was a Warning whose first remedy said "wait for the lever policy".
            // The lever policy exists now: it judges this source's *total*
            // earnings, closes the residual with one lever where it can, and
            // refuses in its own words where it cannot. Leaving a Warning here
            // as well would file two rows for one situation, and the louder of
            // the two would be the one with less information.
            //
            // So this row is now an observation — "gold is whole numbers and
            // this ideal was not" — and the verdict belongs to `tuningPass.js`.
            rows.push(makeRow(
                SEVERITY.INFO,
                'integer-residual',
                `${output.itemId} works out at ${chosen.ideal.toFixed(2)}g from ${entity.name}, and gold comes in whole numbers — kept ${chosen.value}g${Number.isFinite(chosen.deviation) ? `, ${(chosen.deviation * 100).toFixed(0)}% off` : ' (it has no ideal to be off by — the source yields nothing)'}. Whether that matters is judged on ${entity.name}'s total earnings.`,
                {
                    itemId: output.itemId,
                    entityId: entity.id,
                    remedies: [
                        'Nothing, if the tuning pass closed it — see its row for this source.',
                        'Give the output a quantity range so the value has somewhere to land.',
                        'Re-tag its Tempo, or widen the band dial.',
                    ],
                    detail: { ideal: chosen.ideal, value: chosen.value, deviation: chosen.deviation, band },
                }
            ));
        }
    });
}

/**
 * Everything the walk could not reach: genuine cycles, and chains blocked
 * behind an item that will never have a value.
 */
function reportStuck(remaining, { byId, elections, values, rows }) {
    const stuck = new Set(remaining);

    // Edge: this entity needs an input whose anchor is also stuck.
    const edges = new Map();
    for (const id of remaining) {
        const targets = [];
        for (const input of byId.get(id).inputs) {
            if (!input.itemId || values.has(input.itemId)) continue;
            const election = elections.get(input.itemId);
            if (election && stuck.has(election.sourceId)) targets.push(election.sourceId);
        }
        edges.set(id, [...new Set(targets)].sort());
    }

    // Depth-first cycle hunt. Each distinct cycle is reported once, naming
    // every recipe in it — plan §12: the refusal names both recipes.
    const state = new Map();    // id → 'visiting' | 'done'
    const stack = [];
    const seenCycles = new Set();
    const inCycle = new Set();

    const visit = (id) => {
        state.set(id, 'visiting');
        stack.push(id);
        for (const next of edges.get(id) || []) {
            if (state.get(next) === 'visiting') {
                const cycle = stack.slice(stack.indexOf(next));
                const key = [...cycle].sort().join('|');
                if (!seenCycles.has(key)) {
                    seenCycles.add(key);
                    cycle.forEach(c => inCycle.add(c));
                    const names = cycle.map(c => byId.get(c).name);
                    rows.push(makeRefusal('recipe-cycle', {
                        what: `${names.join(' needs ')} needs ${names[0]}.`,
                        why: 'A circular chain cannot be priced bottom-up — every link is waiting for the one behind it.',
                    }, { entityId: cycle[0], detail: { cycle: [...cycle] } }));
                }
            } else if (!state.has(next)) {
                visit(next);
            }
        }
        stack.pop();
        state.set(id, 'done');
    };

    for (const id of remaining) if (!state.has(id)) visit(id);

    // Not in a cycle, just waiting on something that will never arrive. The
    // root cause already has its own Critical row (orphan / deferred-only), so
    // this is the consequence, filed as a Warning naming what it waits for.
    for (const id of remaining) {
        if (inCycle.has(id)) continue;
        const missing = byId.get(id).inputs
            .filter(i => i.itemId && !values.has(i.itemId))
            .map(i => i.itemId);
        // ⚠️ One row per *item* left unpriced, not one per blocked entity.
        // The row used to name only the recipe, and said "the items it anchors
        // stay unpriced" without naming them — so an item-centric reader (the
        // audit panel, or anything asking "why has this item no value?") could
        // not find it, and the item looked silently skipped. Found 2026-09-01
        // when a real chain went unpriced behind an orphaned input.
        const blockedItems = (elections ? [...elections.values()] : [])
            .filter(e => e.sourceId === id && !values.has(e.itemId))
            .map(e => e.itemId);
        const named = blockedItems.length ? blockedItems : [null];
        for (const itemId of named) {
            rows.push(makeRow(
                SEVERITY.WARNING,
                'blocked-chain',
                `${itemId ? itemId + ' cannot be priced: ' : ''}${byId.get(id).name} needs ${missing.join(', ')}, which never got a value.`,
                {
                    entityId: id,
                    ...(itemId ? { itemId } : {}),
                    detail: { missing, blockedItems },
                    remedies: ['Fix the unpriced input above — this row is the consequence, not the cause.'],
                }
            ));
        }
    }
}

/**
 * Price a downcycle recipe's *quantities* (CMS-130).
 *
 * A downcycle recipe never sets a value. Everything it touches is already
 * priced, so the one rule is a cap: the total value that comes back is at most
 * the **recovery ratio** times the value that went in, and the output
 * quantities are derived to fit under it. Strictly losing value on every pass
 * is what makes the loop safe — gold cannot be duplicated by construction.
 */
function priceDowncycle(entity, { values, dials, rows, downcycles }) {
    const missing = [
        ...entity.inputs.filter(i => i.itemId && !values.has(i.itemId)).map(i => i.itemId),
        ...entity.outputs.filter(o => o.itemId && !values.has(o.itemId)).map(o => o.itemId),
    ];
    if (missing.length > 0) {
        rows.push(makeRow(
            SEVERITY.CRITICAL,
            'downcycle-unpriced',
            `${entity.name} is a downcycle recipe, but ${[...new Set(missing)].join(', ')} has no value — a return leg can only give back what is already priced.`,
            { entityId: entity.id, remedies: ['Price those items first, by giving them an in-scope source.'] }
        ));
        return;
    }

    const inputValue = entity.inputs.reduce((s, i) => s + values.get(i.itemId) * i.quantity, 0);
    const cap = dials.downcycleRecoveryRatio * inputValue;
    const authoredReturn = entity.outputs.reduce((s, o) => s + o.abundance * values.get(o.itemId), 0);

    let scale = 1;
    if (authoredReturn > cap) scale = cap / authoredReturn;

    const derived = entity.outputs.map(o => ({
        itemId: o.itemId,
        authoredAvgQty: o.avgQty,
        // Quantities are integers, and flooring can only take the total further
        // under the cap — never over it.
        derivedAvgQty: scale < 1 ? Math.floor(o.avgQty * scale) : o.avgQty,
    }));
    const derivedReturn = derived.reduce((s, d, i) => {
        const o = entity.outputs[i];
        return s + d.derivedAvgQty * o.chance * values.get(o.itemId);
    }, 0);

    downcycles.set(entity.id, { entityId: entity.id, inputValue, cap, authoredReturn, derivedReturn, outputs: derived });

    if (scale < 1) {
        rows.push(makeRow(
            SEVERITY.INFO,
            'downcycle-capped',
            `${entity.name} returns ${authoredReturn.toFixed(2)}g of ${inputValue.toFixed(2)}g as authored, over the ${(dials.downcycleRecoveryRatio * 100).toFixed(0)}% recovery cap — output quantities derived down to ${derivedReturn.toFixed(2)}g.`,
            { entityId: entity.id, detail: { cap, authoredReturn, derivedReturn } }
        ));
    }
    if (derived.every(d => d.derivedAvgQty === 0)) {
        rows.push(makeRow(
            SEVERITY.WARNING,
            'downcycle-yields-nothing',
            `${entity.name} recovers nothing at the current ratio — every output rounds down to zero.`,
            { entityId: entity.id, remedies: ['Raise the recovery-ratio dial (it must stay under 100%).', 'Break down a more valuable input.'] }
        ));
    }
}

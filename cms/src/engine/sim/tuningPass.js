/**
 * Economic simulator — pass 4 of 5: **TUNE**, the lever policy (phase P6).
 *
 * ```
 * 4. TUNE     A source that inherits a value it did not set is nudged into
 *             its earnings band by ONE legible lever — or refused.
 * ```
 *
 * ## The one sentence that matters
 *
 * **The band judges a source's *total* profit per hour, never one output at a
 * time** (plan §5, clarification F2). A level-40 Token whose main output
 * carries its earnings is *in band* even though the cheap level-1 material it
 * also drops would look absurd judged alone. Implementing this per-output is
 * the easy mistake, and it would make the tool wrong in exactly the way that
 * annoys a designer most: correct arithmetic, nonsense conclusion.
 *
 * ## The levers, in order, one at a time
 *
 * | # | Lever | Available when |
 * | :- | :--- | :--- |
 * | 0 | the band forgives it | a non-anchor gets **twice** the anchor band |
 * | 1 | quantity range | always — slide the midpoint, spread preserved |
 * | 2 | chance | the author made this output variable *and* under 100% |
 * | 3 | cycle time | whole seconds, never outside the Tempo band |
 * | 4 | refuse | §12, naming tags and dials |
 *
 * **Each lever is tried from the untouched baseline**, and the first one that
 * lands the source in band is the only one applied. That is what makes a diff
 * read as *one change per Token* — the whole point of the policy. Two levers
 * are never moved when one suffices, and a lever is never moved "a bit" to help
 * the next one along.
 *
 * ## Two rules that are firm
 *
 * - **A 100%-chance output is never made random.** The simulator may turn a
 *   dial the author created; it may never install one. There is no dial, no
 *   threshold and no special case that relaxes this.
 * - **A correction worse than 3× refuses instead of tuning.** Grinding the
 *   levers to their stops would land the number and destroy the Token's
 *   authored character. The single exemption is a quantity move on an
 *   **IPH**-tagged source — volume is an IPH Token's character — and any
 *   exempted move past 3× files a **Warning**, so the one place the guard is
 *   off is always visible.
 *
 * ## What this pass does NOT do
 *
 * **It never re-opens a price.** Item values are settled by the PRICE pass and
 * are read here, never written. Tuning changes how *much* a source produces and
 * how *often*, which changes what that source earns — not what its items are
 * worth. That is what keeps the assembly line one-way (plan §3.4) and is why
 * this pass can run after pricing without anything having to iterate.
 *
 * Like every pass in this directory it writes nothing: a caller gets Maps, and
 * `sim/writeBack.js` is the one place a result reaches stored fields.
 */

import { bandFor } from '../../../../src/config/registries/tempoBands.js';
import { gphAt, purposeGoldFactor, toleranceFor, DEFAULT_DIALS } from './dials.js';
import { isDeferredKind } from './fieldAdapter.js';
import { speedAt } from './tempoPass.js';
import { makeRow, SEVERITY } from './rows.js';
import { makeRefusal } from './refusals.js';

/**
 * The correction the policy refuses rather than grinds out (plan §5's budget
 * rule). Read as a factor in both directions: worse than 3× up, or worse than
 * ⅓ down.
 */
export const CORRECTION_CAP = 3;

/** The lowest chance the policy will snap a primary output to (plan §5 step 2). */
export const PRIMARY_CHANCE_FLOOR = 5;

/** A cap on how far the quantity search walks, so a pathological r cannot hang it. */
const MAX_QUANTITY_STEPS = 100000;

// === Small shared arithmetic =================================================

/** Cycles completed per hour by a worker at exactly the required level. */
export function cyclesPerHour(cycleTimeMs, level) {
    if (!Number.isFinite(cycleTimeMs) || cycleTimeMs <= 0) return 0;
    return (3600 / (cycleTimeMs / 1000)) * speedAt(level);
}

/** Is `profit` inside `±band` of `target`? A target of zero can never be hit. */
export function inBand(profit, target, band) {
    if (!Number.isFinite(target) || target <= 0) return false;
    return Math.abs(profit - target) / target <= band;
}

/**
 * The 10% → 5% → 1% chance ladder, **ported from the retired
 * `cms/src/engine/taskSolver.js`** (its `snapDropChance`), which is deleted in
 * this phase.
 *
 * What survived the port is the *ladder*: try the coarsest legible step first
 * and only get finer when it misses, so a designer reading a diff sees "30%"
 * far more often than "27%". What did not survive is the old function's shape —
 * it took a target EV, a variance and a callback, all of which belonged to the
 * struck EV engine. Here the caller decides which rung lands, because only the
 * caller knows the source's *total* earnings.
 *
 * Returns the rungs in order, de-duplicated, clamped, and never zero — a 0%
 * output produces nothing at all, which is a deletion, not a tuning.
 */
export function snapChanceLadder(raw, { floor = PRIMARY_CHANCE_FLOOR, ceiling = 100 } = {}) {
    if (!Number.isFinite(raw) || raw <= 0) return [];
    const clamp = (v) => Math.max(floor, Math.min(ceiling, v));
    const rungs = [
        clamp(Math.round(raw / 10) * 10),
        clamp(Math.round(raw / 5) * 5),
        clamp(Math.round(raw)),
    ];
    return [...new Set(rungs)].filter((v) => v > 0);
}

// === The state a lever moves =================================================

/**
 * One output as the levers see it. `abundance` — average quantity × chance — is
 * the number every rate in the simulator is built from, so it is recomputed
 * here rather than carried, and it stays the adapter's definition exactly.
 */
function outputState(o) {
    const avgQty = (o.minQty + o.maxQty) / 2;
    return {
        itemId: o.itemId,
        minQty: o.minQty,
        maxQty: o.maxQty,
        avgQty,
        chancePercent: o.chancePercent,
        variable: o.variable === true,
        abundance: avgQty * (o.chancePercent / 100),
    };
}

/** A baseline state: the authored outputs at the TIME pass's chosen cycle. */
function baselineState(entity, cycleTimeMs) {
    return { cycleTimeMs, outputs: entity.outputs.map(outputState) };
}

/** A copy of `state` with output `index` replaced. */
function withOutput(state, index, patch) {
    const outputs = state.outputs.map((o, i) => (i === index ? outputState({ ...o, ...patch }) : o));
    return { ...state, outputs };
}

/**
 * What a source earns per hour in a given state: everything its outputs are
 * worth, less everything its inputs cost, at the rate its cycle implies.
 *
 * An output or input whose item has no value contributes nothing. That is only
 * ever reached for outputs — an entity with an unpriced *input* is not judged
 * at all, because its costs would be understated and the verdict would be a
 * confident lie.
 */
export function earningsPerHour(entity, state, values) {
    const cph = cyclesPerHour(state.cycleTimeMs, entity.level);
    let revenue = 0;
    for (const o of state.outputs) {
        if (!o.itemId || !values.has(o.itemId)) continue;
        revenue += o.abundance * cph * values.get(o.itemId);
    }
    let cost = 0;
    for (const input of entity.inputs) {
        if (!input.itemId || !values.has(input.itemId)) continue;
        cost += input.quantity * values.get(input.itemId) * cph;
    }
    return { cyclesPerHour: cph, revenuePerHour: revenue, costPerHour: cost, profitPerHour: revenue - cost };
}

// === The levers ==============================================================

/**
 * **Lever 1 — quantity range.** Slide the midpoint, keep the authored spread.
 *
 * ⚠️ **A note on "half-unit steps of expected value" (plan §5 step 1).** The
 * game rolls integers — `tokenRegistry.rollOutputQuantity` is
 * `min + floor(random × (max − min + 1))` — so `minQty` and `maxQty` must stay
 * whole numbers. With the spread held fixed, a whole-number midpoint slide
 * moves expected value by whole units; half-units are unreachable *while the
 * spread is preserved*, and preserving the spread is the authored character the
 * plan asks for. What a range does buy is that its expected value sits on a
 * half-unit when the spread is odd (1–2 is 1.5), which is the resolution a
 * fixed integer cannot reach — that is the relief §5 is describing, and it is
 * real. A fixed integer output (min = max) steps the integer, which is the same
 * code path.
 *
 * ⚠️ **The floor is 1, not 0**, for an output whose author wrote at least 1.
 * Sliding a "2–5" down to "0–3" would make a guaranteed drop sometimes yield
 * nothing — installing a failure mode the author did not write, which is the
 * same objection as installing a chance dial. An output already authored to
 * allow 0 keeps that floor.
 */
export function quantityCandidates(output, ratio) {
    const spread = output.maxQty - output.minQty;
    const floorMin = output.minQty >= 1 ? 1 : 0;
    const idealAvg = output.avgQty * ratio;
    const top = Math.min(
        floorMin + MAX_QUANTITY_STEPS,
        Math.ceil(Math.max(idealAvg, output.avgQty)) + spread + 2
    );

    const candidates = [];
    for (let min = floorMin; min <= top; min++) {
        if (min === output.minQty) continue;      // the authored range is the miss
        const max = min + spread;
        if (max < 1) continue;                    // an output that can never yield
        candidates.push({ minQty: min, maxQty: max, avgQty: (min + max) / 2 });
    }

    // Closest to what the correction asks for first; on a tie, the smaller move
    // from what the author wrote. Deterministic, which §11 requires.
    candidates.sort((a, b) => {
        const d = Math.abs(a.avgQty - idealAvg) - Math.abs(b.avgQty - idealAvg);
        if (Math.abs(d) > 1e-9) return d;
        return Math.abs(a.avgQty - output.avgQty) - Math.abs(b.avgQty - output.avgQty);
    });
    return candidates;
}

/**
 * **Lever 3 — cycle time.** Whole seconds, never outside the Tempo band.
 *
 * The band is the Token's authored feel — a Slow token stays slow — so this
 * lever's travel is exactly the band's width and not a millisecond more. Heavy's
 * top is advisory for an *author* (`topIsSoft`), but the simulator will not
 * install a cycle past it: an advisory ceiling is permission for a person, not
 * for a machine.
 */
export function cycleCandidates(tempo, level, currentMs, desiredMs) {
    const band = bandFor(tempo, level);
    if (!band) return [];
    const lo = Math.ceil(band.minMs / 1000);
    const hi = Math.floor(band.maxMs / 1000);
    const out = [];
    for (let s = lo; s <= hi; s++) {
        const ms = s * 1000;
        if (ms === currentMs) continue;
        out.push(ms);
    }
    out.sort((a, b) => Math.abs(a - desiredMs) - Math.abs(b - desiredMs) || a - b);
    return out;
}

// === Prose helpers ===========================================================

const PURPOSE_WORD = Object.freeze({ gph: 'gold', iph: 'item', xph: 'XP' });

const purposeWord = (p) => PURPOSE_WORD[p] ?? p;

/** "2.4× more" / "2.4× less" — a correction said the way a person says it. */
const factor = (r) => (r >= 1 ? `${r.toFixed(2)}× more` : `${(1 / r).toFixed(2)}× less`);

/** "earns 2.4× too much" / "earns 2.4× too little" — the miss, not the fix. */
const gapText = (r) => (r < 1 ? `${(1 / r).toFixed(2)}× too much` : `${r.toFixed(2)}× too little`);

const rangeText = (o) => (o.minQty === o.maxQty ? `${o.minQty}` : `${o.minQty}–${o.maxQty}`);

const seconds = (ms) => `${Math.round(ms / 1000)}s`;

// === The pass ================================================================

/**
 * Run the TUNE pass.
 *
 * @param {Array} entities  adapted entities
 * @param {object} ctx
 * @param {Map} ctx.timing      from the TIME pass
 * @param {Map} ctx.elections   from the ANCHOR pass
 * @param {Map} ctx.candidates  from the ANCHOR pass — every source per item
 * @param {Map} ctx.values      from the PRICE pass
 * @param {Map} ctx.details     from the PRICE pass
 * @param {Set} ctx.refused     entity ids refused outright
 * @param {Map} ctx.skipped     entity id → skip reason
 * @param {object} ctx.dials
 * @returns {{ tunings: Map, cycleTimes: Map, rows: Array }}
 *   `cycleTimes` holds **only** the entities whose cycle this pass moved; the
 *   runner merges them over the TIME pass's choices.
 */
export function runTuningPass(entities, {
    timing = new Map(),
    elections = new Map(),
    candidates = new Map(),
    values = new Map(),
    details = new Map(),
    refused = new Set(),
    skipped = new Map(),
    dials = DEFAULT_DIALS,
} = {}) {
    const rows = [];
    const tunings = new Map();
    const cycleTimes = new Map();

    // Which items does each entity anchor, and did any of them land off-ideal?
    const anchoredBy = new Map();
    for (const election of elections.values()) {
        if (!anchoredBy.has(election.sourceId)) anchoredBy.set(election.sourceId, []);
        anchoredBy.get(election.sourceId).push(election.itemId);
    }
    for (const list of anchoredBy.values()) list.sort();

    for (const entity of entities) {
        if (skipped.has(entity.id)) continue;
        if (refused.has(entity.id)) continue;
        if (entity.downcycle) continue;         // its quantities come from the recovery cap
        if (isDeferredKind(entity)) continue;   // out of scope for v1, so never tuned
        const t = timing.get(entity.id);
        if (!t) continue;

        const tuning = judge(entity, {
            cycleTimeMs: t.cycleTimeMs,
            anchoredItemIds: anchoredBy.get(entity.id) ?? [],
            values, details, dials, rows,
        });
        tunings.set(entity.id, tuning);
        if (tuning.after && tuning.after.cycleTimeMs !== tuning.before.cycleTimeMs) {
            cycleTimes.set(entity.id, tuning.after.cycleTimeMs);
        }

        // One Info row per lever moved. Not a refusal — the sim exercised
        // judgement, which is exactly what Info is for (plan §12) — and it is
        // what makes "one change per Token" checkable by reading the audit
        // panel rather than by trusting this file.
        if (tuning.lever !== 'none') {
            rows.push(makeRow(
                SEVERITY.INFO,
                'tuned',
                `${tuning.name}: ${tuning.diff} — one lever, and it now earns inside its band.`,
                {
                    entityId: entity.id,
                    itemId: tuning.outputItemId,
                    remedies: ['Nothing — this is the lever policy doing its job.', 'Re-tag its Tempo or Purpose if the move is not what you meant.'],
                    detail: { lever: tuning.lever, ratio: tuning.ratio },
                }
            ));
        }
    }

    rows.push(...purposeMismatchRows(candidates));

    return { tunings, cycleTimes, rows };
}

/**
 * Judge one source and, if it misses, move exactly one lever.
 *
 * Returns the record the CMS renders and `writeBack` applies: what it was, what
 * it became, which lever moved and how to say so in one line.
 */
function judge(entity, { cycleTimeMs, anchoredItemIds, values, details, dials, rows }) {
    const isAnchor = anchoredItemIds.length > 0;
    const band = toleranceFor(entity.level, dials, { isAnchor });
    const targetPerHour = gphAt(entity.level, dials) * purposeGoldFactor(entity.purpose, dials);
    const before = baselineState(entity, cycleTimeMs);
    const baseEarnings = earningsPerHour(entity, before, values);

    const record = {
        entityId: entity.id,
        name: entity.name,
        kind: entity.kind,
        level: entity.level,
        tempo: entity.tempo,
        purpose: entity.purpose,
        isAnchor,
        anchoredItemIds,
        band,
        targetPerHour,
        before: { ...before, ...baseEarnings },
        after: null,
        lever: 'none',
        diff: null,
        outputItemId: null,
        ratio: null,
        inBand: false,
        refusalCode: null,
        skippedReason: null,
    };

    // ── Cases the policy declines to judge ───────────────────────────────────
    // An unpriced input understates the cost, so any verdict would be a
    // confident lie. The unpriced item has its own Critical row already.
    if (entity.inputs.some((i) => i.itemId && !values.has(i.itemId))) {
        return { ...record, skippedReason: 'unpriced-inputs' };
    }
    // Nothing it makes has a value: there is no earning to judge.
    if (!before.outputs.some((o) => o.itemId && values.has(o.itemId))) {
        return { ...record, skippedReason: 'no-priced-output' };
    }
    // The craft-margin floor deliberately overrode this source's Purpose target
    // when it priced (plan §6). Tuning it back toward that target would undo,
    // by another route, the decision the floor just made. The floor already has
    // its own Info row saying it did the work.
    if (anchoredItemIds.some((id) => details.get(id)?.floorEngaged)) {
        return { ...record, skippedReason: 'craft-margin-floor' };
    }

    // ── Training losses (plan §6, CMS-122) ───────────────────────────────────
    // An XP source is allowed to cost the player money. It is not allowed to eat
    // a level's whole income.
    if (entity.purpose === 'xph' && baseEarnings.profitPerHour < 0) {
        const loss = -baseEarnings.profitPerHour;
        const cap = dials.trainingLossCap * gphAt(entity.level, dials);
        if (loss <= cap) {
            rows.push(makeRow(
                SEVERITY.INFO,
                'training-loss-within-cap',
                `${entity.name} costs ${loss.toFixed(0)}g an hour to train on, inside the ${(dials.trainingLossCap * 100).toFixed(0)}% training-loss cap — training is meant to cost money.`,
                { entityId: entity.id, detail: { loss, cap } }
            ));
            return { ...record, after: { ...before, ...baseEarnings }, inBand: true };
        }
        rows.push(makeRefusal('training-loss-over-cap', {
            what: `${entity.name} loses ${loss.toFixed(0)}g an hour to train on, past the cap.`,
            why: `An XP source is meant to cost the player money, but not more than ${(dials.trainingLossCap * 100).toFixed(0)}% of what a level ${entity.level} worker earns in that hour — this one is at ${(loss / gphAt(entity.level, dials) * 100).toFixed(0)}%.`,
        }, { entityId: entity.id, purpose: entity.purpose, detail: { loss, cap } }));
        return { ...record, refusalCode: 'training-loss-over-cap' };
    }

    // ── Step 0: the band may already forgive it ──────────────────────────────
    if (inBand(baseEarnings.profitPerHour, targetPerHour, band)) {
        return { ...record, after: { ...before, ...baseEarnings }, inBand: true };
    }

    // ── The output that contributes most, and the correction it must carry ───
    const cph = baseEarnings.cyclesPerHour;
    let dominant = -1;
    let dominantRevenue = 0;
    before.outputs.forEach((o, i) => {
        if (!o.itemId || !values.has(o.itemId)) return;
        const revenue = o.abundance * cph * values.get(o.itemId);
        if (revenue > dominantRevenue) { dominantRevenue = revenue; dominant = i; }
    });

    const missText = `${entity.name} earns ${baseEarnings.profitPerHour.toFixed(0)}g an hour, and a level ${entity.level} ${purposeWord(entity.purpose)} source should earn about ${targetPerHour.toFixed(0)}g.`;

    if (dominant < 0 || dominantRevenue <= 0) {
        // Either nothing it makes is priced, or every output's quantity is
        // zero — a placeholder producer. Scaling zero is not a lever, and
        // inventing a quantity where the author wrote none would be authoring,
        // not tuning.
        const producesNothing = before.outputs.every((o) => o.abundance <= 0);
        rows.push(makeRefusal('correction-too-large', {
            what: `${entity.name} can't be tuned toward its band.`,
            why: producesNothing
                ? `${missText} It yields nothing — every output's quantity is zero — so there is no yield to scale.`
                : `${missText} Nothing it produces has a value, so there is no yield to correct.`,
        }, { entityId: entity.id, purpose: entity.purpose, detail: { producesNothing } }));
        return { ...record, refusalCode: 'correction-too-large' };
    }

    const output = before.outputs[dominant];
    const itemId = output.itemId;
    const requiredRevenue = dominantRevenue + (targetPerHour - baseEarnings.profitPerHour);
    const ratio = requiredRevenue / dominantRevenue;
    record.ratio = ratio;
    record.outputItemId = itemId;

    if (!Number.isFinite(ratio) || ratio <= 0) {
        rows.push(makeRefusal('correction-too-large', {
            what: `${entity.name} can't reach its band by producing less — it would have to produce nothing at all.`,
            why: `${missText} What it inherits for ${itemId} is worth more per hour than its whole target.`,
        }, { entityId: entity.id, itemId, purpose: entity.purpose, detail: { ratio } }));
        return { ...record, refusalCode: 'correction-too-large' };
    }

    const overCap = ratio > CORRECTION_CAP || ratio < 1 / CORRECTION_CAP;
    // The one exemption (F2): volume is an IPH Token's character, so its
    // quantity range may travel as far as it needs. Chance and cycle stay
    // capped even here.
    const quantityExempt = overCap && entity.purpose === 'iph';

    if (overCap && !quantityExempt) {
        rows.push(makeRefusal('correction-too-large', {
            what: `${entity.name} would need its ${itemId} yield ${factor(ratio)} to reach its band.`,
            why: `${missText} A correction that large means the authoring is off — the wrong anchor, the wrong item or the wrong Purpose — not that the numbers need grinding.`,
        }, { entityId: entity.id, itemId, purpose: entity.purpose, detail: { ratio } }));
        return { ...record, refusalCode: 'correction-too-large' };
    }

    // ── Step 1: quantity range ───────────────────────────────────────────────
    for (const candidate of quantityCandidates(output, ratio)) {
        const state = withOutput(before, dominant, candidate);
        const earned = earningsPerHour(entity, state, values);
        if (!inBand(earned.profitPerHour, targetPerHour, band)) continue;

        const moved = candidate.avgQty / output.avgQty;
        const movedFar = moved > CORRECTION_CAP || moved < 1 / CORRECTION_CAP;
        // Outside the exemption the cap binds the *move* as well as the ask, so
        // a candidate that would travel too far is simply not available.
        if (movedFar && !quantityExempt) continue;
        if (movedFar) {
            rows.push(makeRefusal('iph-quantity-exemption', {
                what: `${entity.name}'s ${itemId} yield moved ${factor(moved)}, past the guard that normally refuses a correction that large.`,
                why: 'Volume is what an IPH source is for, so the guard is off for its quantity range. This row exists so the one place that happens stays visible.',
            }, { entityId: entity.id, itemId, purpose: entity.purpose, detail: { ratio, moved } }));
        }
        return {
            ...record,
            after: { ...state, ...earned },
            lever: 'quantity',
            diff: `${itemId}: ${rangeText(output)} → ${rangeText(candidate)}`,
            inBand: true,
        };
    }

    // Past the cap only the quantity lever was ever allowed, and it missed.
    if (overCap) {
        rows.push(makeRefusal('correction-too-large', {
            what: `${entity.name} would need its ${itemId} yield ${factor(ratio)}, and its quantity range cannot get there.`,
            why: `${missText} Chance and cycle time stay capped at ${CORRECTION_CAP}× even on an IPH source, so there is no lever left.`,
        }, { entityId: entity.id, itemId, purpose: entity.purpose, detail: { ratio } }));
        return { ...record, refusalCode: 'correction-too-large' };
    }

    // ── Step 2: chance, only where the author made this output variable ──────
    // ⚠️ FIRM: a 100%-chance output is never made random. Both conditions are
    // required — the `variable` intent flag (plan §16) says the author meant
    // this to be a dial, and a chance under 100% says the dial already exists.
    if (output.variable && output.chancePercent < 100) {
        for (const rung of snapChanceLadder(output.chancePercent * ratio)) {
            if (rung === output.chancePercent) continue;
            const state = withOutput(before, dominant, { chancePercent: rung });
            const earned = earningsPerHour(entity, state, values);
            if (!inBand(earned.profitPerHour, targetPerHour, band)) continue;
            return {
                ...record,
                after: { ...state, ...earned },
                lever: 'chance',
                diff: `${itemId}: ${output.chancePercent}% → ${rung}% chance`,
                inBand: true,
            };
        }
    }

    // ── Step 3: cycle time, inside the Tempo band ────────────────────────────
    const desiredMs = cycleTimeMs / ratio;
    for (const ms of cycleCandidates(entity.tempo, entity.level, cycleTimeMs, desiredMs)) {
        const state = { ...before, cycleTimeMs: ms };
        const earned = earningsPerHour(entity, state, values);
        if (!inBand(earned.profitPerHour, targetPerHour, band)) continue;
        return {
            ...record,
            after: { ...state, ...earned },
            lever: 'cycle',
            diff: `cycle ${seconds(cycleTimeMs)} → ${seconds(ms)}`,
            inBand: true,
        };
    }

    // ── Step 4: refuse ───────────────────────────────────────────────────────
    const tooFast = ratio < 1;
    rows.push(makeRefusal('levers-exhausted', {
        what: `${entity.name} can't reach its earnings band.`,
        why: `${missText} It inherits ${itemId} at ${values.get(itemId)}g, so it earns ${gapText(ratio)}, and neither its quantity range, its drop chance nor its cycle inside the ${entity.tempo} band closes that.`,
    }, {
        entityId: entity.id,
        itemId,
        tooFast,
        hasRange: output.minQty !== output.maxQty,
        purpose: entity.purpose,
        detail: { ratio, band, targetPerHour, profitPerHour: baseEarnings.profitPerHour },
    }));

    return { ...record, refusalCode: 'levers-exhausted' };
}

/**
 * The standing Purpose-mismatch row (plan §5, F3).
 *
 * Two sources of one item carrying different Purpose tags aim at targets ~3×
 * apart before any yield difference, which is the commonest reason tuning
 * strains. The simulator does not forbid it — a gold gatherer and an XP
 * training recipe on the same item is a legitimate design — it names it, once
 * per item, so the cause is already written down when a refusal shows up
 * nearby.
 */
export function purposeMismatchRows(candidates) {
    const rows = [];
    for (const itemId of [...candidates.keys()].sort()) {
        const eligible = (candidates.get(itemId) || []).filter((c) => !c.ineligible);
        const purposes = [...new Set(eligible.map((c) => c.entity.purpose).filter(Boolean))].sort();
        if (purposes.length < 2) continue;
        rows.push(makeRow(
            SEVERITY.INFO,
            'purpose-mismatch',
            `${itemId} is produced by sources tagged ${purposes.map(purposeWord).join(' and ')} (${eligible.map((c) => c.entity.id).sort().join(', ')}) — they aim at very different earnings, so one of them will always be working harder to stay in band.`,
            {
                itemId,
                remedies: [
                    'Nothing, if the split is deliberate — this row is a note, not a fault.',
                    'Re-tag one of them, if they were meant to be the same kind of source.',
                ],
                detail: { purposes, sources: eligible.map((c) => c.entity.id).sort() },
            }
        ));
    }
    return rows;
}

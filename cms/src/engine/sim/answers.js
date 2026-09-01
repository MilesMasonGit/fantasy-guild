/**
 * Economic simulator — "the sim answered", per entity (phase P6, plan §15.1).
 *
 * The Simulator panel has two halves. `SimIntentControls` is the half an author
 * *sets*; this module builds the half the simulator *answers* — one small,
 * plain record per Token and per Recipe, so the editor can render it without
 * knowing anything about passes, Maps or dials.
 *
 * Keeping it here rather than in the component is what stops the CMS growing a
 * second, drifting copy of the engine's vocabulary.
 *
 * ## The stale badge, and why it is a fingerprint
 *
 * §15.1 wants a grey "stale — recalculate" badge when the entity has been
 * edited since the last run. Rather than tracking edit timestamps across every
 * store action — a change in a dozen places, each of which can be forgotten —
 * each answer carries a **fingerprint of the record as the run left it**. The
 * panel fingerprints the live record and compares. Any edit at all makes them
 * differ.
 *
 * ⚠️ That is deliberately over-eager: renaming a Token or changing its sprite
 * marks its answer stale too, though neither changes a number. "Something about
 * this changed since the run" is honest and cheap; "exactly the economically
 * relevant fields changed" is a second model of what matters, and it would rot.
 */

import { bandFor } from '../../../../src/config/registries/tempoBands.js';
import { isRefusal } from './refusals.js';

/**
 * A short, stable fingerprint of a record.
 *
 * djb2 over the record's JSON. Not a cryptographic hash and not trying to be:
 * it only has to change when the record does, within one browser session.
 */
export function fingerprint(record) {
    const json = JSON.stringify(record ?? null);
    let hash = 5381;
    for (let i = 0; i < json.length; i++) hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0;
    return `${hash.toString(36)}:${json.length}`;
}

/**
 * Build one answer per entity the run saw.
 *
 * @param {object} sim      a `runSim` result
 * @param {object} written  `{ tokens, recipes }` — the records **as the
 *                          write-back left them**, which is what the panel will
 *                          be comparing against
 * @param {number} ranAt    when the run finished
 */
export function buildSimAnswers(sim, { tokens = {}, recipes = {} } = {}, ranAt = Date.now()) {
    const answers = {};
    const rowsByEntity = new Map();
    for (const row of sim.rows) {
        if (!row.entityId) continue;
        if (!rowsByEntity.has(row.entityId)) rowsByEntity.set(row.entityId, []);
        rowsByEntity.get(row.entityId).push(row);
    }

    for (const entity of sim.entities) {
        const written = entity.kind === 'token' ? tokens[entity.id] : recipes[entity.id];
        const tuning = sim.tunings?.get(entity.id) ?? null;
        const timing = sim.timing.get(entity.id) ?? null;
        const rows = rowsByEntity.get(entity.id) ?? [];

        answers[entity.id] = {
            entityId: entity.id,
            kind: entity.kind,
            ranAt,
            fingerprint: fingerprint(written),
            skipped: sim.skipped.get(entity.id) ?? null,
            tempo: entity.tempo,
            purpose: entity.purpose,
            level: entity.level,
            cycleTimeMs: sim.cycleTimes.get(entity.id) ?? null,
            band: entity.tempo ? bandFor(entity.tempo, entity.level) : null,
            outputs: entity.outputs.filter(o => o.itemId).map((o) => {
                const election = sim.elections.get(o.itemId) ?? null;
                return {
                    itemId: o.itemId,
                    value: sim.values.has(o.itemId) ? sim.values.get(o.itemId) : null,
                    anchored: election?.sourceId === entity.id,
                    sourceId: election?.sourceId ?? null,
                    sourceName: election?.sourceName ?? null,
                };
            }),
            // The earn gauge's three numbers. Null where the pass declined to
            // judge — a gauge with no reading is better than a made-up dot.
            earn: tuning && !tuning.skippedReason ? {
                profitPerHour: (tuning.after ?? tuning.before).profitPerHour,
                targetPerHour: tuning.targetPerHour,
                band: tuning.band,
            } : null,
            notJudged: tuning?.skippedReason ?? null,
            tuning: tuning && tuning.lever !== 'none' ? { lever: tuning.lever, diff: tuning.diff } : null,
            // Only catalogued refusals go inline; the rest stay in the panel.
            refusals: rows.filter(r => isRefusal(r.code)).map(r => ({
                code: r.code, severity: r.severity, what: r.what, why: r.why,
                message: r.message, remedies: [...r.remedies],
            })),
            cyclesPerHour: timing?.cyclesPerHour ?? null,
        };
    }
    return answers;
}

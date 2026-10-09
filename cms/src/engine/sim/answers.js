/**
 * Economic simulator: the sim answered, per entity. Builds the half of the Simulator panel that the simulator answers, one plain record per Token and Recipe, so the editor needs no knowledge of passes, Maps or dials.
 * ⚠️ The stale badge is a fingerprint: each answer carries a fingerprint of the record as the run left it, and the panel compares it with the live record. Deliberately over-eager (renaming a Token marks it stale), because a second model of which fields matter would rot.
 */

import { bandFor } from '../../../../src/config/registries/tempoBands.js';
import { isRefusal } from './refusals.js';

/** A short, stable fingerprint of a record: djb2 over its JSON. It only has to change when the record does, within one browser session. */
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
            lifetime: lifetimeLine(sim, entity, tuning),
        };
    }
    return answers;
}

/**
 * The lifetime line, hours first. Lives is what the check pass computed from `uses` and the settled cycle, never `charges`, and what one copy earns over that life.
 * ⚠️ A Recipe has no lifetime. `null` means the sim has not said, which the panel renders as silence.
 */
function lifetimeLine(sim, entity, tuning) {
    if (entity.kind !== 'token') return null;
    const life = sim.lifetimes?.get(entity.id) ?? null;
    if (!life || !Number.isFinite(life.hours)) return null;

    const profitPerHour = tuning && !tuning.skippedReason
        ? (tuning.after ?? tuning.before)?.profitPerHour ?? null
        : null;
    const lifetimeValue = Number.isFinite(profitPerHour) ? profitPerHour * life.hours : null;

    return {
        hours: life.hours,
        charges: life.charges,
        unlimited: life.unlimited === true,
        // True where the hours are the `unlimitedLifetimeHours` dial standing in
        // for a lifetime the Token does not have, so the panel can say "assumed"
        // rather than presenting a dial as a measurement.
        assumed: life.assumed === true,
        lifetimeValue,
    };
}

/**
 * Economic simulator — pass 1 of 5: **TIME** (phase P3+4).
 *
 * ```
 * 1. TIME     Pick every cycle time from its Tempo band.       (no values needed)
 * ```
 *
 * This pass is **value-independent**: it never reads an item value and never
 * asks what anything is worth. That is half of why the design has no feedback
 * loop (plan §3.4) — the other half is that pricing sets each value exactly
 * once. Nothing here iterates.
 *
 * What it produces, per tagged producer:
 * - a cycle time — **the middle of its tempo band at its required level,
 *   snapped to whole seconds** (plan §3.1);
 * - units per hour for each of its outputs.
 *
 * This pass writes nothing: a caller gets a Map, and `sim/writeBack.js` lands
 * each cycle time on `config.cycleTimeMs` (Tokens) or `durationMs` (recipes).
 */

import { bandFor } from '../../../../src/config/registries/tempoBands.js';
import { SKILL_SPEED_FACTOR } from '../../../../src/config/FormulaRegistry.js';
import { isInert, isUntagged } from './fieldAdapter.js';
import { makeRow, SEVERITY } from './rows.js';
import { isSimPurpose } from '../../utils/simVocabulary.js';

/**
 * The worker-at-required-level assumption, `speed(L) = 1 + 0.005 × L`
 * (plan §3.1).
 *
 * ⚠️ `SKILL_SPEED_FACTOR` is **imported from the game**, never retyped. The
 * board divides a tile's work time by this same ramp
 * (`FormulaRegistry.skillSpeedBonus` → `BoardRunner.heroSpeedFactor`); a
 * duplicated 0.005 here is exactly how the simulator and the board would drift
 * apart without anyone noticing.
 */
export function speedAt(level) {
    const L = Number.isFinite(level) && level >= 1 ? level : 1;
    return 1 + SKILL_SPEED_FACTOR * L;
}

/**
 * The middle of `tempo`'s band at `level`, in milliseconds, snapped to whole
 * seconds (plan §10: "cycle times are whole seconds").
 *
 * `bandFor` is imported rather than reimplemented — the bands, and the owner's
 * `1 + (level - 1)/70` scaling ruling, live in one place game-side.
 */
export function bandMiddleMs(tempo, level) {
    const band = bandFor(tempo, level);
    if (!band) return null;
    const middle = (band.minMs + band.maxMs) / 2;
    return Math.round(middle / 1000) * 1000;
}

/**
 * Units of one output per hour (plan §3.1):
 *
 * ```
 * units/hour = avg quantity × chance ÷ cycle time × 3600 × speed(required level)
 * ```
 *
 * `output.abundance` is `avg quantity × chance` and comes from the adapter,
 * whose `expectedQuantity` mirrors the runtime's `expectedOutputQuantity`
 * exactly (finding S17/A6). If those two ever disagree, every band computed
 * from this number is quietly wrong — `EconSimTime.test.js` pins them together.
 */
export function unitsPerHour(output, cycleTimeMs, level) {
    if (!Number.isFinite(cycleTimeMs) || cycleTimeMs <= 0) return 0;
    const cycleSeconds = cycleTimeMs / 1000;
    return (output.abundance / cycleSeconds) * 3600 * speedAt(level);
}

/**
 * Run the TIME pass over adapted entities.
 *
 * @returns {{
 *   cycleTimes: Map<string, number>,
 *   timing: Map<string, object>,
 *   skipped: Map<string, string>,
 *   rows: Array<object>
 * }}
 *   `timing` holds, per active entity, its cycle time, cycles per hour and the
 *   per-output units/hour. `skipped` maps an entity id to *why* it was skipped
 *   (`'inert'` or `'untagged'`) — the two are different and the difference is
 *   load-bearing.
 */
export function runTempoPass(entities) {
    const cycleTimes = new Map();
    const timing = new Map();
    const skipped = new Map();
    const rows = [];

    for (const entity of entities) {
        // ── The structural skip (finding B11/S21) ────────────────────────────
        // No work cycle — `config: null`, or a config that produces nothing.
        // Skipped **silently**: there is nothing here to tag. 23 of 39 shipped
        // Tokens are in this bucket, and a row apiece would bury every real row.
        if (isInert(entity)) {
            skipped.set(entity.id, 'inert');
            continue;
        }

        // ── The untagged rule (finding A10) ──────────────────────────────────
        // A real producer with no Tempo/Purpose is "you forgot". It is skipped
        // untouched — the simulator does not guess a tag — and files exactly
        // one Info row.
        if (isUntagged(entity)) {
            skipped.set(entity.id, 'untagged');
            rows.push(makeRow(
                SEVERITY.INFO,
                'untagged-producer',
                `${entity.name} produces but has no Tempo/Purpose tags — untagged, outside the economy pass.`,
                {
                    entityId: entity.id,
                    remedies: ['Tag it with a Tempo (fast/medium/slow/heavy) and a Purpose (gph/iph/xph).'],
                    detail: { tempo: entity.tempo, purpose: entity.purpose },
                }
            ));
            continue;
        }

        // A Purpose outside the three names would otherwise be silently worth
        // nothing: `purposeGoldFactor` returns 0 for an unknown tag, the target
        // becomes 0 g/hr, and every item the entity anchors falls to the 1g
        // floor with no row saying why. Tempo already names its own typos, and
        // the asymmetry was unintended — a mistyped Purpose is the same "you
        // meant something" mistake. Found by the P3+4 verification pass.
        if (!isSimPurpose(entity.purpose)) {
            skipped.set(entity.id, 'untagged');
            rows.push(makeRow(
                SEVERITY.INFO,
                'unknown-purpose',
                `${entity.name} is tagged purpose "${entity.purpose}", which is not one of gph/iph/xph.`,
                {
                    entityId: entity.id,
                    remedies: ['Re-tag it with one of the three purposes.'],
                    detail: { purpose: entity.purpose },
                }
            ));
            continue;
        }

        const cycleTimeMs = bandMiddleMs(entity.tempo, entity.level);
        if (!Number.isFinite(cycleTimeMs) || cycleTimeMs <= 0) {
            // A tempo outside the four names. `bandFor` returns null rather
            // than guessing, so this is a mistyped tag, not a missing one.
            skipped.set(entity.id, 'untagged');
            rows.push(makeRow(
                SEVERITY.INFO,
                'unknown-tempo',
                `${entity.name} is tagged tempo "${entity.tempo}", which is not one of fast/medium/slow/heavy.`,
                { entityId: entity.id, remedies: ['Re-tag it with one of the four tempos.'] }
            ));
            continue;
        }

        const outputs = entity.outputs.map(output => ({
            itemId: output.itemId,
            abundance: output.abundance,
            unitsPerHour: unitsPerHour(output, cycleTimeMs, entity.level),
        }));

        cycleTimes.set(entity.id, cycleTimeMs);
        timing.set(entity.id, {
            entityId: entity.id,
            cycleTimeMs,
            // Cycles completed per hour by a worker at exactly the required
            // level. Pricing divides an hourly target by this to get a
            // per-cycle one.
            cyclesPerHour: (3600 / (cycleTimeMs / 1000)) * speedAt(entity.level),
            speed: speedAt(entity.level),
            outputs,
        });
    }

    return { cycleTimes, timing, skipped, rows };
}

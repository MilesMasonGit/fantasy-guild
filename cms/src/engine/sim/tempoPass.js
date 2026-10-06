/** Economic simulator, pass 1 of 5: TIME. Picks every cycle time from its Tempo band (the middle of the band at the required level, snapped to whole seconds) and the units per hour of each output. Value-independent: it never reads an item value, which is half of why the design has no feedback loop. It writes nothing: a caller gets a Map, and `sim/writeBack.js` lands each cycle time on `config.cycleTimeMs` (Tokens) or `durationMs` (recipes). */

import { bandFor } from '../../../../src/config/registries/tempoBands.js';
import { SKILL_SPEED_FACTOR } from '../../../../src/config/FormulaRegistry.js';
import { isInert, isUntagged } from './fieldAdapter.js';
import { makeRow, SEVERITY } from './rows.js';
import { isSimPurpose } from '../../utils/simVocabulary.js';

/**
 * The worker-at-required-level assumption, `speed(L) = 1 + 0.005 × L`.
 * ⚠️ `SKILL_SPEED_FACTOR` is imported from the game, never retyped: the board divides a tile's work time by the same ramp, and a duplicated 0.005 here is how the simulator and the board would drift apart unnoticed.
 */
export function speedAt(level) {
    const L = Number.isFinite(level) && level >= 1 ? level : 1;
    return 1 + SKILL_SPEED_FACTOR * L;
}

/** The middle of `tempo`'s band at `level`, in milliseconds, snapped to whole seconds. `bandFor` is imported rather than reimplemented: the bands and their level scaling live in one place game-side. */
export function bandMiddleMs(tempo, level) {
    const band = bandFor(tempo, level);
    if (!band) return null;
    const middle = (band.minMs + band.maxMs) / 2;
    return Math.round(middle / 1000) * 1000;
}

/** Units of one output per hour: `avg quantity × chance ÷ cycle time × 3600 × speed(required level)`. `output.abundance` is `avg quantity × chance` and comes from the adapter, whose `expectedQuantity` mirrors the runtime's `expectedOutputQuantity`; if the two disagree every band computed from it is quietly wrong, so `EconSimTime.test.js` pins them together. */
export function unitsPerHour(output, cycleTimeMs, level) {
    if (!Number.isFinite(cycleTimeMs) || cycleTimeMs <= 0) return 0;
    const cycleSeconds = cycleTimeMs / 1000;
    return (output.abundance / cycleSeconds) * 3600 * speedAt(level);
}

/**
 * Run the TIME pass over adapted entities.
 * @returns {{ cycleTimes: Map<string, number>, timing: Map<string, object>, skipped: Map<string, string>, rows: Array<object> }}
 * `timing` holds, per active entity, its cycle time, cycles per hour and per-output units/hour. `skipped` maps an entity id to why it was skipped (`'inert'` or `'untagged'`); the difference is load-bearing.
 */
export function runTempoPass(entities) {
    const cycleTimes = new Map();
    const timing = new Map();
    const skipped = new Map();
    const rows = [];

    for (const entity of entities) {
        // No work cycle (`config: null`, or a config that produces nothing): skipped silently, because there is nothing to tag and a row apiece would bury every real row.
        if (isInert(entity)) {
            skipped.set(entity.id, 'inert');
            continue;
        }

        // A real producer with no Tempo/Purpose is you forgot: it is skipped untouched (the simulator does not guess a tag) and files exactly one Info row.
        if (isUntagged(entity)) {
            skipped.set(entity.id, 'untagged');
            rows.push(makeRow(
                SEVERITY.INFO,
                'untagged-producer',
                `${entity.name} produces but has no Tempo/Purpose tags — untagged, outside the economy pass.`,
                {
                    entityId: entity.id,
                    remedies: ['Tag it with a Tempo (quick/fast/medium/slow/heavy) and a Purpose (gph/iph/xph).'],
                    detail: { tempo: entity.tempo, purpose: entity.purpose },
                }
            ));
            continue;
        }

        // A Purpose outside the three names would otherwise be silently worth nothing: `purposeGoldFactor` returns 0 for an unknown tag, so the target becomes 0 g/hr and every item the entity anchors falls to the 1g floor with no row saying why.
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
            // A tempo outside the five names. `bandFor` returns null rather
            // than guessing, so this is a mistyped tag, not a missing one.
            skipped.set(entity.id, 'untagged');
            rows.push(makeRow(
                SEVERITY.INFO,
                'unknown-tempo',
                `${entity.name} is tagged tempo "${entity.tempo}", which is not one of quick/fast/medium/slow/heavy.`,
                { entityId: entity.id, remedies: ['Re-tag it with one of the five tempos.'] }
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

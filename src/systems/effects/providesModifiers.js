import { KEYWORD } from './statements.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';

/**
 * Put a bearer's combat `Provides` on its aggregator under one source, so a re-sync is a clean
 * replace rather than an accumulation: a lingering effect on a hero or an enemy (`LiveEffects`), an
 * enemy's kinds (`enemyKindEffects`). One road for every number a fighter's effects move.
 *
 * Only the combat axes (`heroOnly` in the palette) go on the aggregator; the board axes are read
 * live by `resolveAxis`. Flat ones go as flat; a percentage one (Damage, Attack Speed) rides as a
 * percentage, because `ModifierAggregator.query` skips every bucket but flat and those axes have
 * their own percentage reader (`getPercentageBucket`).
 *
 * @param {object} aggregator a `ModifierAggregator`
 * @param {string} source the source id every modifier is registered under
 * @param {Array<object>} statements already scaled and stamped
 */
export function registerProvides(aggregator, source, statements) {
    if (!aggregator) return;
    aggregator.removeModifiersBySource(source);
    for (const statement of statements || []) {
        if (statement?.keyword !== KEYWORD.PROVIDES) continue;
        const payload = statement.payload || {};
        if (!getPaletteEntry(payload.type)?.heroOnly) continue;
        const bucket = payload.bucket === 'percentage' ? 'percentage' : !payload.bucket || payload.bucket === 'flat' ? 'flat' : null;
        if (!bucket) continue;
        const value = Number(payload.value);
        if (!Number.isFinite(value) || value === 0) continue;
        aggregator.addModifier({
            type: payload.type, value, bucket, source,
            ...(payload.category ? { target: { category: payload.category } } : {})
        });
    }
}

import * as TileModifiers from './TileModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';

/**
 * The chances a completed cycle has to save what it would spend: its charges (Refresh).
 *
 * ⚠️ The bench's work check pins the `Math.random` stream. A roll here draws only when a rule
 * actually offers the chance, so content without one makes no draw and the stream is unchanged.
 */

/**
 * Whether a rule-driven chance on `type` hits, for Token `instanceId` narrowed to `category`:
 * resolved to a percentage from a base of 0 (the Token's neighbours, the guild's stars, its hero),
 * then rolled once. No chance, no draw.
 */
export function procHits(instanceId, type, category) {
    const chance = TileModifiers.resolveAxis(instanceId, type, 0, category);
    if (!(chance > 0)) return false;
    return Math.random() * 100 < chance;
}

/**
 * REFRESH: whether this cycle spends none of the Token's charges (a Field, none of its load).
 * The caller asks only for a cycle that succeeded and would spend something.
 */
export function rollRefresh(instanceId, skill) {
    return procHits(instanceId, EFFECT_TYPES.REFRESH, skill);
}

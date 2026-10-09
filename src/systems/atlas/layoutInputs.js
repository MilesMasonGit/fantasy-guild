// the game's side of a layout: the shipped mat, Token bodies and Cannot rules

import { MAT_STEP_U, MAT_ASPECT, artRadiusOf } from '../../config/matGeometry.js';
import { matTuningDefault } from '../../config/matTuning.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import { isWithin, nearRadius } from '../board/nearby.js';
import * as Restrictions from '../board/Restrictions.js';
import { HALL_TYPE_ID } from './Layout.js';

/**
 * `Layout.js` is pure and takes its geometry as numbers; this is where the game supplies them, so
 * settle and reroll (and A6's preview) hand every layout the same inputs.
 *
 * ⚠️ The mat size and crowding numbers are the **shipped defaults**, never this device's Mat Tuner
 * values: a settled Region's coordinates must mean the same on every machine. Until T-097 makes
 * the mat size a fixed game value, a device whose Mat Tuner shrank the mat shows a generated
 * Region's outer Tokens past the mat's edge (`MatResize` acts only when the tuner moves, not on
 * load or travel).
 */

/** The mat as the game ships it, in mat units (1760 × 1126 at 11 steps). */
export function shippedMat() {
    const w = matTuningDefault('matSteps') * MAT_STEP_U;
    return { w, h: Math.round(w * MAT_ASPECT) };
}

/** The hitbox and overlap rules as the game ships them. */
export function shippedCrowding() {
    return { hitboxPct: matTuningDefault('hitboxPct'), overlapPct: matTuningDefault('overlapPct') };
}

const hasCannot = (typeId) => statementsWith(getTokenType(typeId), KEYWORD.CANNOT).length > 0;

/**
 * A layout `allows` hook that refuses any spot breaking a `Cannot` rule, judged by `Restrictions`
 * on the layout so far; null when no Token in `typeIds` (nor the Hall) has a `Cannot` at all, so an
 * ordinary layout never pays for it. Without it a generated board could break a rule, and
 * `Restrictions.reconcile` would move map fixtures on the next load.
 *
 * ⚠️ Near is the live Near radius (`Restrictions` reads no other), so this one input is still a
 * per-device value until T-097.
 */
export function cannotCheck(typeIds) {
    if (![...typeIds, HALL_TYPE_ID].some(hasCannot)) return null;
    return (typeId, point, placed) => {
        // A rule is broken by what is Near a Token, and only Tokens Near the newcomer can be
        // newly broken, so nothing further than two Near radii can change the answer.
        const reach = 2 * nearRadius();
        const view = new Map();
        placed.forEach((p, i) => {
            if (isWithin(point, p, reach)) view.set(`n${i}`, { typeId: p.typeId, x: p.x, y: p.y });
        });
        view.set(Restrictions.PLACING_ID, { typeId, x: point.x, y: point.y });
        if (Restrictions.violationAt(view, Restrictions.PLACING_ID)) return false;
        for (const [id, entry] of view) {
            if (id === Restrictions.PLACING_ID || !isWithin(point, entry)) continue;
            if (Restrictions.violationAt(view, id)) return false;
        }
        return true;
    };
}

/**
 * Everything `Layout.layout` needs besides the budget, as the game supplies it. No `terrainAllows`
 * yet, so every Token may stand anywhere dry; per-Token terrain needs (a Dock on the coast), set in
 * the CMS, plug in here when they exist.
 */
export function layoutOptions(summary, seed) {
    const entries = Array.isArray(summary) ? summary : (summary?.entries || []);
    return {
        seed,
        mat: shippedMat(),
        crowding: shippedCrowding(),
        artRadius: artRadiusOf,
        allows: cannotCheck(entries.map(e => e.typeId))
    };
}

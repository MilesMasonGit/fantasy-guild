// Fantasy Guild — Board presentation constants (UI-only).

/**
 * What is left here is presentation: offsets and hit boxes that only React
 * draws with, and the pointer-to-tile snapping the drag layer uses.
 *
 * The board's actual geometry — its size, tile count, Guild Hall tile, tile
 * metrics and footprint maths — lives in `src/config/boardGeometry.js`, because
 * the board engine in `src/systems/board/` depends on it and must not import
 * out of the UI tree (CR2-051). Import geometry from there, not from here;
 * this file deliberately does not re-export it.
 */

import { ALERT } from '../../../systems/board/boardEvents.js';

/**
 * How far the hero and the Token slide apart on a staffed tile (D-266).
 *
 * A hero and the Token they work are **both drawn at full `TILE_PX`**, then
 * pushed in opposite directions — hero left, Token right — so each is 24px off
 * centre and 48px apart. They still overlap across 80 of their 128 pixels, which
 * is the point: two readable silhouettes that are plainly one stacked unit.
 */
export const PAIR_OFFSET_PX = 24;

/**
 * The hero's clickable box — narrower than the art it draws.
 */
export const HERO_HIT_PX = 64;

/**
 * What the red mark means, in the player's words (D-114).
 *
 * Hovering a tile whose Token cannot work states exactly what is wrong. There
 * is no aggregate supply dashboard, so diagnosis happens tile by tile, and this
 * table is the whole of it. Two surfaces read it: the tile's own `title`
 * (`BoardTile`) and the hover panel under the alert bar (`TileProgressBar`).
 *
 * Keyed off the engine's exported `ALERT` so the two vocabularies cannot drift.
 * That now includes `UNSTOCKED`, which `Managers` publishes (CR2-060); it used
 * to be the one alert spelled out as a bare string in three separate files.
 */
export const ALERT_HINT = {
    [ALERT.INPUTS]: 'Waiting for materials — nothing in the Bank or on the board',
    [ALERT.ACCESS]: 'This hero’s skill is too low to work this Token',
    [ALERT.UNSKILLED]: 'This hero doesn’t have the skill for this work — levelling won’t help',
    [ALERT.NO_RECIPE]: 'This station is missing a Token its recipe needs beside it',
    [ALERT.CHARGES]: 'Not enough charges left here to run a full cycle',
    [ALERT.UNSTOCKED]: 'This tile ran dry and the Vault has no replacement — restock it'
};

/**
 * Why a flag passed a Token over, as the tail of one hover line —
 * "Iron Forge — needs materials" (Free Playmat slice 1.5, FP-48, FP-60).
 *
 * Keyed by every reason `Flags` can record: its own `SKIP` values plus the
 * `ALERT` values `WorkCheck` and promotion return. `FlagUI.test.js` derives
 * that list from the engine, so a new reason without a sentence fails. Short
 * forms of `ALERT_HINT`'s wording, because up to five of these stack in one
 * tooltip.
 */
export const SKIP_HINT = {
    [ALERT.INPUTS]: 'needs materials',
    [ALERT.ACCESS]: 'skill too low',
    [ALERT.UNSKILLED]: 'doesn’t have the skill',
    [ALERT.NO_RECIPE]: 'missing a Token its recipe needs beside it',
    [ALERT.CHARGES]: 'not enough charges for a cycle',
    [ALERT.UNSTOCKED]: 'ran dry, nothing in the Vault',
    no_skill: 'names no skill',
    disallowed: 'heroes not allowed',
    claimed: 'being worked by {holder}',
    same_job: 'already holds this job',
    rule_off: 'off in {hero}’s rules'
};

/**
 * One skip as a sentence tail. `holder` names the hero who has a `claimed`
 * Token; without one it reads "another hero". `hero` names the hero whose
 * rules switched it off (`rule_off`, FPP-18); without one, "the hero".
 */
export function skipHint(reason, { holder = null, hero = null } = {}) {
    const text = SKIP_HINT[reason] || 'can’t work it';
    return text.replace('{holder}', holder || 'another hero').replace('{hero}', hero || 'the hero');
}

/** The two-word label printed on the alert bar itself. The sentence is in `ALERT_HINT`. */
export const ALERT_LABEL = {
    [ALERT.INPUTS]: 'Need Items',
    [ALERT.ACCESS]: 'Level Too Low',
    [ALERT.UNSKILLED]: 'Wrong Skill',
    [ALERT.NO_RECIPE]: 'Need Tokens',
    [ALERT.CHARGES]: 'Need Charges',
    [ALERT.UNSTOCKED]: 'Restock'
};

/** Alerts drawn in warning yellow; every other alert is drawn in red. */
const YELLOW_ALERTS = [ALERT.INPUTS];

/** The bar's fill class for an alert value. */
export const alertFillClass = (alert) =>
    YELLOW_ALERTS.includes(alert) ? 'progress-fill--yellow-chroma' : 'progress-fill--red-chroma';

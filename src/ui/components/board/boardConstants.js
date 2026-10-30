
/**
 * Presentation constants: offsets and hit boxes that only React draws with. The mat's actual
 * geometry (its size in mat units, Token art radii and the clamp onto it) lives in
 * `src/config/matGeometry.js`, because the board engine in `src/systems/board/` depends on it
 * and must not import out of the UI tree. Import geometry from there, not from here; this file
 * deliberately does not re-export it.
 */

/**
 * The height of the columns flanking the playmat.
 * ⚠️ A layout number, not a board measurement: it is stated plainly rather than derived from
 * the mat, which is 1040 u tall and would silently change every column's height. Each of these
 * columns is also capped to `maxHeight: 100%`, so on a short window they shrink with the mat
 * rather than hanging off the bottom.
 */
export const SIDE_COLUMN_PX = 928;

/**
 * The flanking columns give way before the mat does.
 * Each column's width is a `clamp()`: its full width on a wide window, shrinking with the
 * viewport, and stopping at a floor set by what is actually inside it. The mat is their flex
 * sibling with `flex-1 min-w-0`, so without this it absorbed every pixel of a narrow window on
 * its own and fitted at a tiny scale.
 * - **The hero column** (`NOTIFICATION_COLUMN`, named for the notifications it once held): the
 * hero panel and the Guild Hall's inspection take it while the Bank or the Hall is open; the
 * playmat itself has no notification column. 256 keeps their contents from overflowing.
 * - **The hero dock** is already only `w-20` (80px) and its inspection sheet is absolutely
 * positioned, so it is left alone.
 * ⚠️ This never lets the mat reach under a column: the mat is fitted to its own cell's
 * measured `clientWidth/Height` and the cell is `overflow-hidden`, so the columns' width is an
 * input to the fit, not something the mat can overrun. That matters because a drop surface
 * that outranks the board's where the two overlap would silently take drops meant for the
 * board.
 */
export const NOTIFICATION_COLUMN = Object.freeze({ min: 256, vw: 20, max: 356 });

/**
 * What a column spec is worth at a given viewport width, in pixels. The pure form of the
 * `clamp()` below, so the rule can be tested without a layout engine. Both are built from the
 * same spec, so they cannot drift.
 */
export const columnWidthAt = (viewportPx, spec) =>
    Math.max(spec.min, Math.min(spec.max, Math.round((viewportPx * spec.vw) / 100)));

export const columnWidthCss = (spec) => `clamp(${spec.min}px, ${spec.vw}vw, ${spec.max}px)`;

import { ALERT } from '../../../systems/board/boardEvents.js';


/** The hero's clickable box, narrower than the art it draws. */
export const HERO_HIT_PX = 64;

/** The hero's box height: the 64 px art at 2×, centred on the hero's point. */
export const HERO_BOX_PX = 128;

/**
 * The gap, in mat units, between a Token's own edge and its progress bar: the bar hangs just
 * under the Token, at the Token's own width. It is the ring row's gap below the lower of the
 * Token and its hero's feet (`ringRow.js`).
 */
export const TOKEN_BAR_GAP_U = 8;

/**
 * Why a flag passed a Token over, as the tail of one hover line, e.g. 'Iron Forge — needs
 * materials'.
 * Keyed by every reason `Flags` can record: its own `SKIP` values plus the `ALERT` values
 * `WorkCheck` and promotion return. `FlagUI.test.js` derives that list from the engine, so a
 * new reason without a sentence fails. Kept short, because up to five of these stack in one
 * tooltip.
 */
export const SKIP_HINT = {
    [ALERT.INPUTS]: 'needs materials',
    [ALERT.ACCESS]: 'skill too low',
    [ALERT.UNSKILLED]: 'doesn’t have the skill',
    [ALERT.NO_TOOL]: 'needs {tool} in hand',
    [ALERT.NO_RECIPE]: 'missing a Token its recipe needs beside it',
    [ALERT.CHARGES]: 'not enough charges for a cycle',
    [ALERT.CHOOSE_BUILD]: 'nothing chosen to build',
    [ALERT.CHOOSE_RECIPE]: 'no recipe chosen',
    [ALERT.NO_ROOM]: 'no room for what it makes',
    [ALERT.SPAWN_NEEDS_ITEM]: 'can’t pay its upkeep',
    [ALERT.SPAWN_NO_ROOM]: 'no room to spawn',
    [ALERT.SPAWN_MAT_FULL]: 'Token cap full',
    [ALERT.RESTING]: 'resting, it comes back soon',
    [ALERT.GROWING]: 'its crop is growing',
    // A growing Token's own waits (a Stump; a Field stopped for want of a seed records the second).
    [ALERT.GROW_NEEDS_NEARBY]: 'waiting for what it needs nearby to grow',
    [ALERT.GROW_NEEDS_ITEM]: 'stopped: can’t pay to grow',
    no_skill: 'names no skill',
    disallowed: 'heroes not allowed',
    claimed: 'being worked by {holder}',
    // `claimed` said of an enemy: every fight is one-on-one, so the hero waits for it.
    claimed_fight: '{holder} is fighting it',
    same_job: 'already holds this job'
};

/**
 * One skip as a sentence tail. `holder` names the hero who has a `claimed` Token; without one
 * it reads 'another hero'. `tool` names the tool a `no_tool` skip wants, with its article
 * ('a Pickaxe'); without one, 'a tool'.
 */
export function skipHint(reason, { holder = null, tool = null } = {}) {
    const text = SKIP_HINT[reason] || 'can’t work it';
    return text.replace('{holder}', holder || 'another hero').replace('{tool}', tool || 'a tool');
}

/** Alerts drawn in warning yellow; every other alert is drawn in red. */
const YELLOW_ALERTS = [ALERT.INPUTS, ALERT.SPAWN_NEEDS_ITEM];

/** Whether an alert is drawn in warning yellow rather than red. */
export const isYellowAlert = (alert) => YELLOW_ALERTS.includes(alert);

/** The bar's fill class for an alert value. */
export const alertFillClass = (alert) =>
    isYellowAlert(alert) ? 'progress-fill--yellow-chroma' : 'progress-fill--red-chroma';

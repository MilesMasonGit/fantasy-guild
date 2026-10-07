
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
 * the mat, which is 1126 u tall and would silently change every column's height. Each of these
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
 * - **Notifications**: `Toast` carries `min-w-[220px]`, and the column's `pl-8` gutter is
 * inside its border-box, so below ~252px the toasts overflow their own column. 256 leaves a
 * little air.
 * - **Effects panel** (`TRAY_COLUMN`): 244 keeps a comfortable margin around its contents.
 * - **The hero dock** is already only `w-20` (80px) and its inspection sheet is absolutely
 * positioned, so it is left alone.
 * ⚠️ This never lets the mat reach under a column: the mat is fitted to its own cell's
 * measured `clientWidth/Height` and the cell is `overflow-hidden`, so the columns' width is an
 * input to the fit, not something the mat can overrun. That matters because a drop surface
 * that outranks the board's where the two overlap would silently take drops meant for the
 * board.
 */
export const NOTIFICATION_COLUMN = Object.freeze({ min: 256, vw: 20, max: 356 });
export const TRAY_COLUMN = Object.freeze({ min: 244, vw: 19, max: 340 });

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

/**
 * The gap, in mat units, between a Token's own edge and its progress bar: the bar hangs just
 * under the Token, at the Token's own width. It is the ring row's gap below the lower of the
 * Token and its hero's feet (`ringRow.js`).
 */
export const TOKEN_BAR_GAP_U = 8;

/**
 * What the red mark means, in the player's words. Hovering a Token that cannot work states
 * exactly what is wrong; there is no aggregate supply dashboard, so diagnosis happens Token by
 * Token and this table is the whole of it. It is read by the hover bubble of a Token's centre
 * mark (`TokenCentreAlert`). Keyed off the engine's exported `ALERT` so the two vocabularies
 * cannot drift.
 */
export const ALERT_HINT = {
    [ALERT.INPUTS]: 'Waiting for materials — nothing in the Bank or on the board',
    [ALERT.ACCESS]: 'This hero’s skill is too low to work this Token',
    [ALERT.UNSKILLED]: 'This hero doesn’t have the skill for this work — levelling won’t help',
    [ALERT.NO_RECIPE]: 'This station is missing a Token its recipe needs beside it',
    [ALERT.CHARGES]: 'Not enough charges left here to run a full cycle',
    [ALERT.CHOOSE_BUILD]: 'Choose what to build on this Foundation',
    [ALERT.CHOOSE_RECIPE]: 'Choose a recipe for this station',
    [ALERT.NO_ROOM]: 'No room on the mat for what this makes — clear some space around it, or remove a placed Token if the mat is full',
    [ALERT.SPAWN_NEEDS_ITEM]: 'This spawner can’t pay its upkeep — put the item in the Bank',
    [ALERT.SPAWN_NO_ROOM]: 'Nowhere free for this spawner’s next Token — clear some space around it'
};

/**
 * Why a flag passed a Token over, as the tail of one hover line, e.g. 'Iron Forge — needs
 * materials'.
 * Keyed by every reason `Flags` can record: its own `SKIP` values plus the `ALERT` values
 * `WorkCheck` and promotion return. `FlagUI.test.js` derives that list from the engine, so a
 * new reason without a sentence fails. Short forms of `ALERT_HINT`'s wording, because up to
 * five of these stack in one tooltip.
 */
export const SKIP_HINT = {
    [ALERT.INPUTS]: 'needs materials',
    [ALERT.ACCESS]: 'skill too low',
    [ALERT.UNSKILLED]: 'doesn’t have the skill',
    [ALERT.NO_RECIPE]: 'missing a Token its recipe needs beside it',
    [ALERT.CHARGES]: 'not enough charges for a cycle',
    [ALERT.CHOOSE_BUILD]: 'nothing chosen to build',
    [ALERT.CHOOSE_RECIPE]: 'no recipe chosen',
    [ALERT.NO_ROOM]: 'no room for what it makes',
    [ALERT.SPAWN_NEEDS_ITEM]: 'can’t pay its upkeep',
    [ALERT.SPAWN_NO_ROOM]: 'no room to spawn',
    no_skill: 'names no skill',
    disallowed: 'heroes not allowed',
    claimed: 'being worked by {holder}',
    same_job: 'already holds this job',
    rule_off: 'off in {hero}’s rules'
};

/**
 * One skip as a sentence tail. `holder` names the hero who has a `claimed` Token; without one
 * it reads 'another hero'. `hero` names the hero whose rules switched it off (`rule_off`);
 * without one, 'the hero'.
 */
export function skipHint(reason, { holder = null, hero = null } = {}) {
    const text = SKIP_HINT[reason] || 'can’t work it';
    return text.replace('{holder}', holder || 'another hero').replace('{hero}', hero || 'the hero');
}

/**
 * The two-word label for an alert: the heading of a worked Token's centre-mark bubble. The
 * sentence is in `ALERT_HINT`.
 */
export const ALERT_LABEL = {
    [ALERT.INPUTS]: 'Need Items',
    [ALERT.ACCESS]: 'Level Too Low',
    [ALERT.UNSKILLED]: 'Wrong Skill',
    [ALERT.NO_RECIPE]: 'Need Tokens',
    [ALERT.CHARGES]: 'Need Charges',
    [ALERT.CHOOSE_BUILD]: 'Choose Build',
    [ALERT.CHOOSE_RECIPE]: 'Choose Recipe',
    [ALERT.NO_ROOM]: 'No Room',
    [ALERT.SPAWN_NEEDS_ITEM]: 'Need Items',
    [ALERT.SPAWN_NO_ROOM]: 'No Room'
};

/** Alerts drawn in warning yellow; every other alert is drawn in red. */
const YELLOW_ALERTS = [ALERT.INPUTS, ALERT.SPAWN_NEEDS_ITEM];

/** Whether an alert is drawn in warning yellow rather than red. */
export const isYellowAlert = (alert) => YELLOW_ALERTS.includes(alert);

/** The bar's fill class for an alert value. */
export const alertFillClass = (alert) =>
    isYellowAlert(alert) ? 'progress-fill--yellow-chroma' : 'progress-fill--red-chroma';

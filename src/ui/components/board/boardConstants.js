// Fantasy Guild — Board presentation constants (UI-only).

/**
 * What is left here is presentation: offsets and hit boxes that only React
 * draws with, and the pointer-to-tile snapping the drag layer uses.
 *
 * The mat's actual geometry — its size in mat units, Token art radii and the
 * clamp onto it — lives in `src/config/matGeometry.js`, because the board engine
 * in `src/systems/board/` depends on it and must not import out of the UI tree
 * (CR2-051). Import geometry from there, not from here; this file deliberately
 * does not re-export it.
 */

/**
 * The height of the columns flanking the playmat — the Tray, the Hero Dock, the
 * Guild Hall effects panel and the left-hand rules column.
 *
 * ⚠️ **A layout number, not a board measurement** (Free Playmat slice 1.6d-2).
 * It used to be `BOARD_PX`, the old 6×6 grid's 928px width, which is why these
 * columns are this tall and not some other height. The grid is gone, so the
 * number is now stated plainly here rather than being derived from a board that
 * no longer exists — the mat is 1126 u tall and using *that* would silently
 * change every column's height.
 *
 * Each of these columns is also capped to `maxHeight: 100%`, so on a short
 * window they shrink with the mat rather than hanging off the bottom (CR2-179).
 */
export const SIDE_COLUMN_PX = 928;

/**
 * ## ⭐ The flanking columns give way before the mat does (FP-100)
 *
 * The three columns beside the mat — notifications, the Tray, the hero dock —
 * used to take a **fixed** width at each breakpoint (356 / 320 / 80 px at `xl`)
 * and were `shrink-0` besides. The mat is their flex sibling with `flex-1
 * min-w-0`, so it absorbed every pixel of a narrow window on its own: at 1280 it
 * was left a few hundred pixels for a 1760 u mat and fitted at about 0.21, and
 * in a narrow pane it hit the 0.1 floor entirely. `useBoardScale`'s own comment
 * already named the intended answer — *"win the board more room by shrinking the
 * columns beside it rather than by refusing to shrink the board"*.
 *
 * So each column's width is now a `clamp()`: its full width on a wide window,
 * shrinking with the viewport, and stopping at a floor set by **what is actually
 * inside it**, not by taste:
 *
 * * **Notifications** — `Toast` carries `min-w-[220px]`, and the column's `pl-8`
 *   gutter is inside its border-box, so below ~252px the toasts overflow their
 *   own column. 256 leaves a little air.
 * * **Tray** — the gold Vault chest is a fixed 128px and tray sprites are a
 *   fixed 128/64 (`trayTokenPx`), so its hard floor is ~180px once the border
 *   and gutter are counted. 244 keeps a comfortable margin around the chest.
 * * **The hero dock** is already only `w-20` (80px) and its inspection sheet is
 *   absolutely positioned, so it costs the mat nothing worth reclaiming and is
 *   left alone.
 *
 * ⚠️ **This never lets the mat reach under a column.** It cannot: the mat is
 * fitted to its own cell's measured `clientWidth/Height` and the cell is
 * `overflow-hidden`, so the columns' width is an input to the fit, not something
 * the mat can overrun. Widening the mat's share only ever *raises* the fit. That
 * matters because the Tray's drop surface outranks the board's where the two
 * overlap, so a mat wider than its box would silently feed drops to the Vault
 * chest (CR2-179).
 *
 * Slice 1.9 retires the Tray and hands most of this space back for good, which
 * is why this is a pair of numbers rather than a layout system.
 */
export const NOTIFICATION_COLUMN = Object.freeze({ min: 256, vw: 20, max: 356 });
export const TRAY_COLUMN = Object.freeze({ min: 244, vw: 19, max: 340 });

/**
 * What a column spec is worth at a given viewport width, in pixels.
 *
 * The pure form of the `clamp()` below, so the rule can be tested without a
 * layout engine. Both are built from the same spec, so they cannot drift.
 */
export const columnWidthAt = (viewportPx, spec) =>
    Math.max(spec.min, Math.min(spec.max, Math.round((viewportPx * spec.vw) / 100)));

/** The same spec as the CSS the column is actually given. */
export const columnWidthCss = (spec) => `clamp(${spec.min}px, ${spec.vw}vw, ${spec.max}px)`;

import { ALERT } from '../../../systems/board/boardEvents.js';


/**
 * The hero's clickable box — narrower than the art it draws.
 */
export const HERO_HIT_PX = 64;

/**
 * The gap, in mat units, between a Token's own edge and its progress bar
 * (TPP-3, Token work presentation). The bar used to hug the Token's bottom
 * edge — a leftover from the grid, where nothing was drawn below a tile. Since
 * Hero Movement (HM-2) that space is empty, so the bar hangs just under the
 * Token instead, at the Token's own width (TP-4).
 */
export const TOKEN_BAR_GAP_U = 8;

/**
 * What the red mark means, in the player's words (D-114).
 *
 * Hovering a tile whose Token cannot work states exactly what is wrong. There
 * is no aggregate supply dashboard, so diagnosis happens tile by tile, and this
 * table is the whole of it. Two surfaces read it: the tile's own `title`
 * (`BoardTile`) and the hover panel under the alert bar (`TileProgressBar`).
 *
 * Keyed off the engine's exported `ALERT` so the two vocabularies cannot drift.
 */
export const ALERT_HINT = {
    [ALERT.INPUTS]: 'Waiting for materials — nothing in the Bank or on the board',
    [ALERT.ACCESS]: 'This hero’s skill is too low to work this Token',
    [ALERT.UNSKILLED]: 'This hero doesn’t have the skill for this work — levelling won’t help',
    [ALERT.NO_RECIPE]: 'This station is missing a Token its recipe needs beside it',
    [ALERT.CHARGES]: 'Not enough charges left here to run a full cycle',
    [ALERT.CHOOSE_BUILD]: 'Choose what to build on this Foundation',
    [ALERT.NO_ROOM]: 'No room on the mat for what this makes — clear some space around it, or remove a placed Token if the mat is full',
    [ALERT.SPAWN_NEEDS_ITEM]: 'This spawner can’t pay its upkeep — put the item in the Bank',
    [ALERT.SPAWN_NO_ROOM]: 'Nowhere free for this spawner’s next Token — clear some space around it'
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
    [ALERT.CHOOSE_BUILD]: 'nothing chosen to build',
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
    [ALERT.CHOOSE_BUILD]: 'Choose Build',
    [ALERT.NO_ROOM]: 'No Room',
    [ALERT.SPAWN_NEEDS_ITEM]: 'Need Items',
    [ALERT.SPAWN_NO_ROOM]: 'No Room'
};

/** Alerts drawn in warning yellow; every other alert is drawn in red. */
const YELLOW_ALERTS = [ALERT.INPUTS, ALERT.SPAWN_NEEDS_ITEM];

/** The bar's fill class for an alert value. */
export const alertFillClass = (alert) =>
    YELLOW_ALERTS.includes(alert) ? 'progress-fill--yellow-chroma' : 'progress-fill--red-chroma';

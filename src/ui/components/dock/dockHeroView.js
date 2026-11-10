
import { ART_PX } from '../../../config/matGeometry.js';
import { boardArtSteps } from '../base/TokenSprite.jsx';
import { PROBLEM_MARK_ART_PX } from '../board/problemMark.js';

/**
 * The horizontal hero dock is a strip under the mat with the heroes standing in it. Each hero is drawn
 * at the mat's own art size, idling, with the strip's bottom edge cutting them off at the
 * waist: only the top half of the sprite frame shows. Name and health bar float above the
 * head. Everything here is plain numbers and predicates so the tests can pin them without
 * rendering anything.
 */

/** The strip's height in screen px. Fixed: a height that followed the art size would change the mat's fit and could oscillate. */
export const DOCK_STRIP_PX = 64;

/**
 * A hero's slot at full width, and the narrowest it shrinks to on a small window. This is the
 * bar's spacing: change it here to spread the heroes. Sized so eight heroes (the owner's planned
 * roster cap) fit the bar at the usual window width (at most 175), each with room for a level-up
 * bubble that never reaches a neighbour.
 * ⚠️ Spacing is the slot's width, not a gap between slots: every pixel of the row stays a hero
 * to drop on, so a reorder never lands in a dead strip.
 */
export const DOCK_SLOT_PX = 160;
export const DOCK_SLOT_MIN_PX = 56;

/** The size of a hero's name on the bar: one of the kit's text sizes (UI_STYLE, "Text sizes"). */
export const DOCK_NAME_TEXT_CLASS = 'ui-text-title';

/** Gap between the top of the sprite frame and the bottom of the name/HP block. */
export const DOCK_LABEL_GAP_PX = 2;

/** The name and HP bar's height plus a small gap, so a bubble's tail stops clear of them. */
export const DOCK_LABEL_PX = 46;

/**
 * How far the names and HP bars stand above the strip's top edge, in screen px: what a panel
 * rising from behind the bar (the Shop) keeps clear at its foot.
 */
export function dockLabelOverhangPx(artPx) {
    return Math.max(0, artPx / 2 + DOCK_LABEL_GAP_PX + DOCK_LABEL_PX - DOCK_STRIP_PX);
}

/**
 * The hero's art size in screen px: the same whole multiple of `ART_PX` the mat lands its
 * heroes on at this fit (`boardArtSteps`), so a hero in the dock is exactly as big as the same
 * hero standing on the mat.
 */
export function dockArtPx(fit = 1) {
    // Never below two whole steps (128 px): at a small mat fit the heroes shrank to 64 px and
    // only a 32 px sliver of each head showed above the strip's edge. Heroes are shown full
    // size.
    return ART_PX * Math.max(2, boardArtSteps(fit));
}

/**
 * How far the art sits below its resting place, in screen px (positive = down): 0, lifted by
 * `lift` while hovered. The name and HP bar never use this: they stay at one height for every
 * hero. Every hero is on the mat, so none sinks or darkens.
 */
export function dockArtOffset(artPx, { hovered = false } = {}) {
    const lift = Math.round(artPx * 0.08);
    return hovered ? -lift : 0;
}

/** The hero's job flag on the roster, in screen px: the mat's flag at its usual size. */
export const ROSTER_FLAG_PX = 24;

/**
 * Where the hero's flag stands on the roster: at the shoulder on the hero's left (the box's right
 * edge 12 % of the art left of the hero's middle, its top 4 % of the art below the top of the
 * sprite frame), so it sits beside the head and below the name and HP bar.
 * `left` is from the slot's middle, `bottom` from the strip's bottom edge; both in screen px.
 */
export function rosterFlagPlace(artPx) {
    return {
        left: -Math.round(artPx * 0.12) - ROSTER_FLAG_PX,
        bottom: Math.round(artPx / 2 - artPx * 0.04 - ROSTER_FLAG_PX)
    };
}

/** The alert sprite's art size, at the hero's art-pixel size like the mat's marks: 32 px at 128. */
export const rosterAlertPx = (artPx) => Math.round((PROBLEM_MARK_ART_PX * artPx) / ART_PX);

/** Where a hero's alert stands: the other shoulder, mirroring the flag. Same units as the flag. */
export function rosterAlertPlace(artPx) {
    return {
        left: Math.round(artPx * 0.12),
        bottom: Math.round(artPx / 2 - artPx * 0.04 - rosterAlertPx(artPx))
    };
}

/** HP as a whole percent, 0–100. */
export function hpPercent(hp) {
    const cur = Math.max(0, Number(hp?.current) || 0);
    const max = Math.max(1, Number(hp?.max) || 100);
    return Math.min(100, Math.round((cur / max) * 100));
}

/** The HP bar's tone: green above half, amber above a fifth, red at or below it. */
export function hpTone(percent) {
    if (percent > 50) return 'green';
    if (percent > 20) return 'amber';
    return 'red';
}

/** The hero's HP bar on the roster: wide enough for its numbers, never wider than a narrow slot. */
export const DOCK_HP_BAR_PX = 88;
export const DOCK_HP_BAR_HEIGHT_PX = 14;


import { ART_PX } from '../../../config/matGeometry.js';
import { boardArtSteps } from '../base/TokenSprite.jsx';

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
 * A hero's slot at full width, and the narrowest it shrinks to on a small window. Sized so
 * eight heroes (the owner's planned roster cap) fit the bar at the usual window width, each with room
 * for a level-up bubble that never reaches a neighbour.
 */
export const DOCK_SLOT_PX = 144;
export const DOCK_SLOT_MIN_PX = 56;

/** Gap between the top of the sprite frame and the bottom of the name/HP block. */
export const DOCK_LABEL_GAP_PX = 2;

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

/**
 * The roster's state word's colour (UI_STYLE meanings): idle in gold, for attention (spotting idle
 * heroes is what a returning player does first); hurt in red; busy in the muted grey.
 */
export const ROSTER_STATE_CLASS = Object.freeze({
    idle: 'text-ui-gold',
    hurt: 'text-ui-red',
    busy: 'text-ui-muted'
});

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

/** Tailwind fill for each tone. */
export const HP_TONE_CLASS = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500 animate-pulse'
};

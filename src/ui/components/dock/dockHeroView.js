
import { ART_PX } from '../../../config/matGeometry.js';
import { boardArtSteps } from '../base/TokenSprite.jsx';

/**
 * The horizontal hero dock is a dark strip with the heroes standing in it. Each hero is drawn
 * at the mat's own art size, idling, with the strip's bottom edge cutting them off at the
 * waist: only the top half of the sprite frame shows. Name and health bar float above the
 * head. Everything here is plain numbers and predicates so the tests can pin them without
 * rendering anything.
 */

/** The strip's height in screen px. Fixed: a height that followed the art size would change the mat's fit and could oscillate. */
export const DOCK_STRIP_PX = 64;

/** A hero's slot at full width, and the narrowest it shrinks to on a small window. */
export const DOCK_SLOT_PX = 88;
export const DOCK_SLOT_MIN_PX = 48;

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
 * Whether a hero counts as **out on the mat**: anything but `docked` in `Flags.statusOf`, i.e.
 * a flag planted (working, walking, idle at it) or the figure still walking home
 * (`returning`). The same test `MatBoard` uses to decide which heroes it draws.
 */
export function isDeployedStatus(state) {
    return !!state && state !== 'docked';
}

/**
 * How far the art sits below its resting place, in screen px (positive = down). The name and
 * HP bar never use this: they stay at one height for every hero.
 * - in the dock: 0; hovered: lifted by `lift`.
 * - deployed: sunk by `sink`; hovered: rises partway, to half the sink.
 */
export function dockArtOffset(artPx, { deployed = false, hovered = false } = {}) {
    const sink = Math.round(artPx * 0.2);
    const lift = Math.round(artPx * 0.08);
    if (deployed) return hovered ? Math.round(sink / 2) : sink;
    return hovered ? -lift : 0;
}

/** The CSS filter on the art: deployed heroes are darkened, less so while hovered. */
export function dockArtFilter({ deployed = false, hovered = false } = {}) {
    if (!deployed) return undefined;
    return hovered ? 'brightness(0.7)' : 'brightness(0.4)';
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

/** Tailwind fill for each tone. */
export const HP_TONE_CLASS = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500 animate-pulse'
};

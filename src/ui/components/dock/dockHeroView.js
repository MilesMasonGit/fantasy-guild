
/**
 * The horizontal hero bar is a strip under the mat: each hero a portrait and a name. Everything
 * here is plain numbers and predicates so the tests can pin them without rendering anything.
 */

/** The strip's height in screen px. Fixed: a height that followed anything else would change the mat's fit and could oscillate. */
export const DOCK_STRIP_PX = 64;

/**
 * A hero's slot at full width, and the narrowest it shrinks to on a small window. Sized so
 * eight heroes (the owner's planned roster cap) fit the bar at the usual window width, each with room
 * for a level-up bubble that never reaches a neighbour.
 */
export const DOCK_SLOT_PX = 144;
export const DOCK_SLOT_MIN_PX = 56;

/**
 * Whether a hero counts as **out on the mat**: anything but `docked` in `Flags.statusOf`, i.e.
 * a flag planted (working, walking, idle at it) or the figure still walking home
 * (`returning`). The same test `MatBoard` uses to decide which heroes it draws.
 */
export function isDeployedStatus(state) {
    return !!state && state !== 'docked';
}

/** The hover outline (UI_STYLE "Colours"): one art pixel of white around the portrait, at its 2x. */
const HOVER_OUTLINE = 'drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff)';

/** The CSS filter on the portrait: deployed heroes are darkened, less so while hovered; hover outlines it. */
export function dockArtFilter({ deployed = false, hovered = false } = {}) {
    if (hovered) return deployed ? `brightness(0.7) ${HOVER_OUTLINE}` : HOVER_OUTLINE;
    return deployed ? 'brightness(0.4)' : undefined;
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

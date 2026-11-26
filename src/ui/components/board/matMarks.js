import * as BoardState from '../../../systems/board/BoardState.js';
import * as Shrines from '../../../systems/board/Shrines.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { STAND_GAP } from '../../../systems/board/HeroMotion.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt, boardArtSteps } from '../base/TokenSprite.jsx';

/**
 * The marks under a worked Token, with no React: its progress bar and the time one cycle takes
 * (`WorkBarLayer` draws them), where they stand, and the mat's UI pixel the marks off the art are
 * measured in. A worked Token shows nothing else under it: its problem is its centred '!', and
 * its charges, skill and timers are on its card (docs/active/concept_playmat_declutter.md §15).
 */

/**
 * Mat units for one plate pixel at a mat fit: the mat's UI pixel (health bars, the fight button,
 * speech, the bar's time), whole screen pixels, half the art's steps, never below one (a 1× mat
 * keeps them at their 2× size).
 */
export function plateUnit(fit = 1) {
    const f = Number.isFinite(fit) && fit > 0 ? fit : 1;
    return Math.max(1, Math.floor(boardArtSteps(f) / 2)) / f;
}

/**
 * The bar in the Token's art pixels: `W` × `H` inside a one-art-pixel black outline, with a hard
 * black shadow one art pixel down-right, on the see-through dark strip the names wear (`PAD_X`,
 * `PAD_Y` round it, `GAP` before the time). It fills in whole art-pixel steps, one per art pixel
 * of `W`.
 */
export const BAR = Object.freeze({
    W: 24,
    H: 4,
    OUTLINE: 1,
    PAD_X: 3,
    PAD_Y: 2,
    GAP: 3,
    /** How far below the name's foot line the strip's top stands. */
    DROP: 2
});

/** How tall the strip is, in art pixels: the bar, its outline and shadow, and the padding. */
export const BAR_STRIP_ART = BAR.H + 2 * BAR.OUTLINE + 1 + 2 * BAR.PAD_Y;

/** How far the marks under the art tuck up under its foot (the art's last rows are its shadow), in plate pixels. */
const TUCK = 2;

/** The art the marks stand under: the Token's. */
function artOf(typeId, fit) {
    return tokenSizeFor(TOKEN_SURFACE.BOARD, typeId, boardScaleAt(fit));
}

/**
 * How far below a Token's point its name's foot stands, in mat units: tucked under the art's
 * foot, so the name reads over the art's bottom edge and the bar hangs just under it.
 */
export function nameFootOf(typeId, fit = 1) {
    return artOf(typeId, fit) / 2 - TUCK * plateUnit(fit);
}

/** The strip's height in mat units. */
export const barStripH = (fit = 1) => BAR_STRIP_ART * boardScaleAt(fit);

/**
 * Where Token `typeId`'s bar stands, in mat units: a slot `width` wide centred on the seam between
 * the Token and its hero (`side` −1/1; 0 centres it on the Token), its top just under the name's
 * foot. Too near the mat's foot to fit, it goes over their heads instead. On whole screen pixels,
 * so the bar's art pixels and the pixel font stay sharp.
 * @returns {{left: number, top: number, width: number}}
 */
export function barPlace({ x, y, typeId, side = 1, fit = 1, matH = Infinity, width = 160 }) {
    const art = boardScaleAt(fit);
    const toward = side === 0 ? 0 : side === -1 ? -1 : 1;
    const seam = x + toward * (artRadiusOf(typeId) + STAND_GAP) / 2;
    const height = barStripH(fit);
    let top = y + nameFootOf(typeId, fit) + BAR.DROP * art;
    if (top + height > matH) top = y - artOf(typeId, fit) / 2 - height;
    const snap = (v) => Math.round(v * fit) / fit;
    return { left: snap(seam - width / 2), top: snap(top), width };
}

/**
 * How much further down a hero's name below them goes while their Token's bar shows, in mat
 * units: past the strip.
 */
export function barNameDrop(fit = 1) {
    return barStripH(fit) + BAR.DROP * boardScaleAt(fit);
}

/** The time one cycle takes, as the bar says it: `3.0s`, `12.5s`; null with no cycle known. */
export function cycleText(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * What Token `id`'s bar needs, as a flat projection (`useTokenState`'s contract), or null while no
 * hero has reached it. `blocked`: any engine alert on a worked Token stops its cycle, and the bar
 * holds there, grey.
 * @returns {{typeId: string, heroId: string, side: number, blocked: boolean}|null}
 */
export function workBarOf(id) {
    const instance = BoardState.getTokenById(id);
    const heroId = instance ? BoardState.workerOf(id) : null;
    if (!heroId) return null;
    return {
        typeId: instance.typeId,
        heroId,
        side: BoardState.heroBodyOf(heroId)?.side === -1 ? -1 : 1,
        blocked: !!instance.alert
    };
}

/** Whether Token type `typeId` is a shrine: its bar on the mat is its lit time, not a cycle's. */
export function isShrineType(typeId) {
    return Shrines.isShrine(getTokenType(typeId));
}

/**
 * What a shrine's lit bar needs, as a flat projection (`useTokenState`'s contract), or null when it
 * is out and nobody tends it, or is no shrine. `litMs` is as the engine last said it; the bar runs it
 * down from there.
 * @returns {{typeId: string, heroId: string|null, side: number, litMs: number, maxLitMs: number}|null}
 */
export function shrineBarOf(id) {
    const instance = BoardState.getTokenById(id);
    const state = instance ? Shrines.shrineState(instance) : null;
    if (!state) return null;
    const heroId = BoardState.workerOf(id) || null;
    if (!state.lit && !heroId) return null;
    return {
        typeId: instance.typeId,
        heroId,
        side: heroId ? (BoardState.heroBodyOf(heroId)?.side === -1 ? -1 : 1) : 0,
        litMs: state.litMs,
        maxLitMs: state.maxLitMs
    };
}

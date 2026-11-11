import { useSyncExternalStore } from 'react';
import { LIMES_TEXT } from '../../../systems/quests/limesText.js';

/**
 * What Limes is saying, as a small module store (the UI's own: the engine never reads it).
 * Two conversations can be open at once:
 * - **talk**: the player clicked Limes on the mat. Next steps through `LIMES_TEXT.talk`; Close
 *   closes it.
 * - **step**: something opened Limes's bubble by itself (a lesson step, `openLimesStep`). It stays
 *   until `closeLimesStep`; the player can only collapse it to a small "…" bubble, and a click
 *   opens it again. A step names where it speaks: `'mat'` (the Starter Camp's Limes) or a screen's
 *   small Limes (a key of `LIMES_TEXT.blurbs`), which then glows and shows the step's words. It
 *   may name a target to wear the hard gold outline (`limesMark.js`).
 * While a step speaks on the mat, it is what the mat's bubble shows.
 */

export const LIMES_MAT = 'mat';

const EMPTY = Object.freeze({ talk: null, step: null, moves: 0 });
let state = EMPTY;
const listeners = new Set();

function set(next) {
    state = Object.freeze(next);
    for (const fn of listeners) fn();
}

export function subscribeLimes(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export const getLimes = () => state;

/** The store, redrawn on change. */
export function useLimes() {
    return useSyncExternalStore(subscribeLimes, getLimes, getLimes);
}

const linesOf = (lines) => (Array.isArray(lines) ? lines : [lines]).filter(l => typeof l === 'string' && l.length);

/**
 * Limes speaks by itself: its bubble opens (on the mat, or on a screen's small Limes) and stays
 * until {@link closeLimesStep}. A new step replaces the last one; any talk is closed.
 * @param {{ id: string, lines: string|string[], spot?: string, target?: object|null }} step
 */
export function openLimesStep({ id, lines, spot = LIMES_MAT, target = null }) {
    const shown = linesOf(lines);
    if (!id || !shown.length) return;
    set({ ...state, talk: null, step: { id, lines: shown, index: 0, collapsed: false, spot, target } });
}

/** The step is done: its bubble, glow and outline go. With an id, only that step. */
export function closeLimesStep(id = null) {
    if (!state.step || (id && state.step.id !== id)) return;
    set({ ...state, step: null });
}

/** The step's bubble shrinks to "…" (or opens again). */
export function collapseLimesStep(collapsed = true) {
    if (!state.step || state.step.collapsed === collapsed) return;
    set({ ...state, step: { ...state.step, collapsed } });
}

/** A click on the mat's Limes: opens or collapses a step speaking on the mat, else starts or ends the talk. */
export function clickLimes() {
    const { step, talk } = state;
    if (step && step.spot === LIMES_MAT) { collapseLimesStep(!step.collapsed); return; }
    set({ ...state, talk: talk ? null : { index: 0 } });
}

/** What the mat's bubble shows: the step speaking on the mat, else the talk, else nothing. */
export function matConversation(s = state) {
    if (s.step && s.step.spot === LIMES_MAT) {
        return { kind: 'step', lines: s.step.lines, index: s.step.index, collapsed: s.step.collapsed };
    }
    if (s.talk) return { kind: 'talk', lines: LIMES_TEXT.talk, index: s.talk.index, collapsed: false };
    return null;
}

/** The next line of `kind`'s conversation ('step' or 'talk'). */
export function limesNext(kind) {
    if (kind === 'step' && state.step) {
        const index = Math.min(state.step.index + 1, state.step.lines.length - 1);
        if (index !== state.step.index) set({ ...state, step: { ...state.step, index } });
    } else if (kind === 'talk' && state.talk) {
        const index = Math.min(state.talk.index + 1, LIMES_TEXT.talk.length - 1);
        if (index !== state.talk.index) set({ ...state, talk: { index } });
    }
}

/** The bubble's Close: a talk closes, a step collapses to "…" (only `closeLimesStep` ends a step). */
export function limesClose(kind) {
    if (kind === 'step') collapseLimesStep(true);
    else if (state.talk) set({ ...state, talk: null });
}

/** The step a screen's small Limes carries, or null. */
export function stepAt(spot, s = state) {
    return s.step && s.step.spot === spot ? s.step : null;
}

/** Limes was moved on the mat (its spot is in the save, `LimesGuide`): the mat redraws it there. */
export function noteLimesMoved() {
    set({ ...state, moves: state.moves + 1 });
}

/** Everything closed (tests). */
export function resetLimes() {
    if (state !== EMPTY) set(EMPTY);
}

import { useSyncExternalStore } from 'react';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Flags from '../../systems/board/Flags.js';
import * as Demolition from '../../systems/board/Demolition.js';

/**
 * The map tool modes, Disallow and Demolish: the one place the mode lives. One at a time; turning
 * one on turns the other off.
 * While a mode is on, a click on a Token acts on it (allow or disallow; mark or unmark) instead
 * of inspecting it, and no drag can start on the mat (`AlphaPointerSensor` asks
 * {@link isMapModeOn}). The bar's toggles and banner (`MatModeControls`) and the mat
 * (`MatBoard`, which hands the mode to each `MatToken` as a prop) read it.
 * UI state only: never saved, and off again whenever the mat's bar goes away (the Guild Hall
 * screen).
 */
export const MAP_MODE = Object.freeze({
    DISALLOW: 'disallow',
    DEMOLISH: 'demolish'
});

let mode = null;
const listeners = new Set();

/** The mode that is on, or null. */
export function getMapMode() {
    return mode;
}

export function setMapMode(next) {
    const value = next === MAP_MODE.DISALLOW || next === MAP_MODE.DEMOLISH ? next : null;
    if (value === mode) return;
    mode = value;
    listeners.forEach((l) => l());
}

/** A toggle's press: its mode on (the other off), or off when it was already on. */
export function toggleMapMode(which) {
    setMapMode(mode === which ? null : which);
}

export const isMapModeOn = () => mode !== null;
export const isDisallowMode = () => mode === MAP_MODE.DISALLOW;
export const isDemolishMode = () => mode === MAP_MODE.DEMOLISH;

/** Disallow mode on, or off (off leaves Demolish mode alone). */
export function setDisallowMode(on) {
    if (on) setMapMode(MAP_MODE.DISALLOW);
    else if (mode === MAP_MODE.DISALLOW) setMapMode(null);
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook: the mode that is on, re-rendering the consumer when it changes. */
export function useMapMode() {
    return useSyncExternalStore(subscribe, getMapMode, getMapMode);
}

/**
 * A click on a Token in disallow mode: allowed → disallowed, or back. The engine refuses a Token
 * no hero works (`Flags.setDisallowed`), and its reason comes back.
 *
 * @returns {{ success: boolean, reason?: string, disallowed?: boolean }}
 */
export function flipDisallowed(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return { success: false, reason: 'No Token there' };
    const next = !Flags.isDisallowed(instance);
    const result = Flags.setDisallowed(instanceId, next);
    return result.success ? { success: true, disallowed: next } : result;
}

/**
 * A shift-click in disallow mode: every Token of the clicked one's type on the mat disallowed,
 * or, when the clicked one is disallowed already, every one of them allowed again. When the
 * engine refuses the clicked one, its reason comes back and nothing changes.
 *
 * @returns {{ success: boolean, reason?: string, disallowed?: boolean, changed?: number }}
 */
export function flipDisallowedType(instanceId) {
    const clicked = BoardState.getTokenById(instanceId);
    if (!clicked) return { success: false, reason: 'No Token there' };
    const next = !Flags.isDisallowed(clicked);
    const refusal = next ? Flags.disallowRefusalOf(clicked) : null;
    if (refusal) return { success: false, reason: refusal };
    let changed = 0;
    for (const instance of BoardState.tokens()) {
        if (instance.typeId !== clicked.typeId) continue;
        if (Flags.isDisallowed(instance) === next) continue;
        if (Flags.setDisallowed(instance.id, next).success) changed++;
    }
    return { success: true, disallowed: next, changed };
}

/** How many Tokens on the mat are disallowed now: the *Allow all* count. */
export function disallowedCount() {
    return BoardState.tokens().filter(Flags.isDisallowed).length;
}

/**
 * A click on a Token in demolish mode: marked → unmarked, or the reverse. A Token the engine
 * protects is left alone and the engine's reason comes back (`Demolition.canMark`).
 *
 * @returns {{ success: boolean, code?: string, reason?: string, marked?: boolean }}
 */
export function flipDemolishMark(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (Demolition.isMarked(instance)) {
        const result = Demolition.unmark(instanceId);
        return result.success ? { success: true, marked: false } : result;
    }
    const result = Demolition.mark(instanceId);
    return result.success ? { success: true, marked: true } : result;
}

/** How many Tokens on the mat are marked for demolition: the *Cancel all marks* count. */
export function markedCount() {
    return Demolition.markedTokens().length;
}

/** **Cancel all marks**: every marked Token unmarked at once. @returns {number} how many */
export function cancelAllMarks() {
    let n = 0;
    for (const instance of Demolition.markedTokens()) {
        if (Demolition.unmark(instance.id).success) n++;
    }
    return n;
}

/** Whether Demolish mode shows this Token dimmed: the engine would refuse to mark it. */
export function isProtectedFromDemolition(instance) {
    return !!instance && Demolition.refusalOf(instance) !== null;
}

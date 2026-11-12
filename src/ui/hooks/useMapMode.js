import { useSyncExternalStore } from 'react';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Demolition from '../../systems/board/Demolition.js';

/**
 * The map tool mode, Demolish: the one place the mode lives.
 * While it is on, a click on a Token acts on it (mark or unmark) instead of inspecting it, and no drag can start on the mat (`AlphaPointerSensor` asks
 * {@link isMapModeOn}). The bar's toggle and banner (`MatModeControls`) and the mat
 * (`MatBoard`, which hands the mode to each `MatToken` as a prop) read it.
 * UI state only: never saved, and off again whenever the mat's bar goes away (the Guild Hall
 * screen).
 */
export const MAP_MODE = Object.freeze({
    DEMOLISH: 'demolish'
});

let mode = null;
const listeners = new Set();

/** The mode that is on, or null. */
export function getMapMode() {
    return mode;
}

export function setMapMode(next) {
    const value = next === MAP_MODE.DEMOLISH ? next : null;
    if (value === mode) return;
    mode = value;
    listeners.forEach((l) => l());
}

/** A toggle's press: its mode on, or off when it was already on. */
export function toggleMapMode(which) {
    setMapMode(mode === which ? null : which);
}

export const isMapModeOn = () => mode !== null;
export const isDemolishMode = () => mode === MAP_MODE.DEMOLISH;

/** Hear the mode change. Returns the undo. */
export function subscribeMapMode(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook: the mode that is on, re-rendering the consumer when it changes. */
export function useMapMode() {
    return useSyncExternalStore(subscribeMapMode, getMapMode, getMapMode);
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

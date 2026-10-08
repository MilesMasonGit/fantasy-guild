import { useSyncExternalStore } from 'react';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Flags from '../../systems/board/Flags.js';

/**
 * Disallow mode: the one place its on/off lives.
 * While on, a click on a Token flips it allowed/disallowed instead of inspecting it, and no
 * drag can start (`AlphaPointerSensor` asks {@link isDisallowMode}). The bar's toggle
 * (`MatDisallowControls`) and the mat (`MatBoard`, which hands it to each `MatToken` as a
 * prop) read it.
 * UI state only: never saved, and off again whenever the mat's bar goes away (the Guild Hall
 * screen).
 */
let on = false;
const listeners = new Set();

export function isDisallowMode() {
    return on;
}

export function setDisallowMode(next) {
    const value = !!next;
    if (value === on) return;
    on = value;
    listeners.forEach((l) => l());
}

export function toggleDisallowMode() {
    setDisallowMode(!on);
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook — re-renders the consumer when the mode turns on or off. */
export function useDisallowMode() {
    return useSyncExternalStore(subscribe, isDisallowMode, isDisallowMode);
}

/**
 * A click on a Token in disallow mode: allowed → disallowed, or back. Only a
 * Token a hero could work flips — the same Tokens the inspection panel's
 * Disallow switch is shown for (`Flags.isHeroWorkable`); a click
 * on any other does nothing.
 *
 * @returns {{ success: boolean, reason?: string, disallowed?: boolean }}
 */
export function flipDisallowed(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return { success: false, reason: 'No Token there' };
    if (!Flags.isHeroWorkable(instance)) return { success: false, reason: 'No hero works this' };
    const next = !Flags.isDisallowed(instance);
    const result = Flags.setDisallowed(instanceId, next);
    return result.success ? { success: true, disallowed: next } : result;
}

/** How many Tokens on the mat are disallowed now — the *Allow all* count. */
export function disallowedCount() {
    return BoardState.tokens().filter(Flags.isDisallowed).length;
}

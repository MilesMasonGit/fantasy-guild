import { useEffect, useSyncExternalStore } from 'react';
import * as BoardState from '../../systems/board/BoardState.js';
import * as FixedTokens from '../../systems/board/FixedTokens.js';
import { GameState } from '../../state/GameState.js';
import { activeRegionId } from '../../systems/atlas/Atlas.js';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import { getMapMode, subscribeMapMode } from './useMapMode.js';
import { pushEscapeLayer } from '../utils/escapeLayers.js';

/**
 * The mat's selection: one hero or one movable Token, or nothing. **The one place it lives**:
 * the gold outline on the mat and the hero bar, and the orders given to what is selected, all
 * read it here.
 * UI state only: never saved, cleared by a click on blank mat, Escape, leaving the mat (a full
 * screen view, travel, a load) or a map mode coming on ({@link useSelectionClearing}). The Bank
 * and the Shop lie over the mat and keep it.
 * @typedef {{ kind: 'hero'|'token', id: string }} MatSelection
 */

export const SELECTION_KIND = Object.freeze({ HERO: 'hero', TOKEN: 'token' });

/** @type {MatSelection|null} */
let selection = null;
const listeners = new Set();

function set(next) {
    if (next === selection) return;
    if (next && selection && next.kind === selection.kind && next.id === selection.id) return;
    selection = next;
    for (const fn of listeners) fn();
}

/** What is selected, or null. The same object until the selection changes. */
export function getSelection() {
    return selection;
}

export function subscribeSelection(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function clearSelection() {
    set(null);
}

/** Select a hero. Nothing is selected while a map mode is on. */
export function selectHero(heroId) {
    if (!heroId || getMapMode()) return;
    set({ kind: SELECTION_KIND.HERO, id: heroId });
}

/**
 * Whether a Token on the mat can be selected: one the player could drag today (not fixed:
 * `FixedTokens.isFixed`), an enemy included.
 */
export function isSelectableToken(instance) {
    if (!instance) return false;
    return !FixedTokens.isFixed(instance);
}

/**
 * A pick of a Token on the mat: a movable one is selected; an unmovable one (a fixed Token) only
 * clears the selection.
 * @returns {boolean} whether the Token is now selected
 */
export function pickToken(instanceId) {
    const instance = instanceId ? BoardState.getTokenById(instanceId) : null;
    if (!instance || getMapMode() || !isSelectableToken(instance)) {
        set(null);
        return false;
    }
    set({ kind: SELECTION_KIND.TOKEN, id: instance.id });
    return true;
}

/** The selected hero's id, or null. */
export function selectedHeroId() {
    return selection?.kind === SELECTION_KIND.HERO ? selection.id : null;
}

/** The selected Token's instance id, or null. */
export function selectedTokenId() {
    return selection?.kind === SELECTION_KIND.TOKEN ? selection.id : null;
}

/** React: the selection, re-rendering the caller only when it changes. */
export function useSelection() {
    return useSyncExternalStore(subscribeSelection, getSelection, getSelection);
}

/** React: the selected hero's id, or null. */
export function useSelectedHeroId() {
    return useSyncExternalStore(subscribeSelection, selectedHeroId, selectedHeroId);
}

/**
 * Drop a selection whose hero or Token is no longer there (a Token used up, moved off the mat or
 * turned into another; a hero dismissed).
 */
export function dropGoneSelection() {
    if (!selection) return;
    if (selection.kind === SELECTION_KIND.TOKEN) {
        const instance = BoardState.getTokenById(selection.id);
        if (!instance || !isSelectableToken(instance)) set(null);
    } else if (!GameState.heroes.some(h => h?.id === selection.id)) {
        set(null);
    }
}

/**
 * Everything that clears the selection besides a click on blank mat and a new pick, held by the
 * app's root while it is mounted:
 * - `leftMat`: a full-screen view is open (the World Map, the Guild Hall, the Encyclopedia);
 * - a map mode coming on (Demolish);
 * - travel to another Region, or a load;
 * - its hero or Token going away;
 * - Escape, as the bottom-most Escape layer, so an open panel, the Bank or a view closes first.
 * @param {boolean} leftMat
 */
export function useSelectionClearing(leftMat) {
    useEffect(() => {
        if (leftMat) clearSelection();
    }, [leftMat]);

    useEffect(() => {
        let region = activeRegionId();
        const offs = [
            subscribeMapMode(() => { if (getMapMode()) clearSelection(); }),
            EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, clearSelection, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, () => {
                const now = activeRegionId();
                if (now !== region) clearSelection();
                region = now;
            }, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, dropGoneSelection, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, dropGoneSelection, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.HEROES_UPDATED, dropGoneSelection, UI_LISTENER)
        ];
        return () => { for (const off of offs) off(); };
    }, []);

    const selected = useSyncExternalStore(subscribeSelection, () => selection != null, () => false);
    useEffect(() => {
        if (!selected) return undefined;
        return pushEscapeLayer(clearSelection, { bottom: true });
    }, [selected]);
}

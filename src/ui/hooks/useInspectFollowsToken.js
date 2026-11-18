import { useEffect, useRef } from 'react';
import * as BoardState from '../../systems/board/BoardState.js';
import { activeRegionId } from '../../systems/atlas/Atlas.js';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';

/**
 * An open Token card stays with its Token. Every "becomes" (a Foundation built, a Tree felled to its
 * Stump, a growth, a turn) is a new instance with a new id, so on `TOKEN_TRANSFORMED` the card moves
 * to the new one; when its Token leaves the mat (used up, killed, claimed, demolished, sold) or the
 * guild travels to another Region, it closes.
 */

/** The selection's mat Token id, or null when it is not a card for a Token on the mat. */
export function inspectedInstanceId(selection) {
    return selection?.type === 'token' && selection.source?.instanceId != null ? selection.source.instanceId : null;
}

/**
 * What a selection becomes when Token `fromId` turned into `instanceId` of `typeId`: the same
 * card on the new Token, or null when the transform is not about this card's Token.
 */
export function followedSelection(selection, { fromId, instanceId, typeId } = {}) {
    if (fromId == null || instanceId == null || !typeId) return null;
    if (inspectedInstanceId(selection) !== fromId) return null;
    return { ...selection, id: typeId, source: { ...selection.source, instanceId } };
}

/**
 * Hold the card to its Token while it is mounted. `inspect` is `useUIModals`' `inspect`: its `set`
 * and `clear` are stable.
 */
export function useInspectFollowsToken(inspect) {
    const { selection, set, clear } = inspect;
    // Read at event time; written straight away on a follow or a close, so a second event in the
    // same task (the transform's `TILE_CHANGED`) sees the card where it now is.
    const current = useRef(selection);
    current.current = selection;

    useEffect(() => {
        let region = activeRegionId();
        const close = () => { current.current = null; clear(); };
        const follow = (payload) => {
            const next = followedSelection(current.current, payload);
            if (!next) return;
            current.current = next;
            set(next.type, next.id, next.source, next.pane);
        };
        const closeIfGone = () => {
            const id = inspectedInstanceId(current.current);
            if (id != null && !BoardState.getTokenById(id)) close();
        };
        const onAtlas = () => {
            const now = activeRegionId();
            if (now !== region && inspectedInstanceId(current.current) != null) close();
            region = now;
        };
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.TOKEN_TRANSFORMED, follow, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, closeIfGone, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, closeIfGone, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEMOLISHED, closeIfGone, UI_LISTENER),
            EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, onAtlas, UI_LISTENER),
            // A catch-up's quiet bus tells the card nothing; its end is a reset.
            EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, closeIfGone, UI_LISTENER)
        ];
        return () => { for (const off of offs) off(); };
    }, [set, clear]);
}

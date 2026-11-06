import { useEffect, useRef } from 'react';
import { takeBack } from '../components/encyclopedia/encyclopediaLink.js';
import { requestRecipeList } from '../components/board/recipeFlip.js';
import * as BoardState from '../../systems/board/BoardState.js';

/**
 * The way back from the Encyclopedia: a book opened from a Token's recipe list (an ingredient's
 * link) brings that card back, on its recipe list, as the book closes, however it closes (its X,
 * Escape, a press beside the book). Nothing comes back when another view took the book's place
 * (the Bank's bubble) or the Token is gone.
 *
 * ⚠️ A switch of view closes everything first and opens the next view a frame later, so the card
 * waits two frames before it looks whether another view opened.
 *
 * @param {boolean} isOpen        whether the Encyclopedia is open
 * @param {boolean} otherViewOpen whether another view (a drawer, the Hall, the Atlas) is open
 * @param {(typeId: string, rect: DOMRect|null, instanceId: string) => void} onInspectToken
 */
export function useEncyclopediaBack(isOpen, otherViewOpen, onInspectToken) {
    const wasOpen = useRef(isOpen);
    const other = useRef(otherViewOpen);
    other.current = otherViewOpen;

    useEffect(() => {
        const closed = wasOpen.current && !isOpen;
        wasOpen.current = isOpen;
        if (!closed) return undefined;
        const back = takeBack();
        const id = back?.recipesOf;
        if (id == null) return undefined;
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
                frame = null;
                const instance = BoardState.getTokenById(id);
                if (other.current || !instance) return;
                requestRecipeList(id);
                const rect = document.querySelector(`[data-token-id="${id}"]`)?.getBoundingClientRect() || null;
                onInspectToken(instance.typeId, rect, id);
            });
        });
        return () => { if (frame != null) cancelAnimationFrame(frame); };
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}

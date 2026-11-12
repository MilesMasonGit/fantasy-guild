import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as BoardState from '../../../systems/board/BoardState.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { TokenGhost } from '../../dnd/DragGhost.jsx';
import { useSelectedTokenId } from '../../hooks/useMatSelection.js';
import { isMatBankLocked } from '../../hooks/useMatBankLock.js';
import { getMapMode } from '../../hooks/useMapMode.js';
import { pointerToMat, matRectForDrag, onMatItself } from './matPoint.js';
import { onFrame } from './frameClock.js';
import { tokenLandingAt } from './MatRings.jsx';
import { setTokenPreview } from './selectedTokenPreview.js';

/** Over the mat and its panels, as the drag's own overlay (`DndKit.jsx`). */
const GHOST_Z = 2000;

const HIDDEN = Object.freeze({ position: 'fixed', left: 0, top: 0, zIndex: GHOST_Z, pointerEvents: 'none', visibility: 'hidden' });

/**
 * While a Token is selected (`useMatSelection.js`) and the pointer is on the mat itself, what a
 * right-click there would do: the drag's own ghost of the Token at the pointer (`TokenGhost`), and
 * where it would land, which `MatRings` rings with its in-reach dots for a Token that uses reach
 * (`selectedTokenPreview.js`). The landing is the drag's (`tokenLandingAt`), so the preview, the
 * drag and the right-click never disagree.
 * ⚠️ Costs no more than a drag: the ghost is moved by a transform written straight on its element
 * and the landing worked out once per frame the pointer moved (`frameClock.onFrame`); React redraws
 * only the ring, as the landing moves. Nothing runs while the pointer is still or off the mat (a
 * panel, the hero bar, the Bank over it), and a drag takes its place while it lasts.
 */
export const SelectedTokenHints = memo(function SelectedTokenHints({ matRef }) {
    const { isDragging } = useActiveDrag();
    const tokenId = useSelectedTokenId();
    if (isDragging || !tokenId) return null;
    return <TokenPreview key={tokenId} instanceId={tokenId} matRef={matRef} />;
});

function TokenPreview({ instanceId, matRef }) {
    const ghostRef = useRef(null);
    const [typeId, setTypeId] = useState(() => BoardState.getTokenById(instanceId)?.typeId ?? null);

    useEffect(() => {
        let pointer = null;
        let moved = false;
        let stopFrames = null;
        // The mat's box, read again each time the pointer comes back onto the mat or the window is
        // resized, never per frame (`matRectForDrag`).
        let rectSession = {};
        let shownType = typeId;
        const start = () => { if (!stopFrames) stopFrames = onFrame(draw); };
        const stop = () => { stopFrames?.(); stopFrames = null; };
        const onMove = (e) => {
            const matEl = matRef?.current || null;
            if (!onMatItself(matEl, e.target) || isMatBankLocked() || getMapMode()) {
                pointer = null;
            } else {
                if (!pointer) rectSession = {};
                pointer = { x: e.clientX, y: e.clientY };
            }
            moved = true;
            start();
        };
        const onLeavePage = (e) => {
            if (e.relatedTarget) return;
            pointer = null;
            moved = true;
            start();
        };
        const onResize = () => { rectSession = {}; };
        function draw() {
            stop();
            if (!moved) return;
            moved = false;
            const ghost = ghostRef.current;
            const instance = BoardState.getTokenById(instanceId);
            const matEl = matRef?.current || null;
            if (!pointer || !instance || !matEl) {
                if (ghost) ghost.style.visibility = 'hidden';
                setTokenPreview(false);
                return;
            }
            // A Token turned into another type while selected shows its new picture.
            if (instance.typeId !== shownType) {
                shownType = instance.typeId;
                setTypeId(shownType);
            }
            if (ghost) {
                ghost.style.transform = `translate(${pointer.x}px, ${pointer.y}px) translate(-50%, -50%)`;
                ghost.style.visibility = 'visible';
            }
            const at = pointerToMat(pointer, matRectForDrag(matEl, rectSession));
            const landing = tokenLandingAt(instance.typeId, at, instanceId);
            setTokenPreview(true, landing ? { ...landing, id: instanceId } : null);
        }
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerout', onLeavePage, { passive: true });
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerout', onLeavePage);
            window.removeEventListener('resize', onResize);
            stop();
            setTokenPreview(false);
        };
    }, [instanceId, matRef]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!typeId || typeof document === 'undefined') return null;
    return createPortal(
        <div ref={ghostRef} data-selected-ghost={instanceId} aria-hidden="true" style={HIDDEN}>
            <TokenGhost payload={{ typeId }} />
        </div>,
        document.body
    );
}

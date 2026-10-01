import React from 'react';
import { clampToMat } from '../../../config/matGeometry.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { nearRadius } from '../../../systems/board/nearby.js';
import * as MatPlacement from '../../../systems/board/MatPlacement.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { useActiveDrag, useDragPointer } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { pointerToMat } from './matPoint.js';
import { MAT_Z } from './matLayers.js';
import { showsNearRing } from '../../../systems/board/reachDisplay.js';

/**
 * The Near ring (FP-64) — **hitboxes are never drawn**, so a Token at rest is
 * just its art. The ring appears only for a Token whose rules involve its
 * neighbours (`showsNearRing`, owner 2026-09-21), and only while the player is
 * doing something with it:
 *
 * * **hovering** one — the ring sits on that Token's centre;
 * * **dragging** one — the ring sits ⭐ **where the Token would really land**.
 *   Since free placement (slice 1.6d) that is the cursor itself when there is
 *   room, and the nudged spot when there is not — so the ring is an honest
 *   preview of the drop rather than a copy of the pointer. When there is no room
 *   within nudge reach the drop would fly back (FP-46), and there is no ring to
 *   draw.
 *
 * Flag radius rings are `FlagLayer`'s: they belong to the flag, not to the mat.
 */

/** The live Near radius, following the Mat Tuner. */
function useNearRadius() {
    const [radius, setRadius] = React.useState(() => nearRadius());
    React.useEffect(() => onMatTuningChanged(() => setRadius(nearRadius())), []);
    return radius;
}

/**
 * @param {{x:number,y:number}|null} hoveredCentre the hovered Token's centre
 * @param {{current: HTMLElement|null}} matRef the mat's own element
 */
/**
 * ⭐ Where the Token being dragged would land, as a mat point — or null when no
 * Token is being dragged, or it would fly back (FP-46).
 *
 * That is the cursor itself when there is room and the nudged spot when there
 * is not, so anything drawn from it is an honest preview of the drop. A Map lies
 * loose wherever it is let go. Shared by the Near ring here and the flag rings
 * in `FlagLayer` (a flag's ring shows while a dragged Token would land in it).
 */
// CR3-401: `MatRings` and `FlagLayer` both call this with the same `matRef`,
// each frame, while a Token is in the hand — so the landing used to be worked
// out twice (a `pointerToMat` plus a `MatPlacement.findSpot` walk) for the
// exact same answer. `pointer` is a fresh object only once per animation
// frame (`DndKit.jsx`'s `setDragPointer`), and `activePayload` only changes at
// drag start/end, so caching on their identity — plus the mat element's, in
// case a caller passed a different `matRef` — answers the second call inside
// the same frame for free and still recomputes the moment anything real
// changes.
let cachedInputs = null;
let cachedResult = null;

export function useTokenDragLanding(matRef) {
    const { activePayload, isDragging } = useActiveDrag();
    const pointer = useDragPointer();
    const matEl = matRef?.current || null;

    if (!isDragging || activePayload?.kind !== DRAG_KIND.TOKEN || !pointer || !matEl) {
        cachedInputs = null;
        return null;
    }

    if (
        cachedInputs &&
        cachedInputs.pointer === pointer &&
        cachedInputs.activePayload === activePayload &&
        cachedInputs.matEl === matEl
    ) {
        return cachedResult;
    }

    const point = pointerToMat(pointer, matEl.getBoundingClientRect());
    let result = null;
    if (point) {
        // Where this very Token would land, itself excluded so a Token being
        // moved does not block its own preview.
        const spot = MatPlacement.findSpot(activePayload.typeId, clampToMat(point), {
            excludeId: activePayload.from?.instanceId || null
        });
        result = spot ? { x: spot.x, y: spot.y, typeId: activePayload.typeId } : null;
    }

    cachedInputs = { pointer, activePayload, matEl };
    cachedResult = result;
    return result;
}

export const MatRings = React.memo(function MatRings({ hoveredCentre = null, matRef = null }) {
    const radius = useNearRadius();
    const mat = useMatSize();
    const { isDragging } = useActiveDrag();
    const landing = useTokenDragLanding(matRef);

    let centre = null;
    if (isDragging) {
        if (landing && showsNearRing(landing.typeId)) centre = landing;
    } else if (hoveredCentre) {
        centre = hoveredCentre;
    }

    if (!centre) return null;

    return (
        <svg
            data-mat-rings
            className="absolute left-0 top-0 overflow-visible pointer-events-none"
            width={mat.w}
            height={mat.h}
            style={{ zIndex: MAT_Z.RINGS }}
        >
            <circle
                data-near-ring="true"
                cx={centre.x}
                cy={centre.y}
                r={radius}
                fill="none"
                stroke="rgb(251, 191, 36)"
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="6 5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
});

export default MatRings;

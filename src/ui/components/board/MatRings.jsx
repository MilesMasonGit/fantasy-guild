import React from 'react';
import { MAT_W, MAT_H, clampToMat } from '../../../config/matGeometry.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { nearRadius } from '../../../systems/board/nearby.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { useActiveDrag, useDragPointer } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { pointerToMat } from './matPoint.js';
import { MAT_Z } from './matLayers.js';
// ⚠️ STOPGAP (deleted in 1.6d): the ring must show where the drop will really
// land, and until free placement that is the nearest old spot, not the cursor.
import { oldSpotAt, oldSpotPoint, isFarOutsideArea } from './oldSpotStopgap.js';

/**
 * The Near ring (FP-64) — **hitboxes are never drawn**, so a Token at rest is
 * just its art. The ring appears only while the player is doing something with
 * a Token:
 *
 * * **hovering** one — the ring sits on that Token's centre;
 * * **dragging** one — the ring sits where it would actually land, which until
 *   slice 1.6d is the nearest old spot (the snapping stopgap). A drop well
 *   outside the play area flies back (FP-93), so there is no ring to draw.
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
export const MatRings = ({ hoveredCentre = null, matRef = null }) => {
    const radius = useNearRadius();
    const { activePayload, isDragging } = useActiveDrag();
    const pointer = useDragPointer();

    let centre = null;

    if (isDragging) {
        if (activePayload?.kind === DRAG_KIND.TOKEN && pointer && matRef?.current) {
            const point = pointerToMat(pointer, matRef.current.getBoundingClientRect());
            const def = getTokenType(activePayload.typeId);
            if (point) {
                if (def?.mapId) {
                    // A Map lies loose wherever it is dropped.
                    centre = clampToMat(point);
                } else if (!isFarOutsideArea(point)) {
                    centre = oldSpotPoint(oldSpotAt(point, def?.size || 1));
                }
            }
        }
    } else if (hoveredCentre) {
        centre = hoveredCentre;
    }

    if (!centre) return null;

    return (
        <svg
            data-mat-rings
            className="absolute left-0 top-0 overflow-visible pointer-events-none"
            width={MAT_W}
            height={MAT_H}
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
};

export default MatRings;

import React from 'react';
import { clampToMat } from '../../../config/matGeometry.js';
import { reachRadius } from '../../../systems/board/nearby.js';
import * as MatPlacement from '../../../systems/board/MatPlacement.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { siteTypeOf } from '../../../systems/board/SiteRules.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';
import { useActiveDrag, useDragPointer } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { pointerToMat, matRectForDrag } from './matPoint.js';
import { showsNearRing, reachDotsAt } from '../../../systems/board/reachDisplay.js';
import { ReachRing } from './CampReachRing.jsx';
import { useTokenPreview } from './selectedTokenPreview.js';

const NEAR_RING_ATTRS = Object.freeze({ 'data-near-ring': 'true' });

/**
 * The reach ring and its dots: **hitboxes are never drawn**, so a Token at rest is just its art.
 * The one standard ring appears only for a Token that uses reach (`showsNearRing`: a Foundation,
 * a work camp, a Token whose rules involve its neighbours), and only while the player is doing
 * something with it:
 * * **hovering** one: the ring sits on that Token's centre;
 * * **dragging** one, from the Shop or across the mat: the ring sits where the Token would REALLY
 * land. With free placement that is the cursor itself when there is room, and the nudged spot
 * when there is not, so the ring is an honest preview of the drop rather than a copy of the
 * pointer. When there is no room within nudge reach the drop would fly back, and there is no ring;
 * * **selected**, with the pointer on the mat: the same, where a right-click would move it
 * (`SelectedTokenHints`).
 * Every Token inside the ring wears a dot (`reachDisplay.reachDotsAt`, the engine's own test).
 * The ring of a camp lit through its hero is `CampReachRing`'s.
 */

/** The live standard reach, following a dev build's Mat Tuner override of it. */
function useReachRadius() {
    const [radius, setRadius] = React.useState(() => reachRadius());
    React.useEffect(() => onMatTuningChanged(() => setRadius(reachRadius())), []);
    return radius;
}

/**
 * Where the Token being dragged would land, as a mat point, or null when no Token is being
 * dragged, or it would fly back.
 * That is the cursor itself when there is room and the nudged spot when there is not, so
 * anything drawn from it is an honest preview of the drop. Shared by the Near ring here and
 * the flag rings in `FlagLayer` (a flag's ring shows while a dragged Token would land in it).
 */
// `MatRings` and `FlagLayer` both call this with the same `matRef`, each frame, while a Token
// is in the hand, so without a cache the landing would be worked out twice (a `pointerToMat`
// plus a `MatPlacement.findSpot` walk) for the exact same answer. `pointer` is a fresh object
// only once per animation frame (`DndKit.jsx`'s `setDragPointer`), and `activePayload` only
// changes at drag start/end, so caching on their identity (plus the mat element's, in case a
// caller passed a different `matRef`) answers the second call inside the same frame for free
// and still recomputes the moment anything real changes.
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

    const point = pointerToMat(pointer, matRectForDrag(matEl, activePayload));
    const result = point ? tokenLandingAt(activePayload.typeId, point, activePayload.from?.instanceId || null) : null;

    cachedInputs = { pointer, activePayload, matEl };
    cachedResult = result;
    return result;
}

/**
 * Where a Token of `typeId` let go at mat `point` would land (`{ x, y, typeId }`), or null when it
 * would be refused for want of room: the placement's own search. `movingId`, a Token on the mat
 * being moved, is left out, so it does not block its own preview. The drag's landing above and a
 * selected Token's preview (`SelectedTokenHints`) both ask here.
 */
export function tokenLandingAt(typeId, point, movingId = null) {
    if (!point) return null;
    const spot = MatPlacement.findSpot(typeId, clampToMat(point), {
        excludeId: movingId,
        siteOf: movingId ? siteTypeOf(BoardState.getTokenById(movingId)) : null
    });
    return spot ? { x: spot.x, y: spot.y, typeId } : null;
}

/**
 * @param {{x:number,y:number,id:string}|null} hoveredCentre the hovered Token's centre and id
 * @param {Array|null} boardTokens the mat's Token list: a new one (a Token arrived, left or moved)
 * works the dots out again
 * @param {{current: HTMLElement|null}} matRef the mat's own element
 */
export const MatRings = React.memo(function MatRings({ hoveredCentre = null, boardTokens = null, matRef = null }) {
    const radius = useReachRadius();
    const { isDragging, activePayload } = useActiveDrag();
    const landing = useTokenDragLanding(matRef);
    const preview = useTokenPreview();

    let centre = null;
    let selfId = null;
    if (isDragging) {
        if (landing && showsNearRing(landing.typeId)) {
            centre = landing;
            selfId = activePayload?.from?.instanceId || null;
        }
    } else if (preview) {
        // A selected Token's preview at the pointer stands in for the drag's landing.
        if (preview.landing && showsNearRing(preview.landing.typeId)) {
            centre = preview.landing;
            selfId = preview.landing.id;
        }
    } else if (hoveredCentre) {
        centre = hoveredCentre;
        selfId = hoveredCentre.id || null;
    }

    // ⚠️ Worked out when the ring moves to a new spot (or the board changes under it), never per
    // frame: a drag frame whose landing stays put reuses the last answer.
    const key = centre ? `${centre.x}|${centre.y}|${selfId}|${radius}` : '';
    const ring = React.useMemo(() => (centre ? { x: centre.x, y: centre.y, r: radius } : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
    const dots = React.useMemo(() => (centre ? reachDotsAt(centre, selfId, radius) : null), [key, boardTokens]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!ring) return null;
    return <ReachRing ring={ring} dots={dots} attrs={NEAR_RING_ATTRS} />;
});

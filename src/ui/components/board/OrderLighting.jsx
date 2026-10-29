import { useEffect } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Orders from '../../../systems/board/Orders.js';
import { setWorkable, setJob } from './orderLit.js';

/** Whether a drag carries a hero (their figure, their pennant or their roster tab). */
const carriesHero = (payload) => !!payload?.heroId
    && (payload.kind === DRAG_KIND.HERO || payload.kind === DRAG_KIND.FLAG);

/** Every Token on the mat `heroId` could be ordered onto (`Orders.canOrderOnto`). */
export function workableFor(heroId) {
    if (!heroId) return [];
    const out = [];
    for (const instance of BoardState.tokens()) {
        if (Orders.canOrderOnto(heroId, instance)) out.push(instance.id);
    }
    return out;
}

/**
 * While a hero is carried, every Token they could be ordered onto shows the green "ready" outline
 * (`orderLit.js`), worked out once as the drag starts. Draws nothing itself.
 */
export function OrderLighting() {
    const { isDragging, activePayload } = useActiveDrag();
    const heroId = isDragging && carriesHero(activePayload) ? activePayload.heroId : null;
    useEffect(() => {
        setWorkable(workableFor(heroId));
        return () => setWorkable([]);
    }, [heroId]);
    return null;
}

/**
 * Light one hero's job on the mat, or none with null: the Token their order names, in the white
 * hover outline (`orderLit.js`). `MatBoard` calls it as a hero, their pennant or their roster tab
 * is hovered, or their sheet is open.
 */
export function lightHeroJob(heroId) {
    setJob(heroId ? Orders.jobTokenOf(heroId)?.id ?? null : null);
}

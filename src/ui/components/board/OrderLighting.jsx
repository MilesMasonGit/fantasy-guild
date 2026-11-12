import { memo, useEffect } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Orders from '../../../systems/board/Orders.js';
import { isGuildHall } from '../../../systems/board/MatCap.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useSelectedHeroId } from '../../hooks/useMatSelection.js';
import { setWorkable, setJob } from './orderLit.js';

/** Whether a drag carries a hero (their flag, picked up by itself, their figure or their roster tab). */
const carriesHero = (payload) => !!payload?.heroId && payload.kind === DRAG_KIND.FLAG;

/**
 * Every Token on the mat `heroId` could be ordered onto to work (`Orders.canOrderOnto`). The Guild
 * Hall takes a drop too (home), but is not work, so it does not light.
 */
export function workableFor(heroId) {
    if (!heroId) return [];
    const out = [];
    for (const instance of BoardState.tokens()) {
        if (!isGuildHall(instance) && Orders.canOrderOnto(heroId, instance)) out.push(instance.id);
    }
    return out;
}

/**
 * What can change the Tokens a selected hero could be sent to: a Token placed, moved, spawned,
 * turned or gone; the hero's skills, gear or health; a load or travel.
 */
const WORKABLE_EVENTS = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED,
    BOARD_EVENTS.TOKEN_DEPLETED,
    ENGINE_EVENTS.HEROES_UPDATED,
    ENGINE_EVENTS.HERO_LEVELED,
    ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED,
    ENGINE_EVENTS.ATLAS_CHANGED,
    ENGINE_EVENTS.GAME_RESET
]);

/**
 * Call `fn` once after any burst of {@link WORKABLE_EVENTS} (one microtask per burst, as
 * `useGameState` does). Returns the undo.
 */
function onWorkableChange(fn) {
    let queued = false;
    let live = true;
    const wake = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
            queued = false;
            if (live) fn();
        });
    };
    const offs = WORKABLE_EVENTS.map(event => EventBus.subscribe(event, wake, UI_LISTENER));
    return () => {
        live = false;
        for (const off of offs) off();
    };
}

/**
 * Every Token a hero could be ordered onto shows the green "ready" outline (`orderLit.js`), so the
 * player sees where a drop or a right-click works before giving it. Draws nothing itself.
 * - **A hero carried**: worked out once as the drag starts.
 * - **A hero selected** (`useMatSelection.js`), nothing carried: worked out as they are selected,
 * and again after anything that could change it, since a selection outlasts a drag. Any drag
 * puts the selection's lights out until it ends.
 * Memoised with no props: only a drag starting or ending, or the selected hero changing, redraws
 * it, never the mat around it.
 */
export const OrderLighting = memo(function OrderLighting() {
    const { isDragging, activePayload } = useActiveDrag();
    const selectedHero = useSelectedHeroId();
    const carried = isDragging && carriesHero(activePayload) ? activePayload.heroId : null;
    const heroId = isDragging ? carried : selectedHero;
    const follows = !isDragging && !!selectedHero;
    useEffect(() => {
        setWorkable(workableFor(heroId));
        const off = follows ? onWorkableChange(() => setWorkable(workableFor(heroId))) : null;
        return () => {
            off?.();
            setWorkable([]);
        };
    }, [heroId, follows]);
    return null;
});

/**
 * Light one hero's job on the mat, or none with null: the Token their order names, in the white
 * hover outline (`orderLit.js`). `MatBoard` calls it as a hero, their flag or their roster tab
 * is hovered, or their sheet is open.
 */
export function lightHeroJob(heroId) {
    setJob(heroId ? Orders.jobTokenOf(heroId)?.id ?? null : null);
}

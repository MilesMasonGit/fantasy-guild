import { useEffect, useRef } from 'react';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { GOAL_STEP } from '../../systems/quests/lessonPlan.js';
import { lessonsOn } from '../../systems/quests/LimesGuide.js';
import { useActiveDrag } from '../dnd/DndKit.jsx';

/**
 * Opens the Atlas, on its World page, when Limes shows it: the lessons' goal (settle a place)
 * arriving as the last lesson is done, with the lessons on. Not on a load or after a catch-up,
 * where the goal is already the step and nothing arrives.
 * ⚠️ Nothing may open or close a drawer mid-drag (drop targets are measured at drag start), so a
 * goal arriving during a drag waits for it to end.
 * @param {() => void} openAtlas the nav's own opener, which closes what is open first
 * @param {boolean} [isDragging]
 */
export function useWorldMapRequests(openAtlas, isDragging = false) {
    const live = useRef({ openAtlas, isDragging });
    live.current = { openAtlas, isDragging };
    const waiting = useRef(false);
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.LIMES_LESSON, (data) => {
        if (!(data?.arrived && data.stepId === GOAL_STEP.id && lessonsOn())) return;
        if (live.current.isDragging) waiting.current = true;
        else live.current.openAtlas();
    }, UI_LISTENER), []);
    useEffect(() => {
        if (isDragging || !waiting.current) return;
        waiting.current = false;
        live.current.openAtlas();
    }, [isDragging]);
}

/** The requests, inside the drag provider so they can wait out a drag. */
export function WorldMapRequests({ openAtlas }) {
    useWorldMapRequests(openAtlas, useActiveDrag().isDragging);
    return null;
}

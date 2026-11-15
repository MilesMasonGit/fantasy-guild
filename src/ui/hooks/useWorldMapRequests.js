import { useEffect } from 'react';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { GOAL_STEP } from '../../systems/quests/lessonPlan.js';
import { lessonsOn } from '../../systems/quests/LimesGuide.js';

/**
 * Opens the Atlas, on its World page, when Limes shows it: the lessons' goal (settle a place)
 * arriving as the last lesson is done, with the lessons on. Not on a load or after a catch-up,
 * where the goal is already the step and nothing arrives.
 * @param {() => void} openAtlas stable for the component's life
 */
export function useWorldMapRequests(openAtlas) {
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.LIMES_LESSON, (data) => {
        if (data?.arrived && data.stepId === GOAL_STEP.id && lessonsOn()) openAtlas();
    }, UI_LISTENER), [openAtlas]);
}

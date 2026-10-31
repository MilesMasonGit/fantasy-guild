import { useEffect } from 'react';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { tutorialTemplate } from '../../systems/quests/tutorialQuests.js';

/**
 * Opens the Atlas, on its World page, when the cartographer does: a tutorial step marked
 * `opensWorld` arriving on the mat (the chain's last, "settle your first place").
 * @param {() => void} openAtlas stable for the component's life
 */
export function useWorldMapRequests(openAtlas) {
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.QUEST_SPAWNED, (data) => {
        if (data?.tutorial && tutorialTemplate(data.questId)?.opensWorld) openAtlas();
    }, UI_LISTENER), [openAtlas]);
}

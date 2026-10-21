import { startTransition, useEffect } from 'react';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../systems/core/engineEvents.js';

/**
 * Opens the hero sheet (`open(heroId)`) when something asks for it: a click on a hero
 * (`INSPECT_HERO`), or an item equipped (`HERO_EQUIPMENT_CHANGED`).
 * ⚠️ Every equip is a drop, and the sheet mounting redraws the whole screen: opened in the drop's
 * own commit it made the equip drop the heaviest of any drag. Opened in a transition, React draws
 * the drop first and the sheet a frame later at most. A click (`INSPECT_HERO` without
 * `afterDrop`) still opens it at once.
 * @param {(heroId: string) => void} open a state setter, stable for the component's life
 */
export function useHeroSheetRequests(open) {
    useEffect(() => {
        const unsubEquip = EventBus.subscribe(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, (data) => {
            if (data?.action === 'equip' && data?.heroId) startTransition(() => open(data.heroId));
        }, UI_LISTENER);
        const unsubInspect = EventBus.subscribe(UI_EVENTS.INSPECT_HERO, (data) => {
            if (!data?.heroId) return;
            if (data.afterDrop) startTransition(() => open(data.heroId));
            else open(data.heroId);
        }, UI_LISTENER);
        return () => {
            unsubEquip();
            unsubInspect();
        };
    }, [open]);
}

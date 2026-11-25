import { startTransition, useCallback, useEffect } from 'react';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../systems/core/engineEvents.js';
import { GameState } from '../../state/GameState.js';
import { isSummoned } from '../../systems/hero/summoned.js';
import { isHandingOver } from '../components/dock/dockEquip.js';

/** Whether `heroId` has a hero sheet: every hero on the roster, never a Summoned worker. */
export function hasHeroSheet(heroId) {
    const record = (GameState.state?.heroes || []).find(h => h?.id === heroId);
    return !!record && !isSummoned(record);
}

/**
 * `open` (the hero sheet's state setter) as every opener calls it: a record with no sheet (a
 * Summoned worker) opens nothing, and `null` still closes.
 */
export function useHeroSheetOpener(open) {
    return useCallback((heroId) => {
        if (heroId == null || hasHeroSheet(heroId)) open(heroId);
    }, [open]);
}

/**
 * Opens the hero sheet (`open(heroId)`) when something asks for it: a click on a hero
 * (`INSPECT_HERO`), or an item equipped (`HERO_EQUIPMENT_CHANGED`), but not one handed from one hero to
 * another (`dockEquip.isHandingOver`).
 * ⚠️ Every equip is a drop, and the sheet mounting redraws the whole screen: opened in the drop's
 * own commit it made the equip drop the heaviest of any drag. Opened in a transition, React draws
 * the drop first and the sheet a frame later at most. A click (`INSPECT_HERO` without
 * `afterDrop`) still opens it at once.
 * @param {(heroId: string) => void} open a state setter, stable for the component's life
 */
export function useHeroSheetRequests(open) {
    useEffect(() => {
        const unsubEquip = EventBus.subscribe(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, (data) => {
            // An item handed from one hero to another keeps the panel on the hero it shows (owner, 2026-11-10).
            if (data?.action === 'equip' && data?.heroId && !isHandingOver()) startTransition(() => open(data.heroId));
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

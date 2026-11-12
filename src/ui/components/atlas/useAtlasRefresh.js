import { useEffect, useState } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { onMatTuningChanged } from '../../../config/matTuning.js';

/**
 * What the Atlas screen redraws on: the Regions (`ATLAS_CHANGED`), what the world map's prices are
 * read against (the Bank, a hero recruited or a level reached), a ring star bought and the Token cap
 * (`GUILD_UPGRADES_UPDATED`, and the Mat Tuner's cap override), and a travel or a load.
 */
export const ATLAS_SCREEN_EVENTS = Object.freeze([
    ENGINE_EVENTS.ATLAS_CHANGED,
    ENGINE_EVENTS.INVENTORY_UPDATED,
    ENGINE_EVENTS.HERO_RECRUITED,
    ENGINE_EVENTS.HERO_LEVELED,
    ENGINE_EVENTS.XP_FOR_EVERYONE_GIVEN,
    ENGINE_EVENTS.GUILD_UPGRADES_UPDATED,
    ENGINE_EVENTS.GAME_RESET,
    ENGINE_EVENTS.GAME_LOADED
]);

/** A number that moves on with each of {@link ATLAS_SCREEN_EVENTS}, for re-reading and as a memo key. */
export function useAtlasRefresh() {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const bump = () => setVersion(v => v + 1);
        const unsubs = ATLAS_SCREEN_EVENTS.map(e => EventBus.subscribe(e, bump, UI_LISTENER));
        unsubs.push(onMatTuningChanged(bump));
        return () => unsubs.forEach(u => u?.());
    }, []);
    return version;
}

import React from 'react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { useRefreshOn } from './MatCapBadge.jsx';
import { TOP_BAR_ICON, TopBarIcon } from './MatTopBar.jsx';

/** What changes the name: a rename, travel or a new Region (`ATLAS_CHANGED`), a load or a new game. */
export const REGION_NAME_EVENTS = Object.freeze([
    ENGINE_EVENTS.ATLAS_CHANGED,
    ENGINE_EVENTS.GAME_LOADED,
    ENGINE_EVENTS.STATE_CHANGED
]);

/** The Region the guild is in, as the bar names it: its flavour name (the one the player renames) and its practical name. */
export function liveRegionName() {
    const region = Atlas.activeRegion();
    if (!region) return null;
    return { name: region.flavourName || region.practicalName || '', practical: region.practicalName || '' };
}

const signatureOf = (r) => (r ? `${r.name}|${r.practical}` : '');

/**
 * The top bar's first item bar: the name of the Region the guild is in. A click opens the Atlas
 * (a second way in besides its bubble). Nothing while there is no Region (before a game starts).
 * @param {{ onOpenAtlas?: () => void, readName?: () => ({ name: string, practical: string }|null) }} props
 *   `readName` for tests
 */
export const MatRegionName = ({ onOpenAtlas, readName = liveRegionName }) => {
    useRefreshOn(REGION_NAME_EVENTS, true, () => signatureOf(readName()));
    const region = readName();
    if (!region?.name) return null;
    const lines = [region.practical && region.practical !== region.name ? region.practical : null, 'Click to open the Atlas.'];
    return (
        <Tooltip title={region.name} lines={lines}>
            <EntityRibbon
                data-mat-region-name
                role="button"
                tabIndex={0}
                size="xs"
                name={region.name}
                title={null}
                icon={<TopBarIcon src={TOP_BAR_ICON.REGION} />}
                onClick={() => onOpenAtlas?.()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAtlas?.(); } }}
                className="whitespace-nowrap"
            />
        </Tooltip>
    );
};

export default MatRegionName;

import React from 'react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { useRefreshOn } from './MatCapBadge.jsx';
import { TOP_BAR_ICON, TopBarIcon } from './MatTopBar.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { liveRegionBanner } from '../atlas/regionBanner.js';

/** What changes the name: a rename, travel or a new Region (`ATLAS_CHANGED`), a load or a new game. */
export const REGION_NAME_EVENTS = Object.freeze([
    ENGINE_EVENTS.ATLAS_CHANGED,
    ENGINE_EVENTS.GAME_LOADED,
    ENGINE_EVENTS.GAME_RESET
]);

/** The Region the guild is in, as the bar names it: its flavour name (the one the player renames) and its practical name. */
export function liveRegionName() {
    const region = Atlas.activeRegion();
    if (!region) return null;
    return { name: region.flavourName || region.practicalName || '', practical: region.practicalName || '' };
}

const signatureOf = (r, banner) => (r ? `${r.name}|${r.practical}|${banner || ''}` : '');

/**
 * The top bar's first item bar: the name of the Region the guild is in. A click opens the Atlas
 * (a second way in besides its bubble). A thin slice of the Region's area banner lies behind the
 * name. Nothing while there is no Region (before a game starts).
 * @param {{ onOpenAtlas?: () => void, readName?: () => ({ name: string, practical: string }|null),
 *   readBanner?: () => (string|null) }} props  `readName` and `readBanner` for tests
 */
export const MatRegionName = ({ onOpenAtlas, readName = liveRegionName, readBanner = liveRegionBanner }) => {
    useRefreshOn(REGION_NAME_EVENTS, true, () => signatureOf(readName(), readBanner()));
    const region = readName();
    const banner = readBanner();
    if (!region?.name) return null;
    const lines = [region.practical && region.practical !== region.name ? region.practical : null, 'Click to open the Atlas.'];
    return (
        <Tooltip title={region.name} lines={lines}>
            <span data-mat-region-banner={banner || ''} className="relative isolate inline-flex items-center overflow-hidden rounded-lg">
                {banner && <BannerArt banner={banner} className="-z-10" />}
                {/* A dark wash so the name reads over any picture. */}
                {banner && <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/65 via-black/35 to-black/10 pointer-events-none" />}
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
                    className={banner ? 'whitespace-nowrap bg-transparent hover:bg-white/10' : 'whitespace-nowrap'}
                />
            </span>
        </Tooltip>
    );
};

export default MatRegionName;

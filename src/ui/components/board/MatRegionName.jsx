import React from 'react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { useRefreshOn } from './MatCapBadge.jsx';
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

/** The banner's width in the bar, px: one 256 px picture at its own size, so its pixels stay whole. */
export const REGION_BANNER_PX = 256;

/** Crisp on the left, gone by the right end, so the picture melts into the bar's fill. */
const BANNER_FADE = 'linear-gradient(to right, #000 0%, #000 40%, transparent 100%)';

/**
 * The top bar's left end: the name of the Region the guild is in, over that Region's banner (the
 * one the Atlas shows). A click opens the Atlas (a second way in besides its bubble). Nothing
 * while there is no Region (before a game starts).
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
            <span
                data-mat-region-banner={banner || ''}
                data-mat-region-name
                role="button"
                tabIndex={0}
                onClick={() => onOpenAtlas?.()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAtlas?.(); } }}
                className="relative isolate h-full flex items-center pl-4 pr-10 cursor-pointer hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-ui-white)]"
                style={{ minWidth: REGION_BANNER_PX }}
            >
                {banner && (
                    <BannerArt
                        banner={banner}
                        className="-z-10"
                        style={{ width: REGION_BANNER_PX, right: 'auto', maskImage: BANNER_FADE, WebkitMaskImage: BANNER_FADE }}
                    />
                )}
                <span data-mat-region-name-text className="ui-text-title ui-text-outline-2 font-bold whitespace-nowrap text-white">{region.name}</span>
            </span>
        </Tooltip>
    );
};

export default MatRegionName;

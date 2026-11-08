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

/** The banner's scale in the bar: a whole number, so its pixels stay whole. */
export const REGION_BANNER_SCALE = 3;
/** The banner's widest in the bar, px: one 256 px picture across, at {@link REGION_BANNER_SCALE}. */
export const REGION_BANNER_PX = 256 * REGION_BANNER_SCALE;
/** The name's clickable end of the bar is at least this wide, whatever the banner's scale. */
const NAME_MIN_PX = 256;
/** Which band of the picture shows (0 top … 1 bottom): a little below the middle, where most banners have their horizon rather than sky. */
const BANNER_FOCUS_Y = 0.6;

/** Crisp on the left, gone by its right end, so the picture melts into the bar's fill. */
const BANNER_FADE = 'linear-gradient(to right, #000 0%, #000 40%, transparent 100%)';

/**
 * The top bar's left end: the name of the Region the guild is in, over that Region's banner (the
 * one the Atlas shows). A click on the name's end opens the Atlas (a second way in besides its
 * bubble). Nothing while there is no Region (before a game starts).
 * The banner runs on past the name, under the bar's middle, one picture across at
 * {@link REGION_BANNER_SCALE} but never past the bar's far end (`100cqw`: `MatTopBar` makes its
 * frame the container), fading as it goes.
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
                className="relative isolate h-full w-full flex items-center pl-4 pr-10 cursor-pointer hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-ui-white)]"
                style={{ minWidth: NAME_MIN_PX }}
            >
                {banner && (
                    <BannerArt
                        banner={banner}
                        className="-z-10"
                        focusY={BANNER_FOCUS_Y}
                        scale={REGION_BANNER_SCALE}
                        // ⚠️ Wider than this end of the bar on purpose: the middle and right ends sit above it
                        // (`MatTopBar` positions them), on their own dark fills.
                        style={{ width: REGION_BANNER_PX, maxWidth: '100cqw', right: 'auto', maskImage: BANNER_FADE, WebkitMaskImage: BANNER_FADE }}
                    />
                )}
                <span data-mat-region-name-text className="ui-text-bar-name ui-text-outline-2 font-bold whitespace-nowrap text-white">{region.name}</span>
            </span>
        </Tooltip>
    );
};

export default MatRegionName;

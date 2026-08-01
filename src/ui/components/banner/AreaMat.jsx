import React, { useMemo } from 'react';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

const bgUrl = (p) => (p ? `url(${p.startsWith('/') ? p : '/' + p})` : undefined);

/**
 * AreaMat — the banner's full-bleed background art (concept §11 mat).
 *
 * One static art layer, rendered sharp (`image-rendering: pixelated`,
 * `background-size: cover`) at full colour and sized to the whole banner, so it
 * never scales or shifts.
 *
 * This used to be TWO "curtains" — the Wilds art and the Outpost art — with a
 * clip boundary sliding between them as the player toggled modes. Outposts are
 * standalone banners now (D-16), so an area banner only ever shows its own
 * region and the whole curtain mechanism is gone.
 *
 * Art source: `areaBannerArt` → `areaArt`. Ids with no area set (an Outpost
 * banner reaching this through FocusScaffold) fall back to a plain surface.
 *
 * Shared by the regular row and every focus view so the background is identical
 * across them.
 */
export const AreaMat = ({ areaId }) => {
    const areaSet = getAreaSet(areaId);
    const art = useMemo(
        () => resolveSpritePath(areaSet?.areaBannerArt || areaSet?.areaArt),
        [areaSet]
    );

    return (
        <div className="absolute inset-0 z-0 overflow-hidden">
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: bgUrl(art),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'pixelated'
                }}
            >
                {!art && <div className="absolute inset-0 bg-gi-surface" />}
            </div>
        </div>
    );
};

export default AreaMat;

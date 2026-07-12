import React, { useMemo } from 'react';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

const bgUrl = (p) => (p ? `url(${p.startsWith('/') ? p : '/' + p})` : undefined);

/**
 * AreaMat — the banner's full-bleed background art (concept §11 mat).
 *
 * Two "curtains", each a full-banner static art layer: the Wilds (area) art and
 * the Outpost (station) art. Neither ever scales or shifts — a **clip boundary**
 * slides across them, revealing more of one and less of the other (like a
 * curtain being pulled back; owner request 2026-07-10). The boundary sits at 80%
 * in Adventure (mostly Wilds, a sliver of Outpost) and animates to 20% in
 * Stationed (mostly Outpost, a sliver of Wilds). Each layer renders **sharp**
 * (`image-rendering: pixelated`, `background-size: cover` — sized to the whole
 * banner, so it stays fixed) at **full colour** (no dimming overlay).
 *
 * Art source (per area, with fallbacks):
 *   - Wilds:   `areaBannerArt` → `areaArt`
 *   - Station: `stationBannerArt` → `outpostArt` → `stationArt` → `campArt`
 *
 * Shared by the regular row and every focus view so the background is identical
 * across them.
 */
export const AreaMat = ({ areaId, stationed = false }) => {
    const areaSet = getAreaSet(areaId);
    const wildsArt = useMemo(
        () => resolveSpritePath(areaSet?.areaBannerArt || areaSet?.areaArt),
        [areaSet]
    );
    const stationArt = useMemo(
        () => resolveSpritePath(areaSet?.stationBannerArt || areaSet?.outpostArt || areaSet?.stationArt || areaSet?.campArt),
        [areaSet]
    );

    // Boundary as a % of banner width from the left: 80% Wilds in Adventure,
    // 20% Wilds in Stationed. Only this value animates — the art never moves.
    const boundary = stationed ? 20 : 80;

    const art = (src) => ({
        backgroundImage: bgUrl(src),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
    });

    return (
        <div className="absolute inset-0 z-0 overflow-hidden">
            {/* Wilds curtain — full-banner static art, revealed from the left edge
                up to the boundary. Only the clip animates. */}
            <div
                className="absolute inset-0 transition-[clip-path] duration-500 ease-in-out"
                style={{ ...art(wildsArt), clipPath: `inset(0 ${100 - boundary}% 0 0)` }}
            >
                {!wildsArt && <div className="absolute inset-0 bg-gi-surface" />}
            </div>

            {/* Outpost curtain — full-banner static art, revealed from the right edge
                back to the boundary. */}
            <div
                className="absolute inset-0 transition-[clip-path] duration-500 ease-in-out"
                style={{ ...art(stationArt), clipPath: `inset(0 0 0 ${boundary}%)` }}
            >
                {!stationArt && <div className="absolute inset-0 bg-gi-base" />}
            </div>
        </div>
    );
};

export default AreaMat;

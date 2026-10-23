import React from 'react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useLiveMatFit } from './MatFitContext.jsx';

/**
 * The bar's height in px: the studded frame's 6 px band above and below 64 px of content, a row of
 * item bars with 32 px sprites and title-size text. The mat does not sit under it: `ReactRoot`
 * stacks the bar above `Board` in a column, so the box `Board` measures for its fit
 * (`useBoardScale`) is this much shorter and the mat shrinks to match.
 */
export const MAT_TOP_BAR_PX = 76;

/**
 * The bar's own icons, drawn at 32 px, their art's own size. Placeholders until the owner draws the
 * Token and upkeep icons (owner_art_list.md).
 */
export const TOP_BAR_ICON = Object.freeze({
    TOKENS: '/assets/ui/u_tree.png',
    UPKEEP: '/assets/ui/u_coin_small.png'
});

/** One of {@link TOP_BAR_ICON}, crisp at the item bar's 32 px. */
export const TopBarIcon = ({ src }) => (
    <img src={src} alt="" draggable={false} width={32} height={32} className="select-none pointer-events-none" style={{ imageRendering: 'pixelated' }} />
);

/**
 * The bar's width in px: the mat's own on-screen width (its size in mat units times the fit
 * `Board` reports), so the bar's ends line up with the mat's edges. It follows a window resize,
 * a column opening and the Mat Tuner, all of which change one of the two.
 */
export function useMatScreenWidth() {
    const mat = useMatSize();
    const fit = useLiveMatFit();
    return Math.round(mat.w * fit);
}

/**
 * The mat's top bar: a strip above the mat, exactly as wide as it, in the studded pixel frame with
 * its hard shadow. Three parts:
 * * **left**: the Region name on its banner,
 * * **middle**, centred on the mat: the Token cap and Upkeep, or the map mode's banner while a
 *   mode is on,
 * * **right**, at the mat's right edge: controls (the Disallow and Demolish toggles).
 * Only drawn on the playmat, never on the Guild Hall upgrade screen ({@link showsMatTopBar}).
 * @param {{ left?: React.ReactNode, middle?: React.ReactNode, right?: React.ReactNode, width?: number }} props
 *   `width` for tests; the mat's on-screen width otherwise
 */
export const MatTopBar = ({ left = null, middle = null, right = null, width }) => {
    const matWidth = useMatScreenWidth();
    return (
        <PixelFrame
            kind={FRAME_KIND.STUDS}
            data-mat-top-bar
            style={{ height: MAT_TOP_BAR_PX, width: width ?? matWidth, maxWidth: '100%' }}
            className="shrink-0 self-center select-none pointer-events-auto z-20"
            // ⚠️ Equal side columns keep the middle on the mat's centre line whatever the two ends hold.
            frameClassName="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-3 pr-1 ui-text-title text-amber-100"
        >
            <div data-mat-top-bar-left className="flex items-center gap-2 h-full">{left}</div>
            <div data-mat-top-bar-middle className="flex items-center justify-center gap-2 min-w-0 h-full">{middle}</div>
            <div data-mat-top-bar-right className="flex items-center gap-2 h-full justify-self-end">{right}</div>
        </PixelFrame>
    );
};

/** Whether the bar is drawn for a fullscreen view: the playmat only, not the Guild Hall upgrade screen. */
export function showsMatTopBar(view) {
    return view !== 'guild';
}

export default MatTopBar;

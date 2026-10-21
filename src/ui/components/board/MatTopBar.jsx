import React from 'react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';

/**
 * The bar's height in px: a slim bar, the studded frame's 6 px band above and below 32 px of
 * content: a row of body-size item bars, or a mode banner's two body-size lines. The mat does
 * not sit under it: `ReactRoot` stacks the bar above `Board` in a column, so the box `Board`
 * measures for its fit (`useBoardScale`) is this much shorter and the mat shrinks to match.
 */
export const MAT_TOP_BAR_PX = 44;

/**
 * The bar's own icons, drawn at 16 px to sit in the item bars' sprite boxes. Placeholders (32 px
 * art at half size) until the owner draws the Region, Token and upkeep icons (owner_art_list.md).
 */
export const TOP_BAR_ICON = Object.freeze({
    REGION: '/assets/ui/u_flag_pennant.png',
    TOKENS: '/assets/ui/u_tree.png',
    UPKEEP: '/assets/ui/u_coin_small.png'
});

/** One of {@link TOP_BAR_ICON}, crisp at the item bar's 16 px. */
export const TopBarIcon = ({ src }) => (
    <img src={src} alt="" draggable={false} width={16} height={16} className="select-none pointer-events-none" style={{ imageRendering: 'pixelated' }} />
);

/**
 * The mat's top bar: a slim strip across the top of the board area in the studded pixel frame
 * with its hard shadow. Three parts:
 * * **left**: information in the item bar style (the Region name, the Token cap, Upkeep),
 * * a **flexible middle**: the map mode's banner while a mode is on, empty otherwise,
 * * **right**: controls (the Disallow and Demolish toggles).
 * Only drawn on the playmat, never on the Guild Hall upgrade screen ({@link showsMatTopBar}).
 * @param {{ left?: React.ReactNode, middle?: React.ReactNode, right?: React.ReactNode }} props
 */
export const MatTopBar = ({ left = null, middle = null, right = null }) => (
    <PixelFrame
        kind={FRAME_KIND.STUDS}
        data-mat-top-bar
        style={{ height: MAT_TOP_BAR_PX }}
        className="shrink-0 w-full select-none pointer-events-auto z-20"
        frameClassName="w-full flex items-center gap-3 px-1 ui-text-body text-amber-100"
    >
        <div data-mat-top-bar-left className="flex items-center gap-2 shrink-0 h-full">{left}</div>
        <div data-mat-top-bar-middle className="flex-1 min-w-0 h-full">{middle}</div>
        <div data-mat-top-bar-right className="flex items-center gap-2 shrink-0 h-full">{right}</div>
    </PixelFrame>
);

/** Whether the bar is drawn for a fullscreen view: the playmat only, not the Guild Hall upgrade screen. */
export function showsMatTopBar(view) {
    return view !== 'guild';
}

export default MatTopBar;

import React from 'react';

/**
 * The bar's height in px (FB-28: "a thin bar"). The mat does not sit under it:
 * `ReactRoot` stacks the bar above `Board` in a column, so the box `Board`
 * measures for its fit (`useBoardScale`) is this much shorter and the mat
 * shrinks to match.
 */
export const MAT_TOP_BAR_PX = 30;

/**
 * ⭐ **The mat's top bar** (Token Lifecycle feedback B2, FB-28): a slim wooden
 * strip across the top of the board area, styled like the mat's brown frame.
 *
 * Three parts, by owner decision (B2 bar style, 2026-09-27):
 * * **left** — information (the Token cap, B2.1; Upkeep, B2.2),
 * * a **flexible middle**, empty, kept for future mat controls,
 * * **right** — controls (disallow mode and *Allow all*, B2.3; the Time Bank).
 *
 * Only drawn on the playmat — never on the Guild Hall upgrade screen
 * ({@link showsMatTopBar}).
 *
 * @param {{ left?: React.ReactNode, right?: React.ReactNode }} props
 */
export const MatTopBar = ({ left = null, right = null }) => (
    <div
        data-mat-top-bar
        style={{ height: MAT_TOP_BAR_PX }}
        className="shrink-0 w-full flex items-center gap-2 px-3 bg-gradient-to-b from-[#5c3e2e] to-[#3a271d] border-b-2 border-[#2a1d15] shadow-[0_2px_6px_rgba(0,0,0,0.6)] font-pixel text-[11px] text-amber-100 select-none pointer-events-auto relative z-20"
    >
        <div data-mat-top-bar-left className="flex items-center gap-2 min-w-0 h-full">{left}</div>
        <div data-mat-top-bar-middle className="flex-1 min-w-0" />
        <div data-mat-top-bar-right className="flex items-center gap-2 shrink-0 h-full">{right}</div>
    </div>
);

/** Whether the bar is drawn for a fullscreen view: the playmat only, not the Guild Hall upgrade screen. */
export function showsMatTopBar(view) {
    return view !== 'guild';
}

export default MatTopBar;

import React from 'react';
import { createPortal } from 'react-dom';
import { placeUnder } from './tooltipPlacement.js';

/**
 * The top bar's small hover tooltip: one frame, a gold title and a line or two. Never catches the
 * pointer. The badges' tooltips all use this so they read alike.
 * @param {{ anchor: Element|null, title: string, lines?: string[], width?: number }} props
 */
export const TopBarTip = ({ anchor, title, lines = [], width = 240 }) => {
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div
            role="tooltip"
            data-top-bar-tip
            className="fixed z-[90] p-2 rounded-lg pointer-events-none bg-black/90 border border-gi-gold/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-[11px] leading-snug text-white"
            style={{ width, ...placeUnder(anchor, width, 40 + lines.length * 16) }}
        >
            <div className="font-bold text-gi-gold">{title}</div>
            {lines.map((line, i) => <div key={i} className="text-white/70">{line}</div>)}
        </div>,
        document.body
    );
};

export default TopBarTip;

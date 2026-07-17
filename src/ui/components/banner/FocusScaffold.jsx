import React from 'react';
import { X } from 'lucide-react';
import { useEngine } from '../../hooks/useEngine.js';
import { useCardTier, BANNER_FOOTER_H, BANNER_BADGE_ROW_H } from './BannerLayout.jsx';
import { AreaMat } from './AreaMat.jsx';

/**
 * FocusScaffold — the shared shell every inline Focus view uses (§11.D):
 * the area mat + a header band (title + close) + a horizontal row of card slots.
 *
 * This is the single place that defines "what a focus view looks like." Deck,
 * Hero (Equip) and Station (Recipe) focus all compose from it, so restyling
 * here restyles all of them at once (owner request 2026-07-09).
 *
 * A focus view is just a DIFFERENT OVERLAY on the SAME banner (owner request
 * 2026-07-10): it reuses the regular row's mat (shared AreaMat — same static
 * full-bleed art) and matches the regular row's header height (h-20) + card-row
 * spacing (gap-4 / px-3 py-3) and card-tier height, so the banner's background
 * art and overall height never change when you enter or leave a focus view.
 *
 * Callers pass their anchor card + slot cards as children.
 */
export const FocusScaffold = ({ areaId, title, onClose, children }) => {
    const engine = useEngine();
    const { height } = useCardTier();

    // Mode can't be toggled while a focus view is open (the toggle lives in the
    // regular row, which is unmounted here), so a one-time read is stable.
    const stationed = (engine.GameState.areaStates?.[areaId]?.mode || 'adventure') !== 'adventure';

    return (
        <div className="relative rounded-xl border border-gi-primary/60 overflow-hidden shadow-lg">
            {/* Mat — the same static full-bleed art as the regular row (AreaMat), so
                the focus view reads as the same banner with a different overlay. */}
            <AreaMat areaId={areaId} stationed={stationed} />

            {/* Floating overlay — header band (matches BannerHeader's h-12) + card row
                + footer band, so the banner height matches the regular row exactly. */}
            <div className="relative z-10 flex flex-col">
                <div className="flex items-center justify-between h-12 px-3">
                    <span className="gi-card-title font-bold text-white tracking-widest uppercase truncate">{title}</span>
                    <button
                        onClick={onClose}
                        title="Done"
                        className="p-1 rounded text-gi-muted hover:text-gi-text transition-colors shrink-0"
                    >
                        <X size={16} />
                    </button>
                </div>
                {/* Scroll container spans the card row + footer band. Long card lists
                    scroll horizontally; the visible scroll bar renders at the bottom,
                    i.e. down in the footer band. */}
                <div
                    className="banner-scroll overflow-x-auto overflow-y-hidden"
                    style={{ height: height + BANNER_BADGE_ROW_H + BANNER_FOOTER_H }}
                >
                    <div className="flex items-end gap-4 px-3" style={{ height: height + BANNER_BADGE_ROW_H }}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FocusScaffold;

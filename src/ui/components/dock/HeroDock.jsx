import React, { useState } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { DOCK_OVERLAP, DOCK_RESERVED_H, DOCK_Z } from './dockConstants.js';

/**
 * HeroDock — the always-visible strip of hero tabs along the bottom edge
 * (concept §1–2). Replaces the pop-out hero side drawer.
 *
 * Three things the concept asks for and this delivers:
 *  - **Fixed, predictable positions.** Tabs render in roster order and never
 *    reorder themselves, so a hero's tab is always where you last saw it.
 *  - **Overlapping hand of cards.** Each tab covers `DOCK_OVERLAP` of its
 *    neighbour, and hovering lifts one clear of the stack.
 *  - **It floats.** The dock overlays the play area rather than displacing it
 *    (roadmap D9); the banner list pads its scroll area by `DOCK_RESERVED_H`
 *    so the last banner can still be scrolled into view.
 *
 * Pinning (Phase 5) and dragging (Phase 6) land on top of this. For now a tab
 * is a button that does nothing on click.
 */
export const HeroDock = () => {
    // Roster order drives tab order. A list of ids keeps this a flat
    // projection per the useGameState selector contract.
    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        ['heroes_updated', 'state_changed']
    ) || [];

    // Which tab is hovered, so it can rise above the neighbours overlapping
    // it. This has to be state rather than a `hover:` class: the resting
    // z-index is an inline style, and inline styles beat utility classes.
    const [hovered, setHovered] = useState(null);

    if (heroIds.length === 0) return null;

    return (
        <div
            data-dnd-surface="dock"
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
            style={{ zIndex: DOCK_Z, height: DOCK_RESERVED_H }}
        >
            <div
                role="list"
                aria-label="Hero roster"
                // pt-2 leaves room for the hover lift, which would otherwise clip.
                className="pointer-events-auto relative flex items-end pt-2 px-2 max-w-full overflow-x-auto overflow-y-visible custom-scrollbar"
            >
                {heroIds.map((heroId, i) => (
                    <div
                        key={heroId}
                        role="listitem"
                        onMouseEnter={() => setHovered(heroId)}
                        onMouseLeave={() => setHovered(prev => (prev === heroId ? null : prev))}
                        style={{
                            // Overlap every tab after the first, and keep the
                            // left-most on top so the strip reads like a hand
                            // fanned out to the right.
                            marginLeft: i === 0 ? 0 : -DOCK_OVERLAP,
                            zIndex: hovered === heroId ? heroIds.length + 1 : heroIds.length - i
                        }}
                    >
                        <HeroDockTab heroId={heroId} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HeroDock;

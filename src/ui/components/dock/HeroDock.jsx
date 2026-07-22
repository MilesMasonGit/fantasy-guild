import React, { useState, useEffect } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { HeroDockCard } from './HeroDockCard.jsx';
import { DOCK_OVERLAP, DOCK_RESERVED_H, DOCK_Z } from './dockConstants.js';

/**
 * HeroDock — the always-visible strip of hero cards along the bottom edge
 * (concept §1–2). Replaces the pop-out hero side drawer.
 *
 * Three things the concept asks for and this delivers:
 *  - **Fixed, predictable positions.** Cards render in roster order and never
 *    reorder themselves, so a hero is always where you last saw them.
 *  - **Overlapping hand of cards.** Each card covers `DOCK_OVERLAP` of its
 *    neighbour; hovering lifts one clear, and pinning pulls it fully up.
 *  - **It floats.** The dock overlays the play area rather than displacing it
 *    (roadmap D9); the banner list pads its scroll area by `DOCK_RESERVED_H`
 *    so the last banner can still be scrolled into view.
 */
export const HeroDock = ({ dock }) => {
    // Roster order drives card order. A list of ids keeps this a flat
    // projection per the useGameState selector contract.
    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        ['heroes_updated', 'state_changed']
    ) || [];

    // Which card is hovered, so it can rise above the cards overlapping it.
    // This has to be state rather than a `hover:` class: the resting z-index
    // is an inline style, and inline styles beat utility classes.
    const [hovered, setHovered] = useState(null);

    const { pinned, togglePin, unpinAll } = dock;
    const hasPinned = pinned.length > 0;

    // Clicking anywhere outside the dock closes every pinned card (D11).
    // Bound on the capture phase so it still fires when the click lands on
    // something that stops propagation, and only while something is open.
    useEffect(() => {
        if (!hasPinned) return;
        const onPointerDown = (e) => {
            if (e.target.closest?.('[data-dnd-surface="dock"]')) return;
            unpinAll();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [hasPinned, unpinAll]);

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
                {heroIds.map((heroId, i) => {
                    const isPinned = pinned.includes(heroId);
                    return (
                        <div
                            key={heroId}
                            role="listitem"
                            data-hero-id={heroId}
                            data-pinned={isPinned || undefined}
                            onMouseEnter={() => setHovered(heroId)}
                            onMouseLeave={() => setHovered(prev => (prev === heroId ? null : prev))}
                            style={{
                                // Overlap every card after the first, and keep
                                // the left-most on top so the strip reads like
                                // a hand fanned out to the right.
                                marginLeft: i === 0 ? 0 : -DOCK_OVERLAP,
                                // Pinned beats hovered beats resting order, so
                                // an open card is never clipped by a neighbour.
                                zIndex: isPinned
                                    ? heroIds.length + 2
                                    : hovered === heroId
                                        ? heroIds.length + 1
                                        : heroIds.length - i
                            }}
                        >
                            <HeroDockCard
                                heroId={heroId}
                                pinned={isPinned}
                                onToggle={() => togglePin(heroId)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HeroDock;

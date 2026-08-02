import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { HeroDockCard } from './HeroDockCard.jsx';
import {
    DOCK_OVERLAP, DOCK_OVERLAP_SMALL, DOCK_RESERVED_H, DOCK_Z, DOCK_SFX,
    dockNeedsSmallMode, dockNeedsHScroll
} from './dockConstants.js';

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

    // Small Mode: measured from the dock's own width against what this roster
    // actually needs. See dockNeedsSmallMode for why it doesn't ride the
    // banner card tier the way roadmap F5 suggested.
    const shellRef = useRef(null);
    const [availableWidth, setAvailableWidth] = useState(0);
    useEffect(() => {
        const el = shellRef.current;
        if (!el) return;

        const measure = () => setAvailableWidth(el.getBoundingClientRect().width);
        measure();

        // Belt and braces: a ResizeObserver catches layout changes that don't
        // resize the window (the bubble column moving side, a drawer opening),
        // and a window listener covers plain resizes. The listener is not
        // redundant — ResizeObserver does not fire at all in the dev preview
        // harness, so without it Small Mode could never be exercised there.
        const ro = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(measure)
            : null;
        ro?.observe(el);
        window.addEventListener('resize', measure);

        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', measure);
        };
        // Re-attaches when the shell first appears: the dock renders null with
        // an empty roster, so on a brand-new game the ref is still null here.
    }, [heroIds.length]);
    const small = dockNeedsSmallMode(availableWidth, heroIds.length);
    // Only pay for a real scrollbar when the roster genuinely doesn't fit —
    // see dockNeedsHScroll for why overflow-x has to stay `visible` otherwise.
    const hScroll = dockNeedsHScroll(availableWidth, heroIds.length, small);

    const engine = useEngine();
    const { pinned, togglePin, unpinAll } = dock;
    const hasPinned = pinned.length > 0;

    // Recall: drag a deployed hero off their banner and drop them anywhere on
    // the dock. Only a payload carrying `from` qualifies — a hero dragged out
    // of the dock itself has nowhere to be recalled from. Same contract the
    // retired side drawer's `hero-recall` target used.
    const recall = useEntityDrop({
        id: 'dock-recall',
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.HERO && !!p.from?.areaId,
        onDrop: p => engine.HeroAssignmentManager.unassignHero(p.from.areaId)
    });

    // Pulling a card up and pushing it back get their own cloth sounds,
    // distinct from the drag SFX the shared drag layer already fires.
    const handleToggle = (heroId, isPinned) => {
        engine.EventBus.publish('audio:play', {
            clip: isPinned ? DOCK_SFX.unpin : DOCK_SFX.pin
        });
        togglePin(heroId);
    };

    // Clicking anywhere outside the dock closes every pinned card (D11).
    // Bound on the capture phase so it still fires when the click lands on
    // something that stops propagation, and only while something is open.
    //
    // POINTERUP, not pointerdown (found 2026-08-02): a drag gesture's first
    // event IS a pointerdown, so binding this to pointerdown meant starting
    // ANY drag from outside the dock — e.g. picking up a food item in the
    // Bank to equip it — closed the pinned card (and unmounted its drop
    // target) before the drag ever got there, immediately undoing the
    // equipment-grid drop-target fix from earlier the same day. pointerup
    // fires at the END of the gesture instead: for a plain click that's the
    // same spot (still correctly detected as outside), and for a drag it's
    // wherever the item was DROPPED — inside the dock when equipping onto an
    // open card, so the still-open target is exactly what receives the drop.
    useEffect(() => {
        if (!hasPinned) return;
        const onPointerUp = (e) => {
            if (e.target.closest?.('[data-dnd-surface="dock"]')) return;
            unpinAll();
        };
        document.addEventListener('pointerup', onPointerUp, true);
        return () => document.removeEventListener('pointerup', onPointerUp, true);
    }, [hasPinned, unpinAll]);

    if (heroIds.length === 0) return null;

    return (
        <div
            ref={shellRef}
            data-dnd-surface="dock"
            // Tagged as a drawer REGION so the drag ghost stays compact over
            // the dock and only blooms into a full card over the board — the
            // same "bloom on cross-over" rule the drawers use.
            data-dnd-region={DND_SURFACE.DRAWER}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
            style={{ zIndex: DOCK_Z, height: DOCK_RESERVED_H }}
        >
            <div
                ref={recall.setNodeRef}
                role="list"
                aria-label="Hero roster"
                // pt-2 leaves room for the hover lift, which would otherwise clip.
                className={cn(
                    'pointer-events-auto relative flex items-end pt-2 px-2 max-w-full',
                    'overflow-y-visible custom-scrollbar rounded-t-xl',
                    hScroll ? 'overflow-x-auto' : 'overflow-x-visible',
                    recall.valid && 'ring-2 ring-gi-success/70 bg-gi-success/5'
                )}
                {...recall.droppableProps}
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
                                marginLeft: i === 0 ? 0 : -(small ? DOCK_OVERLAP_SMALL : DOCK_OVERLAP),
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
                                small={small}
                                onToggle={() => handleToggle(heroId, isPinned)}
                                onEdit={() => dock.openEdit(heroId)}
                                bodyView={dock.bodyView}
                                onToggleBodyView={dock.toggleBodyView}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HeroDock;

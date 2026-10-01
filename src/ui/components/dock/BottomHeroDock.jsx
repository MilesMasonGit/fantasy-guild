import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { DockHeroFigure } from './DockHeroFigure.jsx';
import { DOCK_STRIP_PX, DOCK_SLOT_PX, DOCK_SLOT_MIN_PX, dockArtPx } from './dockHeroView.js';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { HeroManager } from '../../../systems/hero/HeroManager.js';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { reorderHeroInDock } from './dockReorder.js';

/**
 * Whether the horizontal hero dock shows under the main surface. It shows on
 * the playmat and is left out of the Guild Hall upgrade screen (Token
 * Lifecycle feedback Q7, FB-47). `fullscreenView` is `ui.fullscreen.view`.
 */
export function showsBottomHeroDock(fullscreenView) {
    return fullscreenView !== 'guild';
}

/**
 * ⭐ **The horizontal hero dock: a dark strip with the heroes standing in it**
 * (B10, FB-46). No ledge, no tabs: each hero idles at the mat's own art size,
 * cut off at the waist by the strip's bottom edge, with a name and HP bar over
 * the head (`DockHeroFigure`). Heroes out on the mat are darkened and sunk.
 *
 * The strip stays a drop target for recalls (a flag, or a hero dragged off the
 * mat) as before. The inspection sheet still slides up from it. The vertical
 * hero panel beside the Bank (`BankHeroPanel`) is a separate component and is
 * unchanged.
 *
 * `isBankOpen` is still accepted but no longer changes anything: it only
 * forced the old tabs open.
 */
export const BottomHeroDock = ({
    // eslint-disable-next-line no-unused-vars
    isBankOpen = false,
    selectedHeroId,
    onSelectHero,
    onDoubleClickHero,
    onCloseHero,
    onEditHero
}) => {
    const asideRef = useRef(null);
    const [displayedHeroId, setDisplayedHeroId] = useState(selectedHeroId);

    useEffect(() => {
        if (selectedHeroId) {
            setDisplayedHeroId(selectedHeroId);
        }
    }, [selectedHeroId]);

    const isOpen = Boolean(selectedHeroId);

    // The same art size the mat draws its heroes at (FP-99's whole steps).
    const artPx = dockArtPx(useLiveMatFit());

    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        ['heroes_updated', 'state_changed']
    ) || [];

    const handleReorderHero = (sourceHeroId, targetHeroId) =>
        reorderHeroInDock(HeroManager, heroIds, sourceHeroId, targetHeroId);

    const engine = useEngine();

    useEffect(() => {
        if (!selectedHeroId) return;

        const handlePointerDown = (e) => {
            if (asideRef.current && asideRef.current.contains(e.target)) return;
            if (
                e.target.closest('[data-dnd-surface="drawer"]') ||
                e.target.closest('[data-dnd-region="drawer"]') ||
                e.target.closest('[data-item-id]') ||
                e.target.closest('[data-bank-tab]') ||
                // The Bank-side hero panel (its tabs AND its own inspection
                // sheet) is a separate aside this dock doesn't contain, but a
                // click there is still "inside" (CR3-450). The playmat, or
                // anywhere else, is genuinely outside and still closes it.
                e.target.closest('[data-bank-hero-panel]')
            ) {
                return;
            }
            onCloseHero?.();
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onCloseHero?.();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedHeroId, onCloseHero]);

    const recall = useEntityDrop({
        id: 'bottom-dock-recall',
        surface: DND_SURFACE.DRAWER,
        accepts: p => isRecallDrop(p) || (p.kind === DRAG_KIND.HERO && !!p.from?.areaId),
        onDrop: p => {
            if (isRecallDrop(p)) {
                recallFromDrop(engine.BoardPlacement, p);
            } else if (p.from?.areaId) {
                engine.HeroAssignmentManager?.unassignHero(p.from.areaId);
            }
        }
    });

    return (
        // Overflow stays VISIBLE upward: the heroes' heads, names and HP bars
        // may stand over the bottom of the mat. z-40 keeps them above the mat
        // (z-0) and under the drawers and modals, as the old dock sat.
        <aside
            ref={mergeRefs(recall.setNodeRef, asideRef)}
            data-dnd-region={DND_SURFACE.DRAWER}
            data-bottom-hero-dock="true"
            data-dock-art-px={artPx}
            style={{ height: DOCK_STRIP_PX }}
            className={cn(
                'w-full shrink-0 pointer-events-auto select-none relative z-40 overflow-visible',
                'bg-gradient-to-b from-[#0d0907]/90 to-[#050302] border-t border-black/60 shadow-[0_-6px_18px_rgba(0,0,0,0.45)]',
                recall.valid && 'ring-2 ring-gi-success/70 bg-gi-success/5'
            )}
            {...recall.droppableProps}
        >
            {/* Hero Inspection Sheet sliding UP from the dock, clear of the names. */}
            <div
                className={cn(
                    "absolute left-1/2 -translate-x-1/2 w-[368px] md:w-[400px] xl:w-[400px] 2xl:w-[420px] h-[700px] max-h-[75vh] z-30 transition-all duration-200 ease-out",
                    isOpen
                        ? "translate-y-0 opacity-100 pointer-events-auto"
                        : "translate-y-8 opacity-0 pointer-events-none"
                )}
                style={{ bottom: Math.max(DOCK_STRIP_PX, artPx / 2) + 28 }}
            >
                {displayedHeroId && (
                    <HeroInspectionSheet
                        heroId={displayedHeroId}
                        onClose={onCloseHero}
                        onEdit={onEditHero}
                    />
                )}
            </div>

            {/* The heroes, one row. On a narrow window each slot shrinks
                (88 px down to 48 px) before the row runs out of room. */}
            <div className="absolute inset-0 flex flex-row items-end justify-center gap-1 px-2 z-40">
                {heroIds.map((heroId, index) => (
                    <motion.div
                        key={heroId}
                        layout="position"
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        className="relative flex"
                        style={{ flex: `0 1 ${DOCK_SLOT_PX}px`, minWidth: DOCK_SLOT_MIN_PX }}
                    >
                        <DockHeroFigure
                            heroId={heroId}
                            index={index}
                            heroIds={heroIds}
                            artPx={artPx}
                            isSelected={selectedHeroId === heroId}
                            onSelect={onSelectHero}
                            onDoubleClick={onDoubleClickHero}
                            onReorder={handleReorderHero}
                        />
                    </motion.div>
                ))}
            </div>
        </aside>
    );
};

export default BottomHeroDock;

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { DockHeroFigure } from './DockHeroFigure.jsx';
import { DOCK_STRIP_PX, DOCK_SLOT_PX, DOCK_SLOT_MIN_PX, dockArtPx } from './dockHeroView.js';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { HeroManager } from '../../../systems/hero/HeroManager.js';
import { reorderHeroInDock } from './dockReorder.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The roster: the mat's bottom edge, one thin line and no fill, with every hero standing on it.
 * Each hero idles at the mat's own art size, cut off at the waist by the strip's bottom edge,
 * with a name, an HP bar and what they are doing (idle, busy, hurt) over the head
 * (`DockHeroFigure`). Every hero is also on the mat: a click finds them there (outlined, their
 * sheet open), hovering lights them and their job, and dragging one gives them an order.
 */
export const BottomHeroDock = ({
    selectedHeroId,
    onSelectHero,
    onDoubleClickHero
}) => {
    // The same art size the mat draws its heroes at (whole steps).
    const fit = useLiveMatFit();
    const artPx = dockArtPx(fit);

    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    ) || [];

    const handleReorderHero = useCallback(
        (sourceHeroId, targetHeroId) => reorderHeroInDock(HeroManager, heroIds, sourceHeroId, targetHeroId),
        [heroIds]
    );

    return (
        <DockStrip artPx={artPx}>
            {/**
             * The heroes, one row. On a narrow window each slot shrinks (`DOCK_SLOT_PX` down to `DOCK_SLOT_MIN_PX`)
             * before the row runs out of room.
             */}
            <div className="absolute inset-y-0 left-0 right-0 flex flex-row items-end justify-center px-2 z-40">
                {heroIds.map((heroId, index) => (
                    <motion.div
                        key={heroId}
                        data-dock-slot={heroId}
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
        </DockStrip>
    );
};

/** The bar's strip: no drop target of its own (a hero dropped here simply stays where they were). */
const DockStrip = ({ artPx, children }) => (
    // Overflow stays VISIBLE upward: the heroes' heads, names and HP bars may stand over the
    // bottom of the mat. z-40 keeps them above the mat (z-0) and under the drawers and modals.
    <aside
        data-dnd-region={DND_SURFACE.DRAWER}
        data-bottom-hero-dock="true"
        data-dock-art-px={artPx}
        style={{ height: DOCK_STRIP_PX }}
        className={cn(
            'w-full shrink-0 pointer-events-auto select-none relative z-40 overflow-visible',
            'border-t border-white/15'
        )}
    >
        {children}
    </aside>
);

export default BottomHeroDock;

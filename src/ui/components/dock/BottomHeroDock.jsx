import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { DockHeroFigure } from './DockHeroFigure.jsx';
import { WorkRulesButton } from './WorkRulesDrawer.jsx';
import { DOCK_STRIP_PX, DOCK_SLOT_PX, DOCK_SLOT_MIN_PX, dockArtPx } from './dockHeroView.js';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { HeroManager } from '../../../systems/hero/HeroManager.js';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { reorderHeroInDock } from './dockReorder.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * Whether the horizontal hero dock shows under the main surface. It shows on the playmat and
 * is left out of the Guild Hall upgrade screen. `fullscreenView` is `ui.fullscreen.view`.
 */
export function showsBottomHeroDock(fullscreenView) {
    return fullscreenView !== 'guild';
}

/**
 * The horizontal hero dock: the mat's bottom edge, one thin line and no fill, with the heroes
 * standing on it. No ledge, no tabs:
 * each hero idles at the mat's own art size, cut off at the waist by the strip's bottom edge,
 * with a name and HP bar over the head (`DockHeroFigure`). Heroes out on the mat are darkened
 * and sunk.
 * The strip stays a drop target for recalls (a flag, or a hero dragged off the mat). Clicking a
 * hero opens the side hero panel (`BankHeroPanel`); `selectedHeroId` only marks it here.
 * The Work Rules button at the left end toggles the rules drawer (`WorkRulesDrawer`).
 */
export const BottomHeroDock = ({
    selectedHeroId,
    onSelectHero,
    onDoubleClickHero,
    rulesOpen = false,
    onToggleRules
}) => {
    // The same art size the mat draws its heroes at (whole steps).
    const artPx = dockArtPx(useLiveMatFit());

    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.STATE_CHANGED]
    ) || [];

    const handleReorderHero = (sourceHeroId, targetHeroId) =>
        reorderHeroInDock(HeroManager, heroIds, sourceHeroId, targetHeroId);

    const engine = useEngine();

    const recall = useEntityDrop({
        id: 'bottom-dock-recall',
        surface: DND_SURFACE.DRAWER,
        accepts: isRecallDrop,
        onDrop: p => recallFromDrop(engine.BoardPlacement, p)
    });

    return (
        // Overflow stays VISIBLE upward: the heroes' heads, names and HP bars may stand over
        // the bottom of the mat. z-40 keeps them above the mat (z-0) and under the drawers and
        // modals.
        <aside
            ref={recall.setNodeRef}
            data-dnd-region={DND_SURFACE.DRAWER}
            data-bottom-hero-dock="true"
            data-dock-art-px={artPx}
            style={{ height: DOCK_STRIP_PX }}
            className={cn(
                'w-full shrink-0 pointer-events-auto select-none relative z-40 overflow-visible',
                'border-t border-white/15',
                recall.valid && 'ring-2 ring-gi-success/70 bg-gi-success/5'
            )}
            {...recall.droppableProps}
        >
            {onToggleRules && <WorkRulesButton open={rulesOpen} onToggle={onToggleRules} />}
            {/**
             * The heroes, one row. On a narrow window each slot shrinks (`DOCK_SLOT_PX` down to `DOCK_SLOT_MIN_PX`)
             * before the row runs out of room.
             */}
            <div className="absolute inset-0 flex flex-row items-end justify-center px-2 z-40">
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
        </aside>
    );
};

export default BottomHeroDock;

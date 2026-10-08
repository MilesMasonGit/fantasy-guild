import { useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { HeroManager } from '../../../systems/hero/HeroManager.js';
import { reorderHeroInDock } from './dockReorder.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

export const BankHeroPanel = ({
    menuRight,
    selectedHeroId,
    onSelectHero,
    onDoubleClickHero,
    onCloseHero,
    onEditHero
}) => {
    const asideRef = useRef(null);
    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.STATE_CHANGED]
    ) || [];

    const isOpen = Boolean(selectedHeroId);

    // Wired the same as the bottom dock (BottomHeroDock.jsx's handleReorderHero): this panel
    // accepted and highlighted a hero-reorder drop (HeroDockTab draws the insertion line on
    // its own), but would silently drop it if no onReorder were passed in.
    const handleReorderHero = (sourceHeroId, targetHeroId) =>
        reorderHeroInDock(HeroManager, heroIds, sourceHeroId, targetHeroId);

    // The panel sits on the side opposite the nav: with the menu on the right it is on the
    // left, otherwise on the right.
    const isDockLeft = menuRight;

    return (
        <aside
            ref={asideRef}
            // Exempts this whole panel (hero tabs + inspection sheet) from the bottom dock's
            // outside-click listener: the bottom dock stays mounted under the Bank, so without
            // this marker any click in here looked 'outside' to it and closed the sheet early.
            data-bank-hero-panel="true"
            className={cn(
                'absolute inset-y-0 z-[100] pointer-events-none flex flex-col justify-center gap-3 py-4 w-full',
                isDockLeft ? 'left-0' : 'right-0'
            )}
        >
            <div className="flex flex-col items-center gap-3 w-full relative z-[110]">
                {heroIds.map((heroId, index) => (
                    <div key={heroId} className="w-full h-[72px] relative">
                        <HeroDockTab
                            heroId={heroId}
                            index={index}
                            heroIds={heroIds}
                            isSelected={selectedHeroId === heroId}
                            onSelect={onSelectHero}
                            onDoubleClick={onDoubleClickHero}
                            onEdit={onEditHero}
                            onReorder={handleReorderHero}
                            isDockLeft={isDockLeft}
                        />
                    </div>
                ))}
            </div>

            {/* The hero inspection drawer that opens from the side */}
            <div
                className={cn(
                    "absolute top-0 bottom-0 w-full transition-all duration-200 ease-out flex items-center py-4 z-[100] pointer-events-auto",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
                    isOpen ? "translate-x-0" : (isDockLeft ? "-translate-x-full" : "translate-x-full"),
                    isDockLeft ? "left-0" : "right-0"
                )}
            >
                {selectedHeroId && (
                    <HeroInspectionSheet
                        heroId={selectedHeroId}
                        onClose={onCloseHero}
                        onEdit={onEditHero}
                    />
                )}
            </div>
        </aside>
    );
};

export default BankHeroPanel;

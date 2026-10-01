import { useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';

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
        ['heroes_updated', 'state_changed']
    ) || [];

    const isOpen = Boolean(selectedHeroId);

    // If menu is on the right, the bank drawer slides from the right, so put this on the left.
    // If menu is on the left, the bank drawer slides from the left, so put this on the right.
    // BUT WAIT: The drawer actually slides from the nav's edge (which is left if menuRight is false).
    // Let's just put it on the opposite side of the drawer.
    // Drawer side: if menuRight=true, drawer is on the left. Wait!
    // Drawer code: menuRight ? 'right-0 left-[416px]' (Drawer is on the left, stopping before tray on right)
    // Wait, let's just place the Hero Panel on the side opposite the nav, which is the Tray's side.
    // Tray is on the Right if menuRight=false. Tray is on the Left if menuRight=true.
    // So dock should be on `menuRight ? 'left-0' : 'right-0'`.
    const isDockLeft = menuRight;

    return (
        <aside
            ref={asideRef}
            // Exempts this whole panel (hero tabs + inspection sheet) from the
            // bottom dock's outside-click listener (CR3-450): the bottom dock
            // stays mounted under the Bank, so without this marker any click
            // in here looked "outside" to it and closed the sheet early.
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
                            vertical={true}
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

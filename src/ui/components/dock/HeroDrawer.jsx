import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { DOCK_STRIP_PX, HERO_DRAWER_PAD_TOP_PX, dockArtPx, dockLabelOverhangPx } from './dockHeroView.js';

/** The drawer's slide (`HERO_DRAWER_SLIDE`), plus a little slack. */
const DRAWER_CLOSE_MS = 300;
const HERO_DRAWER_SLIDE = 'transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms';

/**
 * Where the drawer is moved to: up on the bar's strip when open, all the way down behind the bar
 * (`under`, the strip's height) when closed.
 */
export function heroDrawerTransform(open, under = DOCK_STRIP_PX) {
    return open ? 'translateY(0)' : `translateY(calc(100% + ${under}px))`;
}

/**
 * The Hero drawer: a hero's panel, rising from behind the hero bar when a hero on it is clicked,
 * across the screen like the Shop (one bottom panel at a time: `useOneBottomDrawer`), over the side
 * drawers and under the bar, whose names and HP bars stand over a clear band at its foot. Its three
 * blocks are the sheet's (`HeroInspectionSheet`). It closes on its X, Escape, or a press outside it
 * (not on the bar, a drawer, an item or the Bank's button, so a hero can be inspected and dressed
 * while the Bank is open).
 */
export const HeroDrawer = ({
    menuRight,
    selectedHeroId,
    onCloseHero,
    onEditHero
}) => {
    const asideRef = useRef(null);
    const [shownHeroId, setShownHeroId] = useState(selectedHeroId);
    const foot = dockLabelOverhangPx(dockArtPx(useLiveMatFit()));

    // ⚠️ The loadout slots are live drop targets and dnd-kit ignores opacity and
    // pointer-events, so a closed drawer must be unmounted (after its slide) or it refuses
    // mat drops inside its box.
    useEffect(() => {
        if (selectedHeroId) {
            setShownHeroId(selectedHeroId);
            return undefined;
        }
        const timer = setTimeout(() => setShownHeroId(null), DRAWER_CLOSE_MS);
        return () => clearTimeout(timer);
    }, [selectedHeroId]);

    useEffect(() => {
        if (!selectedHeroId) return undefined;

        const handlePointerDown = (e) => {
            if (asideRef.current && asideRef.current.contains(e.target)) return;
            if (
                // The bar's own click picks or toggles a hero.
                e.target.closest('[data-bottom-hero-dock]') ||
                e.target.closest('[data-dnd-surface="drawer"]') ||
                e.target.closest('[data-dnd-region="drawer"]') ||
                e.target.closest('[data-item-id]') ||
                e.target.closest('[data-bank-tab]') ||
                // Opening the Bank keeps the drawer: a hero is dressed from the Bank.
                e.target.closest('#bank-bubble-target') ||
                // A tooltip's own box (never under the pointer, but a test may press it).
                e.target.closest('[data-tooltip]')
            ) {
                return;
            }
            onCloseHero?.();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [selectedHeroId, onCloseHero]);

    useEscapeLayer(!!selectedHeroId, () => onCloseHero?.());

    // The open drawer's whole box is a drawer target: a hero dropped on it is a miss (they keep
    // their order) rather than an order onto the mat hidden under it.
    const recall = useEntityDrop({
        id: 'hero-panel-drop',
        surface: DND_SURFACE.DRAWER,
        accepts: p => !!p?.heroId && p.kind === DRAG_KIND.FLAG,
        onDrop: () => null,
        disabled: !shownHeroId
    });

    if (!shownHeroId) return null;

    const isOpen = Boolean(selectedHeroId);

    return (
        <aside
            ref={asideRef}
            data-hero-panel="true"
            data-hero-drawer-state={isOpen ? 'open' : 'closed'}
            className={cn(
                // Edge to edge, under the nav as the Shop: its blocks pad for the nav (`.gi-drawer-pad-x`).
                'absolute inset-x-0 z-(--z-hero-panel)',
                menuRight
                    ? '[--nav-inset-r:84px] md:[--nav-inset-r:152px]'
                    : '[--nav-inset-l:84px] md:[--nav-inset-l:152px]',
                isOpen ? 'pointer-events-auto' : 'pointer-events-none'
            )}
            style={{
                bottom: DOCK_STRIP_PX,
                transform: heroDrawerTransform(isOpen),
                opacity: isOpen ? 1 : 0,
                transition: HERO_DRAWER_SLIDE
            }}
        >
            <div
                ref={recall.setNodeRef}
                {...recall.droppableProps}
                data-dnd-region={DND_SURFACE.DRAWER}
                className={isOpen ? 'pointer-events-auto' : 'pointer-events-none'}
            >
                <PixelFrame
                    kind={FRAME_KIND.STUDS}
                    backdrop="hero"
                    frameClassName={cn('flex flex-col', recall.valid && 'outline-2 outline-gi-success/70')}
                >
                    <div className="gi-drawer-pad-x flex justify-center" style={{ paddingTop: HERO_DRAWER_PAD_TOP_PX }}>
                        <HeroInspectionSheet heroId={shownHeroId} onClose={onCloseHero} onEdit={onEditHero} />
                    </div>
                    {/* The clear band the bar's names and HP bars stand over. */}
                    <div aria-hidden data-hero-drawer-foot className="shrink-0" style={{ height: foot + HERO_DRAWER_PAD_TOP_PX }} />
                </PixelFrame>
            </div>
        </aside>
    );
};

export default HeroDrawer;

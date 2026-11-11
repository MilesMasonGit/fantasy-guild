import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { LimesBlurb } from '../limes/LimesBlurb.jsx';
import { Feather } from 'lucide-react';
import { t } from '../../../i18n/index.js';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { SIDE_DRAWER_TRANSITION } from '../base/SideDrawer.jsx';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';
import { DOCK_STRIP_PX, HERO_DRAWER_PAD_TOP_PX, dockArtPx, dockLabelOverhangPx } from './dockHeroView.js';

/** The drawer's slide (`SIDE_DRAWER_TRANSITION`, 250 ms), plus a little slack before it unmounts. */
const DRAWER_CLOSE_MS = 300;

/** The room kept between the header's HP bar and the corner's controls, in screen px. */
const CONTROLS_GAP_PX = 12;

/** Where the drawer stands: up when open, wholly below the screen's edge (behind the bar) when closed. */
export const heroDrawerY = (open) => (open ? 0 : '100%');

/**
 * The Hero drawer: a hero's panel, rising from behind the hero bar when a hero on it is clicked,
 * across the screen like the Shop (one bottom panel at a time: `useOneBottomDrawer`), over the side
 * drawers and under the bar. It reaches the screen's bottom edge behind the bar, whose strip, names
 * and HP bars stand over a clear band at its foot; it slides up as it opens and down as it closes. Its three
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

    // The header's HP bar runs to the blocks' right edge, but stops short of the corner's X and
    // quill where the blocks reach that far (a narrow window). Measured after every draw and on a
    // resize; it sets only a changed value.
    const [headerEndPx, setHeaderEndPx] = useState(0);
    const [, redraw] = useReducer(n => n + 1, 0);
    useEffect(() => {
        window.addEventListener('resize', redraw);
        return () => window.removeEventListener('resize', redraw);
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const aside = asideRef.current;
        const controls = aside?.querySelector('[data-hero-panel-controls]');
        const body = aside?.querySelector('[data-hero-panel-body]');
        if (!controls || !body) return;
        const clash = Math.ceil(body.getBoundingClientRect().right - (controls.getBoundingClientRect().left - CONTROLS_GAP_PX));
        const next = Math.max(0, clash);
        if (next !== headerEndPx) setHeaderEndPx(next);
    });

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
        <motion.aside
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
            style={{ bottom: 0 }}
            initial={{ y: heroDrawerY(false) }}
            animate={{ y: heroDrawerY(isOpen) }}
            transition={prefersReducedMotion() ? { duration: 0 } : SIDE_DRAWER_TRANSITION}
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
                        <HeroInspectionSheet heroId={shownHeroId} onClose={onCloseHero} headerEndPx={headerEndPx} />
                    </div>
                    {/* The drawer's top right corner, clear of a nav on that side. */}
                    <div
                        data-hero-panel-controls
                        className="absolute top-2 flex items-center gap-1"
                        style={{ right: 'calc(var(--nav-inset-r, 0px) + 0.75rem)' }}
                    >
                        <LimesBlurb spot="heroDrawer" />
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEditHero?.(shownHeroId); }}
                            data-hero-panel-edit
                            aria-label={t('heroPanel.edit')}
                            title={t('heroPanel.edit')}
                            className="ui-icon-button w-8 h-8 flex items-center justify-center text-gi-muted hover:text-[var(--color-ui-white)] transition-colors cursor-pointer"
                        >
                            {/* ⚠️ Placeholder quill until the owner draws one. */}
                            <Feather size={16} />
                        </button>
                        <CloseX data-hero-panel-close label={t('heroPanel.close')} onClick={(e) => { e.stopPropagation(); onCloseHero?.(); }} />
                    </div>
                    {/* The clear band the bar's strip, names and HP bars stand over. */}
                    <div aria-hidden data-hero-drawer-foot className="shrink-0" style={{ height: DOCK_STRIP_PX + foot + HERO_DRAWER_PAD_TOP_PX }} />
                </PixelFrame>
            </div>
        </motion.aside>
    );
};

export default HeroDrawer;

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import BankTab from './BankTab.jsx';
import { columnWidthCss, NOTIFICATION_COLUMN } from '../board/boardConstants.js';
import { PanelHeader } from '../base/CloseX.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';
import { DOCK_STRIP_PX } from '../dock/dockHeroView.js';
import { SIDE_DRAWER_TRANSITION } from '../base/SideDrawer.jsx';
import { ItemDrawer } from './ItemDrawer.jsx';

/**
 * BankDrawer: slides in from the side and holds the item Bank.
 * One pane: the item Bank (the Shop has its own panel from the bottom, `ShopPanel`).
 * Per-pane header: title + Close. Opening/closing is driven by the BubbleMenu (via `ui.nav`);
 * state lives in useUIModals (`ui.drawer.panes`). The Item drawer (`ItemDrawer`) opens and closes
 * with it, in the column it leaves free on the far side.
 */

// Heroes live in the always-visible Hero Dock, not a drawer pane.
const PANES = [
    { key: 'bank', label: 'Item Bank', Component: BankTab }
];

export const BankDrawer = ({ drawer, menuRight = false }) => {
    // Canonical order regardless of the order panes were opened in. `panes` never holds more
    // than one, so this is a lookup rather than a filter.
    const shownPanes = PANES.filter(p => drawer.panes.includes(p.key));
    const slideOffset = menuRight ? '100%' : '-100%';

    return (
        <>
        <AnimatePresence>
            {drawer.isOpen && (
                <motion.div
                    key="bottom-folder-drawer"
                    data-dnd-surface="drawer"
                    data-dnd-region="drawer"
                    initial={{ x: slideOffset, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: slideOffset, opacity: 0 }}
                    // In step with the Item drawer arriving from the far side.
                    transition={prefersReducedMotion() ? { duration: 0 } : SIDE_DRAWER_TRANSITION}
                    // ⚠️ The drawer layer sits under the nav and over everything else (tailwind.css, the layers table).
                    className={cn(
                        'pointer-events-auto',
                        'absolute inset-y-0 z-(--z-drawer)',
                        // From the screen's edge under the nav, as one panel: its rows pad for the
                        // nav (`.gi-drawer-pad-x`). It stops at the column the Item drawer takes.
                        menuRight
                            ? 'right-0 [--nav-inset-r:84px] md:[--nav-inset-r:152px]'
                            : 'left-0 [--nav-inset-l:84px] md:[--nav-inset-l:152px]'
                    )}
                    style={{
                        ...(menuRight ? { left: columnWidthCss(NOTIFICATION_COLUMN) } : { right: columnWidthCss(NOTIFICATION_COLUMN) })
                    }}
                >
                    <PixelFrame kind={FRAME_KIND.STUDS} backdrop="bank" className="h-full" frameClassName="flex overflow-hidden">
                        {shownPanes.map(({ key, label, Component }) => {
                            return (
                                <section key={key} className="flex-1 min-w-0 flex flex-col border-r border-gi-border/50 last:border-r-0">
                                    <PanelHeader
                                        title={label}
                                        onClose={() => drawer.closePane(key)}
                                        closeLabel={`Close ${label}`}
                                        className="gi-drawer-pad-x py-1.5 border-b border-gi-border/40 min-h-[44px]"
                                    />

                                    {/* Clear of the hero bar's strip, which is drawn over the drawer. */}
                                    <div className="flex-1 min-h-0" style={{ paddingBottom: DOCK_STRIP_PX }}>
                                        <Component />
                                    </div>
                                </section>
                            );
                        })}
                    </PixelFrame>
                </motion.div>
            )}
        </AnimatePresence>
        <ItemDrawer open={drawer.isOpen && drawer.panes.includes('bank')} menuRight={menuRight} />
        </>
    );
};

export default BankDrawer;

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { Landmark } from 'lucide-react';
import BankTab from './BankTab.jsx';
import { columnWidthCss, NOTIFICATION_COLUMN } from '../board/boardConstants.js';
import { PanelHeader } from '../base/CloseX.jsx';

/**
 * BankDrawer: slides in from the side and holds the item Bank.
 * One pane: the item Bank (the Shop has its own drawer from the left edge, `ShopDrawer`).
 * Per-pane header: title + Close. Opening/closing is driven by the BubbleMenu (via `ui.nav`);
 * state lives in useUIModals (`ui.drawer.panes`). An item's details are its tile's tooltip, so
 * the drawer has no inspect column.
 */

// Heroes live in the always-visible Hero Dock, not a drawer pane.
const PANES = [
    { key: 'bank', label: 'Item Bank', icon: Landmark, Component: BankTab }
];

export const BankDrawer = ({ drawer, menuRight = false }) => {
    // Canonical order regardless of the order panes were opened in. `panes` never holds more
    // than one, so this is a lookup rather than a filter.
    const shownPanes = PANES.filter(p => drawer.panes.includes(p.key));
    const slideOffset = menuRight ? '100%' : '-100%';

    return (
        <AnimatePresence>
            {drawer.isOpen && (
                <motion.div
                    key="bottom-folder-drawer"
                    data-dnd-surface="drawer"
                    data-dnd-region="drawer"
                    initial={{ x: slideOffset, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: slideOffset, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    // ⚠️ The drawer layer sits under the nav and over everything else (tailwind.css, the layers table).
                    className={cn(
                        'pointer-events-auto flex bg-gi-surface overflow-hidden',
                        'absolute inset-y-0 z-(--z-drawer) shadow-[0_0_40px_rgba(0,0,0,0.6)]',
                        // Nav side → drawer starts at edge 0 underneath the nav bar with padding to sit flush beside the 152px Nav Bar.
                        // Notification side → stops right before the notifications column, leaving it fully exposed.
                        menuRight
                            ? 'right-0 pr-[84px] md:pr-[152px] border-l border-gi-primary/30'
                            : 'left-0 pl-[84px] md:pl-[152px] border-r border-gi-primary/30'
                    )}
                    style={{
                        ...(menuRight ? { left: columnWidthCss(NOTIFICATION_COLUMN) } : { right: columnWidthCss(NOTIFICATION_COLUMN) })
                    }}
                >
                    {shownPanes.map(({ key, label, icon: Icon, Component }) => {
                        return (
                            <section key={key} className="flex-1 min-w-0 flex flex-col border-r border-gi-border/50">
                                <PanelHeader
                                    title={label}
                                    sprite={<Icon size={18} className="text-gi-primary" />}
                                    onClose={() => drawer.closePane(key)}
                                    closeLabel={`Close ${label}`}
                                    className="px-3.5 py-1.5 border-b border-gi-border/40 bg-gi-base/80 min-h-[44px]"
                                />

                                <div className="flex-1 min-h-0">
                                    <Component />
                                </div>
                            </section>
                        );
                    })}

                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BankDrawer;

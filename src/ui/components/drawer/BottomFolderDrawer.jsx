import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { Landmark } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState.js';
import BankTab from './BankTab.jsx';
import InspectionPanel from './InspectionPanel.jsx';
import { columnWidthCss, NOTIFICATION_COLUMN } from '../board/boardConstants.js';

/**
 * BottomFolderDrawer: the bank drawer.
 * ⚠️ The name is wrong and is kept only to avoid a rename in the same change. It slides in
 * from the **side**, shows **one pane at a time**, and inspection has left it entirely for a
 * panel elsewhere. Renaming it to `BankDrawer` is a tidy-up worth doing separately.
 * One pane: the item Bank (the Shop has its own drawer from the left edge, `ShopDrawer`).
 * Per-pane header: title + Close. Opening/closing is driven by the BubbleMenu (via `ui.nav`)
 * or `ui:open_drawer` auto-open events; state lives in useUIModals (`ui.drawer`: `panes` /
 * `filters`).
 * Clicking a tile still sets the shared selection, which renders in the inspection panel
 * rather than inside this drawer.
 */

// Heroes live in the always-visible Hero Dock, not a drawer pane. `paneProps` names exactly
// what each pane's own signature accepts, so the drawer does not hand every pane the same
// props and hope. Keep each entry in step with its component's signature.
const PANES = [
    {
        key: 'bank', label: 'Item Bank', icon: Landmark, Component: BankTab, inspects: true,
        paneProps: ({ filter, searchQuery, onInspect, selId }) => ({ filter, searchQuery, onInspect, selectedItemId: selId })
    }
];

// Which selection type each pane's tiles produce, used to hand each pane only its own
// selection for tile highlighting.
const PANE_SELECTION_TYPE = { bank: 'item' };

export const BottomFolderDrawer = ({ drawer, inspect, menuRight = false }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // Canonical order regardless of the order panes were opened in. `panes` never holds more
    // than one, so this is a lookup rather than a filter.
    const shownPanes = PANES.filter(p => drawer.panes.includes(p.key));
    const activeKey = shownPanes[0]?.key || null;
    const showsInspect = !!shownPanes[0]?.inspects;
    const slideOffset = menuRight ? '100%' : '-100%';

    const handleInspect = (type, id, source = null) => inspect.set(type, id, source, activeKey);

    const paneSelection = inspect.getByPane ? inspect.getByPane(activeKey) : null;
    const activeSelection = paneSelection || (inspect.selection?.pane === activeKey || (!inspect.selection?.pane && inspect.selection?.type === PANE_SELECTION_TYPE[activeKey]) ? inspect.selection : null);
    const sidebarSelection = activeSelection && !(activeSelection.type === 'token' && activeSelection.source?.rect != null) ? activeSelection : null;

    React.useEffect(() => {
        setSearchQuery('');
    }, [activeKey, drawer.isOpen]);

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
                    // ⚠️ z-[90] sits under the nav (BubbleMenu is z-[110]) and over everything else.
                    className={cn(
                        'pointer-events-auto flex bg-gi-surface overflow-hidden',
                        'absolute inset-y-0 z-[90] shadow-[0_0_40px_rgba(0,0,0,0.6)]',
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
                    {showsInspect && (
                        <InspectionPanel
                            selection={sidebarSelection}
                            onInspect={handleInspect}
                            onClear={() => inspect.clear(activeKey)}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            activePane={activeKey}
                            className="border-r border-gi-border/50"
                        />
                    )}
                    {shownPanes.map(({ key, label, icon: Icon, Component, paneProps }) => {
                        // Only the pane whose tiles match the selection type highlights it
                        // (each pane reads its own prop name).
                        const selId = activeSelection?.type === PANE_SELECTION_TYPE[key] ? activeSelection.id : null;
                        return (
                            <section key={key} className="flex-1 min-w-0 flex flex-col border-r border-gi-border/50">
                                <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 border-b border-gi-border/40 bg-gi-base/80 min-h-[44px]">
                                    <span className="flex items-center gap-2.5 text-sm md:text-base font-bold tracking-wide text-gi-text">
                                        <Icon size={18} className="text-gi-primary" /> {label}
                                    </span>
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            onClick={() => drawer.closePane(key)}
                                            title={`Close ${label}`}
                                            className="p-0.5 rounded cursor-pointer flex items-center justify-center gi-hover-pulse"
                                        >
                                            <img
                                                src="/assets/ui/ui_cancel_red.png"
                                                alt="Close"
                                                className="w-8 h-8 object-contain select-none pointer-events-none"
                                                style={{ width: '32px', height: '32px', imageRendering: 'pixelated' }}
                                            />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0">
                                    <Component
                                        {...paneProps({
                                            filter: drawer.filters?.[key] || null,
                                            searchQuery,
                                            onInspect: handleInspect,
                                            selId
                                        })}
                                    />
                                </div>
                            </section>
                        );
                    })}

                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BottomFolderDrawer;

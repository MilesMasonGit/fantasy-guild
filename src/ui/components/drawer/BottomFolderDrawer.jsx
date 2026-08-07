import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { Landmark, ChevronDown, Maximize2, Minimize2, Vault } from 'lucide-react';
import BankTab from './BankTab.jsx';
import TokenVaultTab from './TokenVaultTab.jsx';
import InspectionPanel from './InspectionPanel.jsx';
import { DOCK_RESERVED_H } from '../dock/dockConstants.js';

/**
 * BottomFolderDrawer — the Flexible Bottom Drawer (overhaul Phase 2,
 * ui_overhaul_spec.md §BTM-01). Slides up from the bottom, with the
 * shared InspectionPanel as a fixed column on the far right (always
 * visible while the drawer is open — owner decision 2026-07-11).
 *
 * Two panes: the item Bank and the Token Vault (Phase 7). The Stations pane
 * was temporary by design and retired once station cards moved to the
 * Collection Binder's Deployment Panel.
 *
 * Per-pane header: title + Maximize (expands that pane to full height,
 * hiding the others) + Close. Opening/closing panes is driven by the
 * BubbleMenu (via `ui.nav`) or `ui:open_drawer` auto-open events; state
 * lives in useUIModals (`ui.drawer`: `panes` / `filters` / `maximized`).
 *
 * Selection is drawer-wide: `{type: 'card'|'item', id}` — clicking
 * a tile in any pane loads it in the InspectionPanel.
 */

// Heroes live in the always-visible Hero Dock, not a drawer pane.
const PANES = [
    { key: 'bank', label: 'Bank', icon: Landmark, Component: BankTab },
    // Items and Tokens are stored separately because they are capped separately
    // (D-137) and used for different things — items are for storing, Tokens are
    // for placing (D-158).
    { key: 'vault', label: 'Token Vault', icon: Vault, Component: TokenVaultTab }
];

// Which selection type each pane's tiles produce — used to hand each pane
// only its own selection for tile highlighting.
const PANE_SELECTION_TYPE = { bank: 'item', vault: 'token' };

export const BottomFolderDrawer = ({ drawer, inspect, menuRight = false, cardTier = 'md' }) => {
    if (!drawer.isOpen && !inspect.selection) return null;

    const handleInspect = (type, id) => inspect.set(type, id);
    const clearSelection = () => inspect.clear();
    const selection = inspect.selection;

    // Canonical order regardless of the order panes were opened in.
    const openPanes = PANES.filter(p => drawer.panes.includes(p.key));
    const shownPanes = drawer.maximized
        ? openPanes.filter(p => p.key === drawer.maximized)
        : openPanes;

    return (
        <div
            data-dnd-surface="drawer"
            data-dnd-region="drawer"
            className={cn(
                'pointer-events-auto flex bg-gi-surface border-t border-gi-primary/30',
                'shadow-[0_-10px_30px_rgba(0,0,0,0.5)] overflow-hidden',
                drawer.maximized
                    // Maximize covers the whole play area (banners included);
                    // the parent layout wrapper is position:relative.
                    ? 'absolute inset-0 z-[96]'
                    : cn(
                        'shrink-0 z-[95] transition-all duration-300 ease-in-out',
                        drawer.isOpen
                            ? 'w-full relative'
                            : cn(
                                'absolute bottom-0 w-80',
                                menuRight ? 'right-0 border-l border-gi-primary/30' : 'left-0 border-r border-gi-primary/30'
                            )
                    ),
                menuRight ? 'flex-row' : 'flex-row-reverse'
            )}
            // The Hero Dock floats over the drawer's bottom edge (roadmap
            // D9/D10), so the whole drawer is inset by the dock's height —
            // one change here instead of padding each pane's scroll area.
            style={{
                paddingBottom: DOCK_RESERVED_H,
                ...(!drawer.maximized
                    ? { height: cardTier === 'sm' ? 'calc(100vh - 208px)' : 'calc(100vh - 336px)' }
                    : {})
            }}
        >
            {shownPanes.map(({ key, label, icon: Icon, Component }) => {
                // Only the pane whose tiles match the selection type
                // highlights it (each pane reads its own prop name).
                const selId = selection?.type === PANE_SELECTION_TYPE[key] ? selection.id : null;
                return (
                    <section key={key} className="flex-1 min-w-0 flex flex-col border-r border-gi-border/50">
                        {/* Pane header */}
                        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-gi-border/40 bg-gi-base/60">
                            <span className="flex items-center gap-2 text-[10px] font-bold gi-caps tracking-widest text-gi-text">
                                <Icon size={12} className="text-gi-primary" /> {label}
                            </span>
                            <span className="flex items-center gap-1">
                                <button
                                    onClick={() => drawer.toggleMaximize(key)}
                                    title={drawer.maximized === key ? 'Restore' : 'Maximize'}
                                    className="p-0.5 rounded text-gi-muted hover:text-gi-text transition-colors"
                                >
                                    {drawer.maximized === key ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                                </button>
                                <button
                                    onClick={() => drawer.closePane(key)}
                                    title={`Close ${label}`}
                                    className="p-0.5 rounded text-gi-muted hover:text-gi-text transition-colors"
                                >
                                    <ChevronDown size={12} />
                                </button>
                            </span>
                        </div>

                        {/* Pane content */}
                        <div className="flex-1 min-h-0">
                            <Component
                                filter={drawer.filters?.[key] || null}
                                onInspect={handleInspect}
                                selectedTemplateId={selId}
                                selectedItemId={selId}
                            />
                        </div>
                    </section>
                );
            })}

            {/* Shared inspection column (§COMP-INSPECT) */}
            <InspectionPanel
                selection={selection}
                onInspect={handleInspect}
                onClear={clearSelection}
                className={drawer.isOpen ? (menuRight ? 'border-l border-gi-border/50' : 'border-r border-gi-border/50') : ''}
            />
        </div>
    );
};

export default BottomFolderDrawer;

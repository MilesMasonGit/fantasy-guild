import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { Landmark, ChevronDown, Vault, Map as MapIcon } from 'lucide-react';
import BankTab from './BankTab.jsx';
import TokenVaultTab from './TokenVaultTab.jsx';
import CartographerTab from './CartographerTab.jsx';
import { DOCK_RESERVED_H } from '../dock/dockConstants.js';

/**
 * BottomFolderDrawer — the bank drawer.
 *
 * ⚠️ **The name is now wrong and is kept only to avoid a rename in the same
 * change.** It slid up from the bottom with a shared InspectionPanel column;
 * it now slides in from the **side** (D-238), shows **one pane at a time**
 * (D-239), and **inspection has left it entirely** for a panel over the Tray
 * (D-240). Renaming it to `BankDrawer` is a tidy-up worth doing separately.
 *
 * Two panes: the item Bank and the Token Vault (Phase 7). The Stations pane
 * was temporary by design and retired once station cards moved to the
 * Collection Binder's Deployment Panel.
 *
 * Per-pane header: title + Close. **Maximize is gone** — with one pane at a
 * time it had nothing left to do. Opening/closing is driven by the BubbleMenu
 * (via `ui.nav`) or `ui:open_drawer` auto-open events; state lives in
 * useUIModals (`ui.drawer`: `panes` / `filters`).
 *
 * Clicking a tile still sets the shared selection — it now renders in the
 * inspection panel over the Tray rather than inside this drawer.
 */

// Heroes live in the always-visible Hero Dock, not a drawer pane.
const PANES = [
    { key: 'bank', label: 'Bank', icon: Landmark, Component: BankTab },
    // Items and Tokens are stored separately because they are capped separately
    // (D-137) and used for different things — items are for storing, Tokens are
    // for placing (D-158).
    { key: 'vault', label: 'Token Vault', icon: Vault, Component: TokenVaultTab },
    // The one shop that is deliberately NOT on the board (D-98). The Map is
    // still a Token, so only the transaction leaves the grid.
    { key: 'cartographer', label: 'Cartographer', icon: MapIcon, Component: CartographerTab }
];

// Which selection type each pane's tiles produce — used to hand each pane
// only its own selection for tile highlighting.
const PANE_SELECTION_TYPE = { bank: 'item', vault: 'token', cartographer: 'token' };

export const BottomFolderDrawer = ({ drawer, inspect, menuRight = false, cardTier = 'md' }) => {
    // Inspection moved out of the drawer (D-240) and now lives over the Tray,
    // so a selection on its own no longer summons a collapsed drawer.
    if (!drawer.isOpen) return null;

    const handleInspect = (type, id) => inspect.set(type, id);
    const selection = inspect.selection;

    // Canonical order regardless of the order panes were opened in.
    // One pane at a time (D-239) — `panes` never holds more than one, so this
    // is a lookup rather than a filter, and **maximise is gone**: a lone pane
    // already fills the drawer.
    const shownPanes = PANES.filter(p => drawer.panes.includes(p.key));

    return (
        <div
            data-dnd-surface="drawer"
            data-dnd-region="drawer"
            /**
             * A SIDE drawer (D-238), not a bottom one.
             *
             * It slides from the nav's edge and spans inward, **covering the
             * notifications column and the playmat** and stopping before the
             * Tray. The offsets are the nav's width on one side and the Tray's
             * on the other.
             *
             * ⚠️ **The Tray is excluded deliberately and it is not cosmetic.**
             * D-107 makes the Tray load-bearing *because* an open Bank covers
             * the board: the only route from storage to a tile is
             * **Bank → Tray → Board**. Cover the Tray and there is nowhere to
             * drag a Token to.
             *
             * ⚠️ **z-[90] sits UNDER the nav and OVER everything else.** The
             * BubbleMenu carries `z-[110]` for exactly this.
             */
            className={cn(
                'pointer-events-auto flex bg-gi-surface overflow-hidden',
                'absolute inset-y-0 z-[90] shadow-[0_0_40px_rgba(0,0,0,0.6)]',
                // Nav side → drawer's anchored edge. Tray side → where it stops.
                menuRight
                    ? 'right-20 md:right-[150px] left-64 border-l border-gi-primary/30'
                    : 'left-20 md:left-[150px] right-64 border-r border-gi-primary/30'
            )}
            // The Hero Dock floats over the drawer's bottom edge (roadmap
            // D9/D10), so the whole drawer is inset by the dock's height —
            // one change here instead of padding each pane's scroll area.
            style={{ paddingBottom: DOCK_RESERVED_H }}
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

        </div>
    );
};

export default BottomFolderDrawer;

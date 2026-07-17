import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { HeroInspection } from './HeroesTab.jsx';
import { ItemInspection } from './BankTab.jsx';
import { CardInspection } from './CardsTab.jsx';
import { SearchCheck, X } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * InspectionPanel — the drawer-wide shared inspection column (overhaul
 * Phase 2, spec §COMP-INSPECT). A fixed-width column on the far right of
 * the Bottom Drawer, always visible while the drawer is open (owner
 * decision 2026-07-11). Clicking a Hero, Card, or Item in ANY pane loads
 * its detail sheet here; the bodies themselves live with their panes
 * (HeroInspection / CardInspection / ItemInspection) and are just
 * composed here.
 *
 * `selection` is `{ type: 'hero'|'card'|'item', id }` or null, owned by
 * BottomFolderDrawer so all panes share one selection.
 */
export const InspectionPanel = ({ selection, onInspect, onClear, className, onOpenCustomize }) => {
    const engine = useEngine();

    // Hero context: bench membership drives which actions the hero body
    // offers. Subscribed here (not in the body) so the panel also clears
    // itself if the hero disappears while inspected.
    const benchIds = useGameState(state => (state.bench || []).map(h => h.id), ['heroes_updated']);

    // Item context: the sell controls need the live banked count.
    const itemId = selection?.type === 'item' ? selection.id : null;
    const itemCount = useGameState(
        state => itemId ? (state.inventory?.items?.[itemId]?.quantity || 0) : 0,
        ['inventory_updated'],
        null,
        { deps: [itemId] }
    );

    let body = null;
    if (selection?.type === 'hero') {
        body = (
            <HeroInspection
                heroId={selection.id}
                onBench={benchIds.includes(selection.id)}
                engine={engine}
                onGone={onClear}
                onOpenCustomize={onOpenCustomize}
            />
        );
    } else if (selection?.type === 'card') {
        body = <CardInspection templateId={selection.id} onInspect={onInspect} />;
    } else if (selection?.type === 'item') {
        const template = getItem(selection.id);
        // Sold out / consumed while inspected → fall through to the empty state.
        if (template && itemCount > 0) {
            body = <ItemInspection entry={{ id: selection.id, count: itemCount, template }} engine={engine} />;
        }
    }

    return (
        <div className={cn("w-80 shrink-0 bg-gi-base/40 flex flex-col min-h-0", className)}>
            {/* Slim header, mirrors the pane headers */}
            <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-gi-border/40 bg-gi-base/60">
                <span className="flex items-center gap-2 text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                    <SearchCheck size={12} className="text-gi-primary" /> Inspect
                </span>
                {body && (
                    <button
                        onClick={onClear}
                        title="Clear selection"
                        className="p-0.5 rounded text-gi-muted hover:text-gi-text transition-colors"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {body || (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/50 p-6 text-center">
                        <SearchCheck size={36} />
                        <span className="text-xs gi-caps tracking-widest font-bold">Nothing selected</span>
                        <span className="text-[10px] normal-case tracking-normal">
                            Click a hero, card, or item in any pane to see its details here.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InspectionPanel;

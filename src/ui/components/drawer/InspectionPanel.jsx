import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ItemInspection } from './BankTab.jsx';
import TokenInspection from './TokenInspection.jsx';
import MapInspection from './MapInspection.jsx';
import GuildUpgradeInspection from './GuildUpgradeInspection.jsx';
import { getUpgradeDef } from '../../../config/guildUpgrades.js';
import { SearchCheck, Search, X } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * InspectionPanel — the drawer-wide shared inspection column (overhaul
 * Phase 2, spec §COMP-INSPECT). A fixed-width column on the far right of
 * the Bottom Drawer, always visible while the drawer is open (owner
 * decision 2026-07-11). Clicking a Card or Item in ANY pane loads
 * its detail sheet here; the bodies themselves live with their panes
 * (CardInspection / ItemInspection) and are just
 * composed here.
 *
 * `selection` is `{ type: 'card'|'item', id }` or null, owned by
 * BottomFolderDrawer so all panes share one selection.
 */
export const InspectionPanel = ({
    selection,
    onInspect,
    onClear,
    className,
    searchQuery = '',
    onSearchChange,
    activePane = null
}) => {
    const engine = useEngine();

    // Item context: the sell controls need the live banked count.
    const itemId = selection?.type === 'item' ? selection.id : null;
    const itemCount = useGameState(
        state => itemId ? (state.inventory?.items?.[itemId]?.quantity || 0) : 0,
        ['inventory_updated'],
        null,
        { deps: [itemId] }
    );

    // Heroes are no longer inspected here — the Hero Dock owns them entirely
    // (Hero Dock Phase 7).
    //
    // The `card` branch is deleted with the deck loop. Its successor is the
    // **Token** branch below, and it matters more than the card one did: D-145
    // says a Token's full detail must be available wherever it sits — Vault,
    // Tray, Cartographer pool or board — because hero-time is scarce and a
    // player must never have to spend a tile and a hero to find out what
    // something does. **Planning happens before placement.**
    let body = null;
    const isCartographer = activePane === 'cartographer';

    if (selection?.type === 'guild_upgrade') {
        const upgradeDef = selection.upgradeDef || selection.source?.upgradeDef || getUpgradeDef(selection.id);
        const tileIndex = selection.tileIndex ?? selection.source?.tileIndex;
        body = (
            <GuildUpgradeInspection
                upgradeDef={upgradeDef}
                tileIndex={tileIndex}
                onClose={onClear}
            />
        );
    } else if (selection?.type === 'token') {
        body = (
            <TokenInspection
                typeId={selection.id}
                showSell={!isCartographer}
                showAddToTray={!isCartographer}
                showViewInVault={isCartographer}
            />
        );
    } else if (selection?.type === 'map') {
        body = <MapInspection mapId={selection.id} onInspect={onInspect} />;
    } else if (selection?.type === 'item') {
        const template = getItem(selection.id);
        if (template && (itemCount > 0 || isCartographer)) {
            body = (
                <ItemInspection
                    entry={{ id: selection.id, count: itemCount, template }}
                    engine={engine}
                    showSell={!isCartographer}
                    showViewInBank={isCartographer}
                />
            );
        }
    }

    return (
        <div className={cn("w-80 shrink-0 bg-gi-base/40 flex flex-col min-h-0", className)}>
            {/* Top header matching the main pane title header */}
            <div className="shrink-0 flex items-center px-3.5 py-2 border-b border-gi-border/40 bg-gi-base/80">
                <span className="flex items-center gap-2.5 text-sm md:text-base font-bold tracking-wide text-gi-text">
                    <SearchCheck size={18} className="text-gi-primary" /> Inspect
                </span>
            </div>

            {/* Search bar for Bank / Vault */}
            {(activePane === 'bank' || activePane === 'vault') && (
                <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-gi-border/40 bg-gi-base/50 focus-within:bg-gi-base/80 transition-colors">
                    <Search size={14} className="text-gi-muted shrink-0" />
                    <input
                        value={searchQuery || ''}
                        onChange={e => onSearchChange?.(e.target.value)}
                        placeholder={`Search ${activePane === 'vault' ? 'tokens' : 'items'}…`}
                        className="bg-transparent outline-none text-xs text-gi-text w-full placeholder:text-gi-muted/60"
                    />
                    {searchQuery ? (
                        <button
                            onClick={() => onSearchChange?.('')}
                            className="text-gi-muted hover:text-gi-text p-0.5 rounded cursor-pointer shrink-0"
                        >
                            <X size={14} />
                        </button>
                    ) : null}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {body || (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/50 p-6 text-center">
                        <SearchCheck size={36} />
                        <span className="text-xs gi-caps tracking-widest font-bold">Nothing selected</span>
                        <span className="text-[10px] normal-case tracking-normal">
                            Click an item or Token in any pane to see its details here.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InspectionPanel;

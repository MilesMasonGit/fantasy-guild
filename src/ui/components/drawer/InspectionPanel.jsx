import { useRef, useState, useEffect, useCallback } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ItemInspection } from './BankTab.jsx';
import TokenInspection from './TokenInspection.jsx';
import MapInspection from './MapInspection.jsx';
import GuildUpgradeInspection from './GuildUpgradeInspection.jsx';
import { getUpgradeDef } from '../../../config/guildUpgrades.js';
import { SearchCheck, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * InspectionPanel — the drawer-wide shared inspection column (overhaul
 * Phase 2, spec §COMP-INSPECT). A fixed-width column on the far right of
 * the Bottom Drawer, always visible while the drawer is open.
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
    const scrollRef = useRef(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    // Item context: the sell controls need the live banked count.
    const itemId = selection?.type === 'item' ? selection.id : null;
    const itemCount = useGameState(
        state => itemId ? (state.inventory?.items?.[itemId]?.quantity || 0) : 0,
        ['inventory_updated'],
        null,
        { deps: [itemId] }
    );

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

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 6);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 6);
    }, []);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll, body, selection]);

    const scrollUp = () => {
        scrollRef.current?.scrollBy({ top: -180, behavior: 'smooth' });
    };

    const scrollDown = () => {
        scrollRef.current?.scrollBy({ top: 180, behavior: 'smooth' });
    };

    return (
        <div className={cn("w-80 shrink-0 bg-gi-base/40 flex flex-col min-h-0 relative", className)}>
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

            {/* Flat Scroll Arrow: Top */}
            {canScrollUp && (
                <button
                    onClick={scrollUp}
                    className="w-full py-1 bg-black/60 hover:bg-black/80 border-b border-white/10 hover:border-gi-gold/40 flex items-center justify-center text-gi-gold transition-colors shrink-0 shadow active:scale-[0.99] cursor-pointer"
                    title="Scroll up"
                >
                    <ChevronUp size={14} />
                </button>
            )}

            {/* Scrollable Body (Scrollbar hidden) */}
            <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
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

            {/* Flat Scroll Arrow: Bottom */}
            {canScrollDown && (
                <button
                    onClick={scrollDown}
                    className="w-full py-1 bg-black/60 hover:bg-black/80 border-t border-white/10 hover:border-gi-gold/40 flex items-center justify-center text-gi-gold transition-colors shrink-0 shadow active:scale-[0.99] cursor-pointer"
                    title="Scroll down"
                >
                    <ChevronDown size={14} />
                </button>
            )}
        </div>
    );
};

export default InspectionPanel;

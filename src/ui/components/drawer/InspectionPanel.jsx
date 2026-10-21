import { useGameState } from '../../hooks/useGameState.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ItemInspection } from './BankTab.jsx';
import TokenInspection from './TokenInspection.jsx';
import GuildUpgradeInspection from './GuildUpgradeInspection.jsx';
import { getUpgradeDef } from '../../../config/guildUpgrades.js';
import { SearchCheck, Search, X } from 'lucide-react';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { cn } from '../../utils/cn.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** How far an arrow press scrolls the inspection sheet. */
const INSPECT_SCROLL_STEP_PX = 180;

/**
 * InspectionPanel: the shared inspection column, a fixed-width column shown while its drawer
 * is open.
 */
export const InspectionPanel = ({
    selection,
    onInspect: _onInspect,
    onClear,
    className,
    searchQuery = '',
    onSearchChange,
    activePane = null
}) => {
    // An item is shown only while some is banked, with the live count.
    const itemId = selection?.type === 'item' ? selection.id : null;
    const itemCount = useGameState(
        state => itemId ? (state.inventory?.items?.[itemId]?.quantity || 0) : 0,
        [ENGINE_EVENTS.INVENTORY_UPDATED],
        null,
        { deps: [itemId] }
    );

    let body = null;
    // The upgrade sheet keeps its header still and scrolls only its rank list, with its own
    // arrow bars; a second pair around it would be a list inside a list.
    let scrollsItself = false;

    if (selection?.type === 'guild_upgrade') {
        const upgradeDef = selection.upgradeDef || selection.source?.upgradeDef || getUpgradeDef(selection.id);
        scrollsItself = true;
        body = (
            <GuildUpgradeInspection
                upgradeDef={upgradeDef}
                onClose={onClear}
            />
        );
    } else if (selection?.type === 'token') {
        body = (
            <TokenInspection typeId={selection.id} />
        );
    } else if (selection?.type === 'item') {
        const template = getItem(selection.id);
        if (template && itemCount > 0) {
            body = <ItemInspection entry={{ id: selection.id, count: itemCount, template }} />;
        }
    }

    return (
        <div className={cn("w-80 shrink-0 bg-gi-base/40 flex flex-col min-h-0 relative", className)}>
            <div className="shrink-0 flex items-center px-3.5 py-2 border-b border-gi-border/40 bg-gi-base/80">
                <span className="flex items-center gap-2.5 text-sm md:text-base font-bold tracking-wide text-gi-text">
                    <SearchCheck size={18} className="text-gi-primary" /> Inspect
                </span>
            </div>

            {activePane === 'bank' && (
                <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 border-b border-gi-border/40 bg-gi-base/50 focus-within:bg-gi-base/80 transition-colors">
                    <Search size={14} className="text-gi-muted shrink-0" />
                    <input
                        value={searchQuery || ''}
                        onChange={e => onSearchChange?.(e.target.value)}
                        placeholder="Search items…"
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

            {scrollsItself ? (
                <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
            ) : (
                <ArrowScrollList step={INSPECT_SCROLL_STEP_PX} compact className="flex-1 min-h-0">
                    {body || (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/50 p-6 text-center">
                            <SearchCheck size={36} />
                            <span className="text-xs gi-caps tracking-widest font-bold">Nothing selected</span>
                            <span className="text-[10px] normal-case tracking-normal">
                                Click an item or Token in any pane to see its details here.
                            </span>
                        </div>
                    )}
                </ArrowScrollList>
            )}
        </div>
    );
};

export default InspectionPanel;

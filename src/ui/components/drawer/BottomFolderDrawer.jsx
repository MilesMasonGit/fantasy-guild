import React from 'react';
import { cn } from '../../utils/cn.js';
import { Users, Layers, Landmark, ChevronDown } from 'lucide-react';
import HeroesTab from './HeroesTab.jsx';
import CardsTab from './CardsTab.jsx';
import BankTab from './BankTab.jsx';

/**
 * BottomFolderDrawer — the Phase 7 replacement for both sidebars and the
 * tavern (concept §12). A persistent folder-tab bar sits along the bottom
 * of the screen; opening a tab expands the drawer into a three-pane
 * workspace (search/filter on top, inspection on the left, browsing grid
 * in the center — each tab component owns its own panes).
 *
 * Tabs: Heroes (roster + bench + recruitment), Cards (all gameplay card
 * management, stations included as a filter — owner decision 2026-07-08),
 * Bank (items + gold + selling).
 *
 * State lives in useUIModals (`ui.drawer`) so engine events
 * (`ui:open_drawer`) can auto-open it with a pre-applied filter (§12.B).
 */

const TABS = [
    { key: 'heroes', label: 'Heroes', icon: Users },
    { key: 'cards', label: 'Cards', icon: Layers },
    { key: 'bank', label: 'Bank', icon: Landmark }
];

export const BottomFolderDrawer = ({ drawer }) => {
    return (
        <div className="pointer-events-auto w-full shrink-0 relative z-[95] flex flex-col">
            {/* Folder tab bar — always visible */}
            <div className="flex items-end gap-1.5 px-4 bg-gi-base/90 border-t border-gi-border">
                {TABS.map(({ key, label, icon: Icon }) => {
                    const active = drawer.isOpen && drawer.tab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => drawer.toggleTab(key)}
                            className={cn(
                                'flex items-center gap-2 px-5 py-2 mt-1.5 rounded-t-lg border border-b-0 text-xs font-bold uppercase tracking-wider transition-colors',
                                active
                                    ? 'bg-gi-surface border-gi-primary/50 text-gi-text'
                                    : 'bg-gi-base border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-muted'
                            )}
                        >
                            <Icon size={13} />
                            {label}
                        </button>
                    );
                })}
                {drawer.isOpen && (
                    <button
                        onClick={drawer.close}
                        title="Close drawer"
                        className="ml-auto mb-1 p-1.5 rounded border border-gi-border text-gi-muted hover:text-gi-text transition-colors"
                    >
                        <ChevronDown size={13} />
                    </button>
                )}
            </div>

            {/* Workspace */}
            {drawer.isOpen && (
                <div className="h-[44vh] min-h-[300px] bg-gi-surface border-t border-gi-primary/30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] overflow-hidden">
                    {drawer.tab === 'heroes' && <HeroesTab filter={drawer.filter} />}
                    {drawer.tab === 'cards' && <CardsTab filter={drawer.filter} />}
                    {drawer.tab === 'bank' && <BankTab filter={drawer.filter} />}
                </div>
            )}
        </div>
    );
};

export default BottomFolderDrawer;

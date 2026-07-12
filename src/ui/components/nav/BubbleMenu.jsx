import React from 'react';
import { cn } from '../../utils/cn.js';
import {
    Castle, Package, Users, Layers, Landmark,
    BookOpen, Map, Settings, Coins
} from 'lucide-react';
import { useGameState } from '../../hooks/useGameState.js';

/**
 * BubbleMenu — UI Overhaul Phase 1 (ui_overhaul_spec.md §COL-01).
 * The vertical column of glassmorphic bubble buttons that replaces the
 * top bar's navigation in deck-loop mode. Default-docked on the left;
 * a Settings toggle (`ui.bubbleMenuRight`) swaps it to the right edge
 * (side is decided in ReactRoot and passed down).
 *
 * Wiring by target (spec §2, complete as of Phase 4):
 *  - Heroes / Cards / Bank → toggle Bottom Drawer panes (side-by-side).
 *  - Guild Hall / Packs / Area Manager → full-screen drawers.
 *  - Collection Binder / Settings → existing modal triggers.
 *
 * Gold lives on the Bank bubble as a chip (owner decision 2026-07-11 —
 * the top bar is retired in this mode and influence may be cut entirely).
 */

const formatGold = (g) => {
    if (g >= 1e6) return `${(g / 1e6).toFixed(1)}M`;
    if (g >= 1e4) return `${Math.floor(g / 1e3)}k`;
    return g.toLocaleString();
};

/** One circular menu button. `pip` reserves the spec's notification-pip slot. */
const Bubble = ({ icon: Icon, label, onClick, active = false, disabled = false, pip = false, children }) => (
    <div className="relative flex flex-col items-center">
        <button
            title={label}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center border shadow-lg',
                'bg-gi-surface/60 backdrop-blur-md border-white/10 text-gi-muted',
                'transition-all duration-200',
                !disabled && 'hover:scale-110 hover:text-gi-text hover:border-gi-primary/50 hover:bg-gi-surface/90',
                active && 'ring-2 ring-gi-primary text-gi-primary border-gi-primary/60 bg-gi-primary/10',
                disabled && 'opacity-40 cursor-not-allowed'
            )}
        >
            <Icon size={20} />
        </button>
        {pip && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-gi-danger border border-black/50" />
        )}
        {children}
    </div>
);

export const BubbleMenu = ({ ui, side = 'left' }) => {
    const drawer = ui.drawer;

    // Gold chip on the Bank bubble. state_changed covers save loads (see
    // the same subscription note in the retired TopBarView).
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed', 'state_changed']);

    const isTab = (tab) => drawer.panes.includes(tab);
    const isView = (view) => ui.fullscreen.view === view;

    return (
        <nav
            className={cn(
                'pointer-events-auto shrink-0 z-[110] flex flex-col items-center gap-3 py-4 px-2.5',
                'bg-gi-base/70 backdrop-blur-md border-gi-border',
                side === 'left' ? 'border-r' : 'border-l'
            )}
        >
            <Bubble icon={Castle} label="Guild Hall" active={isView('guild')} onClick={() => ui.fullscreen.toggle('guild')} />
            <Bubble icon={Package} label="Pack Shop" active={isView('packs')} onClick={() => ui.fullscreen.toggle('packs')} />
            <Bubble icon={Users} label="Heroes" active={isTab('heroes')} onClick={() => drawer.toggleTab('heroes')} />
            <Bubble icon={Layers} label="Cards" active={isTab('cards')} onClick={() => drawer.toggleTab('cards')} />
            <Bubble icon={Landmark} label="Bank" active={isTab('bank')} onClick={() => drawer.toggleTab('bank')}>
                <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-black/60 border border-white/10 pointer-events-none">
                    <Coins size={10} className="text-gi-primary shrink-0" />
                    <span className="text-[10px] font-bold text-gi-text leading-none">{formatGold(gold)}</span>
                </div>
            </Bubble>
            <Bubble icon={BookOpen} label="Collection Binder" active={ui.cardLibrary.isOpen} onClick={ui.cardLibrary.open} />
            <Bubble icon={Map} label="Area Manager" active={isView('areas')} onClick={() => ui.fullscreen.toggle('areas')} />

            <div className="mt-auto" />
            <Bubble icon={Settings} label="Settings" active={ui.settings.isOpen} onClick={ui.settings.open} />
        </nav>
    );
};

export default BubbleMenu;

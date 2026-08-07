import React from 'react';
import { formatCompact } from '../../../utils/Formatters.js';
import { cn } from '../../utils/cn.js';
import {
    Castle, Landmark, Vault,
    Settings, Coins
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
 *  - Bank → toggles the Bottom Drawer. Heroes live in the always-visible
 *    Hero Dock and have no bubble.
 *  - Guild Hall / Area Manager → full-screen drawers.
 *  - Collection Binder / Settings → existing modal triggers.
 *
 * All 5 bubbles share one "only one view open at once" rule (ui.nav):
 * clicking a bubble closes whatever any of the others has open, and
 * clicking the active one closes it. This only applies to the bubbles
 * themselves — a banner's own contextual "open the drawer" prompt still
 * opens the Bank pane independently, without closing anything else.
 *
 * No Packs bubble: packs are area-specific (D-32/D-48) and bought at each
 * area's own banner, beside its binder — there's no global shop to open.
 *
 * No Cards/Stations bubble: the old Stations pane was temporary by design
 * and is retired now that station cards deploy from the Collection Binder's
 * Deployment Panel ("Build at Outpost"). A proper in-banner card binder is
 * a later refinement.
 *
 * Gold lives on the Bank bubble as a chip (owner decision 2026-07-11 —
 * the top bar is retired in this mode and influence may be cut entirely).
 *
 * The Bank bubble also carries `id="bank-bubble-target"` — the landing spot
 * `ParticleOverlay.jsx` flies gained-item particles toward on `loot_generated`
 * (owner design 2026-08-01, replacing the old per-item bank-tile targeting,
 * which no longer has anything in the current UI to land on).
 */

// Gold uses the shared ladder (C-15). A local M/k helper stopped at millions
// and rendered anything larger as "4200000000000.0M" — the suffix ladder has
// to live in one place or every new rung has to be re-added per component.
const formatGold = (g) => (g >= 1e4 ? formatCompact(g).toUpperCase() : g.toLocaleString());

/** One circular menu button. `pip` reserves the spec's notification-pip slot. */
const Bubble = ({ icon: Icon, label, color, onClick, active = false, disabled = false, pip = false, id, children }) => (
    <div id={id} className="relative flex flex-col items-center">
        <button
            title={label}
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'w-16 h-16 md:w-32 md:h-32 flex items-center justify-center bg-center bg-no-repeat bg-contain outline-none',
                'transition-all duration-200',
                !disabled && 'hover:scale-110 hover:brightness-110 hover:contrast-125 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] cursor-pointer',
                active && 'scale-110 brightness-110 contrast-125 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]',
                disabled && 'opacity-40 cursor-not-allowed'
            )}
            style={{
                backgroundImage: `url('/assets/ui/ui_orb_${color}.png')`,
                imageRendering: 'pixelated'
            }}
        >
            <Icon 
                className="w-6 h-6 md:w-12 md:h-12 text-yellow-50" 
                style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.75))' }} 
            />
        </button>
        {pip && (
            <span className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-gi-danger border border-black/50" />
        )}
        {children}
    </div>
);

export const BubbleMenu = ({ ui, side = 'left' }) => {
    // Gold chip on the Bank bubble. state_changed covers save loads (see
    // the same subscription note in the retired TopBarView).
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed', 'state_changed']);

    const nav = ui.nav;

    // Settings/Collection Binder are GIModal dialogs whose backdrop (z-[300])
    // sits above the bar's normal z-[110] — so once one is open, its own
    // bubble is physically unreachable to close it again. Rise above the
    // backdrop only while one of those two is the active view, so a second
    // click (or switching to another bubble) can still reach the bar. Stays
    // at the normal layer the rest of the time, so it doesn't leak above
    // unrelated overlays (Slot Selection, Hero Edit, Pack Opening, ...).
    const aboveOwnModal = nav.isActive('settings') || nav.isActive('library');

    return (
        <nav
            className={cn(
                'pointer-events-auto shrink-0 flex flex-col items-center gap-4 py-6 px-3 min-w-[80px] md:min-w-[150px]',
                aboveOwnModal ? 'z-[310]' : 'z-[110]'
            )}
            style={{
                backgroundImage: `url('/assets/ui/ui_bar.png')`,
                backgroundRepeat: 'repeat-y',
                backgroundPosition: side === 'left' ? 'left top' : 'right top',
                backgroundSize: '100% auto',
                imageRendering: 'pixelated'
            }}
        >
            <Bubble icon={Castle} label="Guild Hall" color="purple" active={nav.isActive('guild')} onClick={() => nav.toggle('guild')} />
            {/* No Heroes bubble: the Hero Dock is always on screen, so there
                is nothing to toggle (Hero Dock Phase 7). */}
            <Bubble id="bank-bubble-target" icon={Landmark} label="Bank" color="yellow" active={nav.isActive('bank')} onClick={() => nav.toggle('bank')}>
                <div className="absolute -bottom-2 md:bottom-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/80 border border-white/20 pointer-events-none shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-10">
                    <Coins size={10} className="text-yellow-400 shrink-0" />
                    <span className="text-[10px] md:text-xs font-bold text-yellow-50 leading-none">{formatGold(gold)}</span>
                </div>
            </Bubble>
            {/* The Token Vault is a Bank of its own: Tokens are capped
                separately from items (D-137) and are for placing rather than
                storing (D-158), so they get their own door rather than a tab
                inside someone else's. */}
            <Bubble icon={Vault} label="Token Vault" color="blue" active={nav.isActive('vault')} onClick={() => nav.toggle('vault')} />
            {/* The Collection Binder and Area Manager bubbles are gone with
                their screens — binders were per-area card ownership (D-41) and
                the Area Manager managed areas, both deleted by the playmat
                rework.

                Two bubbles arrive later: the **Token Bank** (Phase 7) and the
                **Cartographer** (Phase 8). Both are deliberate off-board
                exceptions — the design's rule is not "no menus", it is "no menu
                decides what the board does" (grid concept §1). */}

            <div className="mt-auto" />
            <Bubble icon={Settings} label="Settings" color="red" active={nav.isActive('settings')} onClick={() => nav.toggle('settings')} />
        </nav>
    );
};

export default BubbleMenu;

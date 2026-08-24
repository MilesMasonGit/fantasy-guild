import React from 'react';
import { formatCompact } from '../../../utils/Formatters.js';
import { cn } from '../../utils/cn.js';
import {
    Castle, Landmark, Vault, Map as MapIcon,
    Settings, Coins
} from 'lucide-react';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { QuestManager } from '../../../systems/quests/QuestManager.js';

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
 * Gold lives on the Bank bubble as a chip (owner decision 2026-07-11 — the
 * top bar is retired in this mode). Influence has since been cut, so gold is
 * the only currency there is to show.
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
const Bubble = React.forwardRef(({ icon: Icon, label, color, onClick, active = false, disabled = false, pip = false, id, children, droppableProps, isValidDrop }, ref) => {
    const handleClick = (e) => {
        const rect = e.currentTarget?.getBoundingClientRect();
        if (rect) {
            const radius = Math.min(rect.width, rect.height) / 2;
            const dist = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
            if (dist > radius) {
                return; // Transparent corner outside the orb: ignore click
            }
        }
        EventBus.publish('audio:play', { clip: 'button_click' });
        onClick?.(e);
    };

    return (
        <div id={id} ref={ref} {...droppableProps} className={cn("relative flex flex-col items-center rounded-full", isValidDrop && "ring-4 ring-gi-success shadow-[0_0_15px_rgba(34,197,94,0.6)]")}>
            <button
                title={label}
                aria-label={label}
                onClick={handleClick}
                disabled={disabled}
                data-alpha-circle="true"
                className={cn(
                    'w-16 h-16 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-center bg-no-repeat bg-contain outline-none',
                    'transition-all duration-200',
                    !disabled && 'hover:scale-110 hover:brightness-110 hover:contrast-125 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] cursor-pointer',
                    active && 'scale-110 brightness-110 contrast-125 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]',
                    disabled && 'opacity-40 cursor-not-allowed'
                )}
                style={{
                    backgroundImage: `url('/assets/ui/ui_orb_${color === 'blue' ? 'lblu' : color}.png')`,
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
});

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

    const isVaultSendUnlocked = useGameState(
        () => QuestManager.isTokenVaultSendUnlocked(),
        ['state_changed', 'quests_updated', 'loot_token_placed', 'token_placed']
    );

    const vaultDrop = useEntityDrop({
        id: 'vault-bubble-deposit',
        surface: DND_SURFACE.HUD,
        accepts: (p) => {
            if (!isVaultSendUnlocked) return false;
            if (p.kind !== DRAG_KIND.TOKEN) return false;
            const def = getTokenType(p.typeId);
            if (def?.cannotLeaveBoard || def?.isGuildHall || p.typeId === 'token_guild_hall') return false;
            return (p.from?.traySlot != null || p.from?.tile != null);
        },
        onDrop: (p) => {
            if (!isVaultSendUnlocked) {
                NotificationSystem.warning('Token Vault storage unlocks after completing "Place a Dropped Token".');
                return;
            }
            if (p.from?.traySlot != null) {
                const instance = BoardState.getTray()[p.from.traySlot];
                if (!instance) return;

                if (getTokenType(instance.typeId)?.mapId) {
                    NotificationSystem.warning('Maps cannot be stored — open it.');
                    return;
                }
                if (!TokenBank.deposit(instance)) {
                    NotificationSystem.warning('No room in the Vault');
                    return;
                }
                BoardState.takeFromTray(p.from.traySlot);
            } else if (p.from?.tile != null) {
                const res = Placement.returnTokenToVault(p.from.tile);
                if (!res.success && res.reason) {
                    NotificationSystem.warning(res.reason);
                }
            }
        }
    });

    return (
        <nav
            className={cn(
                // `relative` so the z-index below actually applies — it is what
                // keeps the nav ABOVE the bank drawer (z-[90], D-238).
                'pointer-events-auto relative shrink-0 flex flex-col items-center gap-4 py-6 px-3 min-w-[80px] md:min-w-[150px]',
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
            <Bubble id="guild-bubble-target" icon={Castle} label="Guild Hall" color="purple" active={nav.isActive('guild')} onClick={() => nav.toggle('guild')} />
            {/* No Heroes bubble: the Hero Dock is always on screen, so there
                is nothing to toggle (Hero Dock Phase 7). */}
            <Bubble id="bank-bubble-target" icon={Landmark} label="Item Bank" color="yellow" active={nav.isActive('bank')} onClick={() => nav.toggle('bank')}>
                <div className="absolute -bottom-2 md:bottom-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/80 border border-white/20 pointer-events-none shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-10">
                    <Coins size={10} className="text-yellow-400 shrink-0" />
                    <span className="text-[10px] md:text-xs font-bold text-yellow-50 leading-none">{formatGold(gold)}</span>
                </div>
            </Bubble>
            {/* The Token Vault is a Bank of its own: Tokens are capped
                separately from items (D-137) and are for placing rather than
                storing (D-158), so they get their own door rather than a tab
                inside someone else's. */}
            {/* `id` is the particle landing spot for collected Tokens (D-232),
                exactly as the Bank bubble is for items. */}
            <Bubble id="vault-bubble-target" ref={vaultDrop.setNodeRef} droppableProps={vaultDrop.droppableProps} isValidDrop={vaultDrop.valid} icon={Vault} label="Token Vault" color="lblu" active={nav.isActive('vault')} onClick={() => nav.toggle('vault')} />
            {/* The Cartographer: the one shop that is deliberately off-board
                (D-98). A Cartographer Token would have permanently consumed a
                tile AND a hero purely to keep progression ticking. */}
            <Bubble id="cartographer-bubble-target" icon={MapIcon} label="Cartographer's Shop" color="green" active={nav.isActive('cartographer')} onClick={() => nav.toggle('cartographer')} />
            {/* The Collection Binder and Area Manager bubbles are gone with
                their screens — binders were per-area card ownership (D-41) and
                the Area Manager managed areas, both deleted by the playmat
                rework.

                The Token Vault and Cartographer above are both deliberate
                off-board exceptions — the design's rule is not "no menus", it is
                "no menu decides what the board does" (grid concept §1). */}

            <div className="mt-auto" />
            <Bubble icon={Settings} label="Settings" color="red" active={nav.isActive('settings')} onClick={() => nav.toggle('settings')} />
        </nav>
    );
};

export default BubbleMenu;

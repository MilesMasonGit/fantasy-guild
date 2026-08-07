import React, { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { tokenSpritePath } from '../../../config/registries/tokenRegistry.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { Coins, ArrowRight } from 'lucide-react';

/**
 * TokenVaultTab — the Token Bank, as a drawer pane.
 *
 * ## Why a pane rather than a panel beside the board
 * The Bank **covers the board** when open (UI §2), which is precisely why the
 * Tray exists: the flow is **Vault → Tray → Board**, and a Token cannot be
 * dragged from storage onto a tile in one motion. So this offers a button
 * rather than a drag — the destination is behind the drawer, and inventing a
 * drag that has to survive a panel close would be worse than a click.
 *
 * ## What it shows, and what it deliberately does not
 * One row per **distinct type**, because distinct types are the thing that is
 * capped (D-137). Copies are a count, never a list of rows: the Bank holding
 * eight hundred Forests must not become eight hundred entries, and after
 * consolidation (D-77) there is at most one partial per type anyway.
 *
 * ## Selling is an escape valve, not a strategy (D-146)
 * The rate is deliberately poor. It exists because slot caps require an exit —
 * a Map burst hands the player Tokens they have no use for, and without
 * disposal those eventually fill the Vault. If selling ever looks like income,
 * the numbers have drifted.
 *
 * **Mythics sell like anything else** (owner decision 2026-08-06). D-177 made
 * them ownable in multiples — only one may be *placed* — so a sale is no longer
 * irreversible and needs no guard.
 */
export const TokenVaultTab = ({ onInspect }) => {
    const { rows, used, cap, trayFull } = useGameState(
        () => ({
            rows: TokenBank.contents(),
            ...TokenBank.slotUsage(),
            trayFull: BoardState.getTray().length >= BoardState.TRAY_CAPACITY
        }),
        ['token_bank_updated', 'state_changed'],
        // ⚠️ `eventFilter`, not a default value — see the note in Board.jsx.
        null
    );

    const withdraw = useCallback((typeId) => {
        const instance = TokenBank.withdraw(typeId);
        if (!instance) return;
        // Put it straight back if the Tray will not take it. Nothing is ever
        // lost to a full container (D-138), and that includes this path.
        if (!BoardState.addToTray(instance)) {
            TokenBank.deposit(instance);
            NotificationSystem.warning('No room in the Tray');
        }
    }, []);

    const sell = useCallback((typeId) => {
        const result = TokenBank.sell(typeId);
        if (result.success) NotificationSystem.success(`Sold for ${result.gold}g`);
    }, []);

    return (
        <div className="h-full flex flex-col min-h-0">
            {/* The pane's title comes from the drawer; this strip carries only
                the number the player has to watch. Slots, not quantity —
                stacks are never capped (D-137), so a count of copies would be
                the wrong thing to worry about. */}
            <div className="shrink-0 flex items-center justify-end px-3 py-1 border-b border-gi-border/40">
                <span className={cn(
                    'text-[10px] font-bold tabular-nums',
                    used >= cap ? 'text-gi-danger' : 'text-gi-muted'
                )}>
                    {used} / {cap} slots
                </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
                {rows.length === 0 && (
                    <p className="text-[11px] text-gi-muted p-3 text-center">
                        Nothing stored. Tokens you collect land in the Tray first —
                        anything that will not fit there is kept here.
                    </p>
                )}

                {rows.map(row => (
                    <VaultRow
                        key={row.typeId}
                        row={row}
                        trayFull={trayFull}
                        onWithdraw={() => withdraw(row.typeId)}
                        onSell={() => sell(row.typeId)}
                        onInspect={() => onInspect?.('token', row.typeId)}
                    />
                ))}
            </div>
        </div>
    );
};

/** Rarity is a communication tool, not a power scale (D-169) — hence colour only. */
const RARITY_TONE = {
    common: 'text-gi-muted',
    uncommon: 'text-gi-success',
    rare: 'text-gi-info',
    mythic: 'text-gi-gold'
};

const VaultRow = ({ row, trayFull, onWithdraw, onSell, onInspect }) => {
    const art = tokenSpritePath(row.typeId);
    // At most one partial per type survives consolidation (D-77), so this reads
    // as a fact about the pile rather than a list of damaged goods.
    const partial = row.partials;

    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-gi-border/40 bg-gi-base/40">
            <button onClick={onInspect} title="Inspect" className="shrink-0">
                {art && (
                    <img
                        src={art}
                        alt={row.name}
                        draggable={false}
                        style={{ width: 32, height: 32, imageRendering: 'pixelated' }}
                    />
                )}
            </button>

            <div className="flex-1 min-w-0">
                <div className={cn('text-[11px] font-bold truncate', RARITY_TONE[row.rarity] || RARITY_TONE.common)}>
                    {row.name} {row.count > 1 && <span className="text-gi-muted">×{row.count}</span>}
                </div>
                <div className="text-[9px] text-gi-muted tabular-nums">
                    {partial.length
                        ? `${partial.length} part-used (${partial.join(', ')} left)`
                        : 'full'}
                </div>
            </div>

            <button
                onClick={onWithdraw}
                disabled={trayFull}
                title={trayFull ? 'The Tray is full' : 'Move one to the Tray'}
                className={cn(
                    'shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-colors',
                    trayFull
                        ? 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                        : 'border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-muted'
                )}
            >
                Tray <ArrowRight size={10} />
            </button>

            <button
                onClick={onSell}
                title={`Sell one for ${row.sellValue}g — a deliberately poor rate`}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border border-gi-border text-gi-gold/80 hover:text-gi-gold hover:border-gi-gold/50 transition-colors tabular-nums"
            >
                <Coins size={10} /> {row.sellValue}
            </button>
        </div>
    );
};

export default TokenVaultTab;

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { useEntityDrag, useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { getTokenType, tokenStartingUses } from '../../../config/registries/tokenRegistry.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import * as VaultTransfer from '../../../systems/board/VaultTransfer.js';
import * as TokenGroups from '../../../systems/board/TokenGroups.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { QuestManager } from '../../../systems/quests/QuestManager.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { Lock, Vault as VaultIcon, BoxSelect, Coins, Check, AlertTriangle } from 'lucide-react';

/**
 * TokenVaultTab — the Token Bank, as a drawer pane.
 *
 * ## A grid with tabs, like the Bank (D-241, D-242)
 * The owner wanted the two banks to read as siblings, so this is an icon grid
 * with a tab strip rather than the list of rows it used to be.
 *
 * **One cell per distinct type, with a copy count — never one cell per copy.**
 * D-137 caps *types*, so a grid of copies would show forty cells for forty
 * Oakwood Groves and misrepresent the very thing being capped. After
 * consolidation (D-77) there is at most one partial per type anyway.
 *
 * ⚠️ **Tabs are system-owned**, exactly as `BankTabStrip`'s are: padded to the
 * unlocked count by the Guild Hall, never created or named by the player. What
 * the player controls is **which tab a Token lives in** — drag a cell onto a tab
 * to file it.
 *
 * ## Two gestures out, one in
 * Drag a cell to the **Tray** to withdraw (D-244), or click to inspect where
 * Add to Tray and Sell controls live. Drag a Token from the Tray onto this pane
 * to **store** it (D-247) — except a Map, which must be opened.
 */
export const TokenVaultTab = ({ onInspect, selectedTemplateId, searchQuery = '' }) => {
    const { tabs, used, cap, unlocked } = useGameState(
        () => ({
            tabs: TokenGroups.grouped(TokenBank.contents()),
            ...TokenBank.slotUsage(),
            unlocked: TokenGroups.unlockedCount()
        }),
        ['token_bank_updated', 'state_changed'],
        // ⚠️ `eventFilter`, not a default value — see the note in Board.jsx.
        null
    );

    const [activeId, setActiveId] = useState(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [sellModalOpen, setSellModalOpen] = useState(false);

    const currentId = tabs.some(t => t.id === activeId) ? activeId : tabs[0]?.id;
    const current = tabs.find(t => t.id === currentId);

    const allRows = useMemo(() => tabs.flatMap(t => t.rows || []), [tabs]);
    const selectedRows = useMemo(
        () => allRows.filter(r => selectedIds.has(r.typeId)),
        [allRows, selectedIds]
    );

    const toggleSelected = (typeId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(typeId)) next.delete(typeId); else next.add(typeId);
            return next;
        });
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
        setSellModalOpen(false);
    };

    const confirmSell = (quantities) => {
        let totalG = 0;
        selectedRows.forEach(row => {
            const qty = quantities?.[row.typeId] ?? row.count;
            const val = TokenBank.totalSellValue(row.typeId, qty);
            for (let i = 0; i < qty; i++) {
                TokenBank.sell(row.typeId);
            }
            totalG += val;
        });
        EventBus.publish('state_changed', {});
        NotificationSystem.success(`Sold selected token(s) for ${totalG}g`);
        exitSelectMode();
    };

    /**
     * The Vault takes Tokens back (D-247).
     *
     * ⚠️ **Maps are refused, and that is the rule rather than a limitation.**
     * A purchased Map must be opened (D-156). That refusal — and every other one
     * — now comes out of `VaultTransfer.depositFrom` as a `reason` string; this
     * pane no longer carries its own copy of the rule (CR2-134).
     */
    const isVaultSendUnlocked = useGameState(
        () => QuestManager.isTokenVaultSendUnlocked(),
        ['state_changed', 'quests_updated', 'loot_token_placed', 'token_placed']
    );

    const deposit = useEntityDrop({
        id: 'vault-deposit',
        surface: DND_SURFACE.DRAWER,
        accepts: (p) => {
            if (!isVaultSendUnlocked) return false;
            if (p.kind !== DRAG_KIND.TOKEN) return false;
            const def = getTokenType(p.typeId);
            if (def?.cannotLeaveBoard || def?.isGuildHall || p.typeId === 'token_guild_hall') return false;
            return (p.from?.traySlot != null || p.from?.tile != null);
        },
        onDrop: (p) => {
            const res = VaultTransfer.depositFrom(p.from);
            if (!res.success && res.reason) NotificationSystem.warning(res.reason);
        }
    });

    const activeSearch = searchQuery?.trim().toLowerCase();
    const rowsToDisplay = useMemo(() => {
        if (!activeSearch) {
            return current?.rows || [];
        }
        // When searching, match across all rows in current tab or entire vault
        const all = tabs.flatMap(t => t.rows || []);
        return all.filter(r => (r.name || '').toLowerCase().includes(activeSearch) || (r.typeId || '').toLowerCase().includes(activeSearch));
    }, [activeSearch, current?.rows, tabs]);

    return (
        <div
            ref={deposit.setNodeRef}
            {...deposit.droppableProps}
            className="h-full flex flex-col min-h-0"
        >
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gi-border/40 bg-gi-base/30 flex-wrap">
                <TokenTabStrip
                    tabs={tabs}
                    unlocked={unlocked}
                    activeId={currentId}
                    onSelect={setActiveId}
                    onClearSelection={() => setSelectedIds(new Set())}
                />
                <button
                    onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                    title={selectMode ? 'Exit select mode' : 'Select multiple tokens to move or sell'}
                    className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors',
                        selectMode
                            ? 'border-gi-primary bg-gi-primary/15 text-gi-text'
                            : 'border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-muted'
                    )}
                >
                    <BoxSelect size={11} /> {selectMode ? 'Done' : 'Select'}
                </button>
                {selectMode && (
                    <>
                        <span className="text-[10px] text-gi-muted tabular-nums">{selectedRows.length} selected</span>
                        <button
                            onClick={() => setSellModalOpen(true)}
                            disabled={selectedRows.length === 0}
                            className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors',
                                selectedRows.length > 0
                                    ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text hover:bg-gi-gold/25'
                                    : 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                            )}
                        >
                            <Coins size={11} className="text-gi-gold" /> Sell…
                        </button>
                    </>
                )}
                <span
                    title="Tokens in the vault / slot capacity"
                    className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ml-auto',
                        used >= cap ? 'text-gi-danger border-gi-danger/40 bg-gi-danger/10' : 'text-gi-muted border-gi-border'
                    )}
                >
                    {used}/{cap}
                </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {rowsToDisplay.length ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3">
                        {rowsToDisplay.map(row => (
                            <TokenCell
                                key={row.typeId}
                                row={row}
                                selected={selectedTemplateId === row.typeId}
                                checked={selectedIds.has(row.typeId)}
                                selectMode={selectMode}
                                selectionIds={selectedIds}
                                onSelect={() => toggleSelected(row.typeId)}
                                onInspect={() => onInspect?.('token', row.typeId)}
                                // ⚠️ No `vault_withdrawn` / `token_bank_updated`
                                // publish here. `TokenBank.withdraw` already made
                                // both, and republishing them counted one
                                // withdrawal twice on every quest that watches
                                // for it (CR2-146).
                                onQuickAdd={() => {
                                    const res = VaultTransfer.withdrawTo(row.typeId);
                                    if (!res.success) {
                                        if (res.reason) NotificationSystem.warning(res.reason);
                                        return;
                                    }
                                    NotificationSystem.success(`Added ${row.name} to Tray`);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/40">
                        <VaultIcon size={32} />
                        <span className="text-xs uppercase tracking-widest font-bold">
                            {activeSearch ? 'No matching tokens' : (tabs.every(t => !t.rows.length) ? 'Vault empty' : 'Nothing filed here')}
                        </span>
                        <span className="text-[10px] normal-case text-center px-6">
                            {activeSearch ? 'Try a different search term.' : 'Drag Tokens onto a tab to file them here.'}
                        </span>
                    </div>
                )}
            </div>

            {sellModalOpen && (
                <TokenSellConfirmModal
                    entries={selectedRows}
                    onCancel={() => setSellModalOpen(false)}
                    onConfirm={confirmSell}
                />
            )}
        </div>
    );
};

/**
 * The tab strip, mirroring `BankTabStrip`: always `TOKEN_TAB_CAP` positions,
 * unlocked ones showing the sprite of their first Token (or the number when
 * empty), locked ones greyed with a padlock so the player can see what an
 * upgrade buys.
 */
const TokenTabStrip = ({ tabs, unlocked, activeId, onSelect, onClearSelection }) => (
    <div className="flex items-center gap-1 flex-wrap">
        {tabs.map((tab, i) => (
            <TokenTabButton
                key={tab.id}
                tab={tab}
                index={i}
                active={tab.id === activeId}
                onSelect={onSelect}
                onClearSelection={onClearSelection}
            />
        ))}
        {Array.from({ length: Math.max(0, TokenGroups.TOKEN_TAB_CAP - unlocked) }, (_, i) => (
            <div
                key={`locked-${i}`}
                title="Locked — unlock more tabs via Guild Hall upgrades"
                className="w-10 h-10 rounded border border-gi-border/30 bg-black/20 flex items-center justify-center text-gi-muted/30 shrink-0"
            >
                <Lock size={12} />
            </div>
        ))}
    </div>
);

/** One tab — a drop target that files the dragged Token type or selection here. */
const TokenTabButton = ({ tab, index, active, onSelect, onClearSelection }) => {
    const first = tab.rows?.[0];
    const drop = useEntityDrop({
        id: `token-tab-${tab.id}`,
        surface: DND_SURFACE.DRAWER,
        // Accept a dragged single token or a whole multi-select payload
        accepts: (p) => p.kind === DRAG_KIND.TOKEN && (p.from?.vaultTypeId != null || p.selection?.length),
        onDrop: (p) => {
            const ids = p.selection?.length ? p.selection : (p.from?.vaultTypeId ? [p.from.vaultTypeId] : []);
            ids.forEach(id => TokenGroups.assign(id, tab.id));
            if (p.selection?.length) onClearSelection?.();
        }
    });

    return (
        <button
            ref={drop.setNodeRef}
            {...drop.droppableProps}
            onClick={() => onSelect(tab.id)}
            title={first ? `Tab ${index + 1} — ${first.name}` : `Tab ${index + 1} (empty)`}
            className={cn(
                'w-10 h-10 rounded border flex items-center justify-center transition-colors shrink-0 overflow-hidden',
                active ? 'border-gi-primary bg-gi-primary/15' : 'border-gi-border bg-black/40 hover:border-gi-muted',
                drop.valid && 'ring-2 ring-gi-primary border-gi-primary'
            )}
        >
            {first
                ? <TokenSprite typeId={first.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt={first.name} />
                : <span className="text-[10px] font-bold text-gi-muted">{index + 1}</span>}
        </button>
    );
};

const TokenCell = ({
    row,
    selected,
    checked = false,
    selectMode = false,
    selectionIds = null,
    onInspect,
    onQuickAdd,
    onSelect
}) => {
    /**
     * One cell does double duty as a drag source (D-244, D-242):
     * drop it on the **Tray** to withdraw, or on a **tab** to file it.
     * In select mode, a checked cell drags the entire selection.
     */
    const drag = useEntityDrag({
        id: `vault-${row.typeId}`,
        kind: DRAG_KIND.TOKEN,
        payload: {
            typeId: row.typeId,
            from: { vaultTypeId: row.typeId },
            ...(selectMode && checked && selectionIds?.size > 1 ? { selection: [...selectionIds] } : {})
        },
        sourceSurface: DND_SURFACE.DRAWER
    });

    // At most one partial per type survives consolidation (D-77).
    const hasPartial = row.partials?.length > 0;
    const capacity = tokenStartingUses(row.typeId);
    const isPartialOnly = hasPartial && row.count === 1 && capacity != null;
    const pct = isPartialOnly ? Math.max(1, Math.round((row.partials[0] / capacity) * 100)) : null;
    const displayLabel = isPartialOnly ? `${pct}%` : formatCompact(row.count, 1);

    const handleClick = () => {
        if (selectMode) {
            onSelect?.();
        } else {
            onInspect?.();
        }
    };

    return (
        <button
            ref={drag.setNodeRef}
            onClick={handleClick}
            onContextMenu={(e) => {
                e.preventDefault();
                if (!selectMode) onQuickAdd?.();
            }}
            {...drag.handleProps}
            title={
                selectMode
                    ? `${row.name} ×${row.count} — click to ${checked ? 'deselect' : 'select'}`
                    : isPartialOnly
                        ? `${row.name} (${pct}% charges remaining) — drag to tray, right-click to add to tray, or click to inspect`
                        : `${row.name} ×${row.count} — drag to tray, right-click to add to tray, or click to inspect`
            }
            className={cn(
                'relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing text-center min-w-0 min-h-0 aspect-square select-none',
                selected && !selectMode ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted',
                checked && 'border-gi-primary bg-gi-primary/15 ring-1 ring-gi-primary/60',
                drag.isDragging && 'opacity-40'
            )}
        >
            {checked && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded bg-gi-primary text-black flex items-center justify-center">
                    <Check size={11} strokeWidth={3} />
                </span>
            )}
            {hasPartial && !checked && (
                <span
                    title={`Part-used: ${row.partials.join(', ')} left`}
                    className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-gi-warning border border-black/50"
                />
            )}
            {/* 64px Token sprite, matching ItemTile styling */}
            <TokenSprite typeId={row.typeId} surface={TOKEN_SURFACE.VAULT} alt={row.name} className="shrink-0" />
            <span className={cn(
                "text-xs md:text-sm font-bold mt-1.5 tabular-nums",
                isPartialOnly ? "text-gi-warning" : "text-gi-text"
            )}>
                {displayLabel}
            </span>
        </button>
    );
};

/**
 * TokenSellConfirmModal — bulk-sell modal for tokens with quantity sliders.
 */
const TokenSellConfirmModal = ({ entries, onCancel, onConfirm }) => {
    const [quantities, setQuantities] = useState(() => {
        const initial = {};
        entries.forEach(e => {
            initial[e.typeId] = e.count;
        });
        return initial;
    });

    const setQty = (typeId, val, max) => {
        setQuantities(prev => ({
            ...prev,
            [typeId]: Math.max(1, Math.min(max, parseInt(val, 10) || 1))
        }));
    };

    const total = entries.reduce((sum, e) => {
        const qty = quantities[e.typeId] ?? e.count;
        return sum + TokenBank.totalSellValue(e.typeId, qty);
    }, 0);

    const handleConfirm = () => {
        onConfirm(quantities);
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4" onClick={onCancel}>
            <div
                className="w-[48rem] max-w-[96vw] max-h-[85vh] rounded-xl border border-yellow-500/40 bg-[#12141d] shadow-2xl p-4 flex flex-col gap-3"
                onClick={e => e.stopPropagation()}
            >
                {/* Header: Title */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2 text-gi-text font-bold uppercase tracking-wider text-xs">
                        <Coins size={15} className="text-yellow-400" />
                        <span>Bulk Sell Tokens</span>
                        <span className="text-[10px] text-gi-muted font-normal">({entries.length} selected)</span>
                    </div>
                </div>

                {/* Tokens List with Quantity Sliders formatted in aligned grid columns */}
                <div className="max-h-[58vh] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                    {entries.map(e => {
                        const maxCount = e.count;
                        const currentQty = quantities[e.typeId] ?? maxCount;
                        const itemTotal = TokenBank.totalSellValue(e.typeId, currentQty);

                        return (
                            <div key={e.typeId} className="grid grid-cols-[1fr_180px_130px_110px] items-center gap-3 px-3.5 py-2 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                                {/* Token Identity */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <TokenSprite typeId={e.typeId} surface={TOKEN_SURFACE.VAULT} alt={e.name} className="w-7 h-7 shrink-0" />
                                    <span className="text-xs font-bold text-gi-text truncate" title={e.name}>
                                        {e.name}
                                    </span>
                                </div>

                                {/* Slider */}
                                <div className="flex items-center">
                                    <input
                                        type="range"
                                        min="1"
                                        max={maxCount}
                                        value={currentQty}
                                        onChange={(ev) => setQty(e.typeId, ev.target.value, maxCount)}
                                        className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-gi-primary focus:outline-none"
                                    />
                                </div>

                                {/* Quantity Badge */}
                                <div className="flex items-center justify-center gap-1 font-mono text-xs tabular-nums font-bold text-gi-text bg-black/60 px-2 py-1 rounded border border-white/10 text-center select-none">
                                    <span>{currentQty.toLocaleString()}</span>
                                    <span className="text-[10px] text-gi-muted font-normal">/ {maxCount.toLocaleString()}</span>
                                </div>

                                {/* Gold Yield */}
                                <div className="flex items-center justify-end gap-1.5 text-xs md:text-sm font-bold text-yellow-300 font-mono tabular-nums text-right">
                                    <Coins size={12} className="text-yellow-400 shrink-0" />
                                    <span>{itemTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3.5 py-2 rounded-lg border border-gi-border/60 text-xs font-bold uppercase tracking-wider text-gi-muted hover:text-gi-text hover:border-gi-border transition-colors cursor-pointer active:scale-[0.99]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-yellow-500/60 bg-yellow-500/15 hover:bg-yellow-500/25 active:scale-[0.99] text-xs font-bold uppercase tracking-wider text-gi-text transition-all cursor-pointer shadow-sm"
                    >
                        <Coins size={14} className="text-yellow-400" />
                        <span>Sell for {total.toLocaleString()} gold</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TokenVaultTab;


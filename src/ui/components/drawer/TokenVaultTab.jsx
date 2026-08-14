import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { useEntityDrag, useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Placement from '../../../systems/board/Placement.js';
import { getTokenType, tokenStartingUses } from '../../../config/registries/tokenRegistry.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import * as TokenGroups from '../../../systems/board/TokenGroups.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { Lock, Vault as VaultIcon } from 'lucide-react';

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
export const TokenVaultTab = ({ onInspect, selectedTemplateId }) => {
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
    const currentId = tabs.some(t => t.id === activeId) ? activeId : tabs[0]?.id;
    const current = tabs.find(t => t.id === currentId);

    /**
     * The Vault takes Tokens back (D-247).
     *
     * ⚠️ **Maps are refused, and that is the rule rather than a limitation.**
     * A purchased Map must be opened. `TokenBank.deposit` enforces this itself
     * (D-156), so the check here exists only so the drop can *say* why instead
     * of failing silently.
     */
    const deposit = useEntityDrop({
        id: 'vault-deposit',
        surface: DND_SURFACE.DRAWER,
        accepts: (p) => p.kind === DRAG_KIND.TOKEN && (p.from?.traySlot != null || p.from?.tile != null),
        onDrop: (p) => {
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
        <div
            ref={deposit.setNodeRef}
            {...deposit.droppableProps}
            className={cn(
                'h-full flex flex-col min-h-0',
                deposit.valid && 'ring-2 ring-inset ring-gi-success/70',
                deposit.invalid && 'ring-2 ring-inset ring-gi-danger/70'
            )}
        >
            <div className="shrink-0 flex items-start justify-between gap-3 px-3 py-2 border-b border-gi-border/40">
                <TokenTabStrip
                    tabs={tabs}
                    unlocked={unlocked}
                    activeId={currentId}
                    onSelect={setActiveId}
                />
                {/* Slots, not quantity — stacks are never capped (D-137), so a
                    count of copies would be the wrong thing to worry about. */}
                <span className={cn(
                    'shrink-0 text-[10px] font-bold tabular-nums pt-1',
                    used >= cap ? 'text-gi-danger' : 'text-gi-muted'
                )}>
                    {used} / {cap} slots
                </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {current?.rows?.length ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3">
                        {current.rows.map(row => (
                            <TokenCell
                                key={row.typeId}
                                row={row}
                                selected={selectedTemplateId === row.typeId}
                                onInspect={() => onInspect?.('token', row.typeId)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/40">
                        <VaultIcon size={32} />
                        <span className="text-xs uppercase tracking-widest font-bold">
                            {tabs.every(t => !t.rows.length) ? 'Vault empty' : 'Nothing filed here'}
                        </span>
                        <span className="text-[10px] normal-case text-center px-6">
                            Drag Tokens onto a tab to file them here.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * The tab strip, mirroring `BankTabStrip`: always `TOKEN_TAB_CAP` positions,
 * unlocked ones showing the sprite of their first Token (or the number when
 * empty), locked ones greyed with a padlock so the player can see what an
 * upgrade buys.
 */
const TokenTabStrip = ({ tabs, unlocked, activeId, onSelect }) => (
    <div className="flex items-center gap-1 flex-wrap">
        {tabs.map((tab, i) => (
            <TokenTabButton
                key={tab.id}
                tab={tab}
                index={i}
                active={tab.id === activeId}
                onSelect={onSelect}
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

/** One tab — a drop target that files the dragged Token type here. */
const TokenTabButton = ({ tab, index, active, onSelect }) => {
    const first = tab.rows?.[0];
    const drop = useEntityDrop({
        id: `token-tab-${tab.id}`,
        surface: DND_SURFACE.DRAWER,
        // Only a Token already in the Vault can be filed. A Token dragged in
        // from the Tray is a *deposit*, which the pane handles as a whole.
        accepts: (p) => p.kind === DRAG_KIND.TOKEN && p.from?.vaultTypeId != null,
        onDrop: (p) => TokenGroups.assign(p.from.vaultTypeId, tab.id)
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

const TokenCell = ({ row, selected, onInspect }) => {
    /**
     * One cell does double duty as a drag source (D-244, D-242):
     * drop it on the **Tray** to withdraw, or on a **tab** to file it.
     * `from.vaultTypeId` is what both targets key off.
     */
    const drag = useEntityDrag({
        id: `vault-${row.typeId}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: row.typeId, from: { vaultTypeId: row.typeId } },
        sourceSurface: DND_SURFACE.DRAWER
    });

    // At most one partial per type survives consolidation (D-77).
    const hasPartial = row.partials?.length > 0;
    const capacity = tokenStartingUses(row.typeId);
    const isPartialOnly = hasPartial && row.count === 1 && capacity != null;
    const pct = isPartialOnly ? Math.max(1, Math.round((row.partials[0] / capacity) * 100)) : null;
    const displayLabel = isPartialOnly ? `${pct}%` : formatCompact(row.count, 1);

    return (
        <button
            ref={drag.setNodeRef}
            onClick={onInspect}
            {...drag.handleProps}
            title={
                isPartialOnly
                    ? `${row.name} (${pct}% charges remaining) — drag to tray or click to inspect`
                    : `${row.name} ×${row.count} — drag to tray or click to inspect`
            }
            className={cn(
                'relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing text-center min-w-0 min-h-0 aspect-square',
                selected ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted',
                drag.isDragging && 'opacity-40'
            )}
        >
            {hasPartial && (
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

export default TokenVaultTab;

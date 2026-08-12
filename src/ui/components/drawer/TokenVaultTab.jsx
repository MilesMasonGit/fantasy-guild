import React, { useCallback, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { useEntityDrag, useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import * as TokenGroups from '../../../systems/board/TokenGroups.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { Coins, ArrowRight, Lock, Vault as VaultIcon } from 'lucide-react';

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
 * Drag a cell to the **Tray** to withdraw (D-244), or use the arrow button
 * beside it. Drag a Token from the Tray onto this pane to **store** it (D-247) —
 * except a Map, which must be opened.
 *
 * ## What the grid gave up, and where it went
 * A row used to read `3 part-used (400, 200 left)`. A cell has room for an icon
 * and a count, so **partial charges now show as a marker on the cell and their
 * detail lives in inspection** (D-240 keeps that alive over the Tray). This is
 * not cosmetic: a Manager restocking from here draws the **fullest copy first**
 * (D-77), so "is anything in this pile worn down" is a real question.
 *
 * ## Selling is an escape valve, not a strategy (D-146)
 * The rate is deliberately poor. It exists because slot caps require an exit —
 * a Map burst hands the player Tokens they have no use for. If selling ever
 * looks like income, the numbers have drifted.
 *
 * **Mythics sell like anything else** (owner decision 2026-08-06). D-177 made
 * them ownable in multiples — only one may be *placed* — so a sale is no longer
 * irreversible and needs no guard.
 */
export const TokenVaultTab = ({ onInspect, selectedTemplateId }) => {
    const { tabs, used, cap, trayFull, unlocked } = useGameState(
        () => ({
            tabs: TokenGroups.grouped(TokenBank.contents()),
            ...TokenBank.slotUsage(),
            trayFull: BoardState.getTray().length >= BoardState.TRAY_CAPACITY,
            unlocked: TokenGroups.unlockedCount()
        }),
        ['token_bank_updated', 'state_changed'],
        // ⚠️ `eventFilter`, not a default value — see the note in Board.jsx.
        null
    );

    const [activeId, setActiveId] = useState(null);
    const currentId = tabs.some(t => t.id === activeId) ? activeId : tabs[0]?.id;
    const current = tabs.find(t => t.id === currentId);

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
        accepts: (p) => p.kind === DRAG_KIND.TOKEN && p.from?.traySlot != null,
        onDrop: (p) => {
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
                                trayFull={trayFull}
                                selected={selectedTemplateId === row.typeId}
                                onWithdraw={() => withdraw(row.typeId)}
                                onSell={() => sell(row.typeId)}
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

/**
 * Rarity means **drop frequency and nothing else** (D-175) — never a power
 * tier, since a Common Volcanic producer can far outproduce a Rare Woodland
 * one. Hence a colour and no other emphasis: it says "you don't see these
 * often", not "this one is better".
 */
const RARITY_TONE = {
    common: 'text-gi-muted',
    uncommon: 'text-gi-success',
    rare: 'text-gi-info',
    mythic: 'text-gi-gold'
};

const TokenCell = ({ row, trayFull, selected, onWithdraw, onSell, onInspect }) => {
    /**
     * One cell does double duty as a drag source (D-244, D-242):
     * drop it on the **Tray** to withdraw, or on a **tab** to file it.
     * `from.vaultTypeId` is what both targets key off.
     *
     * Withdrawal takes the **fullest copy** (D-77), so a cell showing ×7 hands
     * over the healthiest one — `TokenBank.withdraw` decides that, not the drag.
     */
    const drag = useEntityDrag({
        id: `vault-${row.typeId}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: row.typeId, from: { vaultTypeId: row.typeId } },
        sourceSurface: DND_SURFACE.DRAWER
    });

    // At most one partial per type survives consolidation (D-77), so this is a
    // fact about the pile rather than a list of damaged goods.
    const hasPartial = row.partials?.length > 0;

    return (
        <div
            ref={drag.setNodeRef}
            {...drag.handleProps}
            className={cn(
                'relative flex flex-col items-center gap-1 p-2 rounded border transition-colors',
                'cursor-grab active:cursor-grabbing',
                selected ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border/40 bg-gi-base/40 hover:border-gi-muted',
                drag.isDragging && 'opacity-40'
            )}
        >
            <button onClick={onInspect} title="Inspect" className="relative">
                <TokenSprite typeId={row.typeId} surface={TOKEN_SURFACE.VAULT} alt={row.name} />

                {row.count > 1 && (
                    <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-black/85 text-[10px] font-bold text-white tabular-nums">
                        ×{row.count}
                    </span>
                )}

                {/* ⚠️ The partial marker. A cell cannot carry "3 part-used (400,
                    200 left)", but it must not silently drop the fact either —
                    a Manager restocking from here takes the fullest copy first
                    (D-77). The numbers live in inspection. */}
                {hasPartial && (
                    <span
                        title={`Part-used: ${row.partials.join(', ')} left`}
                        className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-gi-warning border border-black/50"
                    />
                )}
            </button>

            <span className={cn(
                'w-full text-[9px] font-bold text-center truncate',
                RARITY_TONE[row.rarity] || RARITY_TONE.common
            )}>
                {row.name}
            </span>

            <div className="flex items-center gap-1">
                <button
                    onClick={onWithdraw}
                    disabled={trayFull}
                    title={trayFull ? 'The Tray is full' : 'Move one to the Tray'}
                    className={cn(
                        'p-1 rounded border transition-colors',
                        trayFull
                            ? 'border-gi-border/30 text-gi-muted/40 cursor-not-allowed'
                            : 'border-gi-border/50 text-gi-text hover:border-gi-primary/60'
                    )}
                >
                    <ArrowRight size={11} />
                </button>
                <button
                    onClick={onSell}
                    title={`Sell one for ${row.sellValue ?? '?'}g`}
                    className="p-1 rounded border border-gi-border/50 text-gi-gold hover:border-gi-gold/60 transition-colors"
                >
                    <Coins size={11} />
                </button>
            </div>
        </div>
    );
};

export default TokenVaultTab;

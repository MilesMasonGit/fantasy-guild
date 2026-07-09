import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { CommerceSystem } from '../../../systems/economy/CommerceSystem.js';
import { beginNativeDrag, endNativeDrag } from '../../dnd/nativeDrag.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { formatCompact } from '../../../utils/Formatters.js';
import { Search, Coins, Box, Landmark } from 'lucide-react';

/**
 * Bank tab (Phase 7) — replaces the right sidebar (InvView/"Vault"). The
 * guild bank as a filterable grid; the inspection panel carries item
 * details and the sell controls. Item tiles are native drag sources —
 * drop them on a hero's gear slots (Equip Focus or the Heroes tab's
 * inspection) to equip.
 */
export const BankTab = ({ filter }) => {
    const engine = useEngine();

    const [typeFilter, setTypeFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItemId, setSelectedItemId] = useState(null);

    useEffect(() => {
        if (!filter) return;
        setTypeFilter(filter.itemType || 'all');
        setSearchTerm('');
    }, [filter]);

    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed']);
    const capacity = useGameState(state => state.inventory?.slots || { used: 0, max: 20 }, ['inventory_updated']);
    const bank = useGameState(
        state => {
            const entries = Object.entries(state.inventory?.items || {});
            return entries
                .filter(([, data]) => (data?.quantity || 0) > 0)
                .map(([id, data]) => ({ id, count: data.quantity }));
        },
        ['inventory_updated']
    );

    const stocked = useMemo(() => {
        return bank
            .map(({ id, count }) => {
                const template = getItem(id);
                if (!template) return null;
                return { id, count, template };
            })
            .filter(Boolean)
            .sort((a, b) => a.template.name.localeCompare(b.template.name));
    }, [bank]);

    const typeChips = useMemo(() => {
        const types = new Set(stocked.map(e => e.template.type).filter(Boolean));
        return ['all', ...[...types].sort()];
    }, [stocked]);

    const filtered = useMemo(() => {
        let list = stocked;
        if (typeFilter !== 'all') list = list.filter(e => e.template.type === typeFilter);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(e =>
                e.template.name.toLowerCase().includes(term) ||
                e.template.tags?.some(tag => tag.toLowerCase().includes(term))
            );
        }
        return list;
    }, [stocked, typeFilter, searchTerm]);

    const selected = selectedItemId ? stocked.find(e => e.id === selectedItemId) : null;

    return (
        <div className="flex h-full min-h-0">
            {/* Left: inspection + sell controls */}
            <div className="w-80 shrink-0 border-r border-gi-border/50 bg-gi-base/40 overflow-y-auto custom-scrollbar">
                {selected ? (
                    <ItemInspection entry={selected} engine={engine} />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/50 p-6 text-center">
                        <Box size={36} />
                        <span className="text-xs uppercase tracking-widest font-bold">Select an item to inspect</span>
                        <span className="text-[10px] normal-case tracking-normal">Drag gear or provisions onto a hero to equip them.</span>
                    </div>
                )}
            </div>

            {/* Center: filters + grid */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gi-border/40 bg-gi-base/30 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                        {typeChips.map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                className={cn(
                                    'px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors',
                                    typeFilter === type ? 'bg-gi-primary/20 border-gi-primary/40 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text'
                                )}
                            >
                                {type === 'all' ? 'All' : type}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 bg-gi-base border border-gi-border rounded px-2 py-1 ml-auto">
                        <Search size={12} className="text-gi-muted shrink-0" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search items…"
                            className="bg-transparent outline-none text-xs text-gi-text w-36"
                        />
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-gi-gold tabular-nums">
                        <Coins size={12} /> {formatCompact(gold, 2)}
                    </span>
                    <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                        capacity.used >= capacity.max ? 'text-gi-danger border-gi-danger/40 bg-gi-danger/10' : 'text-gi-muted border-gi-border'
                    )}>
                        {capacity.used}/{capacity.max}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {filtered.length > 0 ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
                            {filtered.map(entry => (
                                <ItemTile
                                    key={entry.id}
                                    entry={entry}
                                    selected={selectedItemId === entry.id}
                                    onSelect={() => setSelectedItemId(entry.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/40">
                            <Landmark size={32} />
                            <span className="text-xs uppercase tracking-widest font-bold">
                                {stocked.length === 0 ? 'Bank empty' : 'No items match'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/** One banked item — a native drag source (kind 'item'). */
const ItemTile = ({ entry, selected, onSelect }) => {
    const { template, count } = entry;
    return (
        <button
            onClick={onSelect}
            draggable
            onDragStart={e => beginNativeDrag(e, { kind: 'item', itemId: entry.id })}
            onDragEnd={endNativeDrag}
            title={`${template.name} ×${count}`}
            className={cn(
                'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors cursor-grab active:cursor-grabbing',
                selected ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted'
            )}
        >
            <ItemIcon item={template} size={28} className="bg-gi-base border border-gi-border/50 rounded shrink-0" />
            <span className="min-w-0 flex-1 text-[10px] font-bold text-gi-text truncate">{template.name}</span>
            <span className="shrink-0 text-[10px] font-bold text-gi-muted tabular-nums">{formatCompact(count, 1)}</span>
        </button>
    );
};

const ItemInspection = ({ entry, engine }) => {
    const { template, count } = entry;
    const [sellQty, setSellQty] = useState(1);

    useEffect(() => { setSellQty(1); }, [entry.id]);

    const value = template.baseValue || 1;
    const clampedQty = Math.max(1, Math.min(count, Math.floor(sellQty) || 1));

    const handleSell = (quantity) => {
        const result = CommerceSystem.sellItem(entry.id, quantity);
        if (!result.success) {
            engine.EventBus.publish('ui:notify', { message: result.error || 'Sale failed', type: 'error' });
        }
    };

    return (
        <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border border-gi-border bg-black/30 flex items-center justify-center shrink-0">
                    <ItemIcon item={template} size={48} />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-bold text-gi-text truncate">{template.name}</div>
                    <div className="text-[10px] text-gi-muted capitalize">{template.type || 'item'}</div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <DetailLine label="In bank" value={count.toLocaleString()} />
                <DetailLine label="Sell value" value={`${value} gold`} />
                {template.equipSlot && <DetailLine label="Equips as" value={template.equipSlot} />}
                {template.toolType && <DetailLine label="Tool type" value={template.toolType} />}
                {template.restoreAmount > 0 && <DetailLine label="Restores" value={`${template.restoreAmount} ${template.tags?.includes('drink') ? 'Energy' : 'HP'}`} />}
            </div>

            {template.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {template.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded border border-gi-border/50 text-[9px] text-gi-muted uppercase">{tag}</span>
                    ))}
                </div>
            )}

            {template.description && (
                <p className="text-[10px] text-gi-muted leading-relaxed">{template.description}</p>
            )}

            {/* Sell controls (replaces the old sidebar's sell drawer) */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-gi-border/40">
                <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest">Sell</span>
                <div className="flex items-center gap-1.5">
                    <input
                        type="number" min="1" max={count} value={sellQty}
                        onChange={e => setSellQty(e.target.value)}
                        className="w-16 bg-black/40 border border-gi-border rounded px-2 py-1 text-[11px] text-gi-text outline-none"
                    />
                    <button
                        onClick={() => handleSell(clampedQty)}
                        className="flex-1 px-2 py-1.5 rounded border border-gi-gold/50 bg-gi-gold/10 text-[10px] font-bold uppercase text-gi-text hover:bg-gi-gold/20 transition-colors"
                    >
                        Sell ({clampedQty * value}g)
                    </button>
                    <button
                        onClick={() => handleSell(count)}
                        className="px-2 py-1.5 rounded border border-gi-border text-[10px] font-bold uppercase text-gi-muted hover:text-gi-text transition-colors"
                    >
                        All
                    </button>
                </div>
            </div>
        </div>
    );
};

const DetailLine = ({ label, value }) => (
    <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-gi-muted">{label}</span>
        <span className="text-gi-text font-bold capitalize tabular-nums">{value}</span>
    </div>
);

export default BankTab;

import { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getAllItems, ITEM_TYPES } from '../../../config/registries/itemRegistry.js';

const TYPE_LABEL = {
    [ITEM_TYPES.MATERIAL]: 'Material',
    [ITEM_TYPES.TOOL]: 'Tool',
    [ITEM_TYPES.WEAPON]: 'Weapon',
    [ITEM_TYPES.ARMOR]: 'Armor',
    [ITEM_TYPES.FOOD]: 'Food',
    [ITEM_TYPES.POTION]: 'Potion',
    [ITEM_TYPES.CURRENCY]: 'Currency',
    [ITEM_TYPES.DROP]: 'Drop',
};

/**
 * DevSpawnItemModal — QA tool: search the full item registry and drop copies
 * straight into the bank so they can be dragged onto a hero to test
 * equipability. The other half of the old dead "Spawn Cards/Items..." button
 * (see DevUnlockCardsModal for the split rationale).
 */
export const DevSpawnItemModal = ({ engine, onClose }) => {
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const items = useMemo(
        () => Object.values(getAllItems()).sort((a, b) => a.name.localeCompare(b.name)),
        []
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter(item => {
            if (typeFilter !== 'all' && item.type !== typeFilter) return false;
            if (q && !item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [items, query, typeFilter]);

    const spawn = (itemId, amount) => {
        const added = engine.InventoryManager.addItem(itemId, amount);
        console.log(`[Dev] Spawned ${added}x ${itemId}`);
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
            <div className="w-[480px] max-w-full bg-gi-surface border-2 border-gi-primary/50 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gi-border bg-gi-base/60">
                    <span className="font-display font-bold text-base text-gi-primary uppercase tracking-widest">
                        Spawn Items
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gi-danger/20 hover:text-gi-danger rounded text-gi-muted transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-2 border-b border-gi-border">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gi-muted" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search items..."
                            className="w-full pl-8 pr-3 py-1.5 rounded bg-gi-base border border-gi-border text-sm text-gi-text placeholder:text-gi-muted focus:outline-none focus:border-gi-primary/50"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {['all', ...Object.values(ITEM_TYPES)].map(t => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={cn(
                                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors',
                                    typeFilter === t
                                        ? 'bg-gi-primary/20 border-gi-primary text-gi-primary'
                                        : 'border-gi-border text-gi-muted hover:border-gi-primary/40'
                                )}
                            >
                                {t === 'all' ? 'All' : TYPE_LABEL[t] || t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filtered.length === 0 && (
                        <div className="text-center text-xs text-gi-muted py-8">No items match.</div>
                    )}
                    {filtered.map(item => (
                        <div
                            key={item.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-gi-base border border-gi-border hover:border-gi-primary/40 transition-colors"
                        >
                            <div style={{ imageRendering: 'pixelated' }}>
                                <ItemIcon item={item.id} size={32} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold truncate">{item.name}</div>
                                <div className="text-[9px] text-gi-muted uppercase tracking-wider">
                                    {TYPE_LABEL[item.type] || item.type}
                                </div>
                            </div>
                            <button
                                onClick={() => spawn(item.id, 1)}
                                className="shrink-0 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors"
                            >
                                +1
                            </button>
                            <button
                                onClick={() => spawn(item.id, 10)}
                                className="shrink-0 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors"
                            >
                                +10
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DevSpawnItemModal;

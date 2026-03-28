import React, { useState, useMemo } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { cn } from '../utils/cn.js';
import { Search, PackagePlus } from 'lucide-react';
import { ITEMS as ItemRegistry } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';

/**
 * SpawnItemModal
 * Developer utility screen to force-spawn Items into the Vault.
 */
export const SpawnItemModal = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [quantity, setQuantity] = useState(1);

    // Transform and sort registry into an array once
    const allItems = useMemo(() => {
        return Object.values(ItemRegistry)
            .filter(item => item && item.id)
            .map(item => ({
                id: item.id,
                name: item.name,
                icon: item.icon || '📦',
                type: item.type || 'unknown'
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, []);

    // Filter based on search term
    const filteredItems = useMemo(() => {
        if (!searchTerm) return allItems;
        const lowerTerm = searchTerm.toLowerCase();
        return allItems.filter(item =>
            item.name.toLowerCase().includes(lowerTerm) ||
            item.type.toLowerCase().includes(lowerTerm)
        );
    }, [allItems, searchTerm]);

    // Handle quantity input safely
    const handleQuantityChange = (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
            setQuantity(val);
        } else if (e.target.value === '') {
            setQuantity('');
        }
    };

    const handleBlur = () => {
        if (quantity === '' || quantity < 1) {
            setQuantity(1);
        }
    };

    // Handle spawn action
    const handleSpawn = () => {
        if (!selectedId) return;

        const safeQty = parseInt(quantity, 10) || 1;
        const addedCount = InventoryManager.addItem(selectedId, safeQty);

        if (addedCount > 0) {
            const itemDef = ItemRegistry[selectedId];
            NotificationSystem.success(`Spawned ${safeQty}x ${itemDef.name}`);

            // Auto close after successful spawn
            // onClose(); 
            // Often Devs want to spawn multiple things rapidly, so we leave it open.
        } else {
            NotificationSystem.error('Failed to spawn item.');
        }
    };

    if (!isOpen) return null;

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title="Dev Tools: Spawn Item"
            className="w-full max-w-md bg-gray-900 border-blue-500/50 text-white"
        >
            <div className="flex flex-col gap-4">

                {/* Search Bar */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setSelectedId(null); // Clear selection on search
                        }}
                        placeholder="Search items by name or type..."
                        className="w-full bg-black/60 border border-white/20 text-white font-pixel text-xs py-2 pl-9 pr-3 rounded focus:border-blue-500 outline-none"
                    />
                </div>

                {/* List Container */}
                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar bg-black/40 border border-white/10 rounded p-1">
                    {filteredItems.length === 0 ? (
                        <div className="text-gray-500 text-center py-8 font-pixel text-xs">No items found.</div>
                    ) : (
                        filteredItems.map(item => (
                            <div
                                key={item.id}
                                onClick={() => setSelectedId(item.id)}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border",
                                    selectedId === item.id
                                        ? "bg-blue-900/40 border-blue-500"
                                        : "bg-transparent border-transparent hover:bg-white/5"
                                )}
                            >
                                <span className="text-xl drop-shadow-md w-6 text-center">{item.icon}</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm tracking-wide">{item.name}</span>
                                    <span className="text-[10px] text-gray-500 uppercase">{item.type}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 items-center w-full">
                    <div className="flex items-center gap-2 bg-black/60 border border-white/20 rounded px-2 h-10 w-24">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Qty</span>
                        <input
                            type="number"
                            min="1"
                            max="999"
                            value={quantity}
                            onChange={handleQuantityChange}
                            onBlur={handleBlur}
                            className="w-full bg-transparent text-white font-pixel text-right outline-none no-spinners"
                        />
                    </div>
                    <button
                        onClick={handleSpawn}
                        disabled={!selectedId}
                        className={cn(
                            "flex-1 h-10 rounded font-bold font-pixel tracking-widest uppercase transition-all flex items-center justify-center gap-2",
                            selectedId
                                ? "bg-blue-600 hover:bg-blue-500 text-white drop-shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                                : "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5"
                        )}
                    >
                        <PackagePlus size={18} />
                        Spawn Item
                    </button>
                </div>

            </div>
        </GIModal>
    );
};

export default SpawnItemModal;

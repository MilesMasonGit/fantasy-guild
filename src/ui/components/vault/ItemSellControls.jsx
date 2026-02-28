import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../utils/cn.js';
import { Lock, Unlock, ShoppingCart, Check, X } from 'lucide-react';

/**
 * ItemSellControls
 * A dedicated drop zone area fixed at the bottom of the Inventory Panel. 
 * Allows users to set a quantity, lock/unlock selling, and drag items here to sell them.
 * 
 * @param {Object} props
 * @param {Function} props.onSell - Callback: (itemId, quantity) => void
 */
export const ItemSellControls = ({ onSell, className }) => {
    const [quantity, setQuantity] = useState(1);
    const [isLocked, setIsLocked] = useState(true);

    // Track the item currently being confirmed for sale
    const [pendingItem, setPendingItem] = useState(null);

    // Setup dnd-kit droppable
    const { isOver, setNodeRef } = useDroppable({
        id: 'sell-zone',
        data: {
            accepts: ['item'],
            // DndContext can read this to know what to do onDragEnd
            action: 'initiate-sell'
        }
    });

    // Handle user input for quantity
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

    // Public method exposed via ref or called directly by DndContext parent
    // In our architecture, DndContext finds this droppable and triggers a state update here
    // But since React is unidirectional, it's often cleaner for DndContext to call a callback 
    // that updates a prop, or we listen to a global event. 
    // For this component, we'll design it to accept a `pendingItem` prop IF driven by parent,
    // OR expose a method. But easiest React pattern: The parent (InvView) receives the onDragEnd,
    // sees it dropped on 'sell-zone', and passes `pendingItem` down to this component to trigger confirmation.

    // If we have a pending item waiting for confirmation
    if (pendingItem) {
        return (
            <div className={cn("flex flex-col gap-2 p-3 bg-red-900/40 border border-red-500/50 rounded-lg backdrop-blur-md shadow-glow", className)}>
                <div className="text-sm font-bold text-red-200 text-center font-pixel">
                    Sell {quantity}x {pendingItem.name}?
                </div>
                <div className="flex gap-2 w-full">
                    <button
                        onClick={() => {
                            if (onSell) onSell(pendingItem.id, quantity);
                            setPendingItem(null);
                        }}
                        className="flex-1 bg-green-600/80 hover:bg-green-500 text-white font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                        <Check size={16} /> Confirm
                    </button>
                    <button
                        onClick={() => setPendingItem(null)}
                        className="flex-[0.5] bg-black/60 hover:bg-black/80 text-gray-300 py-1.5 rounded flex items-center justify-center transition-colors border border-white/10"
                    >
                        <X size={16} /> Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Default State: Input + Lock Toggle + Drop Zone
    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col gap-2 p-3 rounded-lg border backdrop-blur-md transition-all duration-300 relative overflow-hidden",
                isLocked
                    ? "bg-black/40 border-white/5 opacity-80"
                    : isOver
                        ? "bg-yellow-900/40 border-yellow-500/80 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.02]"
                        : "bg-surface-glass border-gi-primary/50",
                className
            )}
        >
            {/* Striped construction warning background when unlocked */}
            {!isLocked && (
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, #eab308 25%, transparent 25%, transparent 75%, #eab308 75%, #eab308)', backgroundSize: '20px 20px' }} />
            )}

            <div className="flex justify-between items-center gap-3 relative z-10 w-full">

                {/* Quantity Input */}
                <div className="flex items-center gap-2 bg-black/60 px-2 py-1 rounded border border-white/10 w-24">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Qty</span>
                    <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={handleQuantityChange}
                        onBlur={handleBlur}
                        className="w-full bg-transparent text-white font-pixel text-right outline-none no-spinners"
                        disabled={isLocked}
                    />
                </div>

                {/* Drop Zone Label */}
                <div className="flex-1 flex justify-center items-center">
                    <span className={cn(
                        "font-pixel text-sm uppercase tracking-widest flex items-center gap-2",
                        isLocked ? "text-gray-500" : isOver ? "text-yellow-400 animate-pulse" : "text-gi-primary"
                    )}>
                        <ShoppingCart size={16} />
                        {isLocked ? "Locked" : "Drag to Sell"}
                    </span>
                </div>

                {/* Lock Toggle */}
                <button
                    onClick={() => setIsLocked(!isLocked)}
                    className={cn(
                        "w-8 h-8 rounded flex items-center justify-center transition-colors border",
                        isLocked
                            ? "bg-black/60 border-white/10 text-gray-500 hover:text-white"
                            : "bg-red-900/60 border-red-500/50 text-red-400 hover:bg-red-800/80 hover:text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                    )}
                    title={isLocked ? "Unlock to allow selling" : "Lock to prevent accidental clicks/drags"}
                >
                    {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
            </div>

            {/* Contextual tiny text */}
            <div className="text-[8px] text-center text-gray-500 uppercase tracking-widest relative z-10">
                {isLocked ? "Unlock the merchant protocol to trade" : "Awaiting item transfer..."}
            </div>
        </div>
    );
};

export default ItemSellControls;

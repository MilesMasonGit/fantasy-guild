import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../utils/cn.js';
import { Lock, Unlock, ShoppingCart, Check, X } from 'lucide-react';
import { parseNotation } from '../../../utils/Formatters.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { CommerceSystem } from '../../../systems/economy/CommerceSystem.js';

/**
 * ItemSellControls
 * A dedicated drop zone area fixed at the bottom of the Inventory Panel. 
 * Allows users to set a quantity, lock/unlock selling, and drag items here to sell them.
 * 
 * @param {Object} props
 * @param {Function} props.onSell - Callback: (itemId, quantity) => void
 * @param {Object} props.pendingItem - Item currently being confirmed for sale
 * @param {Function} props.setPendingItem - Callback to clear/set pending item
 */
export const ItemSellControls = ({ onSell, pendingItem, setPendingItem, maxQuantity, className }) => {
    const [inputVal, setInputVal] = useState("1");

    // Reset quantity when pending item changes
    React.useEffect(() => {
        if (pendingItem) {
            setInputVal("1");
        }
    }, [pendingItem?.id]);

    // Numeric value derived from inputVal
    const quantity = parseNotation(inputVal);
    const unitPrice = pendingItem ? CommerceSystem.getItemPrice(pendingItem.id) : 0;
    const totalValue = quantity * unitPrice;

    const handleConfirm = () => {
        if (!pendingItem) return;
        onSell(pendingItem.id, quantity);
        setPendingItem(null);
    };

    const handleCancel = () => {
        setPendingItem(null);
    };

    // Setup dnd-kit droppable
    const { isOver, setNodeRef } = useDroppable({
        id: 'sell-zone',
        disabled: false, // Always active
        data: {
            accepts: ['item'],
            action: 'initiate-sell'
        }
    });

    // Handle user input for quantity
    const handleQuantityChange = (e) => {
        setInputVal(e.target.value);
    };

    const handleBlur = () => {
        const num = parseNotation(inputVal);
        const clamped = Math.max(1, Math.min(num, maxQuantity || Infinity));
        setInputVal(clamped.toString());
    };

    const handleSellAll = () => {
        if (maxQuantity > 0) {
            setInputVal(maxQuantity.toString());
        }
    };

    const handleSellAllButOne = () => {
        if (maxQuantity > 0) {
            const amount = Math.max(1, maxQuantity - 1);
            setInputVal(amount.toString());
        }
    };

    // Default State: Input + Drop Zone
    return (
        <div
            ref={setNodeRef}
            data-droppable-id="sell-zone"
            data-type="sell-zone"
            data-action="initiate-sell"
            className={cn(
                "flex flex-col gap-2 p-1.5 rounded-lg border transition-all duration-300 relative overflow-hidden dnd-target",
                pendingItem
                    ? "bg-yellow-900/20 border-gi-warning/50"
                    : isOver
                        ? "bg-yellow-900/40 border-yellow-500/80"
                        : "bg-gi-surface/40 border-gi-border/50",
                className
            )}
        >
            {/* Top Area: Slot-like Header (The Primary Drop Zone or Confirmation Area) */}
            <div
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (pendingItem) setPendingItem(null);
                }}
                className={cn(
                    "flex items-center justify-between p-2 rounded bg-gi-surface border transition-all duration-200",
                    pendingItem ? "border-gi-warning/50" : isOver ? "border-yellow-500 bg-yellow-900/20" : "border-gi-border border-dashed"
                )}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {/* Item Icon */}
                    <div className="flex-shrink-0">
                        {pendingItem ? (
                            <ItemIcon item={pendingItem} size={32} className="bg-gi-base border border-dashed border-gi-border/50 rounded" />
                        ) : (
                            <div className="w-8 h-8 bg-gi-base border border-dashed border-gi-border/50 rounded flex items-center justify-center text-gi-muted/30">
                                <ShoppingCart size={16} />
                            </div>
                        )}
                    </div>

                    <div className="overflow-hidden">
                        <div className={cn(
                            "gi-text-16 font-bold font-sans transition-colors truncate",
                            pendingItem ? "text-gi-warning" : "text-gi-text"
                        )}>
                            {pendingItem ? pendingItem.name : "Sell Items Here"}
                        </div>
                    </div>
                </div>

                {/* Right Area: Empty when pending or not, since confirming happens below */}
                <div className="flex items-center gap-1.5" />
            </div>

            {/* Bottom: Quantity Controls (Always present) */}
            <div className="flex flex-col gap-2 p-2 rounded bg-black/40 border border-white/5">
                <div className="flex items-center px-1">
                    <span className="gi-text-16 text-gi-muted font-bold uppercase tracking-widest flex-shrink-0">Sell Qty.</span>
                    <div className="flex-1 ml-4 bg-gi-base/60 border border-white/10 rounded px-2 h-[26px] flex items-center overflow-hidden">
                        <input
                            type="text"
                            value={inputVal}
                            onChange={handleQuantityChange}
                            onBlur={handleBlur}
                            className="w-full bg-transparent text-gi-text font-pixel text-center outline-none no-spinners text-[16px] leading-none pt-0.5"
                        />
                    </div>
                </div>

                {/* Quick Action Buttons (Underneath, in same box) */}
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={handleSellAll}
                        className="hover:text-white transition-colors group"
                    >
                        <span className="gi-text-16 font-bold text-gi-muted group-hover:text-gi-warning">Sell All</span>
                    </button>
                    <span className="gi-text-16 font-bold text-gi-muted/30">/</span>
                    <button
                        onClick={handleSellAllButOne}
                        className="hover:text-white transition-colors group"
                    >
                        <span className="gi-text-16 font-bold text-gi-muted group-hover:text-gi-warning">But One</span>
                    </button>
                </div>
            </div>

            {/* Confirmation Footer (Shows only when pending) */}
            {pendingItem && (
                <div className="flex flex-col gap-2">
                    <div className="gi-text-16 text-center font-sans gi-outline-1">
                        Sell <span className="text-gi-warning font-bold gi-outline-1">{inputVal}x {pendingItem.name}</span> for <span className="text-gi-gold font-bold gi-outline-1">{totalValue}g</span>
                    </div>
                    <div className="flex justify-center gap-6">
                        <button
                            onClick={handleConfirm}
                            className="transition-colors group"
                        >
                            <span className="gi-text-16 font-bold text-white group-hover:text-gi-warning">Confirm</span>
                        </button>
                        <button
                            onClick={handleCancel}
                            className="transition-colors group"
                        >
                            <span className="gi-text-16 font-bold text-white group-hover:text-gi-muted">Cancel</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItemSellControls;

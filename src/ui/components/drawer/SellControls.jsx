import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { Coins } from 'lucide-react';

/**
 * SellControls — Reusable sell widget for Item & Token inspection panels.
 *
 * Features:
 * - Prominent, easy-to-read gold value preview outside the sell button
 * - Range slider for scrubbing stack quantity
 * - Number input with auto-clamping
 * - Preset buttons: 1, 50%, All but 1, All
 * - Clear primary sell action button
 */
export const SellControls = ({
    title = 'Sell Items',
    count = 1,
    unitPrice = 1,
    getTotalPrice,
    onSell,
    entityName = 'Item',
    className
}) => {
    const [sellQty, setSellQty] = useState(1);

    // Reset quantity when target or count changes
    useEffect(() => {
        setSellQty(1);
    }, [count]);

    const clampedQty = Math.max(1, Math.min(count, Math.floor(Number(sellQty)) || 1));
    const totalGold = getTotalPrice ? getTotalPrice(clampedQty) : clampedQty * unitPrice;

    const handleInputChange = (e) => {
        const val = parseInt(e.target.value, 10);
        if (isNaN(val)) {
            setSellQty('');
        } else {
            setSellQty(Math.max(1, Math.min(count, val)));
        }
    };

    const handleInputBlur = () => {
        setSellQty(clampedQty);
    };

    const handleSliderChange = (e) => {
        setSellQty(Number(e.target.value));
    };

    const setPreset = (qty) => {
        setSellQty(Math.max(1, Math.min(count, qty)));
    };

    if (count <= 0) return null;

    return (
        <div className={cn("flex flex-col gap-3 pt-3 border-t border-gi-border/40", className)}>
            {/* Header: Title + Big Gold Value */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gi-muted uppercase tracking-wider">
                    {title}
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                    <Coins size={16} className="text-yellow-400 shrink-0" />
                    <span className="text-sm md:text-base font-bold font-mono text-yellow-300 tabular-nums">
                        {totalGold.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400/80">gold</span>
                </div>
            </div>

            {/* Quantity Input + Slider */}
            <div className="flex flex-col gap-2.5 bg-gi-base/50 p-2.5 rounded-lg border border-gi-border/30">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-gi-muted uppercase tracking-wide">
                        Quantity:
                    </span>
                    <div className="flex items-center gap-1.5">
                        <input
                            type="number"
                            min="1"
                            max={count}
                            value={sellQty}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            className="w-16 bg-black/60 border border-gi-border rounded px-2 py-1 text-xs md:text-sm font-bold text-gi-text outline-none font-mono text-center focus:border-gi-primary/60 focus:ring-1 focus:ring-gi-primary/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] font-mono text-gi-muted tabular-nums">
                            / {count.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Range Slider */}
                <div className="flex items-center gap-2 pt-0.5">
                    <input
                        type="range"
                        min="1"
                        max={count}
                        value={clampedQty}
                        onChange={handleSliderChange}
                        className="flex-1 h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-yellow-400 border border-gi-border/40 focus:outline-none"
                    />
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                    <button
                        type="button"
                        onClick={() => setPreset(1)}
                        className={cn(
                            "px-1 py-1 rounded text-[10px] font-bold border transition-colors",
                            clampedQty === 1
                                ? "border-gi-primary/60 bg-gi-primary/20 text-gi-text"
                                : "border-gi-border/40 bg-black/40 text-gi-muted hover:text-gi-text hover:border-gi-border"
                        )}
                        title="Sell 1"
                    >
                        1
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset(Math.ceil(count / 2))}
                        disabled={count < 2}
                        className={cn(
                            "px-1 py-1 rounded text-[10px] font-bold border transition-colors",
                            count < 2
                                ? "border-gi-border/20 text-gi-muted/30 cursor-not-allowed"
                                : clampedQty === Math.ceil(count / 2) && count > 1
                                    ? "border-gi-primary/60 bg-gi-primary/20 text-gi-text"
                                    : "border-gi-border/40 bg-black/40 text-gi-muted hover:text-gi-text hover:border-gi-border"
                        )}
                        title="Sell half (50%)"
                    >
                        50%
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset(count - 1)}
                        disabled={count <= 1}
                        className={cn(
                            "px-1 py-1 rounded text-[10px] font-bold border transition-colors truncate",
                            count <= 1
                                ? "border-gi-border/20 text-gi-muted/30 cursor-not-allowed"
                                : clampedQty === count - 1 && count > 1
                                    ? "border-gi-primary/60 bg-gi-primary/20 text-gi-text"
                                    : "border-gi-border/40 bg-black/40 text-gi-muted hover:text-gi-text hover:border-gi-border"
                        )}
                        title={count <= 1 ? "You only have 1" : `Sell ${count - 1} (keeps 1)`}
                    >
                        All -1
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset(count)}
                        className={cn(
                            "px-1 py-1 rounded text-[10px] font-bold border transition-colors",
                            clampedQty === count
                                ? "border-gi-primary/60 bg-gi-primary/20 text-gi-text"
                                : "border-gi-border/40 bg-black/40 text-gi-muted hover:text-gi-text hover:border-gi-border"
                        )}
                        title={`Sell all (${count})`}
                    >
                        All
                    </button>
                </div>
            </div>

            {/* Sell Confirmation Button */}
            <button
                type="button"
                onClick={() => onSell(clampedQty)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-yellow-500/50 bg-yellow-500/15 hover:bg-yellow-500/25 active:scale-[0.99] text-gi-text font-bold text-xs md:text-sm uppercase tracking-wide transition-all shadow-sm cursor-pointer"
            >
                <Coins size={14} className="text-yellow-400 shrink-0" />
                <span>
                    Sell {clampedQty.toLocaleString()} {clampedQty === 1 ? entityName : `${entityName}s`}
                </span>
            </button>
        </div>
    );
};

export default SellControls;

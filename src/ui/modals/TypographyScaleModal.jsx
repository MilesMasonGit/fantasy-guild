import { useState } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import { SettingsManager } from '../../systems/core/SettingsManager.js';

export const DEFAULT_FONT_SIZES = [
    { key: '--font-size-xxs', label: 'XXS (Extra Extra Small)', defaultVal: 14 },
    { key: '--font-size-xs', label: 'XS (Extra Small)', defaultVal: 16 },
    { key: '--font-size-sm', label: 'SM (Small)', defaultVal: 18 },
    { key: '--font-size-base', label: 'BASE (Standard)', defaultVal: 20 },
    { key: '--font-size-lg', label: 'LG (Large)', defaultVal: 24 },
    { key: '--font-size-xl', label: 'XL (Extra Large)', defaultVal: 32 },
    { key: '--font-size-2xl', label: '2XL (Double Large)', defaultVal: 48 },
];

export const TypographyScaleModal = ({ isOpen, onClose }) => {
    const [sizes, setSizes] = useState(() => {
        const saved = SettingsManager.get('ui.fontSizes') || {};
        const initial = {};
        DEFAULT_FONT_SIZES.forEach(f => {
            if (saved[f.key] != null) {
                initial[f.key] = saved[f.key];
            } else {
                const valStr = typeof document !== 'undefined'
                    ? getComputedStyle(document.documentElement).getPropertyValue(f.key).trim()
                    : '';
                const val = valStr ? parseInt(valStr, 10) : f.defaultVal;
                initial[f.key] = isNaN(val) ? f.defaultVal : val;
            }
        });
        return initial;
    });

    if (!isOpen) return null;

    const handleSliderChange = (key, value) => {
        const next = { ...sizes, [key]: value };
        setSizes(next);
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty(key, `${value}px`);
        }
    };

    const handleReset = () => {
        const reset = {};
        DEFAULT_FONT_SIZES.forEach(f => {
            reset[f.key] = f.defaultVal;
            if (typeof document !== 'undefined') {
                document.documentElement.style.setProperty(f.key, `${f.defaultVal}px`);
            }
        });
        setSizes(reset);
        SettingsManager.set('ui.fontSizes', reset);
    };

    const handleSaveAndClose = () => {
        SettingsManager.set('ui.fontSizes', sizes);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
            <div className="w-[540px] max-w-full bg-gi-surface border-2 border-gi-primary/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] text-gi-text animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gi-border bg-gi-base/60">
                    <span className="font-display font-bold text-base text-gi-primary uppercase tracking-widest">
                        Typography Scale
                    </span>
                    <button
                        onClick={handleSaveAndClose}
                        className="p-1 hover:bg-gi-danger/20 hover:text-gi-danger rounded text-gi-muted transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                    <p className="text-xs text-gi-muted normal-case tracking-normal">
                        Drag the sliders to adjust typography sizing in real time. The entire game interface will immediately scale to preview your layout fit.
                    </p>

                    <div className="space-y-4">
                        {DEFAULT_FONT_SIZES.map(f => {
                            const currentVal = sizes[f.key] ?? f.defaultVal;
                            return (
                                <div key={f.key} className="space-y-2 p-3 rounded-lg bg-black/25 border border-white/5 shadow-sm">
                                    <div className="flex justify-between items-baseline text-xs font-bold font-display text-gi-primary">
                                        <span>{f.label}</span>
                                        <span className="text-xs text-gi-gold tabular-nums font-mono font-bold">
                                            {currentVal}px
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="8"
                                        max="64"
                                        value={currentVal}
                                        onChange={(e) => handleSliderChange(f.key, Number(e.target.value))}
                                        className="w-full accent-gi-gold cursor-pointer h-1.5 bg-gray-700 rounded-lg appearance-none"
                                    />
                                    <div className="border border-dashed border-white/10 p-2.5 rounded bg-black/40 text-center mt-1">
                                        <div
                                            style={{ fontSize: `${currentVal}px` }}
                                            className="font-base uppercase leading-tight tracking-wider truncate"
                                        >
                                            12 Nature: Harvesting 99 Oak.
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="px-5 py-3 border-t border-gi-border bg-gi-base/40 flex items-center justify-between gap-3">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-4 py-2 rounded border border-gi-muted/50 text-xs font-bold text-gi-muted hover:text-white hover:border-white transition-colors uppercase tracking-wider"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
                    </button>
                    <button
                        onClick={handleSaveAndClose}
                        className="flex items-center gap-1.5 px-6 py-2 rounded bg-gi-primary text-black text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md font-pixel"
                    >
                        <Check className="w-4 h-4" /> Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TypographyScaleModal;

import React, { useState, useCallback } from 'react';
import { Ruler, X, RotateCcw } from 'lucide-react';
import { useEngine } from '../hooks/useEngine.js';
import {
    MAT_TUNABLES, matTuning, setMatTuning, resetMatTuning, isMatTuned, matTuningDefault
} from '../../config/matTuning.js';

/**
 * MatTuner — developer panel for the free playmat's rules (FP-66).
 *
 * Separate from the terrain `PlaymatTuner` by owner ruling. Built entirely from
 * `MAT_TUNABLES` in `config/matTuning.js`: a later slice adds a setting by adding
 * a row there, with no UI to write.
 *
 * Moving a slider changes gameplay live: `TileModifiers` listens for the change
 * and rebuilds every tile. The panel only publishes `state_changed` so open
 * inspection panels re-read their numbers.
 */
export const MatTuner = React.memo(() => {
    const engine = useEngine();
    const [isOpen, setIsOpen] = useState(false);
    const [, bump] = useState(0);

    const refresh = useCallback(() => {
        bump(n => n + 1);
        engine?.EventBus.publish('state_changed');
    }, [engine]);

    if (!engine) return null;

    const groups = [...new Set(MAT_TUNABLES.map(t => t.group))];

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-48 z-[9999] p-3 rounded-full bg-gi-primary text-black shadow-lg hover:scale-110 transition-transform flex items-center gap-2 font-bold font-display"
                title="Open Mat Tuner"
            >
                <Ruler className="w-5 h-5" /> TUNER
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-[18rem] z-[9999] w-72 bg-gi-surface/95 border border-gi-primary rounded-xl p-4 flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between mb-3 border-b border-gi-border pb-2">
                <div className="flex items-center gap-2 text-gi-primary font-bold font-display">
                    <Ruler className="w-4 h-4" /> MAT TUNER
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { resetMatTuning(); refresh(); }}
                        disabled={!isMatTuned()}
                        title="Back to shipped defaults"
                        className="p-1 rounded text-gi-muted hover:bg-gi-primary/20 hover:text-gi-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-gi-danger/20 hover:text-gi-danger rounded text-gi-muted transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="overflow-y-auto max-h-[60vh] custom-scrollbar pr-1 space-y-4">
                {groups.map(group => (
                    <div key={group}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gi-muted mb-2">
                            {group}
                        </div>
                        <div className="space-y-3">
                            {MAT_TUNABLES.filter(t => t.group === group).map(t => {
                                const value = matTuning(t.key);
                                const changed = value !== matTuningDefault(t.key);
                                return (
                                    <div key={t.key}>
                                        <div className="flex items-baseline justify-between text-[11px] mb-0.5">
                                            <span className={changed ? 'text-gi-primary font-bold' : 'text-gi-muted'}>
                                                {t.label}
                                            </span>
                                            <span className="text-gi-primary tabular-nums text-[10px]" data-testid={`mat-tuner-${t.key}`}>
                                                {t.format ? t.format(value) : value}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            aria-label={t.label}
                                            min={t.min} max={t.max} step={t.step} value={value}
                                            onChange={(e) => {
                                                setMatTuning(t.key, Number(e.target.value));
                                                refresh();
                                            }}
                                            className="w-full accent-gi-primary cursor-pointer"
                                        />
                                        <div className="text-[9px] leading-tight text-gi-muted/80 mt-0.5">
                                            {t.hint} Default {t.format ? t.format(t.def) : t.def}.
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-[10px] text-center text-gi-muted mt-3 uppercase tracking-widest font-bold">
                Dev only — changes play on this device
            </div>
        </div>
    );
});

export default MatTuner;

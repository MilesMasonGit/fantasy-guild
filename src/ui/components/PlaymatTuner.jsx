import React, { useState, useCallback } from 'react';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { useEngine } from '../hooks/useEngine.js';
import {
    TUNABLES, tuning, setTuning, resetTuning, isTuned, tuningDefault
} from '../../config/playmatTuning.js';
import { artSet, setArtSet } from '../../config/registries/terrainRegistry.js';

/**
 * PlaymatTuner — a developer panel for finding the playmat's look.
 *
 * Sits beside the QA tester and works the same way. The difference is what it is
 * for: QA spawns *state* to test against, this adjusts *appearance* with
 * nothing in the game changing underneath.
 *
 * ## It builds itself
 *
 * Every control comes from `TUNABLES` in `config/playmatTuning.js`. Adding a
 * knob is a row in that table and nothing here — which is the point, because
 * the terrain will grow a lot of these and hand-writing a slider each time is
 * how a panel stops being worth having.
 *
 * ## Redrawing
 *
 * A tuning change alters no game state, so nothing would repaint on its own.
 * The panel publishes `terrain_art_set_changed` — the event the canvas already
 * listens to for a "your sprites mean something different now" repaint, which
 * is exactly what this is.
 */
export const PlaymatTuner = React.memo(() => {
    const engine = useEngine();
    const [isOpen, setIsOpen] = useState(false);
    // Mirrors the module-level store so the sliders re-render as they move.
    const [, bump] = useState(0);
    const [ground, setGround] = useState(artSet());

    const repaint = useCallback(() => {
        bump(n => n + 1);
        engine?.EventBus.publish('terrain_art_set_changed');
    }, [engine]);

    if (!engine) return null;

    const groups = [...new Set(TUNABLES.map(t => t.group))];

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-24 z-[9999] p-3 rounded-full bg-gi-primary text-black shadow-lg hover:scale-110 transition-transform flex items-center gap-2 font-bold font-display"
                title="Open Playmat Tuner"
            >
                <SlidersHorizontal className="w-5 h-5" /> MAT
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-[19rem] z-[9999] w-72 bg-gi-surface/95 border border-gi-primary rounded-xl p-4 flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between mb-3 border-b border-gi-border pb-2">
                <div className="flex items-center gap-2 text-gi-primary font-bold font-display">
                    <SlidersHorizontal className="w-4 h-4" /> PLAYMAT
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { resetTuning(); repaint(); }}
                        disabled={!isTuned()}
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
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gi-muted mb-2">
                        Ground art
                    </div>
                    <button
                        onClick={() => {
                            const next = ground === 'b' ? 'a' : 'b';
                            setArtSet(next);
                            setGround(next);
                            repaint();
                        }}
                        className="w-full text-left px-3 py-2 rounded bg-gi-base hover:bg-gi-primary/20 border border-gi-border hover:border-gi-primary/50 text-sm font-bold transition-colors"
                    >
                        {ground === 'b' ? '8px chunky' : '16px fine'}
                    </button>
                </div>

                {groups.map(group => (
                    <div key={group}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gi-muted mb-2">
                            {group}
                        </div>
                        <div className="space-y-3">
                            {TUNABLES.filter(t => t.group === group).map(t => {
                                const value = tuning(t.key);
                                const changed = value !== tuningDefault(t.key);
                                return (
                                    <div key={t.key}>
                                        <div className="flex items-baseline justify-between text-[11px] mb-0.5">
                                            <span className={changed ? 'text-gi-primary font-bold' : 'text-gi-muted'}>
                                                {t.label}
                                            </span>
                                            <span className="text-gi-primary tabular-nums text-[10px]">
                                                {value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={t.min} max={t.max} step={t.step} value={value}
                                            onChange={(e) => {
                                                setTuning(t.key, Number(e.target.value));
                                                repaint();
                                            }}
                                            className="w-full accent-gi-primary cursor-pointer"
                                        />
                                        <div className="text-[9px] leading-tight text-gi-muted/80 mt-0.5">
                                            {t.hint}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-[10px] text-center text-gi-muted mt-3 uppercase tracking-widest font-bold">
                Appearance only — never saved
            </div>
        </div>
    );
});

export default PlaymatTuner;

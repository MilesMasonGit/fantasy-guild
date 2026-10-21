import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, X, RotateCcw, Copy } from 'lucide-react';
import { useEngine } from '../hooks/useEngine.js';
import {
    TUNABLES, tuning, setTuning, resetTuning, isTuned, tuningDefault, onTuningChanged, tuningReport
} from '../../config/playmatTuning.js';

/**
 * PlaymatTuner: a developer panel for finding the ground's look (dev builds only, `ReactRoot`).
 * Sits beside the QA tester and works the same way; the difference is what it is for: QA spawns
 * *state* to test against, this adjusts *appearance* with nothing in the game changing underneath.
 * It builds itself: every control comes from `TUNABLES` in `config/playmatTuning.js`. Adding a
 * knob is a row in that table and nothing here.
 * Redrawing: a tuning change alters no game state, so nothing would repaint on its own; the ground
 * (`TerrainCanvas`) and this panel both listen with `onTuningChanged`.
 * Copy values puts every value on the clipboard as text (`tuningReport`), for the owner to paste
 * into chat after the eye-check; where the clipboard is refused, the text is shown to select.
 */
export const PlaymatTuner = React.memo(() => {
    const engine = useEngine();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState('');
    const [manual, setManual] = useState(null);
    // Mirrors the module-level store so the sliders follow every change, wherever it came from.
    const [, bump] = useState(0);
    useEffect(() => onTuningChanged(() => bump(n => n + 1)), []);

    const copyValues = useCallback(async () => {
        const text = tuningReport();
        try {
            await navigator.clipboard.writeText(text);
            setManual(null);
            setCopied('Copied: paste it into chat');
        } catch {
            // The older way, still inside the click: an unfocused or embedded page may refuse the
            // clipboard API and allow this.
            if (copyBySelection(text)) {
                setManual(null);
                setCopied('Copied: paste it into chat');
                return;
            }
            setManual(text);
            setCopied('Select the text below and copy it');
        }
    }, []);

    if (!engine) return null;

    const groups = [...new Set(TUNABLES.map(t => t.group))];

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-24 z-(--z-dev-tools) p-3 rounded-full bg-gi-primary text-black shadow-lg hover:scale-110 transition-transform flex items-center gap-2 font-bold font-display"
                title="Open the ground's look (Playmat Tuner)"
            >
                <SlidersHorizontal className="w-5 h-5" /> GROUND
            </button>
        );
    }

    return (
        <div
            data-testid="playmat-tuner"
            className="fixed bottom-4 right-[19rem] z-(--z-dev-tools) w-72 max-h-[calc(100dvh-2rem)] bg-gi-surface/95 border border-gi-primary rounded-xl p-4 flex flex-col pointer-events-auto"
        >
            <div className="shrink-0 flex items-center justify-between mb-3 border-b border-gi-border pb-2">
                <div className="flex items-center gap-2 text-gi-primary font-bold font-display">
                    <SlidersHorizontal className="w-4 h-4" /> GROUND LOOK
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => resetTuning()}
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

            <button
                onClick={copyValues}
                title="Every value as text, to paste into chat"
                className="shrink-0 mb-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors"
            >
                <Copy className="w-3 h-3" /> Copy values
            </button>
            {copied && <div className="shrink-0 text-[10px] text-gi-muted mb-2" role="status">{copied}</div>}
            {manual && (
                <textarea
                    readOnly
                    value={manual}
                    onFocus={(e) => e.target.select()}
                    aria-label="Tuning values"
                    className="shrink-0 mb-2 h-24 w-full text-[10px] font-mono bg-gi-base border border-gi-border rounded p-1 text-gi-text"
                />
            )}

            <div className="min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-4">
                {groups.map(group => (
                    <div key={group}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gi-muted mb-2">
                            {group}
                        </div>
                        <div className="space-y-3">
                            {TUNABLES.filter(t => t.group === group).map(t => {
                                const value = tuning(t.key);
                                const changed = value !== tuningDefault(t.key);
                                if (t.toggle) {
                                    return (
                                        <div key={t.key}>
                                            <label className="flex items-center justify-between text-[11px] mb-0.5 cursor-pointer">
                                                <span className={changed ? 'text-gi-primary font-bold' : 'text-gi-muted'}>
                                                    {t.label}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={value >= 1}
                                                    aria-label={t.label}
                                                    onChange={(e) => setTuning(t.key, e.target.checked ? t.max : t.min)}
                                                    className="accent-gi-primary cursor-pointer"
                                                />
                                            </label>
                                            <div className="text-[9px] leading-tight text-gi-muted/80 mt-0.5">
                                                {t.hint}
                                            </div>
                                        </div>
                                    );
                                }
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
                                            aria-label={t.label}
                                            onChange={(e) => setTuning(t.key, Number(e.target.value))}
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

            <div className="shrink-0 text-[10px] text-center text-gi-muted mt-3 uppercase tracking-widest font-bold">
                Appearance only — never saved
            </div>
        </div>
    );
});

/** Copy `text` through a selected, off-screen text box. Whether the browser says it copied. */
function copyBySelection(text) {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.left = '-9999px';
    document.body.appendChild(box);
    box.select();
    let ok;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    box.remove();
    return ok === true;
}

export default PlaymatTuner;

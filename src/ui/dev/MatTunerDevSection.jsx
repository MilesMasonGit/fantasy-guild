// The QA panel's Mat dials: the free playmat's rules, collapsed until opened.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import {
    MAT_TUNABLES, matTuning, setMatTuning, resetMatTuning, isMatTuned, matTuningDefault
} from '../../config/matTuning.js';

/**
 * Built entirely from `MAT_TUNABLES` in `config/matTuning.js`: adding a setting is adding a row
 * there, with no UI to write. Moving a slider changes gameplay live: `TileModifiers` listens for
 * the change and rebuilds every tile; whatever draws a tuned number hears `onMatTuningChanged`
 * itself.
 */
export function MatTunerDevSection() {
    const [, bump] = useState(0);
    const refresh = useCallback(() => bump(n => n + 1), []);
    const groups = [...new Set(MAT_TUNABLES.map(t => t.group))];

    return (
        <details className="mb-3 pb-3 border-b border-gi-border" data-testid="qa-mat-tuner">
            <summary className="ui-text-title font-bold uppercase tracking-wider text-gi-muted cursor-pointer">
                Mat dials (dev only)
            </summary>
            <div className="mt-2 space-y-4">
                <button
                    onClick={() => { resetMatTuning(); refresh(); }}
                    disabled={!isMatTuned()}
                    title="Back to shipped defaults"
                    className="flex items-center gap-1 px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors disabled:opacity-30"
                >
                    <RotateCcw className="w-3 h-3" /> Back to defaults
                </button>
                {groups.map(group => (
                    <div key={group}>
                        <div className="ui-text-body font-bold uppercase tracking-wider text-gi-muted mb-2">
                            {group}
                        </div>
                        <div className="space-y-3">
                            {MAT_TUNABLES.filter(t => t.group === group).map(t => {
                                const value = matTuning(t.key);
                                const changed = value !== matTuningDefault(t.key);
                                return (
                                    <div key={t.key}>
                                        <div className="flex items-baseline justify-between ui-text-title mb-0.5">
                                            <span className={changed ? 'text-gi-primary font-bold' : 'text-gi-muted'}>
                                                {t.label}
                                            </span>
                                            <span className="text-gi-primary tabular-nums ui-text-body" data-testid={`mat-tuner-${t.key}`}>
                                                {t.format ? t.format(value) : value}
                                            </span>
                                        </div>
                                        {t.choices ? (
                                            <div className="flex gap-1" role="group" aria-label={t.label}>
                                                {t.choices.map((name, i) => {
                                                    const v = t.min + i;
                                                    const on = Math.round(value) === v;
                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            aria-pressed={on}
                                                            data-testid={`mat-tuner-${t.key}-${v}`}
                                                            onClick={() => { setMatTuning(t.key, v); refresh(); }}
                                                            className={`flex-1 px-2 py-1 text-xs font-bold border transition-colors ${on ? 'bg-gi-primary/30 border-gi-primary text-gi-primary' : 'bg-gi-primary/5 border-gi-border text-gi-muted hover:bg-gi-primary/15'}`}
                                                        >
                                                            {name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : <input
                                            type="range"
                                            aria-label={t.label}
                                            min={t.min} max={t.max} step={t.step} value={value}
                                            onChange={(e) => {
                                                setMatTuning(t.key, Number(e.target.value));
                                                refresh();
                                            }}
                                            className="w-full accent-gi-primary cursor-pointer"
                                        />}
                                        <div className="ui-text-body leading-tight text-gi-muted/80 mt-0.5">
                                            {t.hint} Default {t.format ? t.format(t.def) : t.def}.
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </details>
    );
}

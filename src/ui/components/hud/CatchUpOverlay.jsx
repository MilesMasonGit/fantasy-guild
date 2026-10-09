import { useEffect, useState } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import ItemIcon from '../base/ItemIcon.jsx';
import SkillIcon from '../base/SkillIcon.jsx';
import { summaryView, catchUpTitle, formatCount } from './catchUpSummary.js';

/** The speech-bubble look the mat's hero bubbles and the Token inspection share: one thin edge. */
const PANEL = 'rounded-md border border-yellow-500/70 bg-yellow-950/95 text-yellow-100 shadow-lg';

/**
 * While a catch-up plays (`CatchUp.run`, a closed game's time away or a sleeping PC), a loading
 * bar covers the game; when it ends, "While you were away" says what happened. Only catch-ups
 * long enough to `show`; a silent one shows nothing.
 *
 * ⚠️ The bar is moved by its fill's `transform` with a CSS transition, and a sheen runs across it
 * as a CSS animation: both stay on the compositor, so the bar keeps moving through a slice of
 * catch-up work, when the page cannot run any script.
 */
export function CatchUpOverlay() {
    const [run, setRun] = useState(null);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const offStart = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_STARTED, ({ awayMs, show } = {}) => {
            if (!show) return;
            setResult(null);
            setRun({ awayMs, fraction: 0 });
        }, UI_LISTENER);
        const offProgress = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_PROGRESS, ({ fraction, show } = {}) => {
            if (!show) return;
            setRun(r => (r ? { ...r, fraction: Math.min(1, Math.max(0, Number(fraction) || 0)) } : r));
        }, UI_LISTENER);
        const offFinish = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, (finished) => {
            if (!finished?.show) return;
            setRun(null);
            setResult(finished);
        }, UI_LISTENER);
        return () => { offStart(); offProgress(); offFinish(); };
    }, []);

    useEffect(() => {
        if (!result || run) return undefined;
        // Capturing, and stopped there: Esc closes this and nothing underneath it.
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            setResult(null);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [result, run]);

    if (!run && !result) return null;

    return (
        <div
            data-catch-up-overlay
            className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/75 font-sans"
        >
            {run ? <LoadingBar run={run} /> : <Summary result={result} onClose={() => setResult(null)} />}
        </div>
    );
}

function LoadingBar({ run }) {
    return (
        <div data-catch-up-bar role="status" className={`${PANEL} w-80 max-w-full px-4 py-3 flex flex-col gap-2`}>
            <div data-catch-up-title className="text-[13px] font-bold text-gi-gold">{catchUpTitle(run.awayMs)}</div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-black/60">
                <div
                    data-catch-up-fill
                    className="catch-up-fill absolute inset-0 bg-gi-gold"
                    style={{ transform: `scaleX(${run.fraction})` }}
                />
                <div className="catch-up-sheen absolute inset-y-0 w-1/3 bg-white/25" />
            </div>
            <div className="text-[11px] text-yellow-100/60">Your heroes kept working while you were gone.</div>
        </div>
    );
}

function Section({ id, title, children }) {
    return (
        <div data-summary-section={id} className="mt-2 pt-2 border-t border-yellow-500/20">
            <div className="mb-1 text-[11px] font-bold text-yellow-100/60">{title}</div>
            {children}
        </div>
    );
}

function ItemRows({ rows, sign }) {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {rows.map(row => (
                <div key={row.itemId} data-item-id={row.itemId} className="flex items-center gap-1.5 min-w-0">
                    <ItemIcon item={row.itemId} size={16} className="shrink-0" />
                    <span className="truncate">{row.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums font-bold"> {sign}{formatCount(row.count)}</span>
                </div>
            ))}
        </div>
    );
}

function CountRows({ rows, idAttr }) {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {rows.map(row => (
                <div key={row[idAttr.key]} {...{ [idAttr.attr]: row[idAttr.key] }} className="flex items-center gap-1.5 min-w-0">
                    <ItemIcon item={row[idAttr.key]} size={16} className="shrink-0" />
                    <span className="truncate">{row.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums font-bold"> ×{formatCount(row.count)}</span>
                </div>
            ))}
        </div>
    );
}

function Summary({ result, onClose }) {
    const view = summaryView(result);
    return (
        <div
            data-catch-up-summary
            role="dialog"
            aria-label="While you were away"
            className={`${PANEL} w-[32rem] max-w-full max-h-[85vh] flex flex-col text-[12px] leading-snug`}
        >
            <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="text-[14px] font-bold text-gi-gold">While you were away</div>
                <div data-summary-away>You were away {view.awayText}.</div>
                {view.droppedText && <div data-summary-dropped className="text-yellow-100/60">{view.droppedText}</div>}
            </div>

            <div className="px-4 pb-2 min-h-0 overflow-y-auto custom-scrollbar">
                {view.gained.length > 0 && (
                    <Section id="gained" title="Into the Bank">
                        <ItemRows rows={view.gained} sign="+" />
                    </Section>
                )}
                {view.waiting.length > 0 && (
                    <Section id="waiting" title="Made, waiting on the mat">
                        <ItemRows rows={view.waiting} sign="+" />
                    </Section>
                )}
                {view.spent.length > 0 && (
                    <Section id="spent" title="Spent">
                        <ItemRows rows={view.spent} sign="−" />
                    </Section>
                )}
                {view.levelUps.length > 0 && (
                    <Section id="levels" title="Level-ups">
                        {view.levelUps.map(hero => (
                            <div key={hero.heroId} data-summary-hero={hero.heroId} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <span className="font-bold">{hero.heroName} </span>
                                {hero.skills.map(s => (
                                    <span key={s.skillId} className="flex items-center gap-1">
                                        <SkillIcon skill={s.skillId} size={16} alt="" />
                                        <span> {s.skillName} </span>
                                        <span className="tabular-nums font-bold">{s.from} → {s.to}</span>
                                    </span>
                                ))}
                            </div>
                        ))}
                    </Section>
                )}
                {view.depleted.length > 0 && (
                    <Section id="depleted" title="Tokens used up">
                        <CountRows rows={view.depleted} idAttr={{ key: 'typeId', attr: 'data-type-id' }} />
                    </Section>
                )}
                {view.wounded.length > 0 && (
                    <Section id="wounded" title="Heroes wounded">
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {view.wounded.map(w => (
                                <span key={w.heroId} data-hero-id={w.heroId}>
                                    <span className="font-bold">{w.heroName}</span>
                                    {w.times > 1 && <span className="tabular-nums"> ×{formatCount(w.times)}</span>}
                                </span>
                            ))}
                        </div>
                    </Section>
                )}
                {view.fightsWon > 0 && (
                    <Section id="fights" title={`Fights won ${formatCount(view.fightsWon)}`}>
                        <CountRows rows={view.fights} idAttr={{ key: 'enemyId', attr: 'data-type-id' }} />
                    </Section>
                )}
            </div>

            <div className="px-4 pt-2 pb-3 shrink-0 border-t border-yellow-500/20">
                <button
                    type="button"
                    data-summary-close
                    onClick={onClose}
                    autoFocus
                    className="w-full py-1.5 rounded border border-yellow-500/70 bg-yellow-500/15 hover:bg-yellow-500/25 text-[12px] font-bold text-yellow-100 transition-colors"
                >
                    Back to the guild
                </button>
            </div>
        </div>
    );
}

export default CatchUpOverlay;

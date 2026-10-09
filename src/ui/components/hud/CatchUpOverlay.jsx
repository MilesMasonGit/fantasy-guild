import { useEffect, useRef, useState } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as CatchUp from '../../../systems/core/CatchUp.js';
import { cn } from '../../utils/cn.js';
import { ItemRow, ItemRows } from '../base/ItemRow.jsx';
import SkillIcon from '../base/SkillIcon.jsx';
import { summaryView, catchUpTitle, formatCount } from './catchUpSummary.js';

/** The top bar's panel look (the Token Summary, Upkeep): one thin gold edge on black. */
const PANEL = 'rounded-lg border border-gi-gold/40 bg-black/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.8)]';

/**
 * While a catch-up plays (`CatchUp.run`, a closed game's time away or a sleeping PC), a loading
 * bar covers the game; when it ends, "While you were away" says what happened. Only catch-ups
 * long enough to `show`; a silent one shows nothing. The summary closes with "Back to the guild"
 * (or Esc), or turns the catch-up down with "Load as I left it" (`CatchUp.undoLast`).
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

    const close = () => {
        CatchUp.forgetUndo();
        setResult(null);
    };

    useEffect(() => {
        if (!result || run) return undefined;
        // Capturing, and stopped there: Esc closes this and nothing underneath it.
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            CatchUp.forgetUndo();
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
            {run
                ? <LoadingBar run={run} />
                : <Summary result={result} onClose={close} onUndo={() => { if (!CatchUp.undoLast()) close(); }} />}
        </div>
    );
}

function LoadingBar({ run }) {
    return (
        <div data-catch-up-bar role="status" className={`${PANEL} w-80 max-w-full px-4 py-3 flex flex-col gap-2`}>
            <div data-catch-up-title className="text-[13px] font-bold text-gi-gold">{catchUpTitle(run.awayMs)}</div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                    data-catch-up-fill
                    className="catch-up-fill absolute inset-0 bg-gi-gold"
                    style={{ transform: `scaleX(${run.fraction})` }}
                />
                <div className="catch-up-sheen absolute inset-y-0 w-1/3 bg-white/25" />
            </div>
            <div className="text-[11px] text-white/60">Your heroes kept working while you were gone.</div>
        </div>
    );
}

/** The rows' entrance: each row's delay, the stagger stopping at `STAGGER_CAP` rows. */
const ROW_IN = Object.freeze({ STAGGER_MS: 35, STAGGER_CAP: 14, DURATION_MS: 220 });

/**
 * The summary's rows fade and slide in one after another, then lose the entrance class, so a
 * later re-render never plays it again. `enter()` is called once per row, in drawing order.
 */
function useRowEntrance() {
    const [entering, setEntering] = useState(true);
    const count = useRef(0);
    count.current = 0;
    useEffect(() => {
        const ms = Math.min(count.current, ROW_IN.STAGGER_CAP) * ROW_IN.STAGGER_MS + ROW_IN.DURATION_MS + 50;
        const timer = setTimeout(() => setEntering(false), ms);
        return () => clearTimeout(timer);
    }, []);
    return () => {
        if (!entering) return { className: undefined, style: undefined };
        const delay = Math.min(count.current++, ROW_IN.STAGGER_CAP) * ROW_IN.STAGGER_MS;
        return {
            className: 'catch-up-row-in',
            style: { animationDelay: `${delay}ms`, animationDuration: `${ROW_IN.DURATION_MS}ms` }
        };
    };
}

/** A section: a small heading over its rows, set apart by a faint line (rows are never boxed). */
function Section({ id, title, enter, children }) {
    const e = enter();
    return (
        <div data-summary-section={id} className="mt-2 pt-1.5 border-t border-white/10">
            <div style={e.style} className={cn('px-1 mb-0.5 text-[10px] uppercase tracking-wide text-white/50', e.className)}>{title}</div>
            <ItemRows>{children}</ItemRows>
        </div>
    );
}

/** Rows for `{ [idKey]: id, name, count }`, each with that item's or Token's icon. */
function CountRows({ rows, idKey, idAttr, sign, enter }) {
    return rows.map(row => {
        const e = enter();
        return (
            <ItemRow
                key={row[idKey]}
                {...{ [idAttr]: row[idKey] }}
                item={row[idKey]}
                name={row.name}
                count={`${sign}${formatCount(row.count)}`}
                className={e.className}
                style={e.style}
            />
        );
    });
}

const BUTTON = 'flex-1 px-2 py-1.5 rounded border text-[12px] font-bold whitespace-nowrap transition-colors';

function Summary({ result, onClose, onUndo }) {
    const view = summaryView(result);
    const enter = useRowEntrance();
    const undoable = CatchUp.canUndo();
    return (
        <div
            data-catch-up-summary
            role="dialog"
            aria-label="While you were away"
            className={`${PANEL} w-[24rem] max-w-full max-h-[85vh] flex flex-col text-[12px] leading-snug`}
        >
            <div className="px-3 pt-2.5 pb-1 shrink-0">
                <div className="text-[13px] font-bold text-gi-gold">While you were away</div>
                <div data-summary-away>You were away {view.awayText}.</div>
                {view.droppedText && <div data-summary-dropped className="text-white/60">{view.droppedText}</div>}
            </div>

            <div className="px-2 pb-2 min-h-0 overflow-y-auto custom-scrollbar">
                {view.gained.length > 0 && (
                    <Section id="gained" title="Into the Bank" enter={enter}>
                        <CountRows rows={view.gained} idKey="itemId" idAttr="data-item-id" sign="+" enter={enter} />
                    </Section>
                )}
                {view.waiting.length > 0 && (
                    <Section id="waiting" title="Made, waiting on the mat" enter={enter}>
                        <CountRows rows={view.waiting} idKey="itemId" idAttr="data-item-id" sign="+" enter={enter} />
                    </Section>
                )}
                {view.spent.length > 0 && (
                    <Section id="spent" title="Spent" enter={enter}>
                        <CountRows rows={view.spent} idKey="itemId" idAttr="data-item-id" sign="−" enter={enter} />
                    </Section>
                )}
                {view.levelUps.length > 0 && (
                    <Section id="levels" title="Level-ups" enter={enter}>
                        {view.levelUps.flatMap(hero => hero.skills.map(s => {
                            const e = enter();
                            return (
                                <ItemRow
                                    key={`${hero.heroId}|${s.skillId}`}
                                    data-summary-hero={hero.heroId}
                                    data-skill-id={s.skillId}
                                    icon={<SkillIcon skill={s.skillId} size={16} alt="" />}
                                    name={<><span className="font-bold">{hero.heroName}</span> {s.skillName}</>}
                                    count={`${s.from} → ${s.to}`}
                                    className={e.className}
                                    style={e.style}
                                />
                            );
                        }))}
                    </Section>
                )}
                {view.depleted.length > 0 && (
                    <Section id="depleted" title="Tokens used up" enter={enter}>
                        <CountRows rows={view.depleted} idKey="typeId" idAttr="data-type-id" sign="×" enter={enter} />
                    </Section>
                )}
                {view.wounded.length > 0 && (
                    <Section id="wounded" title="Heroes wounded" enter={enter}>
                        {view.wounded.map(w => {
                            const e = enter();
                            return (
                                <ItemRow
                                    key={w.heroId}
                                    data-hero-id={w.heroId}
                                    name={<span className="font-bold">{w.heroName}</span>}
                                    count={w.times > 1 ? `×${formatCount(w.times)}` : null}
                                    className={e.className}
                                    style={e.style}
                                />
                            );
                        })}
                    </Section>
                )}
                {view.fightsWon > 0 && (
                    <Section id="fights" title={`Fights won ${formatCount(view.fightsWon)}`} enter={enter}>
                        <CountRows rows={view.fights} idKey="enemyId" idAttr="data-type-id" sign="×" enter={enter} />
                    </Section>
                )}
            </div>

            <div className="px-3 pt-2 pb-2.5 shrink-0 border-t border-white/10 flex gap-2">
                {undoable && (
                    <button
                        type="button"
                        data-summary-undo
                        onClick={onUndo}
                        title="Throw away the time away and load the game exactly as you left it"
                        className={`${BUTTON} border-white/20 bg-white/5 hover:bg-white/10 text-white/80`}
                    >
                        Load as I left it
                    </button>
                )}
                <button
                    type="button"
                    data-summary-close
                    onClick={onClose}
                    autoFocus
                    className={`${BUTTON} border-gi-gold/60 bg-gi-gold/15 hover:bg-gi-gold/25 text-white`}
                >
                    Back to the guild
                </button>
            </div>
        </div>
    );
}

export default CatchUpOverlay;

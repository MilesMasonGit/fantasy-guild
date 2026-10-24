import { useEffect, useRef, useState } from 'react';
import { HeartCrack } from 'lucide-react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as CatchUp from '../../../systems/core/CatchUp.js';
import { cn } from '../../utils/cn.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import SkillIcon from '../base/SkillIcon.jsx';
import { summaryView, catchUpTitle } from './catchUpSummary.js';

/**
 * While a catch-up plays (`CatchUp.run`, a closed game's time away or a sleeping PC), a loading
 * bar covers the game; when it ends, "While you were away" says what happened. Only catch-ups
 * long enough to `show`; a silent one shows nothing. The summary closes with "Return to the
 * Guild" (or Esc), or, once the player confirms, turns the catch-up down with "Load as I left it"
 * (`CatchUp.undoLast`).
 *
 * ⚠️ The bar is moved by its fill's `transform` with a CSS transition, and a sheen runs across it
 * as a CSS animation: both stay on the compositor, so the bar keeps moving through a slice of
 * catch-up work, when the page cannot run any script.
 */
export function CatchUpOverlay() {
    const [run, setRun] = useState(null);
    const [result, setResult] = useState(null);
    const [asking, setAsking] = useState(false);

    useEffect(() => {
        const offStart = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_STARTED, ({ awayMs, show } = {}) => {
            if (!show) return;
            setResult(null);
            setAsking(false);
            setRun({ awayMs, fraction: 0 });
        }, UI_LISTENER);
        const offProgress = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_PROGRESS, ({ fraction, show } = {}) => {
            if (!show) return;
            setRun(r => (r ? { ...r, fraction: Math.min(1, Math.max(0, Number(fraction) || 0)) } : r));
        }, UI_LISTENER);
        const offFinish = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, (finished) => {
            if (!finished?.show) return;
            setRun(null);
            setAsking(false);
            setResult(finished);
        }, UI_LISTENER);
        return () => { offStart(); offProgress(); offFinish(); };
    }, []);

    const close = () => {
        CatchUp.forgetUndo();
        setAsking(false);
        setResult(null);
        EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
    };

    // Esc closes this and nothing underneath it. While the undo is being asked about, Esc only
    // cancels the question.
    useEscapeLayer(!!result && !run, () => {
        if (asking) {
            setAsking(false);
            return;
        }
        CatchUp.forgetUndo();
        setResult(null);
        EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
    });

    if (!run && !result) return null;

    return (
        <div
            data-catch-up-overlay
            className="fixed inset-0 z-(--z-catch-up) flex items-center justify-center p-4 bg-black/75"
        >
            {run
                ? <LoadingBar run={run} />
                : (
                    <Summary
                        result={result}
                        asking={asking}
                        onClose={close}
                        onAsk={() => setAsking(true)}
                        onCancel={() => setAsking(false)}
                        onUndo={() => { if (!CatchUp.undoLast()) close(); }}
                    />
                )}
        </div>
    );
}

function LoadingBar({ run }) {
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-catch-up-bar role="status" className="w-80 max-w-full" frameClassName="px-3 py-2 flex flex-col gap-2 text-white">
            <div data-catch-up-title className="ui-text-title font-bold text-gi-gold">{catchUpTitle(run.awayMs)}</div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                    data-catch-up-fill
                    className="catch-up-fill absolute inset-0 bg-gi-gold"
                    style={{ transform: `scaleX(${run.fraction})` }}
                />
                <div className="catch-up-sheen absolute inset-y-0 w-1/3 bg-white/25" />
            </div>
            <div className="ui-text-title text-white/60">Your heroes kept working while you were gone.</div>
        </PixelFrame>
    );
}

/** The bars' entrance: each bar's delay, the stagger stopping at `STAGGER_CAP` bars. */
const ROW_IN = Object.freeze({ STAGGER_MS: 35, STAGGER_CAP: 14, DURATION_MS: 220 });

/**
 * The summary's bars fade and slide in one after another, then lose the entrance class, so a
 * later re-render never plays it again. `enter()` is called once per bar, in drawing order.
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

/** A section: a small heading over its bars, set apart by a faint line (never boxed). */
function Section({ id, title, enter, children }) {
    const e = enter();
    return (
        <div data-summary-section={id} className="mt-2 pt-1.5 border-t border-white/10 first:mt-0">
            <div
                data-summary-heading
                style={e.style}
                className={cn('px-1 mb-1 ui-text-body uppercase tracking-wide text-white/50', e.className)}
            >
                {title}
            </div>
            <div data-summary-list className="flex flex-col gap-1">{children}</div>
        </div>
    );
}

/** One Item Bar (the Token inspection's) per `{ [idKey]: id, name, count }`. */
function CountBars({ rows, idKey, idAttr, kind, sign, enter }) {
    return rows.map(row => {
        const e = enter();
        return (
            <EntityRibbon
                key={row[idKey]}
                {...{ [idAttr]: row[idKey] }}
                kind={kind}
                id={row[idKey]}
                name={row.name}
                amount={row.count}
                sign={sign}
                size="sm"
                className={e.className}
                style={e.style}
            />
        );
    });
}

const BUTTON = 'w-full px-2 py-1.5 rounded border ui-text-title font-bold transition-colors';
const SECONDARY = `${BUTTON} border-white/20 bg-white/5 hover:bg-white/10 text-white/80`;

function Summary({ result, asking, onClose, onAsk, onCancel, onUndo }) {
    const view = summaryView(result);
    const enter = useRowEntrance();
    const undoable = CatchUp.canUndo();
    return (
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            data-catch-up-summary
            role="dialog"
            aria-label="While you were away"
            className="w-[28rem] max-w-full"
            frameClassName="max-h-[85vh] flex flex-col ui-text-title leading-snug text-white"
        >
            <div className="px-3 pt-2.5 pb-1 shrink-0">
                <div role="heading" aria-level={2} className="ui-text-title font-bold text-gi-gold">While you were away</div>
                <div data-summary-away>You were away {view.awayText}.</div>
                {view.droppedText && <div data-summary-dropped className="text-white/60">{view.droppedText}</div>}
            </div>

            {/* The side and bottom padding leave room for a hovered sprite's zoom, which this
                scrolling list would otherwise clip. */}
            <div data-summary-body className="px-3 pt-1 pb-3 min-h-0 overflow-y-auto custom-scrollbar">
                {view.waiting.length > 0 && (
                    <Section id="waiting" title="Items produced" enter={enter}>
                        <CountBars rows={view.waiting} idKey="itemId" idAttr="data-item-id" kind="item" sign="+" enter={enter} />
                    </Section>
                )}
                {view.gained.length > 0 && (
                    <Section id="gained" title="Items banked" enter={enter}>
                        <CountBars rows={view.gained} idKey="itemId" idAttr="data-item-id" kind="item" sign="+" enter={enter} />
                    </Section>
                )}
                {view.spent.length > 0 && (
                    <Section id="spent" title="Items spent" enter={enter}>
                        <CountBars rows={view.spent} idKey="itemId" idAttr="data-item-id" kind="item" sign="−" enter={enter} />
                    </Section>
                )}
                {view.levelUps.length > 0 && (
                    <Section id="levels" title="Level-ups" enter={enter}>
                        {view.levelUps.flatMap(hero => hero.skills.map(s => {
                            const e = enter();
                            return (
                                <EntityRibbon
                                    key={`${hero.heroId}|${s.skillId}`}
                                    data-summary-hero={hero.heroId}
                                    data-skill-id={s.skillId}
                                    icon={<SkillIcon skill={s.skillId} size={32} alt="" />}
                                    name={`${hero.heroName} ${s.skillName}`}
                                    countText={`${s.from} → ${s.to}`}
                                    size="sm"
                                    className={e.className}
                                    style={e.style}
                                />
                            );
                        }))}
                    </Section>
                )}
                {view.depleted.length > 0 && (
                    <Section id="depleted" title="Tokens used up" enter={enter}>
                        <CountBars rows={view.depleted} idKey="typeId" idAttr="data-type-id" kind="token" sign="×" enter={enter} />
                    </Section>
                )}
                {view.wounded.length > 0 && (
                    <Section id="wounded" title="Heroes wounded" enter={enter}>
                        {view.wounded.map(w => {
                            const e = enter();
                            return (
                                <EntityRibbon
                                    key={w.heroId}
                                    data-hero-id={w.heroId}
                                    icon={<HeartCrack size={18} className="text-gi-danger" aria-hidden="true" />}
                                    name={w.heroName}
                                    amount={w.times}
                                    sign="×"
                                    size="sm"
                                    className={e.className}
                                    style={e.style}
                                />
                            );
                        })}
                    </Section>
                )}
                {view.fightsWon > 0 && (
                    <Section id="fights" title="Fights won" enter={enter}>
                        <CountBars rows={view.fights} idKey="enemyId" idAttr="data-type-id" kind="token" sign="×" enter={enter} />
                    </Section>
                )}
            </div>

            <div className="px-3 pt-2 pb-2.5 shrink-0 border-t border-white/10">
                {asking ? (
                    <div data-summary-confirm role="alertdialog" aria-label="Load as I left it?" className="flex flex-col gap-1.5">
                        <div className="text-white/80">Load the game as you left it? Everything from your time away is lost.</div>
                        <button
                            type="button"
                            data-summary-confirm-yes
                            onClick={onUndo}
                            className={`${BUTTON} border-gi-danger/60 bg-gi-danger/20 hover:bg-gi-danger/35 text-white`}
                        >
                            Confirm
                        </button>
                        <button type="button" data-summary-confirm-no onClick={onCancel} autoFocus className={SECONDARY}>
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <button
                            type="button"
                            data-summary-close
                            onClick={onClose}
                            autoFocus
                            className={`${BUTTON} border-gi-gold/60 bg-gi-gold/15 hover:bg-gi-gold/25 text-white`}
                        >
                            Return to the Guild
                        </button>
                        {undoable && (
                            <button
                                type="button"
                                data-summary-undo
                                onClick={onAsk}
                                title="Throw away the time away and load the game exactly as you left it"
                                className={SECONDARY}
                            >
                                Load as I left it
                            </button>
                        )}
                    </div>
                )}
            </div>
        </PixelFrame>
    );
}

export default CatchUpOverlay;

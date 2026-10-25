import { useEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as CatchUp from '../../../systems/core/CatchUp.js';
import { cn } from '../../utils/cn.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import SkillIcon from '../base/SkillIcon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { CombatGlyph } from '../combat/CombatGlyph.jsx';
import { GLYPH_COLOUR } from '../combat/combatGlyphs.js';
import { t } from '../../../i18n/index.js';
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
            <div className="relative h-2.5 overflow-hidden bg-white/10">
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

/** One pill: a sprite and its count, its name on hover. */
function Pill({ id, attr, tip, count, children }) {
    return (
        <Tooltip title={tip}>
            <span data-summary-pill {...{ [attr]: id }} className="inline-flex items-center gap-0.5 cursor-help">
                {children}
                <span className="ui-text-body font-bold tabular-nums text-white">×{count.toLocaleString()}</span>
            </span>
        </Tooltip>
    );
}

/** One line of the fights block: a muted word, then its pills wrapping. */
function FightsRow({ id, label, enter, children }) {
    const e = enter();
    return (
        <div data-summary-fight-row={id} style={e.style} className={cn('grid grid-cols-[6.5rem_1fr] items-center gap-2 px-1', e.className)}>
            <span className="ui-text-body text-white/50">{label}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">{children}</span>
        </div>
    );
}

/**
 * The fights while away, one compact block (owner, 2026-10-25): fights won and lost, then a line
 * each for the enemies beaten, the heroes knocked out, the food and elixirs used and what the
 * kills dropped, as pills (a sprite and a count, the name on hover). A line with nothing is left out.
 */
function FightsBlock({ combat, enter }) {
    const e = enter();
    return (
        <div data-summary-section="fights" className="mt-2 pt-1.5 border-t border-white/10 first:mt-0">
            <div style={e.style} className={cn('px-1 mb-1 flex items-baseline gap-2', e.className)}>
                <span data-summary-heading className="ui-text-body uppercase tracking-wide text-white/50">{t('catchUp.combat.title')}</span>
                <span className="flex-1" />
                <span data-summary-fight-tally className="ui-text-body font-bold text-white">
                    {t('catchUp.combat.tally', { won: combat.won.toLocaleString(), lost: combat.lost.toLocaleString() })}
                </span>
            </div>
            <div data-summary-list className="flex flex-col gap-1">
                {combat.beaten.length > 0 && (
                    <FightsRow id="beaten" label={t('catchUp.combat.beaten')} enter={enter}>
                        {combat.beaten.map(r => (
                            <Pill key={r.enemyId} id={r.enemyId} attr="data-type-id" count={r.count} tip={t('catchUp.combat.beatenTip', { enemy: r.name, count: r.count })}>
                                <TokenSprite typeId={r.enemyId} size={32} surface={TOKEN_SURFACE.INSPECT} />
                            </Pill>
                        ))}
                    </FightsRow>
                )}
                {combat.knockouts.length > 0 && (
                    <FightsRow id="knockedOut" label={t('catchUp.combat.knockedOut')} enter={enter}>
                        {combat.knockouts.map(w => (
                            <Tooltip key={w.heroId} title={t('catchUp.combat.knockout', { hero: w.heroName, count: w.times })}>
                                <span data-summary-pill data-hero-id={w.heroId} className="inline-flex items-center gap-1 cursor-help">
                                    <CombatGlyph name="down" colour={GLYPH_COLOUR.red} />
                                    <span className="ui-text-body font-bold text-white">{w.heroName}</span>
                                    <span className="ui-text-body font-bold tabular-nums text-white">×{w.times}</span>
                                </span>
                            </Tooltip>
                        ))}
                    </FightsRow>
                )}
                {combat.used.length > 0 && (
                    <FightsRow id="used" label={t('catchUp.combat.used')} enter={enter}>
                        {combat.used.map(r => (
                            <Pill key={r.itemId} id={r.itemId} attr="data-item-id" count={r.count} tip={t('catchUp.combat.usedTip', { item: r.name, count: r.count })}>
                                <ItemIcon item={r.itemId} size={32} title={null} />
                            </Pill>
                        ))}
                    </FightsRow>
                )}
                {combat.drops.length > 0 && (
                    <FightsRow id="drops" label={t('catchUp.combat.drops')} enter={enter}>
                        {combat.drops.map(r => (
                            <Pill key={r.itemId} id={r.itemId} attr="data-item-id" count={r.count} tip={t('catchUp.combat.dropTip', { item: r.name, count: r.count.toLocaleString() })}>
                                <ItemIcon item={r.itemId} size={32} title={null} />
                            </Pill>
                        ))}
                    </FightsRow>
                )}
            </div>
        </div>
    );
}

/** The summary's buttons: the kit's, full width. */
const BUTTON = { className: 'w-full', buttonClassName: 'py-1 ui-text-title' };

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
                {view.combat.shown && <FightsBlock combat={view.combat} enter={enter} />}
            </div>

            <div className="px-3 pt-2 pb-2.5 shrink-0 border-t border-white/10">
                {asking ? (
                    <div data-summary-confirm role="alertdialog" aria-label="Load as I left it?" className="flex flex-col gap-1.5">
                        <div className="text-white/80">Load the game as you left it? Everything from your time away is lost.</div>
                        <KitButton tone={KIT_BUTTON_TONE.DANGER} data-summary-confirm-yes onClick={onUndo} {...BUTTON}>
                            Confirm
                        </KitButton>
                        <KitButton tone={KIT_BUTTON_TONE.PLAIN} data-summary-confirm-no onClick={onCancel} autoFocus {...BUTTON}>
                            Cancel
                        </KitButton>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <KitButton data-summary-close onClick={onClose} autoFocus {...BUTTON}>
                            Return to the Guild
                        </KitButton>
                        {undoable && (
                            <KitButton
                                tone={KIT_BUTTON_TONE.PLAIN}
                                data-summary-undo
                                onClick={onAsk}
                                title="Throw away the time away and load the game exactly as you left it"
                                {...BUTTON}
                            >
                                Load as I left it
                            </KitButton>
                        )}
                    </div>
                )}
            </div>
        </PixelFrame>
    );
}

export default CatchUpOverlay;

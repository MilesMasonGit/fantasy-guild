import { useEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as CatchUp from '../../../systems/core/CatchUp.js';
import { cn } from '../../utils/cn.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import SkillIcon from '../base/SkillIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { CombatGlyph } from '../combat/CombatGlyph.jsx';
import { GLYPH_COLOUR } from '../combat/combatGlyphs.js';
import { t } from '../../../i18n/index.js';
import { summaryView, catchUpTitle } from './catchUpSummary.js';

/**
 * While a catch-up plays (`CatchUp.run`, a closed game's time away or a sleeping PC), a loading
 * bar covers the game; when it ends, "While you were away" says what happened, in two columns: the
 * items on the left, the news on the right. Only catch-ups long enough to `show`; a silent one
 * shows nothing. Each of its two buttons asks first: "Return to the Guild" (or Esc) keeps the
 * catch-up, "Load as I left it" turns it down (`CatchUp.undoLast`).
 *
 * ⚠️ The bar is moved by its fill's `transform` with a CSS transition, and a sheen runs across it
 * as a CSS animation: both stay on the compositor, so the bar keeps moving through a slice of
 * catch-up work, when the page cannot run any script.
 */
export function CatchUpOverlay() {
    const [run, setRun] = useState(null);
    const [result, setResult] = useState(null);
    /** Which button is being asked about: `'return'`, `'undo'` or null. */
    const [asking, setAsking] = useState(null);

    useEffect(() => {
        const offStart = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_STARTED, ({ awayMs, show } = {}) => {
            if (!show) return;
            setResult(null);
            setAsking(null);
            setRun({ awayMs, fraction: 0 });
        }, UI_LISTENER);
        const offProgress = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_PROGRESS, ({ fraction, show } = {}) => {
            if (!show) return;
            setRun(r => (r ? { ...r, fraction: Math.min(1, Math.max(0, Number(fraction) || 0)) } : r));
        }, UI_LISTENER);
        const offFinish = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, (finished) => {
            if (!finished?.show) return;
            setRun(null);
            setAsking(null);
            setResult(finished);
        }, UI_LISTENER);
        return () => { offStart(); offProgress(); offFinish(); };
    }, []);

    const close = () => {
        CatchUp.forgetUndo();
        setAsking(null);
        setResult(null);
        EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
    };

    // Esc is Return to the Guild's key, so it asks the same question; while a question is asked,
    // Esc only cancels it. Nothing underneath hears it.
    useEscapeLayer(!!result && !run, () => setAsking(a => (a ? null : 'return')));

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
                        onAsk={setAsking}
                        onCancel={() => setAsking(null)}
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
 * Opacity and transform only, and the stagger stops at `STAGGER_CAP`, so a long summary costs
 * no more than a short one.
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
        <div data-summary-section={id} className="mt-2 pt-1.5 border-t border-white/10 first:mt-0 first:pt-0 first:border-t-0">
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
function CountBars({ rows, idKey, idAttr, kind, sign, enter, tip }) {
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
                title={tip?.(row)}
                className={e.className}
                style={e.style}
            />
        );
    });
}

const netSign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±');
const netColour = (n) => (n > 0 ? 'text-gi-success' : n < 0 ? 'text-gi-danger' : 'text-gi-muted');

/**
 * The left column: each item once, its net change in green or red, gained and spent on hover.
 * An item with more lying on the mat than before carries the mat mark, and its hover says how
 * many (`itemChanges` says how the mat and the Bank add up).
 */
function ItemRows({ rows, enter }) {
    return rows.map(row => {
        const e = enter();
        const lines = [
            row.gained > 0 && t('catchUp.items.gained', { count: row.gained.toLocaleString() }),
            row.spent > 0 && t('catchUp.items.spent', { count: row.spent.toLocaleString() }),
            row.onMat > 0 && t('catchUp.items.onMat', { count: row.onMat.toLocaleString() })
        ];
        return (
            <Tooltip key={row.itemId} title={row.name} lines={lines}>
                <EntityRibbon
                    data-item-id={row.itemId}
                    data-summary-net={row.net}
                    data-summary-gained={row.gained}
                    data-summary-spent={row.spent}
                    kind="item"
                    id={row.itemId}
                    name={row.name}
                    amount={Math.abs(row.net)}
                    sign={netSign(row.net)}
                    countClassName={netColour(row.net)}
                    badge={row.onMat > 0 && (
                        <PixelGlyph
                            name="mat"
                            data-summary-on-mat
                            role="img"
                            aria-label={t('catchUp.items.onMatMark')}
                            className="text-gi-muted"
                        />
                    )}
                    size="sm"
                    title={null}
                    className={e.className}
                    style={e.style}
                />
            </Tooltip>
        );
    });
}

/** A column: our arrow bars when it runs past the panel's height, never a scroll bar. */
function Column({ id, children }) {
    // The side and bottom padding leave room for a hovered sprite's zoom, which the scrolling
    // list would otherwise clip.
    return (
        <div data-summary-column={id} className="min-h-0 min-w-0 flex flex-col">
            <ArrowScrollList step={96} compact className="min-h-0 flex-1 px-3 pt-1 pb-3">
                {children}
            </ArrowScrollList>
        </div>
    );
}

/** A muted line where a column has nothing to list. */
const Empty = ({ children }) => <div data-summary-empty className="px-1 ui-text-body text-white/50">{children}</div>;

/** The summary's buttons: the kit's, one width, centred. */
const BUTTON = { className: 'w-80 max-w-full', buttonClassName: 'py-1 ui-text-title' };

function Summary({ result, asking, onClose, onAsk, onCancel, onUndo }) {
    const view = summaryView(result);
    const enter = useRowEntrance();
    const undoable = CatchUp.canUndo();
    const undoing = asking === 'undo';
    return (
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            backdrop="away"
            data-catch-up-summary
            role="dialog"
            aria-label={t('catchUp.title')}
            className="w-[54rem] max-w-full"
            frameClassName="max-h-[85vh] flex flex-col ui-text-title leading-snug text-white"
        >
            <div data-summary-header className="px-3 pt-2.5 pb-1.5 shrink-0 text-center">
                <div role="heading" aria-level={2} className="ui-text-title font-bold text-gi-gold">{t('catchUp.title')}</div>
                <div data-summary-away>{t('catchUp.away', { time: view.awayText })}</div>
                {view.droppedText && <div data-summary-dropped className="text-white/60">{view.droppedText}</div>}
            </div>

            <div data-summary-body className="min-h-0 grid grid-cols-2 grid-rows-[minmax(0,1fr)] border-t border-white/10 pt-1.5">
                <Column id="items">
                    <Section id="items" title={t('catchUp.items.title')} enter={enter}>
                        {view.items.length > 0
                            ? <ItemRows rows={view.items} enter={enter} />
                            : <Empty>{t('catchUp.items.empty')}</Empty>}
                    </Section>
                </Column>

                <Column id="news">
                    {!view.hasNews && (
                        <Section id="news" title={t('catchUp.news.title')} enter={enter}>
                            <Empty>{t('catchUp.news.empty')}</Empty>
                        </Section>
                    )}
                    {view.events.length > 0 && (
                        <Section id="events" title={t('catchUp.news.events')} enter={enter}>
                            {view.events.map(ev => {
                                const e = enter();
                                return (
                                    <EntityRibbon
                                        key={ev.key}
                                        data-event-instance={ev.key}
                                        kind="token"
                                        id={ev.typeId}
                                        name={ev.name}
                                        countText={t(`catchUp.news.eventState.${ev.state}`)}
                                        size="sm"
                                        className={e.className}
                                        style={e.style}
                                    />
                                );
                            })}
                        </Section>
                    )}
                    {view.knockouts.length > 0 && (
                        <Section id="knockouts" title={t('catchUp.news.knockouts')} enter={enter}>
                            {view.knockouts.map(k => {
                                const e = enter();
                                return (
                                    <EntityRibbon
                                        key={k.heroId}
                                        data-hero-id={k.heroId}
                                        icon={<CombatGlyph name="down" colour={GLYPH_COLOUR.red} />}
                                        name={k.heroName}
                                        subtitle={k.lost.length ? t('catchUp.news.lost', { items: k.lost.join(', ') }) : null}
                                        countText={`×${k.times}`}
                                        size="sm"
                                        className={e.className}
                                        style={e.style}
                                    />
                                );
                            })}
                        </Section>
                    )}
                    {view.broken.length > 0 && (
                        <Section id="broken" title={t('catchUp.news.broken')} enter={enter}>
                            {view.broken.map(b => {
                                const e = enter();
                                return (
                                    <EntityRibbon
                                        key={b.key}
                                        data-broken-item={b.itemId}
                                        data-hero-id={b.heroId}
                                        kind="item"
                                        id={b.itemId}
                                        name={b.name}
                                        subtitle={t('catchUp.news.brokeStopped', { hero: b.heroName })}
                                        countText={b.times > 1 ? `×${b.times}` : null}
                                        size="sm"
                                        className={e.className}
                                        style={e.style}
                                    />
                                );
                            })}
                        </Section>
                    )}
                    {view.bankFull.length > 0 && (
                        <Section id="bankFull" title={t('catchUp.news.bankFull')} enter={enter}>
                            {view.bankFull.map(r => {
                                const e = enter();
                                return (
                                    <EntityRibbon
                                        key={r.itemId}
                                        data-item-id={r.itemId}
                                        kind="item"
                                        id={r.itemId}
                                        name={r.name}
                                        size="sm"
                                        className={e.className}
                                        style={e.style}
                                    />
                                );
                            })}
                        </Section>
                    )}
                    {view.recipes.length > 0 && (
                        <Section id="recipes" title={t('catchUp.news.recipes')} enter={enter}>
                            {view.recipes.map(r => {
                                const e = enter();
                                return (
                                    <EntityRibbon
                                        key={r.key}
                                        data-recipe-id={r.recipeId}
                                        kind="item"
                                        id={r.itemId}
                                        name={r.name}
                                        countText={r.heroName}
                                        size="sm"
                                        className={e.className}
                                        style={e.style}
                                    />
                                );
                            })}
                        </Section>
                    )}
                    {view.finds.length > 0 && (
                        <Section id="finds" title={t('catchUp.news.finds')} enter={enter}>
                            <CountBars rows={view.finds} idKey="itemId" idAttr="data-item-id" kind="item" sign="+" enter={enter} />
                        </Section>
                    )}
                    {view.levelUps.length > 0 && (
                        <Section id="levels" title={t('catchUp.news.levelUps')} enter={enter}>
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
                        <Section id="depleted" title={t('catchUp.news.depleted')} enter={enter}>
                            <CountBars rows={view.depleted} idKey="typeId" idAttr="data-type-id" kind="token" sign="×" enter={enter} />
                        </Section>
                    )}
                    {view.kills.length > 0 && (
                        <Section id="kills" title={t('catchUp.news.kills')} enter={enter}>
                            <CountBars
                                rows={view.kills}
                                idKey="enemyId"
                                idAttr="data-type-id"
                                kind="token"
                                sign="×"
                                enter={enter}
                                tip={r => t('catchUp.news.killTip', { enemy: r.name, count: r.count })}
                            />
                        </Section>
                    )}
                </Column>
            </div>

            <div className="px-3 pt-2 pb-2.5 shrink-0 border-t border-white/10">
                {asking ? (
                    <div
                        key={asking}
                        data-summary-confirm={asking}
                        role="alertdialog"
                        aria-label={t(undoing ? 'catchUp.confirmUndo.label' : 'catchUp.confirmReturn.label')}
                        className="flex flex-col items-center gap-1.5"
                    >
                        <div className="text-center text-white/80">
                            {t(undoing ? 'catchUp.confirmUndo.text' : 'catchUp.confirmReturn.text')}
                        </div>
                        {/* Going back throws the time away, so Cancel holds the focus there and a
                            stray Enter cancels; going on loses nothing, so Return holds it. */}
                        <KitButton
                            tone={undoing ? KIT_BUTTON_TONE.DANGER : KIT_BUTTON_TONE.MAIN}
                            data-summary-confirm-yes
                            onClick={undoing ? onUndo : onClose}
                            autoFocus={!undoing}
                            {...BUTTON}
                        >
                            {t(undoing ? 'catchUp.buttons.confirm' : 'catchUp.buttons.return')}
                        </KitButton>
                        <KitButton tone={KIT_BUTTON_TONE.PLAIN} data-summary-confirm-no onClick={onCancel} autoFocus={undoing} {...BUTTON}>
                            {t('catchUp.buttons.cancel')}
                        </KitButton>
                    </div>
                ) : (
                    <div key="buttons" className="flex flex-col items-center gap-1.5">
                        <KitButton data-summary-close onClick={() => onAsk('return')} autoFocus {...BUTTON}>
                            {t('catchUp.buttons.return')}
                        </KitButton>
                        {undoable && (
                            <KitButton
                                tone={KIT_BUTTON_TONE.PLAIN}
                                data-summary-undo
                                onClick={() => onAsk('undo')}
                                title={t('catchUp.buttons.undoTip')}
                                {...BUTTON}
                            >
                                {t('catchUp.buttons.undo')}
                            </KitButton>
                        )}
                    </div>
                )}
            </div>
        </PixelFrame>
    );
}

export default CatchUpOverlay;

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';
import { availableOf } from '../../../systems/board/InputAllocator.js';
import { lifetimeOf } from '../../../systems/progression/collectionLog.js';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { ItemTipContent } from '../drawer/ItemTip.jsx';
import { KIND } from './encyclopediaModel.js';
import {
    layoutChart, grownBox, keepInSight, centreOn, clampPan, needText, requirementOf, entryOfKey, ROOT, STATIONS
} from './encyclopediaChart.js';
import { EntrySprite, RequirementLine, Tick, isCollected, unscroll, SPRITE_PX } from './encyclopediaParts.jsx';

/** The ink the chart's lines and words are drawn in on the parchment. */
const INK = '#3b2614';

/**
 * Whole-pixel line heights, so a box's height is whole and even and its words, centred, land on
 * whole pixels: a pixel font half a pixel off goes soft.
 */
const BODY_LINE = { lineHeight: 'calc(var(--font-size-xs) + 2px)' };
const SMALL_LINE = { lineHeight: 'calc(var(--font-size-xxs) + 2px)' };

/** How far the pointer moves before a press becomes a drag (and the click is dropped). */
const DRAG_START_PX = 5;

/** The glide to the focus. */
const GLIDE = 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)';

const reducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A count as the chart says it: whole numbers as they are, others to one decimal. */
export function amountText(q) {
    const n = Number(q) || 0;
    const shown = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
    return `×${shown.toLocaleString('en-US')}`;
}

/** A line's odds on the box it reaches: "first kill", "40%", nothing when sure. */
export function chanceText(node) {
    if (node.firstKill) return t('encyclopedia.firstKill');
    if (!Number.isFinite(node.chance) || node.chance >= 1) return null;
    return t('encyclopedia.chance', { chance: Math.round(node.chance * 1000) / 10 });
}

const haveOf = (entry) => (entry?.kind === KIND.ITEM ? Math.floor(availableOf(entry.id) || 0) : null);
const count = (n) => Number(n || 0).toLocaleString('en-US');

/** The box of a node in a layout, by id (with its requirement line). */
function boxOf(layout, id) {
    const n = layout.nodes.find(x => x.id === id);
    return n ? { left: n.x, top: n.y - (layout.reqH ?? 0), right: n.x + n.w, bottom: n.y + n.h } : null;
}

/** The side a node grows toward: the start grows none, a box on the left grows left, one on the right right. */
const growSide = (node) => (node.side === 'in' ? 'in' : node.side === 'out' ? 'out' : null);

/** What the inspect mark shows on hover: what the entry is, what you have, and this run's totals. */
const InspectTip = ({ entry, node, have, startName, got, hint }) => {
    const lines = [];
    if (have != null) {
        const need = node.side === 'in' ? needText(node.need) : null;
        lines.push(need != null
            ? t('encyclopedia.haveNeed', { have: count(have), need: count(need), name: startName })
            : t('encyclopedia.have', { count: count(have) }));
    }
    const totals = lifetimeOf(entry.key);
    if (entry.kind === KIND.ITEM) lines.push(t('encyclopedia.collectedCount', { count: count(totals.collected) }));
    if (entry.kind === KIND.TOKEN) lines.push(t('encyclopedia.builtCount', { count: count(totals.built) }));
    if (entry.kind === KIND.ENEMY) lines.push(t('encyclopedia.killedCount', { count: count(totals.killed) }));
    if (entry.kind === KIND.RECIPE) lines.push(t(isCollected(got, entry) ? 'encyclopedia.made' : 'encyclopedia.notMade'));
    return (
        <div data-codex-inspect-tip={entry.key} className="flex flex-col gap-1">
            {entry.kind === KIND.ITEM && <ItemTipContent item={entry.def} />}
            {(entry.kind === KIND.TOKEN || entry.kind === KIND.ENEMY) && entry.def?.description && (
                <p className="text-white/85 leading-snug">{entry.def.description}</p>
            )}
            {entry.kind === STATIONS && (
                <p className="text-white/85 leading-snug">{t('encyclopedia.stations', { count: entry.members.length, names: entry.members.map(k => entry.nameOf?.(k) ?? k).join(', ') })}</p>
            )}
            {lines.map(line => <div key={line} className="text-white">{line}</div>)}
            {hint && <div className="ui-text-small text-white/55">{hint}</div>}
        </div>
    );
};

/** A count of the lines on one side of a box that are not on the chart: "+3". */
const Stem = ({ stem, clickable, onStem }) => {
    const words = t(stem.side === 'in' ? 'encyclopedia.hiddenIn' : 'encyclopedia.hiddenOut', { count: stem.count });
    const Tag = clickable ? 'button' : 'span';
    return (
        <Tooltip lines={clickable ? [words, t('encyclopedia.showThem')] : [words]}>
        <Tag
            {...(clickable ? { type: 'button', onClick: () => onStem(stem.node, stem.side) } : {})}
            data-codex-stem={stem.side}
            data-codex-stem-of={stem.node.id}
            aria-label={words}
            className={cn(
                'absolute flex items-center ui-text-small font-bold tabular-nums',
                stem.side === 'in' ? 'justify-end pr-1' : 'justify-start pl-1',
                clickable ? 'cursor-pointer hover:underline' : 'cursor-default'
            )}
            style={{ left: stem.x, top: stem.y, width: stem.w, height: stem.h, color: INK, ...SMALL_LINE }}
        >
            +{stem.count}
        </Tag>
        </Tooltip>
    );
};

/** One entry on the chart: what it asks above it; its sprite, name, how many a step takes, have / need and odds. */
const ChartNode = memo(function ChartNode({ book, box, entry, focused, collected, have, startName, heroes, got, reqH, onPick }) {
    const node = box.node;
    const need = node.side === 'in' ? needText(node.need) : null;
    const short = need != null && have != null && have < need;
    const odds = chanceText(node);
    const requirement = requirementOf(book, node.key, node.recipe);
    const grow = growSide(node);
    const hint = node.repeat ? t('encyclopedia.again') : node.grown && grow ? t('encyclopedia.fold') : node.canGrow ? t(grow === 'in' ? 'encyclopedia.growIn' : 'encyclopedia.growOut') : null;
    const tip = <InspectTip entry={entry} node={node} have={have} startName={startName} got={got} hint={hint} />;
    return (
        <>
            {requirement && (
                <div data-codex-req-of={node.id} className="absolute flex items-end pointer-events-auto" style={{ left: box.x, top: box.y - reqH, width: box.w, height: reqH }}>
                    <RequirementLine requirement={requirement} heroes={heroes} book={book} className="ui-text-small font-bold" style={{ color: INK, ...SMALL_LINE }} />
                </div>
            )}
            <button
                type="button"
                data-codex-node={node.id}
                data-codex-key={node.key}
                data-codex-side={node.side}
                data-focus={focused ? 'true' : undefined}
                data-grown={node.grown ? 'true' : undefined}
                aria-pressed={focused}
                onClick={() => onPick(node)}
                className={cn(
                    'absolute flex items-center gap-1.5 px-1.5 text-left cursor-pointer bg-gi-surface border-2',
                    focused ? 'border-[var(--color-ui-white)]' : 'border-[var(--color-ui-frame)] hover:border-[var(--color-ui-white)]'
                )}
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            >
                <span className="shrink-0 flex items-center justify-center" style={{ width: SPRITE_PX, height: SPRITE_PX }}>
                    <EntrySprite entry={entry} />
                </span>
                <span className="flex-1 min-w-0 flex flex-col">
                    <span className="ui-text-body font-bold text-white break-words" style={BODY_LINE}>{entry.name}</span>
                    <span className="ui-text-small tabular-nums text-white/70 flex flex-wrap gap-x-1.5" style={SMALL_LINE}>
                        {node.amount != null && <span data-codex-amount>{amountText(node.amount)}</span>}
                        {have != null && (
                            <span data-codex-have data-short={short ? 'true' : undefined} style={short ? { color: 'var(--color-ui-red)' } : undefined}>
                                {need != null ? `${count(have)}/${count(need)}` : count(have)}
                            </span>
                        )}
                        {have == null && <span>{t(`encyclopedia.kindOne.${entry.kind}`)}</span>}
                        {odds && <span data-codex-chance className="text-white">{odds}</span>}
                        {node.repeat && <span className="text-white/50">{t('encyclopedia.again')}</span>}
                    </span>
                </span>
                <span className="self-stretch flex flex-col items-end justify-between py-1">
                    <Tooltip title={entry.name} content={tip} maxWidth={300}>
                        <span data-codex-inspect aria-label={t('encyclopedia.inspect')} className="text-white/60 hover:text-white" onClick={(e) => e.stopPropagation()}>
                            <PixelGlyph name="inspect" />
                        </span>
                    </Tooltip>
                    {collected ? <Tick /> : <span />}
                </span>
            </button>
        </>
    );
});

/** The lines between the boxes, in ink, an arrowhead where each reaches a box. */
const Links = memo(function Links({ layout }) {
    const nodeIds = useMemo(() => new Set(layout.nodes.map(n => n.id)), [layout]);
    return (
        <svg aria-hidden="true" data-codex-links className="absolute left-0 top-0 overflow-visible pointer-events-none" width={1} height={1} shapeRendering="crispEdges">
            {layout.links.map(link => {
                const [x, y] = link.points[link.points.length - 1];
                return (
                    <g key={link.id} data-codex-link={link.id}>
                        <polyline points={link.points.map(p => p.join(',')).join(' ')} fill="none" stroke={INK} strokeWidth={2} />
                        {nodeIds.has(link.into) && <polygon points={`${x - 8},${y - 5} ${x},${y} ${x - 8},${y + 5}`} fill={INK} />}
                    </g>
                );
            })}
        </svg>
    );
});

/**
 * The flowchart, panned inside its window on the pages: the start in the middle at first; a drag
 * moves it (a press that moves is never a click); the wheel scrolls it; when the focus moves the
 * view glides just far enough to keep it, and what it grew, in sight.
 *
 * @param {object} props
 * @param {object} props.chart       `chartOf(...)`
 * @param {{ kind: 'centre'|'keep', at: string, seq: number }} props.glide  a request to move the view
 * @param {string|null} props.focusAt  the node in focus
 * @param {{ left, top, width, height, reserveRight? }} props.rect  the window, in the book's pixels;
 *   `reserveRight` a strip on its right (under a panel) where the focus is never kept
 */
export const ChartView = ({ book, chart, metrics, rect, focusAt, glide, got, heroes, startName, onNode, onStem }) => {
    const layout = useMemo(() => layoutChart(chart, metrics), [chart, metrics]);
    const viewport = { w: Math.max(0, rect.width), h: Math.max(0, rect.height) };
    const sight = { w: Math.max(0, viewport.w - (rect.reserveRight || 0)), h: viewport.h };
    const startBox = boxOf(layout, ROOT);
    const [view, setView] = useState(() => centreOn(sight, startBox));
    const [gliding, setGliding] = useState(false);
    const viewRef = useRef(view);
    viewRef.current = view;
    const layoutRef = useRef(layout);
    layoutRef.current = layout;
    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;
    const sightRef = useRef(sight);
    sightRef.current = sight;

    useLayoutEffect(() => {
        if (!glide) return;
        const lay = layoutRef.current;
        const vp = sightRef.current;
        const focus = boxOf(lay, glide.at) || boxOf(lay, ROOT);
        const next = glide.kind === 'centre'
            ? centreOn(vp, focus)
            : keepInSight(viewRef.current, vp, grownBox(lay, glide.at) || focus, focus);
        setGliding(!reducedMotion());
        setView(clampPan(next, viewportRef.current, lay.box));
    }, [glide]);

    // The window changes size with the screen: keep some of the chart in it.
    useEffect(() => {
        setView(v => clampPan(v, viewportRef.current, layoutRef.current.box));
    }, [viewport.w, viewport.h]);

    // A drag pans; it listens on the window so it follows the pointer anywhere.
    const dropClick = useRef(false);
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        dropClick.current = false;
        const start = { id: e.pointerId, x: e.clientX, y: e.clientY, from: viewRef.current, moved: false };
        const move = (ev) => {
            if (ev.pointerId !== start.id) return;
            const dx = ev.clientX - start.x;
            const dy = ev.clientY - start.y;
            if (!start.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
            start.moved = true;
            setGliding(false);
            setView(clampPan({ x: start.from.x + dx, y: start.from.y + dy }, viewportRef.current, layoutRef.current.box));
        };
        const up = (ev) => {
            if (ev.pointerId !== start.id) return;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            if (start.moved) dropClick.current = true;
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
    };
    const onClickCapture = (e) => {
        if (!dropClick.current) return;
        dropClick.current = false;
        e.stopPropagation();
        e.preventDefault();
    };
    const onWheel = (e) => {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        setGliding(false);
        setView(v => clampPan({ x: v.x - dx, y: v.y - dy }, viewportRef.current, layoutRef.current.box));
    };

    // A station type's members are named in its inspect line.
    const entryFor = (key) => {
        const entry = entryOfKey(book, key);
        return entry?.kind === STATIONS ? { ...entry, nameOf: book.nameOf } : entry;
    };

    return (
        <div
            data-codex-chart
            data-codex-view={`${view.x},${view.y}`}
            className="absolute overflow-hidden select-none cursor-grab active:cursor-grabbing"
            style={{ left: rect.left, top: rect.top, width: viewport.w, height: viewport.h, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onClickCapture={onClickCapture}
            onWheel={onWheel}
            onScroll={unscroll}
            onTransitionEnd={() => setGliding(false)}
        >
            <div
                data-codex-canvas
                className="absolute left-0 top-0"
                style={{ transform: `translate(${view.x}px, ${view.y}px)`, transition: gliding ? GLIDE : 'none' }}
            >
                <Links layout={layout} />
                {layout.ors.map(o => (
                    <span
                        key={o.id}
                        data-codex-or
                        className="absolute flex items-center justify-center ui-text-small font-bold pointer-events-none"
                        style={{ left: o.x - 24, top: o.y - 10, width: 48, height: 20, color: INK }}
                    >
                        {t('encyclopedia.or')}
                    </span>
                ))}
                {layout.captions.map(c => (
                    <span
                        key={c.id}
                        data-codex-caption={c.words}
                        className={cn('absolute flex items-center ui-text-small font-bold pointer-events-none whitespace-nowrap', c.label ? 'justify-center' : 'justify-end pr-2')}
                        style={c.label
                            ? { left: c.x - 40, top: c.y - 10, width: 80, height: 20, color: INK, ...SMALL_LINE }
                            : { left: c.x, top: c.y, width: c.w, height: c.h, color: INK, ...SMALL_LINE }}
                    >
                        {t(`encyclopedia.via.${c.words}`)}
                    </span>
                ))}
                {layout.nodes.map(box => {
                    const entry = entryFor(box.node.key);
                    if (!entry) return null;
                    return (
                        <ChartNode
                            key={box.id}
                            book={book}
                            box={box}
                            entry={entry}
                            focused={focusAt === box.id}
                            collected={isCollected(got, entry)}
                            have={haveOf(entry)}
                            startName={startName}
                            heroes={heroes}
                            got={got}
                            reqH={layout.reqH}
                            onPick={onNode}
                        />
                    );
                })}
                {layout.stems.map(stem => (
                    <Stem
                        key={stem.id}
                        stem={stem}
                        clickable={!stem.node.repeat && (stem.node.side === 'start' || stem.side === growSide(stem.node))}
                        onStem={onStem}
                    />
                ))}
            </div>
        </div>
    );
};

export default ChartView;

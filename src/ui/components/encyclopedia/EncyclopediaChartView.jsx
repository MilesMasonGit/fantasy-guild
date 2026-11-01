import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';
import { availableOf } from '../../../systems/board/InputAllocator.js';
import { PixelTriangle } from '../base/ArrowScrollList.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { KIND } from './encyclopediaModel.js';
import { layoutChart, grownBox, keepInSight, centreOn, clampPan, needText, ROOT } from './encyclopediaChart.js';
import { EntrySprite, GateLine, Tick, isCollected, SPRITE_PX } from './encyclopediaParts.jsx';

/** The ink the chart's lines and words are drawn in on the parchment. */
const INK = '#3b2614';

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

const haveOf = (entry) => (entry?.kind === KIND.ITEM ? Math.floor(availableOf(entry.id) || 0) : null);

/** The box of a node or chip in a layout, by id. */
function boxOf(layout, id) {
    const n = layout.nodes.find(x => x.id === id);
    if (n) return { left: n.x, top: n.y, right: n.x + n.w, bottom: n.y + n.h };
    const c = layout.chips.find(x => x.id === id);
    if (c) return { left: c.x, top: c.y - c.h / 2, right: c.x + c.w, bottom: c.y + c.h / 2 };
    return null;
}

/** One thing on the chart: its sprite, name, how many a step takes and have / need. */
const ChartNode = memo(function ChartNode({ box, entry, focused, collected, have, startName, onPick }) {
    const node = box.node;
    const need = node.side === 'in' ? needText(node.need) : null;
    const short = need != null && have != null && have < need;
    const grow = node.canGrow && !node.grown ? node.side : null;
    const lines = [];
    if (have != null) lines.push(need != null ? t('encyclopedia.haveNeed', { have: have.toLocaleString('en-US'), need: need.toLocaleString('en-US'), name: startName }) : t('encyclopedia.have', { have: have.toLocaleString('en-US') }));
    if (node.repeat) lines.push(t('encyclopedia.again'));
    else if (grow) lines.push(t(grow === 'in' ? 'encyclopedia.growIn' : 'encyclopedia.growOut'));
    return (
        <Tooltip title={entry.name} lines={lines}>
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
                <span className="flex-1 min-w-0 flex flex-col leading-tight">
                    <span className="ui-text-body font-bold text-white break-words">{entry.name}</span>
                    <span className="ui-text-small tabular-nums text-white/70 flex flex-wrap gap-x-1.5">
                        {node.amount != null && <span data-codex-amount>{amountText(node.amount)}</span>}
                        {have != null && (
                            <span data-codex-have data-short={short ? 'true' : undefined} style={short ? { color: 'var(--color-ui-red)' } : undefined}>
                                {need != null ? `${have.toLocaleString('en-US')}/${need.toLocaleString('en-US')}` : have.toLocaleString('en-US')}
                            </span>
                        )}
                        {have == null && <span>{t(`encyclopedia.kindOne.${entry.kind}`)}</span>}
                        {node.repeat && <span className="text-white/50">{t('encyclopedia.again')}</span>}
                    </span>
                </span>
                {collected && <span className="self-start pt-1"><Tick /></span>}
                {grow && (
                    <span
                        aria-hidden="true"
                        data-codex-grows={grow}
                        className={cn('absolute top-1/2 -translate-y-1/2', grow === 'in' ? '-left-4 rotate-90' : '-right-4 -rotate-90')}
                        style={{ color: INK }}
                    >
                        <PixelTriangle dir="down" />
                    </span>
                )}
            </button>
        </Tooltip>
    );
});

/** The words on a link: where it happens (the station, "Gathered"), its odds, its level, how many it takes. */
const ChartChip = memo(function ChartChip({ chip, book, focused, parentHave, heroes, onPick }) {
    const way = chip.way;
    const place = way.place ? book.nameOf(way.place) : null;
    const head = place
        ? (way.places ? t('encyclopedia.place', { name: place, more: way.places }) : place)
        : t(`encyclopedia.chip.${way.words}`);
    const odds = way.firstKill
        ? t('encyclopedia.firstKill')
        : (Number.isFinite(way.chance) && way.chance < 1 ? t('encyclopedia.chance', { chance: Math.round(way.chance * 1000) / 10 }) : null);
    const short = way.takes != null && parentHave != null && parentHave < way.takes;
    const makes = Number.isFinite(way.makes) && way.makes > 0 && way.makes !== 1 ? t('encyclopedia.makes', { count: amountText(way.makes) }) : null;
    const Tag = way.recipe ? 'button' : 'div';
    return (
        <Tag
            {...(way.recipe ? { type: 'button', onClick: () => onPick(chip), title: t('encyclopedia.chipRecipe', { name: book.nameOf(way.recipe) }) } : {})}
            data-codex-chip={chip.id}
            data-codex-how={way.how}
            data-focus={focused ? 'true' : undefined}
            className={cn(
                'absolute flex flex-col items-center gap-0.5 px-1 py-1 text-center ui-text-small leading-tight text-white bg-black/85 border-2',
                focused ? 'border-[var(--color-ui-white)]' : 'border-transparent',
                way.recipe && 'cursor-pointer hover:border-[var(--color-ui-white)]'
            )}
            style={{ left: chip.x, top: chip.y, width: chip.w, transform: 'translateY(-50%)' }}
        >
            <span data-codex-chip-head className="font-bold break-words">{head}{odds ? ` ${odds}` : ''}</span>
            {way.gate && <GateLine gate={way.gate} heroes={heroes} />}
            {way.takes != null && (
                <span data-codex-takes data-short={short ? 'true' : undefined} className="tabular-nums" style={short ? { color: 'var(--color-ui-red)' } : undefined}>
                    {amountText(way.takes)}
                </span>
            )}
            {makes && <span className="tabular-nums text-white/70">{makes}</span>}
        </Tag>
    );
});

/** The lines between the boxes, in ink, an arrowhead where each reaches a node. */
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
 * @param {string|null} props.focusAt  the node or chip in focus
 * @param {{ left, top, width, height }} props.rect  the window, in the book's pixels
 */
export const ChartView = ({ book, chart, metrics, rect, focusAt, glide, got, heroes, startName, onNode, onChip, onMore }) => {
    const layout = useMemo(() => layoutChart(chart, metrics), [chart, metrics]);
    const viewport = { w: Math.max(0, rect.width), h: Math.max(0, rect.height) };
    const startBox = boxOf(layout, ROOT);
    const [view, setView] = useState(() => centreOn(viewport, startBox));
    const [gliding, setGliding] = useState(false);
    const viewRef = useRef(view);
    viewRef.current = view;
    const layoutRef = useRef(layout);
    layoutRef.current = layout;
    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;

    useLayoutEffect(() => {
        if (!glide) return;
        const lay = layoutRef.current;
        const vp = viewportRef.current;
        const focus = boxOf(lay, glide.at) || boxOf(lay, ROOT);
        const next = glide.kind === 'centre'
            ? centreOn(vp, focus)
            : keepInSight(viewRef.current, vp, grownBox(lay, glide.at) || focus, focus);
        setGliding(glide.kind !== 'instant' && !reducedMotion());
        setView(clampPan(next, vp, lay.box));
    }, [glide]);

    // The window changes size with the screen: keep some of the chart in it.
    useEffect(() => {
        setView(v => clampPan(v, viewportRef.current, layoutRef.current.box));
    }, [viewport.w, viewport.h]);

    // A drag pans; it listens on the window so it follows the pointer anywhere.
    const press = useRef(null);
    const dropClick = useRef(false);
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        dropClick.current = false;
        const start = { id: e.pointerId, x: e.clientX, y: e.clientY, from: viewRef.current, moved: false };
        press.current = start;
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
            press.current = null;
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

    const parentHave = (chip) => {
        const parent = layout.nodes.find(n => n.id === chip.parent);
        return parent ? haveOf(book.entryOf(parent.node.key)) : null;
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
                        className="absolute ui-text-small font-bold pointer-events-none"
                        style={{ left: o.x, top: o.y, transform: 'translate(-50%, -50%)', color: INK }}
                    >
                        {t('encyclopedia.or')}
                    </span>
                ))}
                {layout.chips.map(chip => (
                    <ChartChip
                        key={chip.id}
                        chip={chip}
                        book={book}
                        focused={focusAt === chip.id}
                        parentHave={chip.side === 'out' ? parentHave(chip) : null}
                        heroes={heroes}
                        onPick={onChip}
                    />
                ))}
                {layout.nodes.map(box => {
                    const entry = book.entryOf(box.node.key);
                    if (!entry) return null;
                    return (
                        <ChartNode
                            key={box.id}
                            box={box}
                            entry={entry}
                            focused={focusAt === box.id}
                            collected={isCollected(got, entry)}
                            have={haveOf(entry)}
                            startName={startName}
                            onPick={onNode}
                        />
                    );
                })}
                {layout.mores.map(more => (
                    <button
                        key={more.id}
                        type="button"
                        data-codex-more={more.id}
                        onClick={() => onMore(more.id)}
                        className="absolute ui-text-small font-bold text-white bg-black/85 border-2 border-transparent hover:border-[var(--color-ui-white)] cursor-pointer"
                        style={{ left: more.x, top: more.y, width: more.w, height: more.h }}
                    >
                        {t('encyclopedia.more', { count: more.count })}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ChartView;

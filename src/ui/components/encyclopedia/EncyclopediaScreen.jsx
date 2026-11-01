import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { t } from '../../../i18n/index.js';
import { GameState } from '../../../state/GameState.js';
import { itemKey } from '../../../systems/progression/ledger/engine.js';
import { collectedOf, recentlyCollectedItems } from '../../../systems/progression/collectionLog.js';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { TOME_ART, TOME_SCALE, COVER_ART, spreadSize, pageRects } from '../atlas/tomeArt.js';
import { POP_UP_S, prefersReducedMotion } from '../atlas/AtlasTome.jsx';
import { encyclopedia, KINDS } from './encyclopediaModel.js';
import { chartOf, chartMetrics, ROOT } from './encyclopediaChart.js';
import { takeLookUp, onLookUp } from './encyclopediaLink.js';
import { noteViewed, recentlyViewed, RECENT_COUNT } from './encyclopediaRecent.js';
import { ChartView } from './EncyclopediaChartView.jsx';
import { InspectPanel } from './EncyclopediaPanel.jsx';
import { SearchBox, EntryRow, unscroll } from './encyclopediaParts.jsx';

/**
 * The book's pictures: the Atlas's own for now. A recoloured Encyclopedia book replaces them here
 * (its parchment measured in `tomeArt.js`'s way).
 */
const BOOK_ART = TOME_ART;

/** A small overshoot at the top as the book rises, as the Atlas's. */
const SETTLE_EASE = [0.34, 1.32, 0.64, 1];

/** The two pages the book shows. */
export const PAGE = Object.freeze({ OPENING: 'opening', CHART: 'chart' });

/** The search bar's row over the chart, and the panel's width, at the default text size. */
const TOOLBAR_H = 44;
const PANEL_W = 288;
const GAP = 12;

/** A text size from the stylesheet, in pixels (the Text size setting moves it). */
function cssPx(name, fallback) {
    if (typeof document === 'undefined') return fallback;
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** A chart's own state: where it started, what was grown and opened, the focus, and the last glide asked. */
function startState(key, seq = 0) {
    return { start: key, grown: new Set(), opened: new Set(), focus: { key, at: ROOT }, glide: { kind: 'centre', at: ROOT, seq: seq + 1 } };
}

function chartReducer(state, action) {
    const seq = (state?.glide?.seq ?? 0) + 1;
    switch (action.type) {
        case 'start':
            return startState(action.key, state?.glide?.seq ?? 0);
        case 'node': {
            if (!state) return state;
            const grown = action.grow ? new Set(state.grown).add(action.id) : state.grown;
            return { ...state, grown, focus: { key: action.key, at: action.id }, glide: { kind: 'keep', at: action.id, seq } };
        }
        case 'chip':
            if (!state) return state;
            return { ...state, focus: { key: action.key, at: action.id }, glide: { kind: 'keep', at: action.id, seq } };
        case 'more': {
            if (!state) return state;
            const owner = action.id.slice(0, -1);
            return { ...state, opened: new Set(state.opened).add(action.id), glide: { kind: 'keep', at: owner, seq } };
        }
        case 'home':
            if (!state) return state;
            return { ...state, focus: { key: state.start, at: ROOT }, glide: { kind: 'centre', at: ROOT, seq } };
        default:
            return state;
    }
}

/** Where the book lies in its room: centred, cropped when bigger; `visible` the part of the spread on screen. */
function placeSpread(roomW, roomH) {
    const { w, h } = spreadSize(TOME_SCALE);
    if (!(roomW > 0) || !(roomH > 0)) return { left: 0, top: 0, w, h, visible: null };
    const left = Math.round((roomW - w) / 2);
    const top = Math.round((roomH - h) / 2);
    const x0 = Math.max(0, -left);
    const y0 = Math.max(0, -top);
    return { left, top, w, h, visible: { left: x0, top: y0, width: Math.max(0, Math.min(w, roomW - left) - x0), height: Math.max(0, Math.min(h, roomH - top) - y0) } };
}

/**
 * Where the opening page's two panels, and the chart page's bar, chart window and panel, lie on the
 * spread. The chart runs across both pages; the panel floats over its right end, and the view
 * keeps the focus clear of it (`chart.reserveRight`).
 */
export function bookLayout(visible, k = 1) {
    const { left, right } = pageRects(TOME_SCALE, visible, 8);
    const top = Math.max(left.top, right.top);
    const bottom = Math.min(left.top + left.height, right.top + right.height);
    const leftEdge = left.width > 0 ? left.left : right.left;
    const panelW = Math.round(PANEL_W * k);
    const toolbarH = Math.round(TOOLBAR_H * k);
    const panelLeft = right.left + right.width - panelW;
    return {
        left,
        right,
        toolbar: { left: leftEdge, top, width: Math.max(0, panelLeft - GAP - leftEdge), height: toolbarH },
        chart: {
            left: leftEdge,
            top: top + toolbarH + GAP,
            width: Math.max(0, right.left + right.width - leftEdge),
            height: Math.max(0, bottom - top - toolbarH - GAP),
            reserveRight: panelW + GAP
        },
        panel: { left: panelLeft, top, width: panelW, maxHeight: Math.max(0, bottom - top) }
    };
}

const PageArt = ({ side }) => {
    const size = BOOK_ART.pageArtPx * TOME_SCALE;
    return (
        <img
            aria-hidden="true"
            data-codex-page-art={side}
            src={BOOK_ART[side]}
            alt=""
            draggable={false}
            className="absolute top-0 select-none pointer-events-none"
            // ⚠️ Inline: a global img rule would cap the width and squash the art.
            style={{ left: side === 'right' ? size : 0, width: size, height: size, maxWidth: 'none', imageRendering: 'pixelated' }}
        />
    );
};

const Heading = ({ children }) => <h3 className="ui-text-small font-bold gi-caps tracking-wider text-white/60 px-2 pt-1">{children}</h3>;
const Muted = ({ children }) => <p className="ui-text-body text-white/60 px-2 py-1">{children}</p>;

/** The search results, a heading per kind. */
const Results = ({ results, got, onPick }) => {
    if (!results.length) return <Muted>{t('encyclopedia.noResults')}</Muted>;
    return KINDS.map(kind => {
        const hits = results.filter(e => e.kind === kind);
        if (!hits.length) return null;
        return (
            <div key={kind} data-codex-group={kind}>
                <Heading>{t(`encyclopedia.kind.${kind}`)}</Heading>
                {hits.map(e => <EntryRow key={e.key} entry={e} got={got} onPick={onPick} />)}
            </div>
        );
    });
};

/** A short list of entries, or a muted line when there is none. */
const RecentList = ({ id, title, entries, got, onPick }) => (
    <section data-codex-recent={id} className="flex flex-col">
        <Heading>{title}</Heading>
        {entries.length
            ? entries.map(e => <EntryRow key={e.key} entry={e} got={got} onPick={onPick} />)
            : <Muted>{t('encyclopedia.nothingYet')}</Muted>}
    </section>
);

/**
 * The Encyclopedia: a book (the Atlas's), search-first. Its **opening page** searches every item,
 * Token, enemy and recipe, and lists what was looked at lately and the items newly collected.
 * Picking one opens its **chart**: what it comes from flowing in from the left, what it goes into
 * flowing out to the right; a click grows the chart a step from that node and makes it the focus,
 * which a small panel describes; the view glides to keep the focus in sight, drags to look
 * around, and goes back to the start. Everything is shown from the start; ticks mark what this
 * run has. It says what a thing comes from, never where on the world map.
 *
 * Mounted only while open: everything it reads is built the first time it opens.
 */
export const EncyclopediaScreen = ({ onClose }) => {
    const book = useMemo(() => encyclopedia(), []);
    const [chart, dispatch] = useReducer(chartReducer, null, () => {
        const key = takeLookUp();
        return key && book.entryOf(key) ? startState(key) : null;
    });
    const [page, setPage] = useState(() => (chart ? PAGE.CHART : PAGE.OPENING));
    const [term, setTerm] = useState('');

    const chartRef = useRef(chart);
    chartRef.current = chart;
    const startChart = useCallback((key) => {
        if (!book.entryOf(key)) return;
        // The chart already open on this entry comes back as it was left.
        if (chartRef.current?.start !== key) dispatch({ type: 'start', key });
        setTerm('');
        setPage(PAGE.CHART);
    }, [book]);

    // A link pressed while open (a card's book) starts a chart here.
    useEffect(() => onLookUp((key) => {
        takeLookUp();
        startChart(key);
    }), [startChart]);

    const focusKey = chart?.focus.key ?? null;
    useEffect(() => { if (focusKey) noteViewed(focusKey); }, [focusKey]);

    const onSearch = (value) => {
        setTerm(value);
        if (value.trim()) setPage(PAGE.OPENING);
    };
    const searching = term.trim().length > 0;
    const results = useMemo(() => (searching ? book.search(term) : []), [book, term, searching]);
    // Read when the page changes: the run moves on behind an open screen, and nothing here listens.
    const got = useMemo(() => collectedOf(), [page, focusKey, term]); // eslint-disable-line react-hooks/exhaustive-deps
    const heroes = GameState.heroes;

    const tree = useMemo(
        () => (chart ? chartOf(book, chart.start, { grown: chart.grown, opened: chart.opened }) : null),
        [book, chart?.start, chart?.grown, chart?.opened] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const onNode = useCallback((node) => dispatch({ type: 'node', id: node.id, key: node.key, grow: node.canGrow && !node.grown }), []);
    const onChip = useCallback((chip) => { if (chip.way.recipe) dispatch({ type: 'chip', id: chip.id, key: chip.way.recipe }); }, []);
    const onMore = useCallback((id) => dispatch({ type: 'more', id }), []);

    // The room the book lies in, measured; the pane's own resize too (ResizeObserver can be silent).
    const stage = useRef(null);
    const [room, setRoom] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const measure = () => {
            const el = stage.current;
            if (!el) return;
            setRoom(prev => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
        };
        measure();
        window.addEventListener('resize', measure);
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (ro && stage.current) ro.observe(stage.current);
        return () => {
            window.removeEventListener('resize', measure);
            ro?.disconnect();
        };
    }, []);

    const body = useMemo(() => cssPx('--font-size-xs', 16), []);
    const metrics = useMemo(() => chartMetrics(body), [body]);
    const k = Math.max(1, body / 16);
    const spread = placeSpread(room.w, room.h);
    const at = bookLayout(spread.visible, k);
    const { visible } = spread;
    const coverRight = COVER_ART.x1 * TOME_SCALE;
    const coverTop = COVER_ART.y0 * TOME_SCALE;
    const closeLeft = visible ? Math.min(coverRight - 20, visible.left + visible.width - 44) : coverRight - 20;
    const closeTop = visible ? Math.max(coverTop - 12, visible.top + 8) : coverTop - 12;
    // The panel keeps clear of the close button when the screen crops the book to its corner.
    const panelTop = closeLeft < at.panel.left + at.panel.width && closeLeft + 32 > at.panel.left
        ? Math.max(at.panel.top, closeTop + 40) : at.panel.top;
    const still = prefersReducedMotion();
    const below = typeof window !== 'undefined' ? window.innerHeight : 1000;

    const viewed = recentlyViewed().map(key => book.entryOf(key)).filter(Boolean);
    const collected = recentlyCollectedItems(GameState.state, RECENT_COUNT * 2)
        .map(id => book.entryOf(itemKey(id))).filter(Boolean).slice(0, RECENT_COUNT);
    const pickFirst = () => { if (results[0]) startChart(results[0].key); };
    const startName = chart ? book.nameOf(chart.start) : '';

    return (
        <div
            ref={stage}
            data-encyclopedia
            data-codex-page={page}
            className="absolute inset-0 z-(--z-encyclopedia) pointer-events-auto overflow-hidden"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
            onScroll={unscroll}
        >
            <motion.section
                role="dialog"
                aria-label={t('encyclopedia.title')}
                data-codex-book
                className="absolute text-white"
                style={{ left: spread.left, top: spread.top, width: spread.w, height: spread.h }}
                initial={still ? false : { y: below }}
                animate={{ y: 0 }}
                transition={{ duration: POP_UP_S, ease: SETTLE_EASE }}
            >
                <PageArt side="left" />
                <PageArt side="right" />
                {page === PAGE.OPENING && (
                    <>
                        <PixelFrame kind={FRAME_KIND.STUDS} data-codex-opening="search" className="absolute" style={at.left} frameClassName="h-full flex flex-col min-h-0 p-2 gap-2 bg-gi-surface/95">
                            <h2 className="ui-text-title font-bold text-white">{t('encyclopedia.title')}</h2>
                            <SearchBox value={term} onChange={onSearch} onEnter={pickFirst} focusOnMount />
                            <ArrowScrollList step={160} compact className="flex-1 min-h-0" listProps={{ 'data-codex-list': searching ? 'search' : 'none' }}>
                                {searching
                                    ? <Results results={results} got={got} onPick={startChart} />
                                    : <Muted>{t('encyclopedia.searchHint')}</Muted>}
                            </ArrowScrollList>
                        </PixelFrame>
                        <PixelFrame kind={FRAME_KIND.STUDS} data-codex-opening="recent" className="absolute" style={at.right} frameClassName="h-full flex flex-col min-h-0 p-2 gap-3 bg-gi-surface/95">
                            <ArrowScrollList step={160} compact className="flex-1 min-h-0">
                                <RecentList id="viewed" title={t('encyclopedia.recentlyViewed')} entries={viewed} got={got} onPick={startChart} />
                                <RecentList id="collected" title={t('encyclopedia.recentlyCollected')} entries={collected} got={got} onPick={startChart} />
                            </ArrowScrollList>
                        </PixelFrame>
                    </>
                )}
                {page === PAGE.CHART && tree && (
                    <>
                        <ChartView
                            book={book}
                            chart={tree}
                            metrics={metrics}
                            rect={at.chart}
                            focusAt={chart.focus.at}
                            glide={chart.glide}
                            got={got}
                            heroes={heroes}
                            startName={startName}
                            onNode={onNode}
                            onChip={onChip}
                            onMore={onMore}
                        />
                        <div data-codex-toolbar className="absolute flex items-center gap-2" style={at.toolbar}>
                            <SearchBox value={term} onChange={onSearch} onEnter={pickFirst} className="flex-1 min-w-32 max-w-64" />
                            <KitButton tone={KIT_BUTTON_TONE.PLAIN} className="shrink-0" buttonClassName="whitespace-nowrap" data-codex-contents onClick={() => setPage(PAGE.OPENING)} title={t('encyclopedia.contentsTip')}>
                                {t('encyclopedia.contents')}
                            </KitButton>
                            <KitButton tone={KIT_BUTTON_TONE.PLAIN} className="shrink-0" buttonClassName="whitespace-nowrap" data-codex-home onClick={() => dispatch({ type: 'home' })} title={t('encyclopedia.backToStartTip', { name: startName })}>
                                {t('encyclopedia.backToStart')}
                            </KitButton>
                        </div>
                        <InspectPanel
                            book={book}
                            focusKey={chart.focus.key}
                            startKey={chart.start}
                            got={got}
                            heroes={heroes}
                            onChartFrom={startChart}
                            style={{ left: at.panel.left, top: panelTop, width: at.panel.width, maxHeight: at.panel.maxHeight - (panelTop - at.panel.top) }}
                        />
                    </>
                )}
                <CloseX onClick={() => onClose?.()} label={t('common.close')} data-codex-close className="absolute z-30" style={{ left: closeLeft, top: closeTop }} />
            </motion.section>
        </div>
    );
};

export default EncyclopediaScreen;

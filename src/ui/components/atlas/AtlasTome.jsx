import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { TOME_ART, PAGE_PX, SPREAD_W, SPREAD_H, TOME_SCALE, COVER_ART, parchmentRects } from './tomeArt.js';

/** One art pixel of the ribbons, in screen pixels: UI sprites draw at 2×. */
const ART_PX = 2;

/** The page turn: each half of the leaf moves in this many held frames over this long. */
export const PAGE_TURN_STEPS = 3;
export const PAGE_TURN_HALF_S = 0.12;

const stepped = (steps) => (t) => Math.min(1, Math.ceil(t * steps) / steps);

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** One page of the owner's book: the right page as drawn, the left one mirrored. */
const PageArt = ({ side, style, className }) => (
    <img
        aria-hidden="true"
        data-tome-page={side}
        src={TOME_ART.page}
        alt=""
        draggable={false}
        className={cn('absolute top-0 select-none pointer-events-none', className)}
        style={{
            width: PAGE_PX,
            height: PAGE_PX,
            // ⚠️ Inline: a global img rule would cap the width and squash the art.
            maxWidth: 'none',
            imageRendering: 'pixelated',
            transform: side === 'left' ? 'scaleX(-1)' : undefined,
            ...style
        }}
    />
);

/** The open book behind the Atlas's panels: the owner's page at 4×, twice, spine to spine. */
const TomeBackdrop = () => (
    <div aria-hidden="true" data-tome-art className="absolute inset-0 pointer-events-none">
        <PageArt side="left" style={{ left: 0 }} />
        <PageArt side="right" style={{ left: PAGE_PX }} />
    </div>
);

/** How far a ribbon stands above the book, and how far it tucks in under the cover. */
const RIBBON_UP_PX = 34;
const RIBBON_TUCK_PX = 16;
/** The open section's ribbon stands this much taller. */
const RIBBON_LIFT_PX = 10;

/** A bookmark ribbon on the book's top edge: the screen's own variant of the kit's tabs. */
export const BookmarkRibbon = ({ id, label, colour, selected, onSelect }) => (
    <button
        type="button"
        role="tab"
        aria-selected={selected}
        data-atlas-tab={id}
        onClick={() => onSelect(id)}
        className={cn(
            'relative font-pixel ui-text-body font-bold px-4 cursor-pointer select-none flex items-start justify-center',
            selected ? 'text-white' : 'text-white/60 hover:text-white'
        )}
        style={{
            background: colour,
            height: (selected ? RIBBON_UP_PX + RIBBON_LIFT_PX : RIBBON_UP_PX) + RIBBON_TUCK_PX,
            paddingTop: 6 * ART_PX,
            clipPath: `polygon(0 0, 50% ${4 * ART_PX}px, 100% 0, 100% 100%, 0 100%)`,
            boxShadow: selected
                ? `inset ${ART_PX}px 0 0 0 var(--color-ui-gold), inset -${ART_PX}px 0 0 0 var(--color-ui-gold)`
                : `inset 0 -${RIBBON_TUCK_PX}px 0 0 rgba(0,0,0,0.25)`
        }}
    >
        {label}
    </button>
);

/**
 * The leaf that sweeps across when the tabs change: it lifts off one page, folds over the spine
 * and lays down on the other, in held frames. The new section is drawn underneath at once.
 */
const PageTurn = ({ turn, onDone }) => {
    const forward = turn.forward;
    const from = forward ? 'right' : 'left';
    const to = forward ? 'left' : 'right';
    // The spine is at the middle of the spread: each half of the leaf folds about it.
    const origin = (side) => (side === 'right' ? 'left center' : 'right center');
    const at = (side) => (side === 'right' ? PAGE_PX : 0);
    return (
        <div aria-hidden="true" data-page-turn={forward ? 'forward' : 'back'} className="absolute inset-0 pointer-events-none z-20">
            <motion.div
                className="absolute top-0"
                style={{ left: at(from), width: PAGE_PX, height: PAGE_PX, transformOrigin: origin(from) }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: PAGE_TURN_HALF_S, ease: stepped(PAGE_TURN_STEPS) }}
            >
                <PageArt side={from} style={{ left: 0 }} />
            </motion.div>
            <motion.div
                className="absolute top-0"
                style={{ left: at(to), width: PAGE_PX, height: PAGE_PX, transformOrigin: origin(to) }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: PAGE_TURN_HALF_S, duration: PAGE_TURN_HALF_S, ease: stepped(PAGE_TURN_STEPS) }}
                onAnimationComplete={onDone}
            >
                <PageArt side={to} style={{ left: 0 }} />
            </motion.div>
        </div>
    );
};

/**
 * The Atlas as the owner's open book lying on the map table, drawn at exactly 4× (1024 × 512) and
 * never scaled: a mat column smaller than that crops the table around it. Bookmark ribbons on its
 * top edge switch the section, with a quick page turn (none under reduced motion); the section's
 * own panels lie inside the pages' parchment (`TomeSpread`).
 *
 * @param {object} props
 * @param {{ id: string, label: string, colour: string }[]} props.tabs  in page order
 * @param {string} props.tab
 * @param {(id: string) => void} props.onTab
 * @param {React.ReactNode} [props.closeButton]
 * @param {string} props.label
 */
export const AtlasTome = ({ tabs, tab, onTab, closeButton, label, children }) => {
    const [turn, setTurn] = useState(null);
    const turns = useRef(0);
    const select = (id) => {
        if (id === tab) return;
        const order = tabs.map(t => t.id);
        if (!prefersReducedMotion()) {
            turns.current += 1;
            setTurn({ key: turns.current, forward: order.indexOf(id) > order.indexOf(tab) });
        }
        onTab(id);
    };
    // A turn left running when the screen closes or the leaf never reports done must not stick.
    useEffect(() => {
        if (!turn) return undefined;
        const t = setTimeout(() => setTurn(null), PAGE_TURN_HALF_S * 2000 + 200);
        return () => clearTimeout(t);
    }, [turn]);

    return (
        <section
            role="dialog"
            aria-label={label}
            data-atlas-screen
            className="relative shrink-0 text-white"
            style={{ width: SPREAD_W, height: SPREAD_H, marginTop: RIBBON_UP_PX + RIBBON_LIFT_PX }}
        >
            {/* Before the book, so the ribbons tuck in under its cover. */}
            <div
                role="tablist"
                className="absolute bottom-full flex items-end gap-2"
                style={{ left: PAGE_PX - COVER_ART.x1 * TOME_SCALE + 48, marginBottom: -RIBBON_TUCK_PX - COVER_ART.y0 * TOME_SCALE }}
            >
                {tabs.map(t => (
                    <BookmarkRibbon key={t.id} {...t} selected={t.id === tab} onSelect={select} />
                ))}
            </div>
            <TomeBackdrop />
            {closeButton && (
                <div className="absolute z-30" style={{ left: PAGE_PX + COVER_ART.x1 * TOME_SCALE - 20, top: COVER_ART.y0 * TOME_SCALE - 12 }}>{closeButton}</div>
            )}
            <div data-tome-pages className="absolute inset-0">
                {children}
            </div>
            {turn && <PageTurn key={turn.key} turn={turn} onDone={() => setTurn(null)} />}
        </section>
    );
};

/** Where the panels go on each page: inside the parchment, clear of the gold border. */
export const PAGE_RECTS = parchmentRects();

/**
 * The two pages as places to lay panels: `left` and `right` each fill their page's parchment and
 * nothing spills past its gold border.
 */
export const TomeSpread = ({ left, right }) => (
    <div data-tome-spread className="absolute inset-0">
        <div data-tome-left className="absolute flex flex-col min-h-0 min-w-0" style={PAGE_RECTS.left}>{left}</div>
        <div data-tome-right className="absolute flex flex-col min-h-0 min-w-0" style={PAGE_RECTS.right}>{right}</div>
    </div>
);

export default AtlasTome;

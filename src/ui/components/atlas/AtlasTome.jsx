import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { TOME_ART, TOME_FILL } from './tomeArt.js';

/** One art pixel of the placeholder book, in screen pixels: UI sprites draw at 2×. */
const ART_PX = 2;

/** The page turn: each half of the leaf moves in this many held frames over this long. */
export const PAGE_TURN_STEPS = 3;
export const PAGE_TURN_HALF_S = 0.12;

const stepped = (steps) => (t) => Math.min(1, Math.ceil(t * steps) / steps);

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PARCHMENT = '#e9d9b0';
const PARCHMENT_EDGE = '#c9b282';
const COVER = '#4a2a1a';
const COVER_EDGE = '#2a160c';

/** The spine's shadow on each page, darkest at the fold. */
const pageShade = (side) => `linear-gradient(${side === 'left' ? 'to left' : 'to right'}, rgba(74,42,26,0.35) 0, rgba(74,42,26,0) 48px)`;

/** One placeholder page: parchment, a faint ruled edge, the spine's shadow. */
const Page = ({ side }) => (
    <div
        aria-hidden="true"
        data-tome-page={side}
        className="absolute inset-y-0 w-1/2"
        style={{
            [side]: 0,
            background: `${pageShade(side)}, ${PARCHMENT}`,
            boxShadow: `inset 0 0 0 ${ART_PX}px ${PARCHMENT_EDGE}`
        }}
    />
);

/**
 * The open book behind the Atlas's panels. The owner's spread picture when there is one
 * (`TOME_ART.spread`), else a code-drawn book: a leather cover, two parchment pages, a spine.
 */
const TomeBackdrop = () => {
    if (TOME_ART.spread) {
        return (
            <img
                aria-hidden="true"
                data-tome-art
                src={TOME_ART.spread}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
                style={{ imageRendering: 'pixelated' }}
            />
        );
    }
    return (
        <div aria-hidden="true" data-tome-art="placeholder" className="absolute inset-0 pointer-events-none">
            <div
                className="absolute inset-0"
                style={{ background: COVER, boxShadow: `inset 0 0 0 ${ART_PX}px ${COVER_EDGE}, ${2 * ART_PX}px ${2 * ART_PX}px 0 0 #000` }}
            />
            <div className="absolute" style={{ inset: 6 * ART_PX }}>
                <Page side="left" />
                <Page side="right" />
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: ART_PX * 2, background: COVER_EDGE }} />
            </div>
        </div>
    );
};

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
    const leaf = { background: PARCHMENT, boxShadow: `inset 0 0 0 ${ART_PX}px ${PARCHMENT_EDGE}` };
    return (
        <div aria-hidden="true" data-page-turn={forward ? 'forward' : 'back'} className="absolute pointer-events-none z-20" style={{ inset: 6 * ART_PX }}>
            <motion.div
                className="absolute inset-y-0 w-1/2"
                style={{ ...leaf, [from]: 0, transformOrigin: from === 'right' ? 'left center' : 'right center' }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: PAGE_TURN_HALF_S, ease: stepped(PAGE_TURN_STEPS) }}
            />
            <motion.div
                className="absolute inset-y-0 w-1/2"
                style={{ ...leaf, [to]: 0, transformOrigin: to === 'right' ? 'left center' : 'right center' }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: PAGE_TURN_HALF_S, duration: PAGE_TURN_HALF_S, ease: stepped(PAGE_TURN_STEPS) }}
                onAnimationComplete={onDone}
            />
        </div>
    );
};

/**
 * The Atlas as an open tome lying on the map table, nearly filling its area. Bookmark ribbons on
 * its top edge switch the section, with a quick page turn (none under reduced motion); the
 * section's own panels lie over the pages (`TomeSpread`).
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
            className="relative text-white"
            style={{ width: `${TOME_FILL * 100}%`, height: `calc(${TOME_FILL * 100}% - ${RIBBON_UP_PX + RIBBON_LIFT_PX}px)`, marginTop: RIBBON_UP_PX + RIBBON_LIFT_PX }}
        >
            {/* Before the book, so the ribbons tuck in under its cover. */}
            <div role="tablist" className="absolute bottom-full left-[8%] flex items-end gap-2" style={{ marginBottom: -RIBBON_TUCK_PX }}>
                {tabs.map(t => (
                    <BookmarkRibbon key={t.id} {...t} selected={t.id === tab} onSelect={select} />
                ))}
            </div>
            <TomeBackdrop />
            {closeButton && <div className="absolute z-30 -top-3 -right-3">{closeButton}</div>}
            <div data-tome-pages className="absolute flex flex-col min-h-0" style={{ inset: 6 * ART_PX }}>
                {children}
            </div>
            {turn && <PageTurn key={turn.key} turn={turn} onDone={() => setTurn(null)} />}
        </section>
    );
};

/** The width of the gutter either side of the spine, where nothing is laid. */
export const TOME_GUTTER_PX = 28;
const GUTTER = TOME_GUTTER_PX;

/**
 * The two pages as places to lay panels: `left` and `right` each fill their page, kept clear of
 * the spine; `spread` lays one thing across both.
 */
export const TomeSpread = ({ left, right, spread, className }) => {
    if (spread) {
        return <div data-tome-spread className={cn('flex-1 min-h-0 flex flex-col', className)}>{spread}</div>;
    }
    return (
        <div data-tome-spread className={cn('flex-1 min-h-0 grid grid-cols-2', className)} style={{ columnGap: GUTTER * 2 }}>
            <div data-tome-left className="min-h-0 min-w-0 flex flex-col p-5 pr-0">{left}</div>
            <div data-tome-right className="min-h-0 min-w-0 flex flex-col p-5 pl-0">{right}</div>
        </div>
    );
};

export default AtlasTome;

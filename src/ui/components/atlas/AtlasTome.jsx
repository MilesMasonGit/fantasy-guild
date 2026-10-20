import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { TOME_ART, TOME_SCALE, COVER_ART, spreadSize, pageRects } from './tomeArt.js';

/** One art pixel of the ribbons, in screen pixels: UI sprites draw at 2×. */
const ART_PX = 2;

/** The page turn: each half of the leaf moves in this many held frames over this long. */
export const PAGE_TURN_STEPS = 3;
export const PAGE_TURN_HALF_S = 0.12;

/** The pop-up: the book rises from below the screen's bottom edge and settles, about 0.3 s. */
export const POP_UP_S = 0.3;
const POP_DOWN_S = 0.22;
/** A small overshoot at the top, then it settles. */
const SETTLE_EASE = [0.34, 1.32, 0.64, 1];

const stepped = (steps) => (t) => Math.min(1, Math.ceil(t * steps) / steps);

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** One of the owner's two pages at the book's scale. */
const PageArt = ({ side, scale, style }) => {
    const size = TOME_ART.pageArtPx * scale;
    return (
        <img
            aria-hidden="true"
            data-tome-page={side}
            src={TOME_ART[side]}
            alt=""
            draggable={false}
            className="absolute top-0 select-none pointer-events-none"
            style={{
                width: size,
                height: size,
                // ⚠️ Inline: a global img rule would cap the width and squash the art.
                maxWidth: 'none',
                imageRendering: 'pixelated',
                ...style
            }}
        />
    );
};

/** How far a ribbon stands above the book, and how far it tucks in under the cover. */
const RIBBON_UP_PX = 34;
const RIBBON_TUCK_PX = 16;
/** The open section's ribbon stands this much taller. */
const RIBBON_LIFT_PX = 10;
const RIBBON_ROOM_PX = RIBBON_UP_PX + RIBBON_LIFT_PX;

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
const PageTurn = ({ turn, scale, onDone }) => {
    const page = TOME_ART.pageArtPx * scale;
    const forward = turn.forward;
    const from = forward ? 'right' : 'left';
    const to = forward ? 'left' : 'right';
    // The spine is at the middle of the spread: each half of the leaf folds about it.
    const origin = (side) => (side === 'right' ? 'left center' : 'right center');
    const at = (side) => (side === 'right' ? page : 0);
    return (
        <div aria-hidden="true" data-page-turn={forward ? 'forward' : 'back'} className="absolute inset-0 pointer-events-none z-20">
            <motion.div
                className="absolute top-0"
                style={{ left: at(from), width: page, height: page, transformOrigin: origin(from) }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: PAGE_TURN_HALF_S, ease: stepped(PAGE_TURN_STEPS) }}
            >
                <PageArt side={from} scale={scale} style={{ left: 0 }} />
            </motion.div>
            <motion.div
                className="absolute top-0"
                style={{ left: at(to), width: page, height: page, transformOrigin: origin(to) }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: PAGE_TURN_HALF_S, duration: PAGE_TURN_HALF_S, ease: stepped(PAGE_TURN_STEPS) }}
                onAnimationComplete={onDone}
            >
                <PageArt side={to} scale={scale} style={{ left: 0 }} />
            </motion.div>
        </div>
    );
};

/**
 * Where the book lies in its room (`roomW` × `roomH`, the mat column): centred with its ribbons
 * when it fits, else the book alone centred and cropped. `visible` is the part of the spread on
 * screen (null before the room is measured).
 */
export function placeBook(scale, roomW, roomH) {
    const { w, h } = spreadSize(scale);
    if (!(roomW > 0) || !(roomH > 0)) return { left: 0, top: RIBBON_ROOM_PX, w, h, visible: null };
    const left = Math.round((roomW - w) / 2);
    const top = Math.round(roomH >= h + RIBBON_ROOM_PX ? (roomH - h + RIBBON_ROOM_PX) / 2 : (roomH - h) / 2);
    const x0 = Math.max(0, -left);
    const y0 = Math.max(0, -top);
    const x1 = Math.min(w, roomW - left);
    const y1 = Math.min(h, roomH - top);
    return { left, top, w, h, visible: { left: x0, top: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) } };
}

/** Whether the ribbons stand on screen above the cover's top edge (else they lie on the book's visible top). */
export function ribbonsTucked(book, scale) {
    return !book.visible || book.top + COVER_ART.y0 * scale - RIBBON_ROOM_PX >= 0;
}

const PageRectsContext = createContext(null);

/**
 * The Atlas as the owner's open book, popped up over the mat: it slides up from below the
 * screen's bottom edge and settles (straight in under reduced motion), and back down on close
 * (`AnimatePresence` around the screen). Drawn at a whole 2×, 3× or 4× (QA → Atlas), never in
 * between; a book bigger than the mat column is centred and cropped, and the panels keep to the
 * part of the parchment on screen. Bookmark ribbons on its top edge switch the section, with a
 * quick page turn; the section's own panels lie inside the pages (`TomeSpread`).
 *
 * @param {object} props
 * @param {{ id: string, label: string, colour: string }[]} props.tabs  in page order
 * @param {string} props.tab
 * @param {(id: string) => void} props.onTab
 * @param {React.ReactNode} [props.closeButton]
 * @param {string} props.label
 */
export const AtlasTome = ({ tabs, tab, onTab, closeButton, label, children }) => {
    const scale = TOME_SCALE;
    const [turn, setTurn] = useState(null);
    const turns = useRef(0);
    const stage = useRef(null);
    const [room, setRoom] = useState({ w: 0, h: 0 });
    const measure = useCallback(() => {
        const el = stage.current;
        if (!el) return;
        const w = el.clientWidth;
        const h = el.clientHeight;
        setRoom(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    }, []);
    useLayoutEffect(() => {
        measure();
        window.addEventListener('resize', measure);
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (ro && stage.current) ro.observe(stage.current);
        return () => {
            window.removeEventListener('resize', measure);
            ro?.disconnect();
        };
    }, [measure]);

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

    const book = placeBook(scale, room.w, room.h);
    const { visible } = book;
    const coverTop = COVER_ART.y0 * scale;
    const coverRight = COVER_ART.x1 * scale;
    // The ribbons tuck in under the cover's top edge; with that edge off screen they lie on the
    // book's top as far as can be seen, and the panels start below them.
    const tucked = ribbonsTucked(book, scale);
    const ribbonsDrop = RIBBON_ROOM_PX + RIBBON_TUCK_PX + 8;
    const pageRoom = tucked ? visible : { ...visible, top: visible.top + ribbonsDrop, height: visible.height - ribbonsDrop };
    const rects = pageRects(scale, pageRoom);
    const ribbonsLeft = Math.max((COVER_ART.x0 + 24) * scale, visible ? visible.left + 16 : 0);
    const closeLeft = visible ? Math.min(coverRight - 20, visible.left + visible.width - 44) : coverRight - 20;
    const closeTop = visible ? Math.max(coverTop - 12, visible.top + 8) : coverTop - 12;
    const still = prefersReducedMotion();
    const below = typeof window !== 'undefined' ? window.innerHeight : 1000;

    return (
        <div ref={stage} data-tome-stage className="absolute inset-0 pointer-events-none">
            <motion.section
                role="dialog"
                aria-label={label}
                data-atlas-screen
                data-tome-scale={scale}
                className="absolute text-white pointer-events-auto"
                style={{ left: book.left, top: book.top, width: book.w, height: book.h }}
                initial={still ? false : { y: below }}
                animate={{ y: 0 }}
                exit={still ? { opacity: 0, transition: { duration: 0 } } : { y: below, transition: { duration: POP_DOWN_S, ease: 'easeIn' } }}
                transition={{ duration: POP_UP_S, ease: SETTLE_EASE }}
            >
                <div
                    role="tablist"
                    className={cn('absolute flex items-end gap-2', !tucked && 'z-30')}
                    style={tucked
                        ? { left: ribbonsLeft, bottom: book.h - coverTop - RIBBON_TUCK_PX }
                        : { left: ribbonsLeft, top: visible.top + 4 }}
                >
                    {tabs.map(t => (
                        <BookmarkRibbon key={t.id} {...t} selected={t.id === tab} onSelect={select} />
                    ))}
                </div>
                <div aria-hidden="true" data-tome-art className="absolute inset-0 pointer-events-none">
                    <PageArt side="left" scale={scale} style={{ left: 0 }} />
                    <PageArt side="right" scale={scale} style={{ left: TOME_ART.pageArtPx * scale }} />
                </div>
                {closeButton && <div className="absolute z-30" style={{ left: closeLeft, top: closeTop }}>{closeButton}</div>}
                <PageRectsContext.Provider value={rects}>
                    <div data-tome-pages className="absolute inset-0">{children}</div>
                </PageRectsContext.Provider>
                {turn && <PageTurn key={turn.key} turn={turn} scale={scale} onDone={() => setTurn(null)} />}
            </motion.section>
        </div>
    );
};

/**
 * The two pages as places to lay panels: `left` and `right` each fill the part of their page's
 * parchment on screen, and nothing spills past its border.
 */
export const TomeSpread = ({ left, right }) => {
    const rects = useContext(PageRectsContext) || pageRects(2);
    return (
        <div data-tome-spread className="absolute inset-0">
            <div data-tome-left className="absolute flex flex-col min-h-0 min-w-0" style={rects.left}>{left}</div>
            <div data-tome-right className="absolute flex flex-col min-h-0 min-w-0" style={rects.right}>{right}</div>
        </div>
    );
};

export default AtlasTome;

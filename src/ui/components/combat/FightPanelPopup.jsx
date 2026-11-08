import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { LiveFightPanel, PANEL_W } from './FightPanel.jsx';
import {
    closeFightPanel, minimizeFightPanel, moveFightPanel, raiseFightPanel,
    useFightWindows, openFightWindows, fightWindows
} from './fightPanelStore.js';
import { startFightWatch, reconcile, adopt } from './fightWatch.js';
import { onPoll } from '../board/frameClock.js';

/** Closest a window comes to the screen's edge, and its gap from the button it opened from. */
const MARGIN = 12;
const GAP = 10;
/** How often the windows and tabs check for a fight that ended or began without a word. */
export const WINDOW_CHECK_MS = 1000;

/**
 * Where a new window goes for its size: beside the button on its `away` side (away from the
 * fight, so the fighters stay in view), its top a little above the button's; the other side when
 * that has no room; always inside the screen, on whole pixels.
 */
export function panelPlace(anchor, away, w, h, viewW, viewH) {
    if (!anchor) return { left: Math.round((viewW - w) / 2), top: Math.round((viewH - h) / 2) };
    const rightLeft = anchor.right + GAP;
    const leftLeft = anchor.left - GAP - w;
    const fitsRight = rightLeft + w <= viewW - MARGIN;
    const fitsLeft = leftLeft >= MARGIN;
    let left = away === -1 ? (fitsLeft || !fitsRight ? leftLeft : rightLeft) : (fitsRight || !fitsLeft ? rightLeft : leftLeft);
    left = Math.max(MARGIN, Math.min(viewW - MARGIN - w, left));
    const top = Math.max(MARGIN, Math.min(viewH - MARGIN - h, anchor.top - 40));
    return { left: Math.round(left), top: Math.round(top) };
}

/** A window's place kept inside the screen: all of it, or its top-left when it is larger. */
export function keepOnScreen(x, y, w, h, viewW, viewH) {
    return {
        left: Math.round(Math.max(0, Math.min(viewW - w, x))),
        top: Math.round(Math.max(0, Math.min(viewH - h, y)))
    };
}

/**
 * One open window, fixed on the screen where it was put. Dragged by its title bar: the box moves
 * itself while the pointer is down and tells the store once, on release, so a drag redraws
 * nothing. Pressing anywhere on it brings it to the top.
 */
const FightWindow = memo(function FightWindow({ win, z }) {
    const ref = useRef(null);
    const { heroId } = win;

    const settle = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const w = el.offsetWidth || PANEL_W + 12;
        const h = el.offsetHeight || 400;
        const now = fightWindows().find(x => x.heroId === heroId);
        if (!now) return;
        const at = now.x == null
            ? panelPlace(now.anchor, now.away, w, h, window.innerWidth, window.innerHeight)
            : keepOnScreen(now.x, now.y, w, h, window.innerWidth, window.innerHeight);
        moveFightPanel(heroId, at.left, at.top);
    }, [heroId]);

    // Placed for its size before it paints, and kept on screen when it grows (the log opening).
    useLayoutEffect(() => {
        settle();
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(settle);
        ro.observe(el);
        return () => ro.disconnect();
    }, [settle]);

    useEffect(() => {
        window.addEventListener('resize', settle);
        return () => window.removeEventListener('resize', settle);
    }, [settle]);

    const onDragStart = useCallback((e) => {
        const el = ref.current;
        if (!el || e.button > 0) return;
        e.preventDefault();
        const start = { px: e.clientX, py: e.clientY, x: el.offsetLeft, y: el.offsetTop };
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        let at = { left: start.x, top: start.y };
        const move = (ev) => {
            at = keepOnScreen(start.x + ev.clientX - start.px, start.y + ev.clientY - start.py, w, h, window.innerWidth, window.innerHeight);
            el.style.left = `${at.left}px`;
            el.style.top = `${at.top}px`;
        };
        const up = () => {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
            moveFightPanel(heroId, at.left, at.top);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
    }, [heroId]);

    const placed = win.x != null;
    return (
        <div
            ref={ref}
            data-fight-panel-popup={heroId}
            data-fight-window={heroId}
            className="fixed pointer-events-auto"
            style={{ left: placed ? win.x : -9999, top: placed ? win.y : -9999, zIndex: z, visibility: placed ? 'visible' : 'hidden' }}
            onPointerDownCapture={() => raiseFightPanel(heroId)}
        >
            <LiveFightPanel
                heroId={heroId}
                onClose={() => closeFightPanel(heroId)}
                onMinimize={() => minimizeFightPanel(heroId)}
                onDragStart={onDragStart}
            />
        </div>
    );
});

/**
 * The fight windows over the playmat, one per hero, several at once (owner, 2026-11-05): opened
 * by a fight's button, closed by their X or Escape (the top one first), minimized to a tab
 * (`FightTabStrip`). They stay open between fights, showing the last result. Always mounted, so
 * the fight watch keeps every fight's log from the start whether or not a window is open.
 * `onOpened` runs as a window comes to the top (the Token card closes: one card over the mat).
 */
export const FightPanelPopup = ({ onOpened = null }) => {
    useEffect(() => startFightWatch(), []);
    const all = useFightWindows();
    const open = openFightWindows(all);
    const top = open.at(-1) || null;
    const topKey = top ? `${top.heroId}:${top.z}` : null;

    useEffect(() => { if (topKey) onOpened?.(); }, [topKey, onOpened]);

    // A fight that ended or began without a word (a recall, a catch-up) is caught here, for every
    // window and tab at once; nothing is drawn unless a record changed.
    const watched = all.length > 0;
    useEffect(() => {
        if (!watched) return undefined;
        return onPoll(() => {
            for (const w of fightWindows()) if (!reconcile(w.heroId)) adopt(w.heroId);
        }, WINDOW_CHECK_MS);
    }, [watched]);

    // One Escape closes the top window; a window brought to the top is the top layer again.
    useEscapeLayer(!!top, () => closeFightPanel(), topKey);

    if (open.length === 0) return null;
    return (
        <div data-fight-windows className="fixed left-0 top-0 w-0 h-0 z-(--z-token-popup)">
            {open.map((w, i) => <FightWindow key={w.heroId} win={w} z={i + 1} />)}
        </div>
    );
};

export default FightPanelPopup;

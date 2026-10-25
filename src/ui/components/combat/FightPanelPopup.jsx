import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { LiveFightPanel, PANEL_W } from './FightPanel.jsx';
import { closeFightPanel, useFightPanelState } from './fightPanelStore.js';
import { startFightWatch } from './fightWatch.js';

/** Closest the panel comes to a window edge, and its gap from the chip it opened from. */
const MARGIN = 12;
const GAP = 10;

/**
 * Where the panel goes for its size: beside the chip on its `away` side (away from the fight, so
 * the fighters stay in view), its top a little above the chip's; the other side when that has no
 * room; always inside the window, on whole pixels.
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

/**
 * The fight panel over the playmat, like the Token's card: one at a time, opened by a fight's chip,
 * closed by its X, Escape, or a click anywhere off it (another fight's chip moves it there). Always
 * mounted, so the fight watch keeps every fight's log from the start whether or not a panel is open.
 * `onOpened` runs as a panel opens (the Token card closes: one popup over the mat at a time).
 */
export const FightPanelPopup = ({ onOpened = null }) => {
    useEffect(() => startFightWatch(), []);
    const open = useFightPanelState();
    const heroId = open?.heroId || null;
    const ref = useRef(null);
    const [place, setPlace] = useState(null);

    useEffect(() => { if (heroId) onOpened?.(); }, [heroId, onOpened]);

    const relayout = useCallback(() => {
        const el = ref.current;
        if (!el || !open) return;
        const next = panelPlace(open.anchor, open.away, el.offsetWidth || PANEL_W + 12, el.offsetHeight || 360, window.innerWidth, window.innerHeight);
        setPlace(prev => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
    }, [open]);

    // Placed for its size before it paints, and again whenever it changes size (the log opening).
    useLayoutEffect(() => {
        if (!heroId) { setPlace(null); return undefined; }
        relayout();
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(relayout);
        ro.observe(el);
        return () => ro.disconnect();
    }, [heroId, relayout]);

    useEffect(() => {
        if (!heroId) return undefined;
        window.addEventListener('resize', relayout);
        return () => window.removeEventListener('resize', relayout);
    }, [heroId, relayout]);

    useEffect(() => {
        if (!heroId) return undefined;
        const onClick = (e) => {
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const inside = ref.current && (path.includes(ref.current) || ref.current.contains(e.target));
            if (inside || e.target?.closest?.('[data-fight-chip]')) return;
            closeFightPanel();
        };
        const timer = setTimeout(() => window.addEventListener('click', onClick), 50);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', onClick);
        };
    }, [heroId]);

    useEscapeLayer(!!heroId, closeFightPanel);

    if (!heroId) return null;
    return (
        <div
            ref={ref}
            data-fight-panel-popup={heroId}
            className="fixed z-(--z-token-popup)"
            style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, visibility: place ? 'visible' : 'hidden' }}
        >
            <LiveFightPanel key={heroId} heroId={heroId} onClose={closeFightPanel} />
        </div>
    );
};

export default FightPanelPopup;

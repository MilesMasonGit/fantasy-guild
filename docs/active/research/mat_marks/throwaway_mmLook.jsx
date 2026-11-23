// THROWAWAY (brief 830 D3 screenshot page): never committed. window.__mm = { look: 'A'|'B'|'C'|'D'|'P', allNames }
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchWorkBar } from './workBar.js';
import { readCycle } from './cycleShare.js';
import { platePlace, plateUnit } from './workPlate.js';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { REACH_DOT } from './reachDot.js';
import './mmLook.css';

const DEFAULT = { look: 'D', allNames: false };
const get = () => (typeof window !== 'undefined' && window.__mm) || DEFAULT;
const sub = (fn) => { window.addEventListener('mmlook', fn); return () => window.removeEventListener('mmlook', fn); };
export const useMm = () => useSyncExternalStore(sub, get);

if (typeof window !== 'undefined') {
    window.__setMm = (v) => {
        window.__mm = { ...get(), ...v };
        document.documentElement.setAttribute('data-mm', window.__mm.look);
        window.dispatchEvent(new Event('mmlook'));
        return window.__mm;
    };
}

// ---- dot halos: the dot's shape grown by one and two art pixels -----------------------------
const grow = (rows) => {
    const n = rows.length + 2;
    const on = (x, y) => rows[y]?.[x] !== undefined && rows[y][x] !== '.';
    const out = [];
    for (let y = 0; y < n; y++) {
        let r = '';
        for (let x = 0; x < n; x++) {
            const px = x - 1, py = y - 1;
            r += on(px, py) || on(px - 1, py) || on(px + 1, py) || on(px, py - 1) || on(px, py + 1) ? '#' : '.';
        }
        out.push(r);
    }
    return out;
};
const pathOf = (rows, keep, off) => {
    let d = '';
    rows.forEach((row, y0) => {
        let x = 0;
        while (x < row.length) {
            if (!keep(x, y0)) { x++; continue; }
            let len = 1;
            while (x + len < row.length && keep(x + len, y0)) len++;
            d += `M${x + off} ${y0 + off}h${len}v1h${-len}z`;
            x += len;
        }
    });
    return d;
};
const G1 = grow(REACH_DOT);
const G2 = grow(G1);
const inDot = (x, y) => REACH_DOT[y]?.[x] !== undefined && REACH_DOT[y][x] !== '.';
const inG1 = (x, y) => G1[y]?.[x] === '#';
/** Ring 1: one art pixel outside the dot. Ring 2: two out. Both as paths from the dot's top-left cell. */
export const MM_RING1 = pathOf(G1, (x, y) => G1[y][x] === '#' && !inDot(x - 1, y - 1), -1);
export const MM_RING2 = pathOf(G2, (x, y) => G2[y][x] === '#' && !inG1(x - 1, y - 1), -2);

// ---- the proposed progress bar --------------------------------------------------------------
/** Inner length and height in art pixels; a one-art-pixel black outline round it. */
export const MM_BAR = { W: 24, H: 4 };

const secs = (ms) => (ms == null ? '–' : `${(ms / 1000).toFixed(1)}s`);

export function MmBar({ tokenId, x, y, typeId, side, fit, matH, blocked }) {
    const art = boardScaleAt(fit);
    const u = plateUnit(fit);
    const fillRef = useRef(null);
    const [ms, setMs] = useState(null);
    useLayoutEffect(() => {
        let held = null;
        const stop = watchWorkBar(tokenId, (bar) => { held?.attach(null); held = bar; bar?.attach(fillRef.current, MM_BAR.W); });
        return () => { stop(); held?.attach(null); };
    }, [tokenId]);
    useEffect(() => {
        const read = () => setMs(readCycle(tokenId, performance.now())?.cycleMs ?? null);
        read();
        const id = setInterval(read, 500);
        return () => clearInterval(id);
    }, [tokenId]);
    const place = platePlace({ x, y, typeId, side, fit, matH });
    return (
        <div data-mm-bar-slot={tokenId} className="absolute flex justify-center pointer-events-none"
            style={{ left: place.left, top: place.top + 2 * art, width: place.width }}>
            <div data-mm-bar={tokenId} data-mm-blocked={blocked ? 'true' : undefined} className="mm-bar-row flex items-center"
                style={{ gap: 3 * art, padding: `${2 * art}px ${3 * art}px`, '--a': `${art}px` }}>
                <div className="mm-bar-chroma" style={{ padding: art }}>
                    <div className="mm-bar-outline" style={{ padding: art, boxShadow: `${art}px ${art}px 0 #000` }}>
                        <div className="mm-bar-track relative" style={{ width: MM_BAR.W * art, height: MM_BAR.H * art }}>
                            <div ref={fillRef} className="absolute inset-0">
                                <div className="mm-bar-fill absolute left-0 top-0 bottom-0" style={{ width: 'calc(var(--work-bar-fill, 0) * 100%)' }} />
                            </div>
                        </div>
                    </div>
                </div>
                <span className="mm-bar-time font-bold tabular-nums leading-none text-white"
                    style={{ fontSize: `calc(var(--font-size-xxs, 14px) * ${u})` }}>{secs(ms)}</span>
            </div>
        </div>
    );
}

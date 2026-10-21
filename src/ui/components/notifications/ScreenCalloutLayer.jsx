import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { CALLOUT_MS } from '../board/callouts.js';

/**
 * A refusal off the mat (an item a hero cannot equip, dropped on their tab or panel), said as a
 * callout where the pointer let go, in the mat's callout style. Gone by itself; nothing to click.
 */

/** Callouts on screen at once; the oldest give way. */
const MAX_SHOWN = 3;

let nextId = 1;

export function ScreenCalloutLayer() {
    const [callouts, setCallouts] = useState([]);
    const pointer = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const timers = new Set();
        const track = (e) => { pointer.current = { x: e.clientX, y: e.clientY }; };
        window.addEventListener('pointermove', track, { passive: true });
        window.addEventListener('pointerup', track, { passive: true });
        const off = EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => {
            if (!p?.text) return;
            const id = nextId++;
            const at = Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : { ...pointer.current };
            setCallouts(list => [...list, { id, text: p.text, ...at }].slice(-MAX_SHOWN));
            const t = setTimeout(() => {
                timers.delete(t);
                setCallouts(list => list.filter(c => c.id !== id));
            }, CALLOUT_MS);
            timers.add(t);
        }, UI_LISTENER);
        return () => {
            off();
            window.removeEventListener('pointermove', track);
            window.removeEventListener('pointerup', track);
            for (const t of timers) clearTimeout(t);
        };
    }, []);

    if (!callouts.length || typeof document === 'undefined') return null;
    return createPortal(
        <div data-screen-callouts className="fixed inset-0 pointer-events-none z-(--z-screen-callouts)">
            {callouts.map(c => (
                // The outer box places it; the bubble's own transform is its pop (`callout-pop`).
                <div key={c.id} className="absolute" style={{ left: c.x, top: c.y - 12, transform: 'translate(-50%, -100%)' }}>
                    <div
                        data-callout={c.text}
                        className="callout-bubble whitespace-nowrap px-2 py-1 rounded-md border border-emerald-400/70 bg-emerald-950/95 text-emerald-100 text-[11px] font-bold shadow-lg"
                    >
                        {c.text}
                    </div>
                </div>
            ))}
        </div>,
        document.body
    );
}

export default ScreenCalloutLayer;

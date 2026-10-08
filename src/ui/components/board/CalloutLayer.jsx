import { memo, useEffect, useRef, useState } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { MAT_Z } from './matLayers.js';
import { CALLOUT_MS, addCallout, anchorKeyOf, calloutText } from './callouts.js';

/** Clear air between the top of a Token's art and the bottom of its callout's tail, in mat units. */
const GAP_PX = 6;

let nextId = 1;

/**
 * Quick popups over the mat, one style: "! Spawned Oak Tree" over the spawner, an effect's name
 * over the Token it fired on, and the reason for a refused drop over the spot it was aimed at.
 * They appear, hold for a moment and fade (`callout-pop` in `components.css`); nothing to click,
 * and the pointer passes straight through. One layer and one subscription per event for the
 * whole mat, however many Tokens are drawn.
 * Depletion and level-ups are not here: a hero says those (`HeroBubbleLayer`).
 */
export const CalloutLayer = memo(function CalloutLayer() {
    const [callouts, setCallouts] = useState([]);
    const timers = useRef(new Map());

    useEffect(() => {
        const pending = timers.current;
        const say = ({ anchorId = null, x = null, y = null, text }) => {
            if (!text) return;
            const anchor = anchorId ? BoardState.getTokenById(anchorId) : null;
            const at = anchor ? { x: anchor.x, y: anchor.y, typeId: anchor.typeId } : { x, y, typeId: null };
            if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
            const id = nextId++;
            const entry = { id, key: anchorKeyOf({ anchorId: anchor ? anchorId : null, ...at }), anchorId: anchor ? anchorId : null, ...at, text };
            setCallouts(list => addCallout(list, entry));
            pending.set(id, setTimeout(() => {
                pending.delete(id);
                setCallouts(list => list.filter(c => c.id !== id));
            }, CALLOUT_MS));
        };
        const unsubs = [
            EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => {
                if (p?.spawnerId && p.name) say({ anchorId: p.spawnerId, text: calloutText.spawned(p.name) });
            }),
            EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => {
                if (p?.instanceId && p.title) say({ anchorId: p.instanceId, text: calloutText.effect(p.title) });
            }),
            // A drop the mat refused names a point, not a Token: say why where it was aimed.
            EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => {
                if (p?.type === 'drop_rejected') say({ x: p.x, y: p.y, text: p.rulesText || p.title || p.message });
            }),
            // The screen's own refusal (the Guild Hall dragged off).
            EventBus.subscribe(UI_EVENTS.UI_TOKEN_ALERT, (p) => {
                if (p?.instanceId) say({ anchorId: p.instanceId, text: p.title || p.message });
            })
        ];
        return () => {
            unsubs.forEach(u => u());
            for (const t of pending.values()) clearTimeout(t);
            pending.clear();
        };
    }, []);

    if (!callouts.length) return null;

    const groups = new Map();
    for (const c of callouts) {
        if (!groups.has(c.key)) groups.set(c.key, []);
        groups.get(c.key).push(c);
    }

    return (
        <div
            data-callouts
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.CALLOUT }}
        >
            {[...groups.entries()].map(([key, list]) => {
                const { x, y, typeId } = list[0];
                const top = y - (typeId ? artRadiusOf(typeId) : 0) - GAP_PX;
                return (
                    <div
                        key={key}
                        className="absolute flex flex-col-reverse items-center gap-1"
                        style={{ left: 0, top: 0, transform: `translate(${x}px, ${top}px) translate(-50%, -100%)` }}
                    >
                        {list.map(c => (
                            <div key={c.id} data-callout={c.text} className="callout-bubble relative whitespace-nowrap px-2 py-1 rounded-md border border-emerald-400/70 bg-emerald-950/95 text-emerald-100 text-[11px] font-bold shadow-lg">
                                {c.text}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-emerald-400/70 bg-emerald-950/95" />
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
});

export default CalloutLayer;

import { useEffect, useRef, useState } from 'react';
import { FLAG_PX } from './flagGeometry.js';
import { MAT_Z } from './matLayers.js';
import { blockedLineFor, readyToSpeak } from './heroBubbles.js';
import { addMoment, liveMoments, stackOf, momentText } from './heroSpeech.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

/** How often lines are re-read and expired ones cleared. */
const REFRESH_MS = 500;

/**
 * ⭐ **Speech bubbles, above every hero's head.**
 *
 * One layer over the whole mat, so a bubble is never hidden by a Token, a flag
 * or another hero. Each stack is placed from the same point `MatHero` uses and
 * glides with it for one tick while the hero walks, so it stays over the head.
 * Bubbles are not clickable: the pointer passes straight through to whatever is
 * beneath, so dragging a hero or their flag is never blocked.
 *
 * Up to three bubbles per hero (SB-3):
 *
 * * **blocked** (`hero.alert`, the alert on the Token they hold) — says what is
 *   wrong for as long as it is wrong, re-read twice a second so it names what
 *   is missing *now*; a shortage of items waits first (SB-6);
 * * **moments** — arriving at a job, going idle, a level-up — timed, and gone
 *   by themselves (`heroSpeech.js`).
 */
export const HeroBubbleLayer = ({ heroes }) => {
    const [now, setNow] = useState(() => Date.now());
    const sinceRef = useRef(new Map());     // blocked key → when first seen
    const momentsRef = useRef(new Map());   // heroId → moments, oldest first
    const wasIdleRef = useRef(null);        // heroId → was idle last render (null until the first look)

    const say = (heroId, moment) => {
        const at = Date.now();
        momentsRef.current.set(heroId, addMoment(momentsRef.current.get(heroId) || [], moment, at));
        setNow(at);
    };
    const sayRef = useRef(say);
    sayRef.current = say;

    // Level-ups and arrivals arrive as events.
    useEffect(() => {
        const unsubs = [
            EventBus.subscribe('hero_leveled', ({ heroId, skillName, newLevel }) => {
                if (!heroId || !skillName) return;
                sayRef.current(heroId, { key: `level:${skillName}`, text: momentText.levelUp(skillName, newLevel) });
            }),
            EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, (p) => {
                if (p?.reason !== 'arrived' || !p.heroId || !p.instanceId) return;
                const token = BoardState.getTokenById(p.instanceId);
                if (!token) return;
                const name = getTokenType(token.typeId)?.name || tokenName(token.typeId) || token.typeId;
                sayRef.current(p.heroId, { key: 'arrived', text: momentText.arrived(name) });
            })
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    // Going idle is a change of state rather than an event: a hero who was busy
    // (walking to a job, working) and now stands at their flag with nothing to
    // do. Judged on `state` alone — an idle hero strolling about (`moving`) has
    // not gone idle again.
    useEffect(() => {
        const prev = wasIdleRef.current;
        const next = new Map();
        for (const h of heroes) {
            const idle = h.state === 'idle';
            next.set(h.heroId, idle);
            if (prev && prev.get(h.heroId) === false && idle) {
                sayRef.current(h.heroId, { key: 'idle', text: momentText.idle() });
            }
        }
        wasIdleRef.current = next;
    }, [heroes]);

    // Forget heroes who have left the mat, and lapsed moments.
    const t = Math.max(now, Date.now());
    const onMat = new Set(heroes.map(h => h.heroId));
    for (const [heroId, list] of momentsRef.current) {
        const live = liveMoments(list, t);
        if (!onMat.has(heroId) || !live.length) momentsRef.current.delete(heroId);
        else if (live.length !== list.length) momentsRef.current.set(heroId, live);
    }

    // When each block was first seen; a block that has cleared is forgotten so
    // it waits its delay afresh if it returns.
    const since = sinceRef.current;
    const liveKeys = new Set();
    const keyOf = (h) => `${h.heroId}:${h.tokenId}:${h.alert}`;
    for (const h of heroes) {
        if (!(h.alert && h.tokenId)) continue;
        liveKeys.add(keyOf(h));
        if (!since.has(keyOf(h))) since.set(keyOf(h), Date.now());
    }
    for (const key of [...since.keys()]) if (!liveKeys.has(key)) since.delete(key);

    const busy = heroes.some(h => h.alert && h.tokenId) || momentsRef.current.size > 0;
    useEffect(() => {
        if (!busy) return undefined;
        const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
        return () => clearInterval(timer);
    }, [busy]);

    return (
        <div
            data-hero-bubbles
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.HERO_BUBBLE }}
        >
            {heroes.map(h => {
                const blocked = (h.alert && h.tokenId && readyToSpeak(h.alert, since.get(keyOf(h)) ?? t, t))
                    ? blockedLineFor(h.tokenId, h.alert)
                    : null;
                const stack = stackOf(momentsRef.current.get(h.heroId) || [], blocked, t);
                if (!stack.length) return null;
                return (
                    <div
                        key={h.heroId}
                        data-hero-bubble-stack={h.heroId}
                        className="absolute flex flex-col items-center justify-end gap-1 pointer-events-none"
                        style={{
                            left: h.x,
                            // The bottom of the stack sits on the top of the hero's box
                            // (`heroPlacement`'s top, without importing it back from MatBoard).
                            top: h.y - FLAG_PX / 2 + FLAG_PX * 0.2,
                            transform: 'translate(-50%, -100%)',
                            transition: h.moving
                                ? `left ${TICK_INTERVAL_MS}ms linear, top ${TICK_INTERVAL_MS}ms linear`
                                : 'none'
                        }}
                    >
                        {stack.map(b => (
                            <div
                                key={b.id}
                                data-hero-bubble={b.id}
                                data-hero-bubble-kind={b.kind}
                                className="relative whitespace-nowrap px-2 py-1 rounded-md border border-yellow-500/70 bg-yellow-950/95 text-yellow-100 text-[11px] font-bold shadow-lg"
                            >
                                {b.text}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-yellow-500/70 bg-yellow-950/95" />
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export default HeroBubbleLayer;

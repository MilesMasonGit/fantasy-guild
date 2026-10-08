import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAT_Z } from './matLayers.js';
import { blockedLineFor, readyToSpeak, pinRefusedLineFor } from './heroBubbles.js';
import { addMoment, liveMoments, stackOf, momentText, speaksMoment, levelUpFrom, DEPLETED_TTL_MS } from './heroSpeech.js';
import { useMatFit } from './MatFitContext.jsx';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt } from '../base/TokenSprite.jsx';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { layoutStacks, bubbleAnchorY } from './bubbleLayout.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** How often lines are re-read and expired ones cleared. */
const REFRESH_MS = 500;

/** Before a stack has been measured: a guess from its text, in mat units. */
const GUESS_CHAR_PX = 6.3;
const GUESS_PAD_PX = 16;
const GUESS_ROW_PX = 22;
const ROW_GAP_PX = 4;
const guessSize = (stack) => ({
    w: Math.max(...stack.map(b => b.text.length)) * GUESS_CHAR_PX + GUESS_PAD_PX,
    h: stack.length * GUESS_ROW_PX + (stack.length - 1) * ROW_GAP_PX
});

/**
 * Speech bubbles, above every hero's head.
 * One layer over the whole mat, so a bubble is never hidden by a Token, a flag or another
 * hero. Each stack is placed from the same point `MatHero` uses and glides with it for one
 * tick while the hero walks, so it stays over the head. Bubbles are not clickable: the pointer
 * passes straight through to whatever is beneath, so dragging a hero or their flag is never
 * blocked.
 * Per hero: **blocked** (`hero.alert`, the alert on the Token they hold) says what is wrong
 * for as long as it is wrong, re-read twice a second so it names what is missing NOW; a
 * shortage of items waits first. **moments** (arriving at a job, going idle, a level-up, a
 * flag that could not be pinned, a Token the hero used up) are timed, and gone by themselves (`heroSpeech.js`).
 * Only unusual events are spoken: routine lines are filtered out by `speaksMoment` /
 * `speaksBlock`, and every line with its status is listed in
 * `docs/reference/speech_bubble_lines.md`.
 * Stacks are kept off each other and inside the mat (`bubbleLayout.js`); a nudged stack's
 * little tail still points at its hero.
 */
export const HeroBubbleLayer = ({ heroes }) => {
    const [now, setNow] = useState(() => Date.now());
    const sinceRef = useRef(new Map());     // blocked key → when first seen
    const momentsRef = useRef(new Map());   // heroId → moments, oldest first
    const layerRef = useRef(null);
    const sizesRef = useRef(new Map());     // heroId → measured {w, h} of its stack
    const [, setSizeTick] = useState(0);
    const mat = useMatSize();
    // The hero's art size in mat units, as `MatHero` draws it.
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(useMatFit()));
    const wasIdleRef = useRef(null);        // heroId → was idle last render (null until the first look)

    // `kind` is the moment's entry in `MOMENT_SPOKEN`: routine ones stay
    // silent.
    const say = (heroId, kind, moment, ttlMs) => {
        if (!speaksMoment(kind)) return;
        const at = Date.now();
        momentsRef.current.set(heroId, addMoment(momentsRef.current.get(heroId) || [], moment, at, ttlMs));
        setNow(at);
    };
    const sayRef = useRef(say);
    sayRef.current = say;

    // Level-ups and arrivals arrive as events.
    useEffect(() => {
        const unsubs = [
            EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, ({ heroId, skillName, newLevel, oldLevel }) => {
                if (!heroId || !skillName) return;
                const key = `level:${skillName}`;
                const from = levelUpFrom(momentsRef.current.get(heroId) || [], key, oldLevel ?? newLevel - 1, Date.now());
                sayRef.current(heroId, 'levelUp', { key, from, text: momentText.levelUp(skillName, newLevel, newLevel - from) });
            }),
            // The hero whose work spent a Token's last charge says so.
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, (p) => {
                if (!p?.exhaustedBy || !p.typeId) return;
                const name = getTokenType(p.typeId)?.name || tokenName(p.typeId) || p.typeId;
                sayRef.current(p.exhaustedBy, 'depleted', { key: `depleted:${p.typeId}`, text: momentText.depleted(name) }, DEPLETED_TTL_MS);
            }),
            EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, (p) => {
                if (p?.reason !== 'arrived' || !p.heroId || !p.instanceId) return;
                const token = BoardState.getTokenById(p.instanceId);
                if (!token) return;
                const name = getTokenType(token.typeId)?.name || tokenName(token.typeId) || token.typeId;
                sayRef.current(p.heroId, 'arrived', { key: 'arrived', text: momentText.arrived(name) });
            }),
            // The flag could not be pinned to the Token it was dropped on, so the hero says
            // why in their stuck-line words.
            EventBus.subscribe(BOARD_EVENTS.PIN_REFUSED, (p) => {
                if (!p?.heroId) return;
                const text = pinRefusedLineFor(p.instanceId, p.reason);
                if (text) sayRef.current(p.heroId, 'pinRefused', { key: 'pinRefused', text: momentText.pinRefused(text) });
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
                sayRef.current(h.heroId, 'idle', { key: 'idle', text: momentText.idle() });
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

    // What each hero says now, then where every stack goes so none crowd.
    const anchored = [];
    for (const h of heroes) {
        const blocked = (h.alert && h.tokenId && readyToSpeak(h.alert, since.get(keyOf(h)) ?? t, t))
            ? blockedLineFor(h.tokenId, h.alert)
            : null;
        const stack = stackOf(momentsRef.current.get(h.heroId) || [], blocked, t);
        if (!stack.length) continue;
        // The tail sits just above the head, read from the art's real size at this mat scale
        // (`bubbleAnchorY`). A moving hero comes with no point: read it live.
        const at = h.x == null ? HeroMotion.bodyView(h.heroId) : h;
        if (!at) continue;
        anchored.push({ h, stack, x: at.x, y: bubbleAnchorY(at.y, artPx), live: h.x == null });
    }

    // While a moving hero is speaking, follow their steps here: the one place that still
    // redraws per step, and only while a bubble is up.
    const following = anchored.some(a => a.live);
    useLayoutEffect(() => {
        if (!following) return undefined;
        return EventBus.subscribe(BOARD_EVENTS.HEROES_WALKED, () => setNow(Date.now()));
    }, [following]);
    const offsets = layoutStacks(
        anchored.map(a => ({ id: a.h.heroId, x: a.x, y: a.y, ...(sizesRef.current.get(a.h.heroId) || guessSize(a.stack)) })),
        mat
    );

    // Measure what was drawn, so the next pass spaces real sizes, not guesses. Only when what
    // the stacks SAY changes: a stack's size is its lines, and this layer re-renders on every
    // walking step, where measuring forced a layout inside each commit.
    const measureKey = anchored
        .map(({ h, stack }) => `${h.heroId}:${stack.map(b => `${b.id}=${b.text}`).join('|')}`)
        .join('||');
    useLayoutEffect(() => {
        const root = layerRef.current;
        if (!root) return;
        let changed = false;
        const seen = new Set();
        for (const el of root.querySelectorAll('[data-hero-bubble-stack]')) {
            const id = el.getAttribute('data-hero-bubble-stack');
            seen.add(id);
            const size = { w: el.offsetWidth, h: el.offsetHeight };
            const old = sizesRef.current.get(id);
            if (!old || Math.abs(old.w - size.w) > 1 || Math.abs(old.h - size.h) > 1) {
                sizesRef.current.set(id, size);
                changed = true;
            }
        }
        for (const id of [...sizesRef.current.keys()]) if (!seen.has(id)) sizesRef.current.delete(id);
        if (changed) setSizeTick(n => n + 1);
    }, [measureKey]);

    return (
        <div
            ref={layerRef}
            data-hero-bubbles
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.HERO_BUBBLE }}
        >
            {anchored.map(({ h, stack, x, y }) => {
                const { dx, dy } = offsets.get(h.heroId);
                return (
                    <div
                        key={h.heroId}
                        data-hero-bubble-stack={h.heroId}
                        className="absolute flex flex-col items-center justify-end gap-1 pointer-events-none"
                        // Moved by `transform`, as its hero is; the second translate keeps the
                        // stack centred over the point, tail down.
                        style={{
                            left: 0,
                            top: 0,
                            transform: `translate(${x + dx}px, ${y + dy}px) translate(-50%, -100%)`,
                            transition: h.moving
                                ? `transform ${TICK_INTERVAL_MS}ms linear`
                                : 'none'
                        }}
                    >
                        {stack.map((b, i) => (
                            <div
                                key={b.id}
                                data-hero-bubble={b.id}
                                data-hero-bubble-kind={b.kind}
                                className="relative whitespace-nowrap px-2 py-1 rounded-md border border-yellow-500/70 bg-yellow-950/95 text-yellow-100 text-[11px] font-bold shadow-lg"
                            >
                                {b.text}
                                {/* The tail is on the bubble nearest the head, and points at the
                                    hero even when the stack has been nudged aside. */}
                                {i === stack.length - 1 && (
                                    <div
                                        className="absolute -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-yellow-500/70 bg-yellow-950/95"
                                        style={{ left: `clamp(8px, calc(50% - ${dx}px), calc(100% - 8px))` }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export default HeroBubbleLayer;

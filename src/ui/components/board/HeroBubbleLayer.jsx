import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAT_Z } from './matLayers.js';
import { pinRefusedLineFor } from './heroBubbles.js';
import { addMoment, liveMoments, stackOf, momentText, speaksMoment, DEPLETED_TTL_MS } from './heroSpeech.js';
import { floatsOf, anyFloats, subscribeFloats } from './levelUpFloats.js';
import { LevelUpFloats } from './LevelUpFloat.jsx';
import { useMatFit } from './MatFitContext.jsx';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt } from '../base/TokenSprite.jsx';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import * as Flags from '../../../systems/board/Flags.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../../config/registries/enemyProfile.js';
import { layoutStacks, bubbleAnchorY } from './bubbleLayout.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';
import { publishHeroColumns } from './speechColumns.js';
import { SpeechFrame, tailInset } from './SpeechFrame.jsx';
import { momentTone } from './speechTone.js';
import { plateUnit } from './workPlate.js';

/** How often lines are re-read and expired ones cleared. */
const REFRESH_MS = 500;

/** Before a stack has been measured: a guess from its text, in mat units. */
const GUESS_CHAR_PX = 6.3;
const GUESS_PAD_PX = 16;
const GUESS_ROW_PX = 22;
const ROW_GAP_PX = 4;
/** A level-up float: the icon (16 art pixels) beside a number of about four characters. */
const GUESS_FLOAT_ART_PX = 40;
const GUESS_FLOAT_ROW_ART_PX = 22;
const guessSize = (stack, floats, unit) => {
    const floatW = floats.length * GUESS_FLOAT_ART_PX * unit;
    const textW = stack.length ? Math.max(...stack.map(b => b.text.length)) * GUESS_CHAR_PX + GUESS_PAD_PX : 0;
    const rows = stack.length + (floats.length ? 1 : 0);
    return {
        w: Math.max(floatW, textW),
        h: (floats.length ? GUESS_FLOAT_ROW_ART_PX * unit : 0) + stack.length * GUESS_ROW_PX + (rows - 1) * ROW_GAP_PX
    };
};

/**
 * Speech bubbles, above every hero's head.
 * One layer over the whole mat, so a bubble is never hidden by a Token, a flag or another
 * hero. Each stack is placed from the same point `MatHero` uses and glides with it for one
 * tick while the hero walks, so it stays over the head. Bubbles are not clickable: the pointer
 * passes straight through to whatever is beneath, so dragging a hero or their flag is never
 * blocked.
 * A hero who has just levelled a skill has its icon and number floating at the top of their
 * stack (`levelUpFloats.js`, `LevelUpFloat.jsx`), drawn with the speech so it follows the hero
 * and is kept off the other stacks the same way.
 * Heroes speak only of **moments** (going idle, a flag that could not be pinned, a Token the hero
 * used up), timed and gone by themselves (`heroSpeech.js`). A Token's problem is never spoken: its
 * problem mark and the mark's hover say it. Routine moments are filtered out by `speaksMoment`,
 * and every line with its status is listed in `docs/reference/speech_bubble_lines.md`.
 * Stacks are kept off each other and inside the mat (`bubbleLayout.js`); a nudged stack's
 * little tail still points at its hero.
 */
export const HeroBubbleLayer = ({ heroes }) => {
    const [now, setNow] = useState(() => Date.now());
    const momentsRef = useRef(new Map());   // heroId → moments, oldest first
    const layerRef = useRef(null);
    const sizesRef = useRef(new Map());     // heroId → measured {w, h} of its stack
    const [, setSizeTick] = useState(0);
    const mat = useMatSize();
    // The hero's art size in mat units, as `MatHero` draws it.
    const fit = useMatFit();
    const artUnit = boardScaleAt(fit);
    const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, artUnit);
    // The frames' unit: one screen pixel in mat units, as the work plate's.
    const u = plateUnit(fit || 1);
    const inset = tailInset(u);
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

    // A level-up float added or let go (`levelUpFloats.js` hears the level-ups). A count, not
    // the clock: several level-ups land in the same millisecond.
    const [, setFloatTick] = useState(0);
    useEffect(() => subscribeFloats(() => setFloatTick(n => n + 1)), []);

    // Depletions, arrivals and refused pins arrive as events.
    useEffect(() => {
        const unsubs = [
            // The hero whose work spent a Token's last charge says so.
            // An enemy is beaten, not depleted.
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, (p) => {
                if (!p?.exhaustedBy || !p.typeId) return;
                const def = getTokenType(p.typeId);
                const name = def?.name || tokenName(p.typeId) || p.typeId;
                const kind = isEnemyDef(def) ? 'beaten' : 'depleted';
                sayRef.current(p.exhaustedBy, kind, { key: `depleted:${p.typeId}`, text: momentText[kind](name) }, DEPLETED_TTL_MS);
            }, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, (p) => {
                if (p?.reason !== 'arrived' || !p.heroId || !p.instanceId) return;
                const token = BoardState.getTokenById(p.instanceId);
                if (!token) return;
                const name = getTokenType(token.typeId)?.name || tokenName(token.typeId) || token.typeId;
                sayRef.current(p.heroId, 'arrived', { key: 'arrived', text: momentText.arrived(name) });
            }, UI_LISTENER),
            // The flag could not be pinned to the Token it was dropped on, so the hero says
            // why in their stuck-line words.
            EventBus.subscribe(BOARD_EVENTS.PIN_REFUSED, (p) => {
                if (!p?.heroId) return;
                const text = pinRefusedLineFor(p.instanceId, p.reason);
                if (text) sayRef.current(p.heroId, 'pinRefused', { key: 'pinRefused', text: momentText.pinRefused(text) });
            }, UI_LISTENER)
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
                // Idle because the one fight in reach is another hero's: they wait for it.
                const busy = BoardState.getTokenById(Flags.waitingFor(h.heroId));
                if (busy) {
                    const name = getTokenType(busy.typeId)?.name || tokenName(busy.typeId) || busy.typeId;
                    sayRef.current(h.heroId, 'waiting', { key: 'idle', text: momentText.waiting(name) });
                } else {
                    sayRef.current(h.heroId, 'idle', { key: 'idle', text: momentText.idle() });
                }
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

    // What each hero says at time `t`, and where its stack hangs. Reads, never writes: the
    // poll below asks it too.
    const speechAt = (list, t) => {
        const out = [];
        for (const h of list) {
            const stack = stackOf(momentsRef.current.get(h.heroId) || [], t);
            const floats = floatsOf(h.heroId, t);
            if (!stack.length && !floats.length) continue;
            // The tail sits just above the head, read from the art's real size at this mat scale
            // (`bubbleAnchorY`). A moving hero comes with no point: read it live.
            const at = h.x == null ? HeroMotion.bodyView(h.heroId) : h;
            if (!at) continue;
            out.push({ h, stack, floats, x: at.x, y: bubbleAnchorY(at.y, artPx), live: h.x == null });
        }
        return out;
    };
    const speechKeyOf = (list) => list
        .map(({ h, stack, floats }) => `${h.heroId}:${floats.map(f => `${f.key}=${f.from}>${f.to}`).join('|')}:${stack.map(b => `${b.id}=${b.text}`).join('|')}`)
        .join('||');
    const speechAtRef = useRef(speechAt);
    speechAtRef.current = speechAt;
    const heroesRef = useRef(heroes);
    heroesRef.current = heroes;
    /** What the layer last drew, as `speechKeyOf` writes it. */
    const drawnKeyRef = useRef(null);

    // Twice a second, while anyone has a moment or a float up: one may have lapsed. Drawn only
    // when what is said has changed.
    const busy = momentsRef.current.size > 0 || anyFloats(t);
    useEffect(() => {
        if (!busy) return undefined;
        const timer = setInterval(() => {
            const at = Date.now();
            if (speechKeyOf(speechAtRef.current(heroesRef.current, at)) !== drawnKeyRef.current) setNow(at);
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [busy]);

    // What each hero says now, then where every stack goes so none crowd.
    const anchored = speechAt(heroes, t);

    // While a moving hero is speaking, follow their steps here: the one place that still
    // redraws per step, and only while a bubble is up.
    const following = anchored.some(a => a.live);
    useLayoutEffect(() => {
        if (!following) return undefined;
        return EventBus.subscribe(BOARD_EVENTS.HEROES_WALKED, () => setNow(Date.now()), UI_LISTENER);
    }, [following]);
    const offsets = layoutStacks(
        anchored.map(a => ({ id: a.h.heroId, x: a.x, y: a.y, ...(sizesRef.current.get(a.h.heroId) || guessSize(a.stack, a.floats, artUnit)) })),
        mat
    );

    // Where each stack standing at a Token is, so that Token's callouts go on top of it
    // (`speechColumns.js`). A walker's stack is not one: it moves on without this layer.
    useLayoutEffect(() => {
        publishHeroColumns(anchored
            .filter(a => a.h.tokenId && !a.live && !a.h.moving)
            .map(a => {
                const { dx, dy } = offsets.get(a.h.heroId);
                const { h: stackH } = sizesRef.current.get(a.h.heroId) || guessSize(a.stack, a.floats, artUnit);
                return { tokenId: a.h.tokenId, x: a.x + dx, top: a.y + dy - stackH };
            }));
    });
    useLayoutEffect(() => () => publishHeroColumns([]), []);

    // Measure what was drawn, so the next pass spaces real sizes, not guesses. Only when what
    // the stacks SAY changes: a stack's size is its lines, and this layer re-renders on every
    // walking step, where measuring forced a layout inside each commit.
    const measureKey = speechKeyOf(anchored);
    useLayoutEffect(() => {
        drawnKeyRef.current = measureKey;
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
            {anchored.map(({ h, stack, floats, x, y }) => {
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
                        {floats.length > 0 && <LevelUpFloats floats={floats} unit={artUnit} fit={fit} />}
                        {stack.map((b, i) => (
                            // The tail is on the bubble nearest the head, and points at the hero
                            // even when the stack has been nudged aside.
                            <SpeechFrame
                                key={b.id}
                                data-hero-bubble={b.id}
                                data-hero-bubble-kind={b.kind}
                                tone={momentTone(b.id)}
                                u={u}
                                tail={i === stack.length - 1}
                                tailLeft={`clamp(${inset}px, calc(50% - ${dx}px), calc(100% - ${inset}px))`}
                                className="whitespace-nowrap ui-text-title font-bold"
                            >
                                {b.text}
                            </SpeechFrame>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export default HeroBubbleLayer;

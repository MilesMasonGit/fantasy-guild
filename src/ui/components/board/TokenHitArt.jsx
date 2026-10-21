import React from 'react';
import { cn } from '../../utils/cn.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { useTokenEvent } from './tokenEvents.js';
import {
    HIT_PERIOD_MS, STRIKE_DELAY_MS, buildHitKeyframes, hitAnimationFor, hitsOnAttack, knockbackDir, strikeStartTime
} from './hitAnimations.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';
import { flashTint, afterimages, later, ringBlink, echoRing } from './fx/tokenFx.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { isDrawn } from '../../dev/perf/drawSwitches.js';
import { playTokenFx } from './fx/tokenFxPlay.js';
import { SPARK_MS } from './fx/matFx.js';
import { startStrikeChips } from './fx/strikeChips.js';

/** The engine's one-per-attack combat event (`CombatAttackProcessor`). */
export const COMBAT_ATTACK_EVENT = ENGINE_EVENTS.COMBAT_HERO_ATTACK;

/** How many effect frames a landed hit turns the enemy white. */
export const HIT_FLASH_FRAMES = 2;

/** A finished cycle: the outline white for this many effect frames. */
export const CYCLE_BLINK_FRAMES = 1;

/** A Token that has just become another: its outline white for this many effect frames. */
export const TRANSFORM_FLASH_FRAMES = 3;

const timelineNow = () =>
    (typeof document !== 'undefined' && document.timeline?.currentTime != null)
        ? document.timeline.currentTime
        : performance.now();

/**
 * The Token's art, reacting to its hero's blows.
 * A wrapper round the sprite and nothing else, so only the art moves: the Token's point, its
 * round hit area (the box around this), its badges and its drag are untouched. Animated with
 * the Web Animations API, transforms in whole art pixels (`unit` mat units each): no React render
 * per hit.
 * * **Work** (`skill` a work skill): while `heroId` works it and nothing is wrong (`active`),
 * one looping animation whose every loop starts on the hero's strike frame
 * (`strikeStartTime`), and a few chips in the colour of what is worked popping off each strike
 * (`fx/strikeChips.js`).
 * * **Combat** (an enemy): on each landed `combat_hero_attack`, on the hero's strike frame
 * ({@link STRIKE_DELAY_MS}: the hero plays its attack row once from that same event), the enemy
 * turns white for {@link HIT_FLASH_FRAMES} frames and is knocked back away from the hero who
 * struck, two white afterimages trailing it. A miss plays nothing.
 * * **A cycle finished** by a hero: the outline blinks white ({@link CYCLE_BLINK_FRAMES}).
 * * **A rule fired** on it: an echo of its outline ripples out (`echoRing`).
 * * **Just became this Token** (`flashOnMount`): the outline white for {@link TRANSFORM_FLASH_FRAMES}.
 * The mat's other one-off effects on this Token (`fx/tokenFxPlay.js`) play inside it too.
 * Reduced motion: no movement; combat keeps its white flash.
 */
export function TokenHitArt({ instanceId, skill, heroId = null, active = false, tokenX = null, unit = 1, flashOnMount = false, className, children }) {
    const ref = React.useRef(null);
    const anim = React.useMemo(() => hitAnimationFor(skill), [skill]);
    const onAttack = !!anim && hitsOnAttack(skill);

    const tokenXRef = React.useRef(tokenX);
    tokenXRef.current = tokenX;
    const unitRef = React.useRef(unit);
    unitRef.current = unit;

    // Work: a loop on the strike clock while the hero is at it, and the chips each strike knocks off.
    React.useEffect(() => {
        const el = ref.current;
        if (!el || !anim || onAttack || !heroId || !active || typeof el.animate !== 'function') return undefined;
        const reduced = prefersReducedMotion();
        const keyframes = buildHitKeyframes(anim, { periodMs: HIT_PERIOD_MS, reducedMotion: reduced, unit });
        if (!keyframes.length) return undefined;
        const loop = el.animate(keyframes, { duration: HIT_PERIOD_MS, iterations: Infinity });
        loop.startTime = strikeStartTime(timelineNow(), heroId);
        const stopChips = !reduced && isDrawn('tokenFx')
            ? startStrikeChips(el, {
                skill,
                firstStrike: loop.startTime,
                periodMs: HIT_PERIOD_MS,
                dir: () => {
                    const body = BoardState.heroBodyOf(heroId);
                    return knockbackDir(tokenXRef.current, body?.x, body?.side);
                },
                unit,
                seed: instanceId
            })
            : null;
        return () => {
            loop.cancel();
            stopChips?.();
        };
    }, [anim, onAttack, heroId, active, unit, skill, instanceId]);

    // Combat: one flash and knockback per landed hit, on the hero's strike frame.
    const lastHit = React.useRef(null);
    const stopHit = () => {
        const h = lastHit.current;
        if (!h) return;
        h.knock?.cancel();
        h.cancelLater?.();
        for (const a of h.copies) a?.cancel();
        lastHit.current = null;
    };
    useTokenEvent(COMBAT_ATTACK_EVENT, onAttack ? instanceId : null, (p) => {
        if (!p?.hit) return;
        const el = ref.current;
        if (!el || typeof el.animate !== 'function') return;
        stopHit();
        const body = p.heroId ? BoardState.heroBodyOf(p.heroId) : null;
        const dir = knockbackDir(tokenXRef.current, body?.x, body?.side);
        el.dataset.hitDir = String(dir);
        const u = unitRef.current;
        const keyframes = buildHitKeyframes(anim, { dir, reducedMotion: prefersReducedMotion(), unit: u });
        const hit = { knock: null, cancelLater: null, copies: [] };
        if (keyframes.length) hit.knock = el.animate(keyframes, { duration: anim.ms, delay: STRIKE_DELAY_MS });
        // The copies read the art as it is at the strike (an enemy's sheet frame), so they are made then.
        hit.cancelLater = later(STRIKE_DELAY_MS, () => {
            if (!isDrawn('tokenFx')) return;
            hit.copies.push(flashTint(el, 'white', { frames: HIT_FLASH_FRAMES }));
            if (!keyframes.length) return;
            const poses = anim.poses.map(q => ({ ms: q.ms, x: (q.x || 0) * dir, y: q.y || 0 }));
            hit.copies.push(...afterimages(el, poses, { unit: u }));
        });
        lastHit.current = hit;
    });
    React.useEffect(() => stopHit, []);

    useTokenEvent(BOARD_EVENTS.CYCLE_COMPLETE, onAttack ? null : instanceId, (p) => {
        if (p?.failed || !p?.heroId || !isDrawn('tokenFx')) return;
        ringBlink(ref.current, 'hover', { frames: CYCLE_BLINK_FRAMES });
    });
    useTokenEvent(BOARD_EVENTS.EFFECT_FIRED, instanceId, (p) => {
        if (!isDrawn('tokenFx')) return;
        const echo = () => echoRing(ref.current, 'hover', { unit: unitRef.current });
        // A neighbour's rule: the echo waits for its spark to land (`matFx.spark`).
        if (p?.fromTokenId && p.fromTokenId !== instanceId) later(SPARK_MS, echo);
        else echo();
    });
    React.useLayoutEffect(() => {
        if (flashOnMount && isDrawn('tokenFx')) ringBlink(ref.current, 'hover', { frames: TRANSFORM_FLASH_FRAMES });
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    // The mat's one-off effects, asked for by name (the QA panel, the Region settle).
    useTokenEvent(UI_EVENTS.UI_TOKEN_FX, instanceId, (p) => {
        playTokenFx(ref.current, p, { unit: unitRef.current, anim });
    });

    const live = anim && !onAttack && heroId && active;
    return (
        <div
            ref={ref}
            data-hit-art={instanceId}
            data-token-hit={anim?.name || undefined}
            data-token-hit-live={live ? 'true' : undefined}
            className={cn('absolute inset-0 pointer-events-none', className)}
            style={live ? { willChange: 'contents' } : undefined}
        >
            {children}
        </div>
    );
}

export default TokenHitArt;

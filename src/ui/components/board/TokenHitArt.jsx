import React from 'react';
import { cn } from '../../utils/cn.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { useTokenEvent } from './tokenEvents.js';
import {
    HIT_PERIOD_MS, STRIKE_DELAY_MS, buildHitKeyframes, hitAnimationFor, hitsOnAttack, knockbackDir, strikeStartTime
} from './hitAnimations.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** The engine's one-per-attack combat event (`CombatAttackProcessor`). */
export const COMBAT_ATTACK_EVENT = ENGINE_EVENTS.COMBAT_HERO_ATTACK;

function prefersReducedMotion() {
    try {
        return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

const timelineNow = () =>
    (typeof document !== 'undefined' && document.timeline?.currentTime != null)
        ? document.timeline.currentTime
        : performance.now();

/**
 * The Token's art, reacting to its hero's blows.
 * A wrapper round the sprite and nothing else, so only the art moves: the Token's point, its
 * round hit area (the box around this), its badges and its drag are untouched. Animated with
 * the Web Animations API, transforms and (for combat's red flash) a filter: no React render
 * per hit.
 * * **Work** (`skill` a work skill): while `heroId` works it and nothing is wrong (`active`),
 * one looping animation whose every loop starts on the hero's strike frame
 * (`strikeStartTime`).
 * * **Combat** (an enemy): one knockback per landed `combat_hero_attack`, away from the hero
 * who struck. It waits {@link STRIKE_DELAY_MS}: the hero plays its attack row once from that
 * same event, and the knockback lands on the strike frame. A miss plays no knockback.
 * Reduced motion: no movement; combat keeps its red flash.
 */
export function TokenHitArt({ instanceId, skill, heroId = null, active = false, tokenX = null, className, children }) {
    const ref = React.useRef(null);
    const anim = React.useMemo(() => hitAnimationFor(skill), [skill]);
    const onAttack = !!anim && hitsOnAttack(skill);

    // Work: a loop on the strike clock while the hero is at it.
    React.useEffect(() => {
        const el = ref.current;
        if (!el || !anim || onAttack || !heroId || !active || typeof el.animate !== 'function') return undefined;
        const keyframes = buildHitKeyframes(anim, { periodMs: HIT_PERIOD_MS, reducedMotion: prefersReducedMotion() });
        if (!keyframes.length) return undefined;
        el.style.transformOrigin = anim.origin;
        const loop = el.animate(keyframes, { duration: HIT_PERIOD_MS, iterations: Infinity });
        loop.startTime = strikeStartTime(timelineNow(), heroId);
        return () => loop.cancel();
    }, [anim, onAttack, heroId, active]);

    // Combat: one knockback per landed hit, on the hero's strike frame.
    const tokenXRef = React.useRef(tokenX);
    tokenXRef.current = tokenX;
    const lastHit = React.useRef(null);
    useTokenEvent(COMBAT_ATTACK_EVENT, onAttack ? instanceId : null, (p) => {
        if (!p?.hit) return;
        const el = ref.current;
        if (!el || typeof el.animate !== 'function') return;
        const body = p.heroId ? BoardState.heroBodyOf(p.heroId) : null;
        const dir = knockbackDir(tokenXRef.current, body?.x, body?.side);
        const keyframes = buildHitKeyframes(anim, { dir, reducedMotion: prefersReducedMotion() });
        if (!keyframes.length) return;
        lastHit.current?.cancel();
        el.style.transformOrigin = anim.origin;
        el.dataset.hitDir = String(dir);
        lastHit.current = el.animate(keyframes, { duration: anim.ms, delay: STRIKE_DELAY_MS });
    });
    React.useEffect(() => () => lastHit.current?.cancel(), []);

    return (
        <div
            ref={ref}
            data-token-hit={anim?.name || undefined}
            data-token-hit-live={anim && !onAttack && heroId && active ? 'true' : undefined}
            className={cn('absolute inset-0 pointer-events-none', className)}
        >
            {children}
        </div>
    );
}

export default TokenHitArt;

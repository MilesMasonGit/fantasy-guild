import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useTokenEvent } from './tokenEvents.js';
import { Infinity as InfinityIcon } from 'lucide-react';
import { inputSummary, outputSummary, contextSummary } from './StationRecipeModal.jsx';
import { turnCountdownText } from './centreAlert.js';

/**
 * The small things drawn **on** a Token: its name, its charges, the recipe gear
 * (top-left), the disallow mark (top-right) and a spawner's count.
 *
 * ⚠️ The green assign-a-hero plus is gone (FB-6): heroes find work through
 * their flags.
 *
 * They used to live in `BoardTile.jsx` and be keyed by tile index; since the mat
 * renderer (slice 1.6c-2) a Token is a circle at a point, so what they are about
 * is its **instance id** — and everything they need to draw arrives as a prop
 * from `MatToken`, which already reads the Token's details by id. Only the
 * charge floater still listens for itself, because a `-1` is a moment rather
 * than a state.
 */

/**
 * TokenChargeBadge — remaining charges at the bottom-right of a Token on
 * hover. Shows the full number (or an infinity icon for an unlimited Token).
 *
 * ⚠️ Used to shift up above the progress bar while the Token was cycling or
 * blocked, because the bar used to hug this same bottom-right corner. The bar
 * moved into the gap below the Token (TP-2), so this corner is free at rest
 * now — the shift is retired (TPP-2).
 */
export const TokenChargeBadge = ({ usesRemaining, isDragging, isHovered }) => {
    const [localHover, setLocalHover] = useState(false);

    if (isDragging) return null;

    const visible = isHovered || localHover;
    const isUnlimited = usesRemaining == null;
    const displayVal = isUnlimited ? null : Number(usesRemaining).toLocaleString();
    const titleText = isUnlimited ? 'Unlimited charges' : `${displayVal} charges remaining`;

    return (
        <div
            onMouseEnter={() => setLocalHover(true)}
            onMouseLeave={() => setLocalHover(false)}
            aria-label={titleText}
            className={cn(
                "absolute right-1.5 bottom-1.5 z-30 pointer-events-auto",
                "flex items-center justify-center px-1.5 py-0.5 rounded",
                "bg-black/95 backdrop-blur-sm border border-gi-gold/50 shadow-[0_0_8px_rgba(251,191,36,0.25)]",
                "text-gi-gold font-mono text-[10px] font-bold tabular-nums leading-none tracking-tight",
                "transition-all duration-150 ease-out cursor-default select-none",
                visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}
        >
            {isUnlimited ? (
                <InfinityIcon size={12} className="shrink-0 text-gi-gold" />
            ) : (
                <span className="text-gi-gold">{displayVal}</span>
            )}
        </div>
    );
};

/**
 * TokenChargeDeltaFloater — floating numbers (-1, +50) when this Token's charges
 * change. Sits just above where the charge badge is drawn.
 */
export const TokenChargeDeltaFloater = ({ instanceId }) => {
    const [deltas, setDeltas] = useState([]);
    const timers = React.useRef(new Set());

    useTokenEvent(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, instanceId, (p) => {
        if (p?.delta == null || p?.delta === 0) return;
        const id = Math.random().toString(36).slice(2);
        setDeltas(prev => [...prev, { id, delta: p.delta }]);
        const timer = setTimeout(() => {
            setDeltas(prev => prev.filter(d => d.id !== id));
            timers.current.delete(timer);
        }, 3000);
        timers.current.add(timer);
    });

    useEffect(() => {
        const pending = timers.current;
        return () => {
            for (const timer of pending) clearTimeout(timer);
            pending.clear();
        };
    }, []);

    if (!deltas.length) return null;

    return (
        <div
            className={cn(
                "absolute right-1.5 bottom-3.5 z-40 pointer-events-none",
                "transition-all duration-150 ease-out"
            )}
        >
            <AnimatePresence>
                {deltas.map(d => (
                    <motion.div
                        key={d.id}
                        initial={{ opacity: 0, y: 2, scale: 0.95 }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            y: [2, 0, -2, -5],
                            scale: [0.95, 1, 1, 0.98]
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: 3.0,
                            times: [0, 0.08, 0.82, 1],
                            ease: 'easeOut'
                        }}
                        className={cn(
                            "absolute right-0 bottom-0 font-mono font-bold text-[12px] tabular-nums leading-none tracking-tight pointer-events-none select-none drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] whitespace-nowrap",
                            d.delta > 0 ? "text-emerald-300" : "text-amber-200"
                        )}
                        style={{
                            textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000'
                        }}
                    >
                        {d.delta > 0 ? `+${d.delta.toLocaleString()}` : (d.delta < 0 ? `-${Math.abs(d.delta).toLocaleString()}` : `${d.delta}`)}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

/**
 * TokenNameBadge — the Token's name across the top on hover. Clean outlined
 * text that wraps onto as many lines as it needs.
 */
export const TokenNameBadge = ({ name, isDragging, isHovered }) => {
    if (!name || isDragging) return null;

    return (
        <div
            className={cn(
                "absolute top-1 left-1 right-1 z-30 pointer-events-none",
                "flex items-start justify-center text-center select-none",
                "transition-opacity ease-out",
                isHovered ? "opacity-100 duration-500 delay-[1200ms]" : "opacity-0 duration-150 delay-0"
            )}
        >
            <span
                className="text-[10px] font-bold text-white leading-tight tracking-tight px-1 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]"
                style={{
                    textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000'
                }}
            >
                {name}
            </span>
        </div>
    );
};

/**
 * StationGearBadge — the recipe picker's handle, **top-left** of a Token that
 * has something to choose (FB-7): a Foundation, or a station whose pool is not
 * empty (`centreAlert.gearStateOf` decides).
 *
 * Always shown, not only on hover. While nothing is chosen it **pulses
 * gently** and that is all — no red alert (owner, after Q1): the Token is
 * waiting, not broken, and heroes pass it over until the player picks. Once a
 * recipe is chosen it stays, still, so the player can change it.
 *
 * Hovering previews the selected recipe (concept §2.1) — outputs first, then
 * what it consumes.
 */
export const StationGearBadge = ({ isDragging, recipe, pulsing = false, isFoundation = false, onClick }) => {
    if (isDragging) return null;

    const outputs = outputSummary(recipe);
    const inputs = inputSummary(recipe);
    const context = contextSummary(recipe);
    const label = isFoundation ? 'Choose what to build' : 'Choose recipe';

    return (
        <div
            data-station-gear={pulsing ? 'unset' : 'set'}
            className="absolute left-1 top-1 z-30 group pointer-events-auto"
        >
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                aria-label={label}
                className={cn(
                    'w-7 h-7 flex items-center justify-center p-0 cursor-pointer select-none',
                    'filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]',
                    'hover:scale-110 active:scale-95 transition-transform duration-150',
                    pulsing && 'gi-gear-pulse'
                )}
            >
                <img
                    src="/assets/ui/ui_gear.png"
                    alt={label}
                    className="w-6 h-6 object-contain pointer-events-none"
                    style={{ imageRendering: 'pixelated' }}
                />
            </button>

            <div
                className={cn(
                    'absolute left-0 top-8 w-44 p-1.5 rounded z-40',
                    'bg-black/95 border border-gi-gold/40 text-[10px] leading-tight text-white',
                    'pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150'
                )}
            >
                <div className="font-bold text-gi-gold">
                    {recipe?.name || (isFoundation ? 'Nothing chosen to build' : 'No recipe selected')}
                </div>
                {outputs && <div>Makes {outputs}</div>}
                {inputs && <div className="text-white/70">Needs {inputs}</div>}
                {context && <div className="text-white/70">Beside {context}</div>}
            </div>
        </div>
    );
};

/**
 * DisallowBadge — the red disallow sprite, **top-right** of a Token heroes
 * may not work (FP-35 per-Token disallow, FB-33). Always shown. It replaced the
 * dim ⊘ that sat bottom-left (FPP-8).
 */
export const DisallowBadge = ({ isDragging }) => {
    if (isDragging) return null;
    return (
        <div
            data-tile-disallowed="true"
            aria-label="Heroes may not work this"
            className="absolute right-1 top-1 z-30 pointer-events-none select-none w-7 h-7 flex items-center justify-center filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
        >
            <img
                src="/assets/ui/ui_disallow_red.png"
                alt="Heroes may not work this"
                className="w-6 h-6 object-contain"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    );
};

/**
 * SpawnerCountBadge — a spawner's live family count against its cap, `3/5`,
 * bottom-left (FB-5). Plain on purpose: brief B1 turns it into a ring badge in
 * a row under the Token.
 */
export const SpawnerCountBadge = ({ text, isDragging }) => {
    if (!text || isDragging) return null;
    return (
        <div
            data-spawner-count={text}
            aria-label={`${text} spawned`}
            className={cn(
                'absolute left-1.5 bottom-1.5 z-30 pointer-events-none select-none',
                'flex items-center justify-center px-1.5 py-0.5 rounded',
                'bg-black/90 border border-gi-gold/50',
                'text-gi-gold font-mono text-[10px] font-bold tabular-nums leading-none tracking-tight'
            )}
        >
            {text}
        </div>
    );
};

/** How often the turn countdown re-reads its clock (ms). */
export const TURN_COUNTDOWN_REFRESH_MS = 250;

/**
 * TurnCountdownBadge — time to a turning Token's next roll, `0:34`,
 * bottom-left (FB-14, TL-12). Shown on a Coast (its next chance to turn) and
 * on the Shrimp Coast it became (its next chance to turn back). Plain on
 * purpose, like the spawner count it shares the corner with (a Token cannot
 * both spawn and turn): brief B1 turns it into a ring badge.
 *
 * The clock runs on game time (the engine's `delta`), so the badge polls it
 * rather than keeping its own: `read()` returns `TimedChanges.nextTurnRoll`
 * for this Token, `{ inMs, chance, back }`, or null.
 */
export const TurnCountdownBadge = ({ read, isDragging }) => {
    const [roll, setRoll] = useState(() => read?.() ?? null);
    useEffect(() => {
        if (!read) return undefined;
        const timer = setInterval(() => setRoll(read() ?? null), TURN_COUNTDOWN_REFRESH_MS);
        return () => clearInterval(timer);
    }, [read]);

    const text = roll ? turnCountdownText(roll.inMs) : null;
    if (!text || isDragging) return null;
    const what = roll.back ? 'turn back' : 'turn';
    return (
        <div
            data-turn-countdown={text}
            aria-label={`Next chance to ${what} in ${text} (${roll.chance}%)`}
            className={cn(
                'absolute left-1.5 bottom-1.5 z-30 pointer-events-none select-none',
                'flex items-center justify-center px-1.5 py-0.5 rounded',
                'bg-black/90 border border-sky-300/50',
                'text-sky-200 font-mono text-[10px] font-bold tabular-nums leading-none tracking-tight'
            )}
        >
            {text}
        </div>
    );
};

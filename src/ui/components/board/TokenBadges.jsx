import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useTokenEvent } from './tokenEvents.js';
import { inputSummary, outputSummary, contextSummary } from './StationRecipeModal.jsx';

/**
 * The small things drawn on a Token besides its ring bubbles: its name above the box, and the
 * recipe gear and the disallow mark, which sit in the middle row of bubbles (`TokenBubbles`
 * places them).
 * A Token is a circle at a point, so what these badges are about is its **instance id**, and
 * everything they need to draw arrives as a prop from `MatToken`, which already reads the
 * Token's details by id. Only the charge floater still listens for itself, because a `-1` is a
 * moment rather than a state.
 */

/**
 * TokenChargeDeltaFloater: floating numbers (-1, +50) when this Token's charges change.
 * `anchor="ring"`: just above the charges ring it is drawn inside; `"corner"`: the Token's
 * bottom-right, when no charges ring shows.
 */
export const TokenChargeDeltaFloater = ({ instanceId, anchor = 'corner' }) => {
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
            data-charge-floater={anchor}
            className={cn(
                "absolute z-40 pointer-events-none",
                anchor === 'ring' ? "left-1/2 bottom-full mb-1" : "right-1.5 bottom-3.5",
                "transition-all duration-150 ease-out"
            )}
        >
            {/**
             * Each number rises and fades by a CSS animation (`gi-charge-float`, tailwind.css)
             * on the compositor, not on framer-motion's JavaScript frame loop. Same 3 s curve.
             */}
            {deltas.map(d => (
                <div
                    key={d.id}
                    className={cn(
                        "gi-charge-float",
                        anchor === 'ring' ? "absolute left-0 bottom-0 -translate-x-1/2" : "absolute right-0 bottom-0",
                        "font-mono font-bold text-[12px] tabular-nums leading-none tracking-tight pointer-events-none select-none drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] whitespace-nowrap",
                        d.delta > 0 ? "text-emerald-300" : "text-amber-200"
                    )}
                    style={{
                        textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000'
                    }}
                >
                    {d.delta > 0 ? `+${d.delta.toLocaleString()}` : (d.delta < 0 ? `-${Math.abs(d.delta).toLocaleString()}` : `${d.delta}`)}
                </div>
            ))}
        </div>
    );
};

/**
 * TokenNameBadge: the Token's name on hover, centred just above the Token's box so it never
 * covers a bubble. `lift` raises it further (mat units) when bubbles hang off the box's top
 * (a small Token's timer).
 */
export const TokenNameBadge = ({ name, isDragging, isHovered, lift = 0 }) => {
    if (!name || isDragging) return null;

    // A full-width flex row centres the label without a `transform`: a transform on every
    // Token of a busy mat costs more in compositing than it saves.
    return (
        <div
            data-token-name="true"
            className={cn(
                "absolute left-0 right-0 z-30 pointer-events-none",
                "flex items-end justify-center text-center select-none",
                "transition-opacity ease-out",
                isHovered ? "opacity-100 duration-500 delay-[1200ms]" : "opacity-0 duration-150 delay-0"
            )}
            style={{ bottom: `calc(100% + ${4 + lift}px)` }}
        >
            <span
                className="w-max max-w-[240px] shrink-0 text-[10px] font-bold text-white leading-tight tracking-tight px-1 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]"
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
 * StationGearBadge: the recipe picker's handle, in the middle row of a Token that has something
 * to choose: a Foundation, or a station whose pool is not empty (`centreAlert.gearStateOf`
 * decides; `TokenBubbles` decides when it shows).
 * While nothing is chosen it **pulses gently** and that is all, with no red alert: the Token is
 * waiting, not broken, and heroes pass it over until the player picks. Once a recipe is chosen
 * it is still, so the player can change it.
 * Hovering previews the selected recipe: outputs first, then what it consumes.
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
            className="relative shrink-0 group pointer-events-auto"
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
 * DisallowBadge: the red disallow sprite, in the middle row of a Token heroes may not work.
 * Shown the whole time it is disallowed. It takes pointer events so its tooltip and a press
 * (which grabs the Token) work; `TokenBubbles` puts it in the row.
 */
export const DisallowBadge = ({ isDragging }) => {
    if (isDragging) return null;
    return (
        <div
            data-tile-disallowed="true"
            aria-label="Heroes may not work this"
            className="shrink-0 select-none w-7 h-7 flex items-center justify-center filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
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
 * StuckBadge: the warning mark in the middle row of a spawner that cannot spawn: yellow while
 * it waits on an item, red when there is no room. `TokenBubbles` shows it the whole time.
 */
export const StuckBadge = ({ noRoom = false, title }) => (
    <div
        data-stuck-badge={noRoom ? 'no_room' : 'needs_item'}
        aria-label={title}
        className="shrink-0 select-none w-7 h-7 flex items-center justify-center filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
    >
        <img
            src={noRoom ? '/assets/ui/ui_alert_red.png' : '/assets/ui/ui_alert_yellow.png'}
            alt={title}
            className="w-6 h-6 object-contain"
            style={{ imageRendering: 'pixelated' }}
        />
    </div>
);

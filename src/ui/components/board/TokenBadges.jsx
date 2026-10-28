import React, { memo, useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useTokenEvent } from './tokenEvents.js';
import { inputSummary, outputSummary, contextSummary } from './recipeText.js';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { getSkill, DEMOLITION_SKILL_ID } from '../../../config/registries/skillRegistry.js';
import { RING_D_U } from './ringRow.js';
import { Tooltip } from '../base/Tooltip.jsx';

/**
 * The small things drawn on a Token besides its ring bubbles: its name above the box, the -1
 * floater, and the recipe gear, the disallow mark and the demolition mark, which sit in the
 * middle row (`TokenBubbles` places them).
 * A Token is a circle at a point, so what these badges are about is its **instance id**, and
 * everything they need to draw arrives as a prop from `MatToken`, which already reads the
 * Token's details by id. Only the charge floater still listens for itself, because a `-1` is a
 * moment rather than a state.
 */

const NAME_STYLE = Object.freeze({ textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000' });
const FLOATER_STYLE = Object.freeze({ textShadow: '0 1px 2px #000, 0 0 3px #000, 0 0 1px #000' });
const FLOATER_AT_REST_STYLE = Object.freeze({ ...FLOATER_STYLE, willChange: 'contents' });

/**
 * ⚠️ The -1 / +50 floaters are switched off: a worked Token's charges count down on its work plate
 * instead. Kept, not deleted, because they also told of charges changing with no hero at work: a
 * Token restocked by dropping a copy on it (its "Restocked" callout still says so), a Tool Rack or
 * anvil worn by the station beside it, a Token refilled after resting, an enemy's charge on a kill.
 * Those now change without a number.
 */
export const CHARGE_FLOATERS = false;

/**
 * TokenChargeDeltaFloater: floating numbers (-1, +50) when this Token's charges change.
 * `anchor="ring"`: just above the charges ring's spot, `slot` (`{left, top}` in the Token's box,
 * the spot a ring `RING_D_U` across takes); `"corner"`: the Token's bottom-right, for a Token with
 * no charges. Nothing at all is drawn while no number floats. Memoised: it draws from its own
 * state, not from its Token's redraws.
 * ⚠️ `atRest` (no hero works the Token): the rise runs on the main thread, since among the resting
 * Tokens a compositor animation redrew every Token in front of it soft (tailwind.css, at
 * `.gi-token-land`). A worked Token is drawn in front of every resting one, so its -1, the usual
 * one, stays on the compositor: on the main thread the -1s alone cost a third more frame work.
 */
export const TokenChargeDeltaFloater = memo(function TokenChargeDeltaFloater({ instanceId, anchor = 'corner', atRest = false, slot = null }) {
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

    const floats = (
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
                        "font-bold ui-text-title tabular-nums leading-none tracking-tight pointer-events-none select-none drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] whitespace-nowrap",
                        d.delta > 0 ? "text-emerald-300" : "text-amber-200"
                    )}
                    style={atRest ? FLOATER_AT_REST_STYLE : FLOATER_STYLE}
                >
                    {d.delta > 0 ? `+${d.delta.toLocaleString()}` : (d.delta < 0 ? `-${Math.abs(d.delta).toLocaleString()}` : `${d.delta}`)}
                </div>
            ))}
        </div>
    );
    if (!slot) return floats;
    return (
        <div
            data-bubble-slot="charges"
            className="absolute z-20 pointer-events-none"
            style={{ left: slot.left, top: slot.top, width: RING_D_U, height: RING_D_U }}
        >
            {floats}
        </div>
    );
});

/**
 * TokenNameBadge: a Token's or hero's name once the pointer rests on it (`shown`), centred just
 * below the box (`below`) or just above it, so it never covers a bubble. `offset` moves it further
 * from the box (mat units) past whatever hangs off that edge: a small Token's corner rings, a
 * health bar, a hero's art reaching past its box. Memoised: its Token redraws far more often than
 * any of these change.
 */
export const TokenNameBadge = memo(function TokenNameBadge({ name, isDragging, shown = false, below = false, offset = 0 }) {
    // ⚠️ Not drawn at all until shown, never drawn hidden: the label's drop shadow is a filter
    // Chrome draws on a layer of its own, and every Token drawn after a hidden label then needed
    // a layer too, drawn soft and a pixel off.
    if (!name || isDragging || !shown) return null;

    // A full-width flex row centres the label without a `transform`: a transform on every
    // Token of a busy mat costs more in compositing than it saves.
    return (
        <div
            data-token-name="true"
            className={cn(
                "absolute left-0 right-0 z-30 pointer-events-none",
                "flex justify-center text-center select-none",
                below ? "items-start" : "items-end"
            )}
            style={below ? { top: `calc(100% + ${4 + offset}px)` } : { bottom: `calc(100% + ${4 + offset}px)` }}
        >
            <span
                className="ui-text-small w-max max-w-[240px] shrink-0 font-bold text-white leading-tight tracking-tight px-1 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]"
                style={NAME_STYLE}
            >
                {name}
            </span>
        </div>
    );
});

/**
 * StationGearBadge: the recipe picker's handle, in the middle row of a Token that has something
 * to choose: a Foundation, or a station whose pool is not empty (`centreAlert.gearStateOf`
 * decides; `TokenBubbles` decides when it shows).
 * While nothing is chosen it wears a gold one-art-pixel outline stepping between two golds, and that is all, with no red alert: the Token is
 * waiting, not broken, and heroes pass it over until the player picks. Once a recipe is chosen
 * it is still, so the player can change it.
 * Hovering previews the selected recipe: outputs first, then what it consumes.
 * `artUnit` draws it at its sprite's own pixels times that, filling its button (the 2x gear that
 * stands in a choice's problem mark on hover); without it, the small 24px gear.
 */
// One art pixel of the 32px gear sprite, drawn at 24px in its 28px button (2px inset).
const GEAR_INSET = 2;
const GEAR_ART_PX = 24 / 32;
export const GEAR_SPRITE_PX = 32;
const GEAR_OUTLINE_OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const GEAR_SRC = '/assets/ui/u_gear.png';

/** The gear's shape filled with the alert colour, one art pixel off in one direction. */
const gearOutlineStyle = (dx, dy, inset = GEAR_INSET, artPx = GEAR_ART_PX, size = null) => ({
    left: `${inset + dx * artPx}px`,
    top: `${inset + dy * artPx}px`,
    ...(size ? { width: size, height: size } : null),
    maskImage: `url("${GEAR_SRC}")`,
    WebkitMaskImage: `url("${GEAR_SRC}")`,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    imageRendering: 'pixelated'
});

export const StationGearBadge = ({ isDragging, recipe, pulsing = false, isFoundation = false, isField = false, onClick, artUnit = null }) => {
    if (isDragging) return null;
    const big = artUnit ? GEAR_SPRITE_PX * artUnit : null;
    const outline = (dx, dy) => (big ? gearOutlineStyle(dx, dy, 0, artUnit, big) : gearOutlineStyle(dx, dy));

    const outputs = outputSummary(recipe);
    const inputs = inputSummary(recipe);
    const context = contextSummary(recipe);
    const label = isFoundation ? 'Choose what to build' : isField ? 'Choose crop' : 'Choose recipe';

    const title = recipe?.name || (isFoundation ? 'Nothing chosen to build' : isField ? 'No crop picked' : 'No recipe selected');
    // A crop's inputs are its seed, paid once per sowing rather than per harvest.
    const preview = (outputs || inputs || context) ? (
        <>
            {outputs && <div>Makes {outputs}</div>}
            {inputs && <div className="text-white/70">{isField ? 'Sown for' : 'Needs'} {inputs}</div>}
            {context && <div className="text-white/70">Beside {context}</div>}
        </>
    ) : null;

    // ⚠️ The shared tooltip, portalled out of the mat: a box drawn inside the Token sat under the
    // work plate's layer.
    return (
        <Tooltip title={title} content={preview}>
            <div
                data-station-gear={pulsing ? 'unset' : 'set'}
                className="relative shrink-0 pointer-events-auto"
            >
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
                    aria-label={label}
                    data-gear-px={big || undefined}
                    style={big ? { width: big, height: big } : undefined}
                    className={cn(
                        !big && 'w-7 h-7',
                        'flex items-center justify-center p-0 cursor-pointer select-none',
                        'filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]',
                        'group/gear',
                        pulsing && 'relative'
                    )}
                >
                    {pulsing && GEAR_OUTLINE_OFFSETS.map(([dx, dy]) => (
                        <span
                            key={`${dx}${dy}`}
                            data-gear-outline=""
                            aria-hidden="true"
                            className={cn('gi-gear-alert absolute pointer-events-none', !big && 'w-6 h-6')}
                            style={outline(dx, dy)}
                        />
                    ))}
                    {!pulsing && GEAR_OUTLINE_OFFSETS.map(([dx, dy]) => (
                        <span
                            key={`h${dx}${dy}`}
                            data-gear-hover-outline=""
                            aria-hidden="true"
                            className={cn('hidden group-hover/gear:block absolute bg-white pointer-events-none', !big && 'w-6 h-6')}
                            style={outline(dx, dy)}
                        />
                    ))}
                    <img
                        src={GEAR_SRC}
                        alt={label}
                        className={cn('relative object-contain pointer-events-none', !big && 'w-6 h-6')}
                        style={big ? { width: big, height: big, imageRendering: 'pixelated' } : { imageRendering: 'pixelated' }}
                    />
                </button>
            </div>
        </Tooltip>
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
                src="/assets/ui/u_disallow_red.png"
                alt="Heroes may not work this"
                className="w-6 h-6 object-contain"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    );
};

/**
 * MarkedBadge: the Construction icon in the middle row of a Token marked for demolition, the whole
 * time it is marked: it is Construction work now, whatever it was.
 */
export const MarkedBadge = ({ title }) => (
    <div
        data-demolish-badge="true"
        aria-label={title}
        className="shrink-0 select-none w-7 h-7 flex items-center justify-center rounded-full bg-black/70 border border-gi-warning/80 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
    >
        <SkillIcon skill={getSkill(DEMOLITION_SKILL_ID)} skillId={DEMOLITION_SKILL_ID} size={16} />
    </div>
);

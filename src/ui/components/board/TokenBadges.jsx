import { memo } from 'react';
import { cn } from '../../utils/cn.js';
import { inputSummary, outputSummary, contextSummary } from './recipeText.js';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { getSkill, DEMOLITION_SKILL_ID } from '../../../config/registries/skillRegistry.js';
import { Tooltip } from '../base/Tooltip.jsx';

/**
 * The small things drawn on a Token besides its ring bubbles: its name above the box, and the
 * recipe gear and the demolition mark, which sit in the middle row (`TokenBubbles` places them).
 * A Token is a circle at a point, so what these badges are about is its **instance id**, and
 * everything they need to draw arrives as a prop from `MatToken`, which already reads the
 * Token's details by id.
 */

/**
 * TokenNameBadge: a Token's or hero's name once the pointer rests on it (`shown`), centred.
 * `foot` (mat units down from the box's top) stands the name's bottom on that line: a Token's
 * name sits over its art's bottom edge, on its plate's top (`plateFootOf`). Otherwise just below
 * the box (`below`) or just above it, `offset` further out past whatever hangs off that edge: a
 * health bar, a hero's art reaching past its box. Memoised: its Token redraws far more often than
 * any of these change.
 */
export const TokenNameBadge = memo(function TokenNameBadge({ name, isDragging, shown = false, below = false, offset = 0, foot = null }) {
    if (!name || isDragging || !shown) return null;

    // A full-width flex row centres the label without a `transform`: a transform on every
    // Token of a busy mat costs more in compositing than it saves.
    return (
        <div
            data-token-name="true"
            className={cn(
                "absolute left-0 right-0 z-30 pointer-events-none",
                "flex justify-center text-center select-none",
                below && foot == null ? "items-start" : "items-end"
            )}
            style={foot != null
                ? { top: 0, height: foot }
                : below ? { top: `calc(100% + ${4 + offset}px)` } : { bottom: `calc(100% + ${4 + offset}px)` }}
        >
            <span
                className="ui-text-small w-max max-w-[240px] shrink-0 font-bold text-white leading-tight tracking-tight px-1">
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
 * `px` draws it that many mat units across, filling its button: on a Token, every gear is the
 * problem mark's size (`problemMark.tokenGearPx`). Without it, the small 24px gear (the style sheet).
 */
// One art pixel of the 32px gear sprite, drawn at 24px in its 28px button (2px inset).
const GEAR_INSET = 2;
export const GEAR_SPRITE_PX = 32;
const GEAR_ART_PX = 24 / GEAR_SPRITE_PX;

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

export const StationGearBadge = ({ isDragging, recipe, pulsing = false, isFoundation = false, isField = false, onClick, px = null }) => {
    if (isDragging) return null;
    const big = px || null;
    const outline = (dx, dy) => (big ? gearOutlineStyle(dx, dy, 0, big / GEAR_SPRITE_PX, big) : gearOutlineStyle(dx, dy));

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
                        'drop-shadow-[2px_2px_0_#000]',
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
 * MarkedBadge: the Construction icon in the middle row of a Token marked for demolition, the whole
 * time it is marked: it is Construction work now, whatever it was.
 */
export const MarkedBadge = ({ title }) => (
    <div
        data-demolish-badge="true"
        aria-label={title}
        className="shrink-0 select-none w-7 h-7 flex items-center justify-center rounded-full bg-black/70 border border-gi-warning/80 drop-shadow-[2px_2px_0_#000]"
    >
        <SkillIcon skill={getSkill(DEMOLITION_SKILL_ID)} skillId={DEMOLITION_SKILL_ID} size={16} />
    </div>
);

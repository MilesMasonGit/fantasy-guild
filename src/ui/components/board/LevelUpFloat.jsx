import { memo, useState } from 'react';
import { skillArt } from '../base/SkillIcon.jsx';
import { useSpriteFxVersion, shadowLayer, layerStyle } from '../../utils/spriteFx.js';
import { FLOAT_MS, FLASH_MS, FADE_MS, rollValues, rollMs } from './levelUpFloats.js';

/** Skill icons are 16 art pixels; on the mat they draw at the heroes' art scale (2× at 1:1). */
const ICON_ART_PX = 16;

/** Stepped frames per number the roll passes, so it moves in visible jumps, never smoothly. */
const ROLL_FRAMES_PER_VALUE = 8;

/**
 * One levelled skill over a hero's head: its icon and its level, free of any frame. The old
 * level flashes a gold outline, then rolls up like an odometer to the new one; at the end of
 * its time it fades. Every step is a CSS animation that starts when the float is first drawn,
 * so nothing here re-renders while it plays.
 * `unit` is one art pixel in mat units (`boardScaleAt`), `fit` the mat's fit, for the icon's
 * hard shadow.
 */
const LevelUpFloat = memo(function LevelUpFloat({ f, unit, fit }) {
    useSpriteFxVersion();
    const [shownAt] = useState(() => Date.now());
    const values = rollValues(f.from, f.to);
    const rolls = values.length > 1;
    const roll = rollMs(values);
    const fadeDelay = Math.max(0, f.at + FLOAT_MS - FADE_MS - shownAt);

    const { spritePath, def } = skillArt(f.skillId || f.skillName);
    const iconPx = ICON_ART_PX * unit;
    const src = spritePath ? (spritePath.startsWith('/') ? spritePath : `/${spritePath}`) : null;
    const shadow = src ? shadowLayer(src, iconPx, fit) : null;

    return (
        <div
            data-level-float={f.key}
            data-level-from={f.from}
            data-level-to={f.to}
            className="gi-lvl-float flex items-center"
            style={{
                gap: unit * 2,
                '--lvl-u': `${unit}px`,
                animationDelay: `${fadeDelay}ms`,
                animationDuration: `${FADE_MS}ms`
            }}
        >
            <span className="relative inline-block shrink-0" style={{ width: iconPx, height: iconPx }}>
                {shadow && <span aria-hidden="true" style={layerStyle(shadow.url, shadow.offset, shadow.offset, iconPx, iconPx)} />}
                {src ? (
                    <img
                        src={src}
                        alt={f.skillName}
                        draggable={false}
                        style={{ position: 'relative', width: iconPx, height: iconPx, maxWidth: 'none', imageRendering: 'pixelated' }}
                    />
                ) : (
                    <span className="relative flex items-center justify-center w-full h-full leading-none" style={{ fontSize: iconPx * 0.7 }}>
                        {def?.icon || '✨'}
                    </span>
                )}
            </span>
            <span data-level-window className="gi-lvl-window ui-text-display relative overflow-hidden font-bold text-white">
                <span
                    data-level-roll
                    className={rolls ? 'gi-lvl-roll flex flex-col items-center' : 'flex flex-col items-center'}
                    style={rolls ? {
                        '--lvl-roll-y': `${(-100 * (values.length - 1)) / values.length}%`,
                        animationDuration: `${roll}ms`,
                        animationDelay: `${FLASH_MS}ms`,
                        animationTimingFunction: `steps(${(values.length - 1) * ROLL_FRAMES_PER_VALUE}, end)`
                    } : undefined}
                >
                    {values.map((v, i) => (
                        <span key={i} data-level-value={v} className="gi-lvl-num block">{v}</span>
                    ))}
                </span>
                {rolls && (
                    <span
                        data-level-flash
                        aria-hidden="true"
                        className="gi-lvl-flash gi-lvl-num gi-lvl-gold absolute left-0 right-0 top-0 block text-center"
                        style={{ animationDuration: `${FLASH_MS}ms` }}
                    >
                        {values[0]}
                    </span>
                )}
            </span>
        </div>
    );
});

/** A hero's levelled skills, side by side. */
export const LevelUpFloats = ({ floats, unit, fit }) => (
    <div data-level-floats className="flex items-end justify-center" style={{ gap: unit * 4 }}>
        {floats.map(f => <LevelUpFloat key={`${f.key}:${f.from}`} f={f} unit={unit} fit={fit} />)}
    </div>
);

export default LevelUpFloats;

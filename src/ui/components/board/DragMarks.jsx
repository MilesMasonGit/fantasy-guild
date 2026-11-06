import { memo } from 'react';
import { useHeroHints } from './dragHints.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { skillArt } from '../base/SkillIcon.jsx';
import { useSpriteFxVersion, outlineLayer, layerStyle } from '../../utils/spriteFx.js';

/** A failed mark is drawn darker under its red outline. */
const FAIL_FILTER = 'brightness(0.5)';

/** The outline's fallback for art the outline generator has not drawn (`spriteFx.js`). */
const FALLBACK_RING = { work: 'var(--color-gi-success)', alert: 'rgb(239, 68, 68)' };

const itemSrc = (itemId) => {
    const item = getItem(itemId);
    return item ? resolveSpritePath(item) : null;
};

/**
 * One mark: a sprite at `size`, in the green (`'work'`) or red (`'alert'`) outline or none, darker
 * when it fails, with `label` (the hero's level) on its foot.
 */
function Mark({ src, size, outline = null, label = null, kind, pass }) {
    useSpriteFxVersion();
    if (!src) return null;
    const ring = outline ? outlineLayer(src, size, outline) : null;
    const fallback = outline && !ring ? FALLBACK_RING[outline] : null;
    const shadow = Math.max(1, Math.round(size / 32));
    return (
        <span
            data-drag-mark={kind}
            data-drag-mark-pass={pass === undefined ? undefined : String(pass)}
            className="relative inline-block shrink-0"
            style={{ width: size, height: size, outline: fallback ? `${shadow}px solid ${fallback}` : undefined }}
        >
            {ring && <span aria-hidden="true" style={layerStyle(ring.url, -ring.pad, -ring.pad, size + 2 * ring.pad, size + 2 * ring.pad)} />}
            <img
                src={src}
                alt=""
                draggable={false}
                className="absolute left-0 top-0 select-none"
                style={{
                    width: size,
                    height: size,
                    maxWidth: 'none',
                    imageRendering: 'pixelated',
                    filter: pass === false ? FAIL_FILTER : undefined
                }}
            />
            {label != null && (
                <span
                    data-drag-mark-level
                    className="absolute font-bold leading-none text-white tabular-nums"
                    style={{
                        right: -shadow,
                        bottom: -shadow,
                        fontSize: Math.round((size * 3) / 8)
                    }}
                >
                    {label}
                </span>
            )}
        </span>
    );
}

const ringOf = (pass) => (pass ? 'work' : 'alert');

/**
 * Hero `heroId`'s drag hints (`dragHints.js`) as a row of marks `size` px each, or `fallback`
 * (what usually stands there: an alert, bubbles) while there are none. The caller places the
 * row with `className` and `style`. Draws nothing of its own while no hero is carried.
 */
export const HeroDragMarks = memo(function HeroDragMarks({ heroId, size, className, style, fallback = null }) {
    const marks = useHeroHints(heroId);
    if (!marks) return fallback;
    const gap = Math.max(2, Math.round(size / 8));
    return (
        <div
            data-drag-marks={heroId}
            aria-hidden="true"
            className={className}
            style={{ display: 'flex', alignItems: 'flex-end', gap, pointerEvents: 'none', ...style }}
        >
            {marks.kind === 'hands'
                ? marks.items.map((itemId, i) => <Mark key={`${itemId}:${i}`} kind="hand" src={itemSrc(itemId)} size={size} />)
                : (
                    <>
                        {marks.tool && (
                            <Mark kind="tool" src={itemSrc(marks.tool.itemId)} size={size} outline={ringOf(marks.tool.pass)} pass={marks.tool.pass} />
                        )}
                        <Mark
                            kind="skill"
                            src={skillArt(marks.skill.skillId).spritePath}
                            size={size}
                            outline={ringOf(marks.skill.pass)}
                            pass={marks.skill.pass}
                            label={marks.skill.level}
                        />
                    </>
                )}
        </div>
    );
});

import { memo } from 'react';
import { useHeroHints } from './dragHints.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { skillArt } from '../base/SkillIcon.jsx';
import { boardArtSteps } from '../base/TokenSprite.jsx';
import { useSpriteFxVersion, outlineLayer, layerStyle } from '../../utils/spriteFx.js';

/** Item and skill art are 32 px pictures. */
export const MARK_ART_PX = 32;

/** Off the mat (the hero bar's cards): the art at 1x, one picture pixel to one screen pixel. */
export const MARK_SCREEN_PX = MARK_ART_PX;

/**
 * Screen pixels per picture pixel for a mark on the mat at fit `fit`: half the Tokens' own step,
 * whole, never below 1. At the board's natural 2x (fit 1) the marks are 1x.
 */
export const markArtSteps = (fit = 1) => Math.max(1, Math.floor(boardArtSteps(fit) / 2));

/** A mark's size in MAT UNITS at fit `fit`: through the mat's zoom, exactly `markArtSteps` x 32 screen px. */
export const markMatPx = (fit = 1) => {
    const f = Number.isFinite(fit) && fit > 0 ? fit : 1;
    return (MARK_ART_PX * markArtSteps(f)) / f;
};

/** A failed mark is drawn darker under its red outline. */
export const FAIL_FILTER = 'brightness(0.3)';

/** The outline's fallback for art the outline generator has not drawn (`spriteFx.js`). */
const FALLBACK_RING = { work: 'var(--color-gi-success)', alert: 'rgb(239, 68, 68)' };

const itemSrc = (itemId) => {
    const item = getItem(itemId);
    return item ? resolveSpritePath(item) : null;
};

/** One mark: a sprite at `size`, in the green (`'work'`) or red (`'alert'`) outline or none, darker when it fails. */
function Mark({ src, size, outline = null, kind, pass }) {
    useSpriteFxVersion();
    if (!src) return null;
    const ring = outline ? outlineLayer(src, size, outline) : null;
    const fallback = outline && !ring ? FALLBACK_RING[outline] : null;
    const line = Math.max(1, Math.round(size / MARK_ART_PX));
    return (
        <span
            data-drag-mark={kind}
            data-drag-mark-pass={pass === undefined ? undefined : String(pass)}
            className="relative inline-block shrink-0"
            style={{ width: size, height: size, outline: fallback ? `${line}px solid ${fallback}` : undefined }}
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
        </span>
    );
}

const ringOf = (pass) => (pass ? 'work' : 'alert');

/**
 * Hero `heroId`'s drag hints (`dragHints.js`) as a row of marks `size` px each, or `fallback`
 * (what usually stands there: an alert, bubbles) while there are none. The skill mark is its icon
 * with the hero's level under it. The caller places the row with `className` and `style`. Draws
 * nothing of its own while no hero is carried.
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
            style={{ display: 'flex', alignItems: 'flex-start', gap, pointerEvents: 'none', ...style }}
        >
            {marks.kind === 'hands'
                ? marks.items.map((itemId, i) => <Mark key={`${itemId}:${i}`} kind="hand" src={itemSrc(itemId)} size={size} />)
                : (
                    <>
                        {marks.tool && (
                            <Mark kind="tool" src={itemSrc(marks.tool.itemId)} size={size} outline={ringOf(marks.tool.pass)} pass={marks.tool.pass} />
                        )}
                        <span data-drag-mark-skill className="flex flex-col items-center shrink-0">
                            <Mark
                                kind="skill"
                                src={skillArt(marks.skill.skillId).spritePath}
                                size={size}
                                outline={ringOf(marks.skill.pass)}
                                pass={marks.skill.pass}
                            />
                            <span
                                data-drag-mark-level
                                className="font-bold leading-none text-white tabular-nums"
                                style={{ fontSize: Math.round(size / 2), marginTop: Math.max(1, Math.round(size / 16)) }}
                            >
                                {marks.skill.level}
                            </span>
                        </span>
                    </>
                )}
        </div>
    );
});

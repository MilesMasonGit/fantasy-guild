import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { previewPicture, previewReady } from './mapPreview.js';
import { SCREEN_TEXT } from './atlasScreenText.js';

/**
 * How long a plan must hold before its picture is built: the click's own change (a map in its
 * slot) is painted first, and a quick run of clicks builds one picture, not one each.
 */
export const PREVIEW_SETTLE_MS = 120;

/** Put a picture's bytes on the canvas, as they are. */
function paint(canvas, picture) {
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const image = ctx.createImageData(picture.cols, picture.rows);
    image.data.set(picture.data);
    ctx.putImageData(image, 0, 0);
}

/**
 * The plan drawn as a tiny real map (`mapPreview.js`): one canvas, drawn when the plan or its fit
 * changes (a slot, a reroll) and at no other time, {@link PREVIEW_SETTLE_MS} after it does. The
 * picture before stays, dimmed, while the next one is built.
 *
 * ⚠️ The context is CPU-backed (`willReadFrequently`), as the mat's ground is: no composited layer
 * of its own over the mat.
 *
 * @param {{plan: object, mat: {w: number, h: number}, fit: object}} props  a plan (`Atlas.preview`
 *   or a reroll), the mat it lands on, and their `previewFit`; the same objects while their
 *   numbers hold
 */
export const MapPreview = ({ plan, mat, fit }) => {
    const canvas = useRef(null);
    const [drawn, setDrawn] = useState(null);

    useEffect(() => {
        if (!plan || !fit || !mat) return undefined;
        let live = true;
        const timer = setTimeout(() => {
            previewReady(plan).then(() => {
                if (!live) return;
                const picture = previewPicture(plan, fit, mat);
                paint(canvas.current, picture);
                setDrawn({ plan, tokens: picture.tokens });
            });
        }, PREVIEW_SETTLE_MS);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [plan, mat, fit]);

    const current = drawn?.plan === plan;
    return (
        <canvas
            ref={canvas}
            data-map-preview
            data-preview-seed={plan.seed}
            data-preview-drawn={drawn ? drawn.plan.seed : ''}
            data-preview-tokens={current ? drawn.tokens : ''}
            data-preview-step={fit.step}
            role="img"
            aria-label={SCREEN_TEXT.PREVIEW_LABEL}
            width={fit.cols}
            height={fit.rows}
            className={cn('block', !current && 'opacity-60')}
            style={{ width: fit.width, height: fit.height, imageRendering: 'pixelated' }}
        />
    );
};

export default MapPreview;

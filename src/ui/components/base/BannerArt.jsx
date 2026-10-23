import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { areaBannerSrc, areaBannerLabel } from '../../../config/areaBanners.js';

/** Most banners are drawn 256 px square; a bigger one says so once its picture loads. */
const ASSUMED_ART_PX = 256;

/**
 * The smallest whole multiple of the art that covers a `boxW` × `boxH` box, never below 1: pixel
 * art is never drawn between sizes, so it covers by growing a whole step and is cropped.
 */
export function coverScale(boxW, boxH, artW = ASSUMED_ART_PX, artH = ASSUMED_ART_PX) {
    if (!(artW > 0) || !(artH > 0)) return 1;
    return Math.max(1, Math.ceil(Math.max((boxW || 0) / artW, (boxH || 0) / artH) - 1e-9));
}

/**
 * An area banner filling its box as a backdrop: the picture at a whole multiple of its size,
 * centred and cropped to the box. Place and size it with `className` (it is `absolute inset-0`
 * unless told otherwise); `focusY` (0 top … 1 bottom) picks which band of a tall crop shows.
 * `scale` fixes the whole-number scale instead of the smallest that covers the box.
 */
export const BannerArt = ({ banner, className, focusY = 0.5, scale: fixedScale = null, ...rest }) => {
    const box = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [art, setArt] = useState({ w: ASSUMED_ART_PX, h: ASSUMED_ART_PX });
    const measure = useCallback(() => {
        const el = box.current;
        if (!el) return;
        const w = el.clientWidth;
        const h = el.clientHeight;
        setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    }, []);
    useLayoutEffect(() => {
        measure();
        window.addEventListener('resize', measure);
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (ro && box.current) ro.observe(box.current);
        return () => {
            window.removeEventListener('resize', measure);
            ro?.disconnect();
        };
    }, [measure]);

    const src = areaBannerSrc(banner);
    const scale = fixedScale ?? coverScale(size.w, size.h, art.w, art.h);
    const w = art.w * scale;
    const h = art.h * scale;
    const top = (size.h - h) * Math.min(1, Math.max(0, focusY));
    return (
        <div
            ref={box}
            aria-hidden="true"
            data-banner-art={banner || ''}
            className={cn('absolute inset-0 overflow-hidden pointer-events-none select-none', className)}
            {...rest}
        >
            {src && (
                <img
                    src={src}
                    alt={areaBannerLabel(banner)}
                    draggable={false}
                    data-banner-scale={scale}
                    onLoad={(e) => {
                        const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
                        if (nw > 0 && nh > 0) setArt(prev => (prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }));
                    }}
                    className="absolute"
                    style={{
                        // ⚠️ Inline: a global img rule caps the width at the box and squashes the art.
                        maxWidth: 'none',
                        maxHeight: 'none',
                        width: w,
                        height: h,
                        left: Math.round((size.w - w) / 2),
                        top: Math.round(top),
                        imageRendering: 'pixelated'
                    }}
                />
            )}
        </div>
    );
};

export default BannerArt;

import { cn } from '../../utils/cn.js';

/** The two frame styles (UI_STYLE "Pixel frames"): studs for big docked panels, chamfer for small floating ones. */
export const FRAME_KIND = Object.freeze({ STUDS: 'studs', CHAMFER: 'chamfer' });

/** The frame band in screen px: the pictures' 3-pixel corners drawn at 2×. Content sits this far in. */
export const FRAME_BAND_PX = 6;

/**
 * A pixel frame: the kind's 7×7 nine-slice picture around the content (it paints the panel's
 * fill colour too), with a hard black shadow 2 art pixels down-right, like a carried Token's.
 *
 * Any panel can wear one: `className`, `style` and other props go on the outer box (place and
 * size it there); `frameClassName` and `frameStyle` go on the framed box that holds the children
 * (lay the content out there). The frame looks come from the shared classes in `tailwind.css`
 * (`ui-frame-studs`, `ui-frame-chamfer` and their `ui-frame-shadow-*` copies).
 *
 * ⚠️ The shadow sits 4 px outside the box, down and right: a parent that hides its overflow
 * clips it.
 *
 * @param {{ kind?: 'studs'|'chamfer', className?: string, frameClassName?: string,
 *   frameStyle?: object, children?: React.ReactNode }} props
 */
export const PixelFrame = ({ kind = FRAME_KIND.CHAMFER, className, frameClassName, frameStyle, children, ...rest }) => (
    <div className={cn('relative isolate', className)} data-pixel-frame={kind} {...rest}>
        <div aria-hidden="true" data-pixel-frame-shadow className={`ui-frame-shadow-${kind} absolute inset-0 -z-10 pointer-events-none`} />
        <div className={cn(`ui-frame-${kind} relative h-full`, frameClassName)} style={frameStyle}>
            {children}
        </div>
    </div>
);

export default PixelFrame;

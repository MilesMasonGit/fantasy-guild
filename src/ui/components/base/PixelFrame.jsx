import { cn } from '../../utils/cn.js';
import { panelBackdropStyle } from './panelBackdrop.js';

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
 * A full panel (Bank, Shop, a world panel, Settings...) names its `backdrop`, a tone from
 * `PANEL_TONES` (`panelBackdrop.js`): its coloured pixel bands then lie over the frame's dark fill,
 * under the content. Small floating pieces (tooltips, bubbles, buttons) have none.
 *
 * ⚠️ The shadow sits 4 px outside the box, down and right: a parent that hides its overflow
 * clips it.
 *
 * @param {{ kind?: 'studs'|'chamfer', backdrop?: string, className?: string, frameClassName?: string,
 *   frameStyle?: object, children?: React.ReactNode }} props
 */
export const PixelFrame = ({ kind = FRAME_KIND.CHAMFER, backdrop = null, className, frameClassName, frameStyle, children, ...rest }) => {
    const backdropStyle = backdrop ? panelBackdropStyle(backdrop) : null;
    return (
        <div className={cn('relative isolate', className)} data-pixel-frame={kind} {...rest}>
            <div aria-hidden="true" data-pixel-frame-shadow className={`ui-frame-shadow-${kind} absolute inset-0 -z-10 pointer-events-none`} />
            {/* ⚠️ `isolate` on the framed box: the backdrop's negative layer then paints over the
                frame's fill and under the content, never under the frame. */}
            <div className={cn(`ui-frame-${kind} relative h-full`, backdropStyle && 'isolate', frameClassName)} style={frameStyle}>
                {backdropStyle && (
                    <div aria-hidden="true" data-panel-backdrop={backdrop} className="absolute inset-0 -z-10 pointer-events-none" style={backdropStyle} />
                )}
                {children}
            </div>
        </div>
    );
};

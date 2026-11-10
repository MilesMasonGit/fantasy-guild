import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { PixelFrame, FRAME_KIND } from './PixelFrame.jsx';
import { NOTIFICATION_COLUMN, columnWidthCss } from '../board/boardConstants.js';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';

/** The drawers' slide: the Bank drawer's own duration and easing, so the two arrive together. */
export const SIDE_DRAWER_TRANSITION = Object.freeze({ duration: 0.25, ease: [0.16, 1, 0.3, 1] });

/** Which screen edge the side drawer stands on: the one away from the nav. */
export const sideDrawerEdge = (menuRight) => (menuRight ? 'left' : 'right');

/**
 * The one side drawer for inspecting the world, items and upgrades: flush to the screen's edge on
 * the side away from the nav (the Menu on Right Side setting flips it), the full height, the hero
 * column's width (`NOTIFICATION_COLUMN`), in the studs frame with the screen's backdrop. It slides
 * in from its edge as it opens and out as it closes.
 *
 * The shell holds no header and no X: what it shows decides (the Item drawer has none, it opens
 * and closes with the Bank). Lay the content out in a column: the framed box is `flex flex-col`
 * with its overflow hidden, so a long body scrolls in an `ArrowScrollList` of its own.
 *
 * ⚠️ `absolute inset-y-0`: mount it in the screen-wide overlay (ReactRoot's table, beside the Bank
 * drawer), not inside a camera's moving side, or it measures from the wrong box.
 *
 * @param {{ open: boolean, menuRight?: boolean, backdrop: string, label: string,
 *   frameClassName?: string, className?: string, children?: React.ReactNode }} props
 *   `backdrop` is a tone from `PANEL_TONES` (bank, world, hall...); `frameClassName` goes on the
 *   framed box (the Hall's purple frame: `ui-frame-studs-purple`); other props (`data-*`) go on
 *   the drawer's own box.
 */
export const SideDrawer = ({ open, menuRight = false, backdrop, label, frameClassName, className, children, ...rest }) => {
    const edge = sideDrawerEdge(menuRight);
    const offset = edge === 'left' ? '-100%' : '100%';
    return (
        <AnimatePresence>
            {open && (
                <motion.aside
                    key="side-drawer"
                    data-side-drawer={edge}
                    aria-label={label}
                    initial={{ x: offset }}
                    animate={{ x: 0 }}
                    exit={{ x: offset }}
                    transition={prefersReducedMotion() ? { duration: 0 } : SIDE_DRAWER_TRANSITION}
                    // ⚠️ The drawer layer: under the nav and the hero bar, over the mat (tailwind.css, the layers table).
                    className={cn(
                        'pointer-events-auto absolute inset-y-0 z-(--z-drawer)',
                        edge === 'left' ? 'left-0' : 'right-0',
                        className
                    )}
                    style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                    {...rest}
                >
                    <PixelFrame
                        kind={FRAME_KIND.STUDS}
                        backdrop={backdrop}
                        className="h-full"
                        frameClassName={cn('flex flex-col overflow-hidden', frameClassName)}
                    >
                        {children}
                    </PixelFrame>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

export default SideDrawer;

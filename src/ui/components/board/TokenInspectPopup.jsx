import { useRef, useLayoutEffect, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import TokenInspection from '../drawer/TokenInspection.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useTokenEvent } from './tokenEvents.js';

/**
 * The Token sheet, floating beside the Token it is about.
 * It follows the Token, not a remembered rectangle. On the mat a Token moves: it is pushed by
 * a 2×2 cascade, or dragged somewhere else, and the popup has to come along or it ends up
 * pointing at bare mat. So the anchor is looked up live by **instance id**
 * (`[data-token-id]`), and re-measured whenever something happens to that Token: once straight
 * away, and once more after the CSS move has finished, because a Token slides to its new point
 * over 220ms and measuring mid-slide would anchor to where it was passing through.
 */

/** How far an arrow press scrolls the sheet. */
const POPUP_SCROLL_STEP_PX = 140;

/** Long enough for `MatToken`'s left/top transition to have settled. */
const MOVE_SETTLE_MS = 280;

/** Where the tail sits for each side the popup opens on, and which two edges carry its border. */
const TAIL_CLASS = {
    top: '-bottom-[6px] -translate-x-1/2 border-r border-b',
    bottom: '-top-[6px] -translate-x-1/2 border-l border-t',
    right: '-left-[6px] -translate-y-1/2 border-l border-b',
    left: '-right-[6px] -translate-y-1/2 border-r border-t'
};

export const TokenInspectPopup = ({ typeId, instanceId = null, anchorRect, onClose }) => {
    const popupRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, dir: 'top', tailOffset: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [targetRect, setTargetRect] = useState(anchorRect || null);

    /** Where the Token is on screen right now, falling back to where it was. */
    const measure = useCallback(() => {
        const el = instanceId && typeof document !== 'undefined'
            ? document.querySelector(`[data-token-id="${instanceId}"]`)
            : null;
        setTargetRect(el ? el.getBoundingClientRect() : (anchorRect || null));
    }, [instanceId, anchorRect]);

    useLayoutEffect(() => { measure(); }, [measure]);

    // The Token moved, was replaced, or ran dry: re-anchor to wherever it is.
    useTokenEvent(BOARD_EVENTS.TILE_CHANGED, instanceId, () => {
        measure();
        setTimeout(measure, MOVE_SETTLE_MS);
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [measure]);

    useLayoutEffect(() => {
        if (!targetRect || !popupRef.current) return;

        const popupEl = popupRef.current;
        const popupW = popupEl.offsetWidth || 288;
        const popupH = popupEl.offsetHeight || 320;

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const margin = 12;
        const tailGap = 10;

        const spaceTop = targetRect.top - margin;
        const spaceBottom = viewportH - targetRect.bottom - margin;
        const spaceRight = viewportW - targetRect.right - margin;
        const spaceLeft = targetRect.left - margin;

        // Favour top -> bottom, then right -> left
        let dir = 'top';
        if (spaceTop >= popupH + tailGap) {
            dir = 'top';
        } else if (spaceBottom >= popupH + tailGap) {
            dir = 'bottom';
        } else if (spaceRight >= popupW + tailGap && spaceRight >= spaceLeft) {
            dir = 'right';
        } else if (spaceLeft >= popupW + tailGap) {
            dir = 'left';
        } else {
            // Fallback to whichever vertical side has more room
            dir = spaceTop >= spaceBottom ? 'top' : 'bottom';
        }

        let top = 0;
        let left = 0;
        let tailOffset = 0;

        const tokenCenterX = targetRect.left + targetRect.width / 2;
        const tokenCenterY = targetRect.top + targetRect.height / 2;

        if (dir === 'top') {
            top = Math.max(margin, targetRect.top - tailGap - popupH);
            const idealLeft = tokenCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
            tailOffset = Math.max(16, Math.min(popupW - 16, tokenCenterX - left));
        } else if (dir === 'bottom') {
            top = Math.min(viewportH - margin - popupH, targetRect.bottom + tailGap);
            const idealLeft = tokenCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
            tailOffset = Math.max(16, Math.min(popupW - 16, tokenCenterX - left));
        } else if (dir === 'right') {
            left = Math.min(viewportW - margin - popupW, targetRect.right + tailGap);
            const idealTop = tokenCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
            tailOffset = Math.max(16, Math.min(popupH - 16, tokenCenterY - top));
        } else if (dir === 'left') {
            left = Math.max(margin, targetRect.left - tailGap - popupW);
            const idealTop = tokenCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
            tailOffset = Math.max(16, Math.min(popupH - 16, tokenCenterY - top));
        }

        // Whole pixels: a fractional position blurs the pixel-art icons inside.
        setCoords({ top: Math.round(top), left: Math.round(left), dir, tailOffset: Math.round(tailOffset) });
        requestAnimationFrame(() => setIsVisible(true));
    }, [targetRect, typeId]);

    useEffect(() => {
        const handleGlobalClick = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                // Clicking another Token just moves the inspection to it.
                const onToken = e.target.closest('[data-token-id]');
                if (!onToken) {
                    onClose();
                }
            }
        };

        const timer = setTimeout(() => window.addEventListener('click', handleGlobalClick), 50);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleGlobalClick);
        };
    }, [onClose]);

    const originClass = {
        top: 'origin-bottom',
        bottom: 'origin-top',
        right: 'origin-left',
        left: 'origin-right'
    }[coords.dir] || 'origin-bottom';

    return (
        <div
            ref={popupRef}
            className={cn(
                "fixed z-[80] w-72 border border-yellow-500/70 bg-yellow-950/95 shadow-lg rounded-md flex flex-col",
                "transition-all duration-200 ease-out",
                originClass,
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
            )}
            style={{
                top: coords.top,
                left: coords.left
            }}
        >
            <div className="w-full flex-1 flex flex-col overflow-hidden rounded-md">
                <ArrowScrollList step={POPUP_SCROLL_STEP_PX} compact className="max-h-[75vh]">
                    <TokenInspection typeId={typeId} instanceId={instanceId} hideSprite={true} showSell={false} />
                </ArrowScrollList>
            </div>

            {/* The tail is the speech bubbles' own: a small turned square on the edge facing
                the Token, its two outer edges carrying the border. */}
            <div
                data-inspect-tail={coords.dir}
                className={cn(
                    "absolute z-10 w-2.5 h-2.5 rotate-45 border-yellow-500/70 bg-yellow-950 pointer-events-none",
                    TAIL_CLASS[coords.dir]
                )}
                style={coords.dir === 'top' || coords.dir === 'bottom'
                    ? { left: coords.tailOffset }
                    : { top: coords.tailOffset }}
            />
        </div>
    );
};

export default TokenInspectPopup;

import { useRef, useLayoutEffect, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { TokenCard, CARD_ART_PX } from './TokenCard.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { PixelFrame, FRAME_KIND, FRAME_BAND_PX } from '../base/PixelFrame.jsx';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useTokenEvent } from './tokenEvents.js';

/**
 * The Token card, floating beside the Token it is about. One at a time: clicking another Token
 * moves it there, clicking bare mat or pressing Escape closes it.
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

/** The card inside its chamfer frame. */
const POPUP_W = CARD_ART_PX + 2 * FRAME_BAND_PX;

export const TokenInspectPopup = ({ typeId, instanceId = null, anchorRect, onClose }) => {
    const popupRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, dir: 'top' });
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
        const popupW = popupEl.offsetWidth || POPUP_W;
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

        const tokenCenterX = targetRect.left + targetRect.width / 2;
        const tokenCenterY = targetRect.top + targetRect.height / 2;

        if (dir === 'top') {
            top = Math.max(margin, targetRect.top - tailGap - popupH);
            const idealLeft = tokenCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
        } else if (dir === 'bottom') {
            top = Math.min(viewportH - margin - popupH, targetRect.bottom + tailGap);
            const idealLeft = tokenCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
        } else if (dir === 'right') {
            left = Math.min(viewportW - margin - popupW, targetRect.right + tailGap);
            const idealTop = tokenCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
        } else if (dir === 'left') {
            left = Math.max(margin, targetRect.left - tailGap - popupW);
            const idealTop = tokenCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
        }

        // Whole pixels: a fractional position blurs the pixel-art icons inside.
        setCoords({ top: Math.round(top), left: Math.round(left), dir });
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

        // One Escape, one layer: while a drag is live, Escape only cancels it.
        const handleKey = (e) => {
            if (e.key === 'Escape' && !document.body.classList.contains('gi-dnd-active')) onClose();
        };

        const timer = setTimeout(() => window.addEventListener('click', handleGlobalClick), 50);
        window.addEventListener('keydown', handleKey);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleGlobalClick);
            window.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    return (
        <div
            ref={popupRef}
            data-token-card-popup={coords.dir}
            className={cn(
                "fixed z-[80] transition-opacity duration-200 ease-out",
                isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{ top: coords.top, left: coords.left, width: POPUP_W }}
        >
            <PixelFrame kind={FRAME_KIND.CHAMFER}>
                <ArrowScrollList step={POPUP_SCROLL_STEP_PX} compact className="max-h-[75vh]">
                    <TokenCard typeId={typeId} instanceId={instanceId} onClose={onClose} />
                </ArrowScrollList>
            </PixelFrame>
        </div>
    );
};

export default TokenInspectPopup;

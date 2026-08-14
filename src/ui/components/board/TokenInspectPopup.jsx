import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import TokenInspection from '../drawer/TokenInspection.jsx';

export const TokenInspectPopup = ({ typeId, anchorRect, onClose }) => {
    const popupRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, dir: 'top', tailOffset: 0 });
    const [isVisible, setIsVisible] = useState(false);

    useLayoutEffect(() => {
        if (!anchorRect || !popupRef.current) return;

        const popupEl = popupRef.current;
        const popupW = popupEl.offsetWidth || 288;
        const popupH = popupEl.offsetHeight || 320;

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const margin = 12;
        const tailGap = 10;

        const spaceTop = anchorRect.top - margin;
        const spaceBottom = viewportH - anchorRect.bottom - margin;
        const spaceRight = viewportW - anchorRect.right - margin;
        const spaceLeft = anchorRect.left - margin;

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

        const tileCenterX = anchorRect.left + anchorRect.width / 2;
        const tileCenterY = anchorRect.top + anchorRect.height / 2;

        if (dir === 'top') {
            top = Math.max(margin, anchorRect.top - tailGap - popupH);
            const idealLeft = tileCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
            tailOffset = Math.max(16, Math.min(popupW - 16, tileCenterX - left));
        } else if (dir === 'bottom') {
            top = Math.min(viewportH - margin - popupH, anchorRect.bottom + tailGap);
            const idealLeft = tileCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
            tailOffset = Math.max(16, Math.min(popupW - 16, tileCenterX - left));
        } else if (dir === 'right') {
            left = Math.min(viewportW - margin - popupW, anchorRect.right + tailGap);
            const idealTop = tileCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
            tailOffset = Math.max(16, Math.min(popupH - 16, tileCenterY - top));
        } else if (dir === 'left') {
            left = Math.max(margin, anchorRect.left - tailGap - popupW);
            const idealTop = tileCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
            tailOffset = Math.max(16, Math.min(popupH - 16, tileCenterY - top));
        }

        setCoords({ top, left, dir, tailOffset });
        requestAnimationFrame(() => setIsVisible(true));
    }, [anchorRect, typeId]);

    useEffect(() => {
        const handleGlobalClick = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                // Check if clicking another tile to inspect
                const isTile = e.target.closest('[data-tile-index]');
                if (!isTile) {
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
                "fixed z-[9999] w-72 bg-gi-surface border border-gi-border shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-lg",
                "transition-all duration-200 ease-out",
                originClass,
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
            )}
            style={{
                top: coords.top,
                left: coords.left
            }}
        >
            {/* Tail pointing toward the anchor tile */}
            {coords.dir === 'top' && (
                <div 
                    className="absolute bottom-0 translate-y-full -translate-x-1/2 w-0 h-0 border-solid border-t-[8px] border-l-[8px] border-r-[8px] border-b-0 border-t-gi-surface border-l-transparent border-r-transparent"
                    style={{ left: coords.tailOffset }}
                />
            )}
            {coords.dir === 'bottom' && (
                <div 
                    className="absolute top-0 -translate-y-full -translate-x-1/2 w-0 h-0 border-solid border-b-[8px] border-l-[8px] border-r-[8px] border-t-0 border-b-gi-surface border-l-transparent border-r-transparent"
                    style={{ left: coords.tailOffset }}
                />
            )}
            {coords.dir === 'right' && (
                <div 
                    className="absolute left-0 -translate-x-full -translate-y-1/2 w-0 h-0 border-solid border-r-[8px] border-t-[8px] border-b-[8px] border-l-0 border-r-gi-surface border-t-transparent border-b-transparent"
                    style={{ top: coords.tailOffset }}
                />
            )}
            {coords.dir === 'left' && (
                <div 
                    className="absolute right-0 translate-x-full -translate-y-1/2 w-0 h-0 border-solid border-l-[8px] border-t-[8px] border-b-[8px] border-r-0 border-l-gi-surface border-t-transparent border-b-transparent"
                    style={{ top: coords.tailOffset }}
                />
            )}
            
            <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                <TokenInspection typeId={typeId} showSell={false} showAddToTray={false} />
            </div>
        </div>
    );
};

export default TokenInspectPopup;

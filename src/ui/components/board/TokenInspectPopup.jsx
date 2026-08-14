import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { TILE_PX, BOARD_SIZE, BOARD_PX } from './boardConstants.js';
import TokenInspection from '../drawer/TokenInspection.jsx';

export const TokenInspectPopup = ({ typeId, anchorRect, onClose }) => {
    const popupRef = useRef(null);
    const [position, setPosition] = useState({ top: 0, left: 0, align: 'top' });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!anchorRect) return;
        
        // Default position: above the tile, horizontally centered
        const tileCenterY = anchorRect.top;
        const tileCenterX = anchorRect.left + (anchorRect.width / 2);
        
        let top = tileCenterY;
        let left = tileCenterX;
        let align = 'top';

        // We don't have the exact height yet, but we can assume it will fit if top > 300px
        // If top is small, we might clip top edge, so render below the tile instead
        if (top < 300) {
            top = anchorRect.bottom;
            align = 'bottom';
        }

        setPosition({ top, left, align });
        // Trigger transition on next frame
        requestAnimationFrame(() => setIsVisible(true));

        const handleGlobalClick = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                // Check if they clicked a tile to open another popup
                const isTile = e.target.closest('[data-tile-index]');
                if (!isTile) {
                    onClose();
                }
            }
        };

        // Delay adding click listener to avoid immediately closing on the double click that opened it
        setTimeout(() => window.addEventListener('click', handleGlobalClick), 50);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [anchorRect, onClose]);

    const isBottomAlign = position.align === 'bottom';

    return (
        <div
            ref={popupRef}
            className={cn(
                "fixed z-[9999] w-72 bg-gi-surface border border-gi-border shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-lg",
                "transition-all duration-200 ease-out origin-bottom",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
            )}
            style={{
                top: position.top,
                left: position.left,
                transform: `translate(-50%, ${isBottomAlign ? '10px' : 'calc(-100% - 10px)'}) ${isVisible ? 'scale(1)' : 'scale(0.5)'}`,
                transformOrigin: isBottomAlign ? 'top center' : 'bottom center',
            }}
        >
            {/* Tail */}
            <div 
                className={cn(
                    "absolute left-1/2 -translate-x-1/2 w-0 h-0 border-solid",
                    isBottomAlign 
                        ? "top-0 -translate-y-full border-b-[10px] border-l-[10px] border-r-[10px] border-t-0 border-b-gi-surface border-l-transparent border-r-transparent"
                        : "bottom-0 translate-y-full border-t-[10px] border-l-[10px] border-r-[10px] border-b-0 border-t-gi-surface border-l-transparent border-r-transparent"
                )}
            />
            
            <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                <TokenInspection typeId={typeId} />
            </div>
        </div>
    );
};

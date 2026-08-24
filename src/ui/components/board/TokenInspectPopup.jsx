import { useRef, useLayoutEffect, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import TokenInspection from '../drawer/TokenInspection.jsx';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const TokenInspectPopup = ({ typeId, tileIndex, anchorRect, onClose }) => {
    const popupRef = useRef(null);
    const scrollRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, dir: 'top', tailOffset: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 6);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 6);
    }, []);

    useLayoutEffect(() => {
        const targetRect = anchorRect || (tileIndex != null ? document.getElementById(`tile-${tileIndex}`)?.getBoundingClientRect() : null);
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

        const tileCenterX = targetRect.left + targetRect.width / 2;
        const tileCenterY = targetRect.top + targetRect.height / 2;

        if (dir === 'top') {
            top = Math.max(margin, targetRect.top - tailGap - popupH);
            const idealLeft = tileCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
            tailOffset = Math.max(16, Math.min(popupW - 16, tileCenterX - left));
        } else if (dir === 'bottom') {
            top = Math.min(viewportH - margin - popupH, targetRect.bottom + tailGap);
            const idealLeft = tileCenterX - popupW / 2;
            left = Math.max(margin, Math.min(viewportW - margin - popupW, idealLeft));
            tailOffset = Math.max(16, Math.min(popupW - 16, tileCenterX - left));
        } else if (dir === 'right') {
            left = Math.min(viewportW - margin - popupW, targetRect.right + tailGap);
            const idealTop = tileCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
            tailOffset = Math.max(16, Math.min(popupH - 16, tileCenterY - top));
        } else if (dir === 'left') {
            left = Math.max(margin, targetRect.left - tailGap - popupW);
            const idealTop = tileCenterY - popupH / 2;
            top = Math.max(margin, Math.min(viewportH - margin - popupH, idealTop));
            tailOffset = Math.max(16, Math.min(popupH - 16, tileCenterY - top));
        }

        setCoords({ top, left, dir, tailOffset });
        requestAnimationFrame(() => setIsVisible(true));
    }, [anchorRect, tileIndex, typeId]);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll, typeId]);

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

    const scrollUp = () => {
        scrollRef.current?.scrollBy({ top: -140, behavior: 'smooth' });
    };

    const scrollDown = () => {
        scrollRef.current?.scrollBy({ top: 140, behavior: 'smooth' });
    };

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
                "fixed z-[80] w-72 bg-gi-surface border border-gi-border shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-lg flex flex-col",
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
                    className="absolute bottom-0 translate-y-full -translate-x-1/2 w-0 h-0 border-solid border-t-[8px] border-l-[8px] border-r-[8px] border-b-0 border-t-gi-border border-l-transparent border-r-transparent pointer-events-none drop-shadow"
                    style={{ left: coords.tailOffset }}
                />
            )}
            {coords.dir === 'bottom' && (
                <div 
                    className="absolute top-0 -translate-y-full -translate-x-1/2 w-0 h-0 border-solid border-b-[8px] border-l-[8px] border-r-[8px] border-t-0 border-b-gi-border border-l-transparent border-r-transparent pointer-events-none drop-shadow"
                    style={{ left: coords.tailOffset }}
                />
            )}
            {coords.dir === 'right' && (
                <div 
                    className="absolute left-0 -translate-x-full -translate-y-1/2 w-0 h-0 border-solid border-r-[8px] border-t-[8px] border-b-[8px] border-l-0 border-r-gi-border border-t-transparent border-b-transparent pointer-events-none drop-shadow"
                    style={{ top: coords.tailOffset }}
                />
            )}
            {coords.dir === 'left' && (
                <div 
                    className="absolute right-0 translate-x-full -translate-y-1/2 w-0 h-0 border-solid border-l-[8px] border-t-[8px] border-b-[8px] border-r-0 border-l-gi-border border-t-transparent border-b-transparent pointer-events-none drop-shadow"
                    style={{ top: coords.tailOffset }}
                />
            )}
            
            <div className="w-full flex-1 flex flex-col overflow-hidden rounded-lg">
                {/* Flat Scroll Arrow: Top */}
                {canScrollUp && (
                    <button
                        onClick={scrollUp}
                        className="w-full py-1 bg-black/60 hover:bg-black/80 border-b border-white/10 hover:border-gi-gold/40 flex items-center justify-center text-gi-gold transition-colors shrink-0 shadow active:scale-[0.99] cursor-pointer"
                        title="Scroll up"
                    >
                        <ChevronUp size={14} />
                    </button>
                )}

                <div
                    ref={scrollRef}
                    className="max-h-[75vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                    <TokenInspection typeId={typeId} hideSprite={true} showSell={false} showAddToTray={false} />
                </div>

                {/* Flat Scroll Arrow: Bottom */}
                {canScrollDown && (
                    <button
                        onClick={scrollDown}
                        className="w-full py-1 bg-black/60 hover:bg-black/80 border-t border-white/10 hover:border-gi-gold/40 flex items-center justify-center text-gi-gold transition-colors shrink-0 shadow active:scale-[0.99] cursor-pointer"
                        title="Scroll down"
                    >
                        <ChevronDown size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default TokenInspectPopup;

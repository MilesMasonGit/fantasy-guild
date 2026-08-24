import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { cn } from '../../utils/cn.js';

/**
 * On-board floating event alert icon in the top-left corner of a tile.
 * Displays a pop-up text bubble at the top of the tile on hover.
 * When unhovered after inspection, begins a 5s countdown followed by a 3s smooth fadeout.
 * Re-hovering resets the timer and restores 100% opacity.
 *
 * Dismissal behavior:
 * - Moving a token on this tile, placing a new token on this tile, or clicking the icon immediately starts fadeout.
 * - Once dismissed, hovering does not restore the alert.
 */
export const TileEventAlert = ({ tile }) => {
    const [alertData, setAlertData] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isFading, setIsFading] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [iconRect, setIconRect] = useState(null);

    const { activePayload } = useActiveDrag();
    const iconRef = useRef(null);
    const delayTimerRef = useRef(null);
    const fadeTimerRef = useRef(null);

    const dismissAlert = useCallback(() => {
        if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        setIsHovered(false);
        setIsDismissed(true);
        setIsFading(true);
        fadeTimerRef.current = setTimeout(() => {
            setAlertData(null);
            setIsFading(false);
            setIsDismissed(false);
        }, 400);
    }, []);

    useEffect(() => {
        if (!EventBus || tile == null) return;

        const unsub = EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => {
            if (p?.tile !== tile) return;
            // Clear any active fadeout timers
            if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

            setIsDismissed(false);
            setIsFading(false);
            setAlertData(prev => {
                let startLevel = p.startLevel;
                let newLevel = p.newLevel;
                const isHeroLevelUp = p.type === 'hero_level_up' || p.severity === 'upgrade';
                if (isHeroLevelUp && prev && (prev.type === 'hero_level_up' || prev.severity === 'upgrade') && prev.heroId === p.heroId && prev.skillId === p.skillId) {
                    startLevel = prev.startLevel ?? startLevel;
                }
                const message = isHeroLevelUp && p.heroName && p.skillName
                    ? `${p.heroName} leveled up ${p.skillName} ${startLevel}>${newLevel}!`
                    : (p.title || p.message);

                return {
                    severity: p.severity || (p.type === 'token_exhausted' ? 'red' : p.type === 'drop_rejected' ? 'disallow' : isHeroLevelUp ? 'upgrade' : 'yellow'),
                    type: p.type,
                    name: p.name,
                    title: message,
                    rulesText: p.rulesText,
                    message: message,
                    heroId: p.heroId,
                    skillId: p.skillId,
                    heroName: p.heroName,
                    skillName: p.skillName,
                    startLevel,
                    newLevel,
                    iconSrc: p.iconSrc
                };
            });
        });

        const unsubClear = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
            if (p?.tile === tile) {
                // Moving a token or placing a new token on this tile immediately dismisses the alert
                dismissAlert();
            }
        });

        return () => {
            unsub();
            unsubClear();
            if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        };
    }, [EventBus, tile, dismissAlert]);

    // If a token on this tile is being picked up / moved, dismiss the alert immediately
    useEffect(() => {
        if (activePayload?.from?.tile === tile && alertData && !isDismissed) {
            dismissAlert();
        }
    }, [activePayload, tile, alertData, isDismissed, dismissAlert]);

    const handleMouseEnter = () => {
        if (isDismissed) return;
        if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        setIsFading(false);
        if (iconRef.current) {
            setIconRect(iconRef.current.getBoundingClientRect());
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (!alertData || isDismissed) return;

        // 5s wait before starting fadeout
        delayTimerRef.current = setTimeout(() => {
            setIsFading(true);
            // 3s smooth fadeout duration
            fadeTimerRef.current = setTimeout(() => {
                setAlertData(null);
                setIsFading(false);
            }, 3000);
        }, 5000);
    };

    const handleClick = (e) => {
        e.stopPropagation();
        dismissAlert();
    };

    if (!alertData) return null;

    const isUpgrade = alertData.severity === 'upgrade' || alertData.type === 'hero_level_up';
    const isDisallow = alertData.severity === 'disallow' || alertData.type === 'drop_rejected';
    const isRed = alertData.severity === 'red' || alertData.type === 'token_exhausted';
    const isGreen = alertData.severity === 'green' || alertData.type === 'token_restocked';
    const iconSrc = alertData.iconSrc || (
        isUpgrade
            ? '/assets/ui/ui_upgrade.png'
            : isDisallow
                ? '/assets/ui/ui_disallow_red.png'
                : isRed
                    ? '/assets/ui/ui_alert_red.png'
                    : isGreen
                        ? '/assets/ui/ui_alert_green.png'
                        : '/assets/ui/ui_alert_yellow.png'
    );

    const speechBubble = (
        <div
            className={cn(
                iconRect ? "fixed -translate-x-1/2 -translate-y-full" : "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
                "whitespace-nowrap z-[9999] pointer-events-none",
                "px-2.5 py-1.5 rounded-md shadow-2xl backdrop-blur-md border",
                "flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150",
                (isDisallow || isRed)
                    ? "bg-red-950/95 border-red-500/70 text-red-100 shadow-red-950/60"
                    : isGreen
                        ? "bg-emerald-950/95 border-emerald-500/70 text-emerald-100 shadow-emerald-950/60"
                        : "bg-yellow-950/95 border-yellow-500/70 text-yellow-100 shadow-yellow-950/60"
            )}
            style={iconRect ? {
                left: iconRect.left + iconRect.width / 2,
                top: iconRect.top - 6,
                opacity: (isFading || isDismissed) ? 0 : 1,
                transition: isDismissed
                    ? 'opacity 400ms ease-out'
                    : isFading
                        ? 'opacity 3000ms cubic-bezier(0.4, 0, 0.2, 1)'
                        : 'none'
            } : undefined}
        >
            <div className="flex flex-col gap-0.5 text-left">
                <span className={cn(
                    "font-bold text-[12px] tracking-wide",
                    (isDisallow || isRed) ? "text-red-100" : isGreen ? "text-emerald-100" : "text-yellow-100"
                )}>
                    {alertData.title || alertData.message}
                </span>
                {alertData.rulesText && (
                    <span className={cn(
                        "text-[11px] font-medium leading-tight",
                        (isDisallow || isRed) ? "text-red-300/90" : isGreen ? "text-emerald-300/90" : "text-yellow-300/90"
                    )}>
                        {alertData.rulesText}
                    </span>
                )}
            </div>

            {/* Speech Bubble Arrow pointing down to center of icon */}
            <div
                className={cn(
                    "absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b",
                    (isDisallow || isRed)
                        ? "bg-red-950/95 border-red-500/70"
                        : isGreen
                            ? "bg-emerald-950/95 border-emerald-500/70"
                            : "bg-yellow-950/95 border-yellow-500/70"
                )}
            />
        </div>
    );

    return (
        <div
            ref={iconRef}
            onClick={handleClick}
            className={cn(
                "absolute top-1.5 left-[2px] z-[100]",
                isDismissed ? "pointer-events-none" : "pointer-events-auto"
            )}
            style={{
                opacity: (isFading || isDismissed) ? 0 : 1,
                transition: isDismissed
                    ? 'opacity 400ms ease-out'
                    : isFading
                        ? 'opacity 3000ms cubic-bezier(0.4, 0, 0.2, 1)'
                        : 'none'
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Floating glowing alert icon (32px, upright) */}
            <div className="relative group cursor-pointer w-8 h-8 flex items-center justify-center">
                <img
                    src={iconSrc}
                    alt={alertData.message || alertData.title}
                    className={cn(
                        "w-8 h-8 object-contain select-none",
                        "animate-bounce transition-transform duration-200",
                        (isDisallow || isRed)
                            ? "drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                            : isGreen
                                ? "drop-shadow-[0_0_8px_rgba(34,197,94,0.9)]"
                                : "drop-shadow-[0_0_8px_rgba(234,179,8,0.9)]"
                    )}
                    style={{
                        width: '32px',
                        height: '32px',
                        imageRendering: 'pixelated',
                        animationDuration: '2s',
                        transform: 'none'
                    }}
                />

                {/* Pop-up Text Bubble portalled to document.body at z-[9999] */}
                {isHovered && !isDismissed && (
                    typeof document !== 'undefined' && iconRect
                        ? createPortal(speechBubble, document.body)
                        : speechBubble
                )}
            </div>
        </div>
    );
};

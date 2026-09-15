import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { cn } from '../../utils/cn.js';
import { useTokenEvent } from './tokenEvents.js';

/**
 * The floating alert mark — "Token Exhausted", "Missing Items", a refused drop.
 *
 * Shown at the top-left of the thing it is about, with a pop-up bubble on hover.
 * Unhovered after being read it waits 5s, then fades out over 3s. Re-hovering
 * resets the wait. Clicking it, or anything happening to its Token, dismisses it
 * at once; once dismissed, hovering does not bring it back.
 *
 * Two things draw one: {@link TokenEventAlert}, on a Token, by instance id; and
 * `MatPointAlerts`, at a bare mat point, for an alert whose Token has just left
 * the mat or never existed (a refused drop). The state machine and the mark are
 * shared between them so the two cannot drift.
 */

/** The alert's life: what it says, whether it is fading, and how to end it. */
export function useEventAlert(onGone = null) {
    const [alertData, setAlertData] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isFading, setIsFading] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [iconRect, setIconRect] = useState(null);

    const iconRef = useRef(null);
    const delayTimerRef = useRef(null);
    const fadeTimerRef = useRef(null);
    const goneRef = useRef(onGone);
    goneRef.current = onGone;

    const clearTimers = () => {
        if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };

    useEffect(() => clearTimers, []);

    const dismiss = useCallback(() => {
        clearTimers();
        setIsHovered(false);
        setIsDismissed(true);
        setIsFading(true);
        fadeTimerRef.current = setTimeout(() => {
            setAlertData(null);
            setIsFading(false);
            setIsDismissed(false);
            goneRef.current?.();
        }, 400);
    }, []);

    /** Take a `board:tile_event_alert` payload and say it. */
    const show = useCallback((p) => {
        if (!p) return;
        clearTimers();
        setIsDismissed(false);
        setIsFading(false);
        setAlertData(prev => {
            let startLevel = p.startLevel;
            const newLevel = p.newLevel;
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
                message,
                heroId: p.heroId,
                skillId: p.skillId,
                heroName: p.heroName,
                skillName: p.skillName,
                startLevel,
                newLevel,
                iconSrc: p.iconSrc
            };
        });
    }, []);

    const onMouseEnter = () => {
        if (isDismissed) return;
        clearTimers();
        setIsFading(false);
        if (iconRef.current) setIconRect(iconRef.current.getBoundingClientRect());
        setIsHovered(true);
    };

    const onMouseLeave = () => {
        setIsHovered(false);
        if (!alertData || isDismissed) return;
        // 5s wait, then a 3s fade.
        delayTimerRef.current = setTimeout(() => {
            setIsFading(true);
            fadeTimerRef.current = setTimeout(() => {
                setAlertData(null);
                setIsFading(false);
                goneRef.current?.();
            }, 3000);
        }, 5000);
    };

    return { alertData, isHovered, isFading, isDismissed, iconRect, iconRef, show, dismiss, onMouseEnter, onMouseLeave };
}

/** The icon itself, and its hover bubble. `alert` is a {@link useEventAlert}. */
export const EventAlertMark = ({ alert }) => {
    const { alertData, isHovered, isFading, isDismissed, iconRect, iconRef, dismiss, onMouseEnter, onMouseLeave } = alert;
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
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
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
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
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

/**
 * The alert drawn on one Token, by instance id (slice 1.6c-2). Anything
 * happening to that Token — it moves, it is replaced, it is picked up —
 * dismisses it, because the news is about the Token as it was.
 */
export const TokenEventAlert = ({ instanceId }) => {
    const alert = useEventAlert();
    const { activePayload } = useActiveDrag();
    const { alertData, isDismissed, show, dismiss } = alert;

    useTokenEvent(BOARD_EVENTS.TILE_EVENT_ALERT, instanceId, show);
    useTokenEvent(BOARD_EVENTS.TILE_CHANGED, instanceId, dismiss);

    // Picked up: the alert goes with the Token leaving the spot.
    useEffect(() => {
        const dragged = activePayload?.from?.instanceId ?? null;
        if (dragged && dragged === instanceId && alertData && !isDismissed) dismiss();
    }, [activePayload, instanceId, alertData, isDismissed, dismiss]);

    return <EventAlertMark alert={alert} />;
};

export default TokenEventAlert;

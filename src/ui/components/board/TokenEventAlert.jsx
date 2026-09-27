import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as TokenNotices from '../../../systems/board/TokenNotices.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getMissingRequirements } from '../../../systems/board/RecipeResolver.js';
import { ALERT_HINT, ALERT_LABEL, isYellowAlert } from './boardConstants.js';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { cn } from '../../utils/cn.js';
import { useTokenEvent } from './tokenEvents.js';
import { ALERT_KIND, alertKindOf, alertFades, pickCentreAlert, workedAlertOf } from './centreAlert.js';

/**
 * The floating alert mark — "Token Exhausted", "Needs Oak Seed to spawn", a
 * refused drop, a green "New Oak Sapling".
 *
 * ⭐ Drawn at the **centre** of the thing it is about (FB-8, TL-14), with a
 * pop-up bubble on hover. There are two kinds (`centreAlert.js`):
 *
 * * **Problems** (red, yellow). A live one — a spawner waiting on the Bank or
 *   on room — stays until the engine says the cause is gone. News of a
 *   problem that cannot be fixed any more (a Token ran dry, a drop was
 *   refused — `alertFades`) goes after `TokenNotices.NOTICE_MS` like a notice,
 *   still red (owner, after Q2). Any other problem news stays until the
 *   player reads it: once hovered and left it waits 5s, then fades over 3s.
 *   Clicking any of them dismisses it at once.
 * * **Notices** (green) go on their own after `TokenNotices.NOTICE_MS`.
 *
 * A Token shows one mark at a time: a problem always wins over a notice.
 *
 * Two things draw one: {@link TokenCentreAlert}, on a Token, by instance id;
 * and `MatPointAlerts`, at a bare mat point, for an alert whose Token has just
 * left the mat or never existed (a refused drop). The state machine and the
 * mark are shared between them so the two cannot drift.
 */

/** How long a notice takes to fade out at the end of its life, in ms. */
const NOTICE_FADE_MS = 1500;

/** The alert's life: what it says, whether it is fading, and how to end it. */
export function useEventAlert(onGone = null) {
    const [alertData, setAlertData] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isFading, setIsFading] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [iconRect, setIconRect] = useState(null);
    /** Whether the news up now fades on its own clock (`alertFades`). */
    const [fades, setFades] = useState(false);

    const iconRef = useRef(null);
    const fadesRef = useRef(false);
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
        // News that cannot be fixed goes on its own after the notice's ten
        // seconds, fading over its last moment, hovered or not.
        const selfFading = alertFades(p);
        fadesRef.current = selfFading;
        setFades(selfFading);
        if (selfFading) {
            delayTimerRef.current = setTimeout(() => {
                setIsFading(true);
                fadeTimerRef.current = setTimeout(() => {
                    setAlertData(null);
                    setIsFading(false);
                    goneRef.current?.();
                }, NOTICE_FADE_MS);
            }, Math.max(0, TokenNotices.NOTICE_MS - NOTICE_FADE_MS));
        }
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
        if (fadesRef.current) {
            // Its own clock keeps running; hovering only reads it.
            if (iconRef.current) setIconRect(iconRef.current.getBoundingClientRect());
            setIsHovered(true);
            return;
        }
        clearTimers();
        setIsFading(false);
        if (iconRef.current) setIconRect(iconRef.current.getBoundingClientRect());
        setIsHovered(true);
    };

    const onMouseLeave = () => {
        setIsHovered(false);
        if (!alertData || isDismissed || fadesRef.current) return;
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

    return {
        alertData, isHovered, isFading, isDismissed, iconRect, iconRef, show, dismiss, onMouseEnter, onMouseLeave,
        fades, fadeMs: fades ? NOTICE_FADE_MS : undefined
    };
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

    const missing = alertData.missing?.items?.length ? alertData.missing : null;
    const speechBubble = (
        <div
            data-tile-alert-hint={alertData.hint || undefined}
            className={cn(
                iconRect ? "fixed -translate-x-1/2 -translate-y-full" : "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
                // A worked Token's hint is a whole sentence: wrap it, as the
                // bar's dropdown did, instead of one very long line (B1.1).
                alertData.hint ? "w-max max-w-[220px] whitespace-normal" : "whitespace-nowrap",
                "z-[9999] pointer-events-none",
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
                {/* A worked Token's missing requirements (B1.1; the bar's
                    dropdown before). */}
                {missing && (
                    <div data-missing-requirements={missing.type} className="flex flex-col gap-0.5 pt-1 mt-0.5 border-t border-white/15">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                            {missing.type === 'items' ? 'Items' : 'Tokens'}
                        </span>
                        {missing.items.map((name, i) => (
                            <span key={i} className="text-[11px] font-semibold leading-tight">{name}</span>
                        ))}
                    </div>
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
            data-alert-kind={isGreen ? ALERT_KIND.NOTICE : ALERT_KIND.PROBLEM}
            data-alert-severity={alertData.severity}
            data-alert-fades={alert.fades ? 'true' : undefined}
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]",
                isDismissed ? "pointer-events-none" : "pointer-events-auto"
            )}
            style={{
                opacity: (isFading || isDismissed) ? 0 : 1,
                transition: isDismissed
                    ? 'opacity 400ms ease-out'
                    : isFading
                        ? `opacity ${alert.fadeMs ?? 3000}ms cubic-bezier(0.4, 0, 0.2, 1)`
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

/** "A", "A and B", "A, B and C". */
const joinNames = (names) => names.length <= 1
    ? (names[0] || '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** The mark's own words for a spawner alert (`SpawnerSystem.spawnerAlertOf`). */
export function spawnerAlertData(state) {
    if (!state?.alert) return null;
    const needs = (state.needs || []).map(id => getItem(id)?.name || id);
    const title = state.alert === ALERT.SPAWN_NEEDS_ITEM
        ? (needs.length ? `Needs ${joinNames(needs)} to spawn` : 'Needs items to spawn')
        : 'No room to spawn';
    return {
        severity: state.alert === ALERT.SPAWN_NEEDS_ITEM ? 'yellow' : 'red',
        type: state.alert,
        title,
        message: title,
        rulesText: ALERT_HINT[state.alert] || null
    };
}

/**
 * The mark's own words for a worked Token's problem (B1.1): the alert's short
 * label as the heading, its `ALERT_HINT` sentence, and — when there are any —
 * the missing requirements listed under it. Yellow or red as the bar was.
 */
export function workedAlertData(alert, missing = null) {
    if (!alert) return null;
    const title = ALERT_LABEL[alert] || 'Blocked';
    return {
        severity: isYellowAlert(alert) ? 'yellow' : 'red',
        type: alert,
        title,
        message: title,
        rulesText: ALERT_HINT[alert] || null,
        hint: alert,
        missing: missing?.items?.length ? missing : null
    };
}

const NO_MISSING = Object.freeze({ type: null, items: [] });

/** A Token's green notice, read from `TokenNotices` and timed out here. */
function useNotice(instanceId) {
    const [notice, setNotice] = useState(() => TokenNotices.noticeOf(instanceId));
    const [isFading, setIsFading] = useState(false);

    const refresh = useCallback(() => setNotice(TokenNotices.noticeOf(instanceId)), [instanceId]);
    useEffect(() => { refresh(); }, [refresh]);
    useTokenEvent(BOARD_EVENTS.NOTICE_CHANGED, instanceId, refresh);

    // Fade over its last moment, then read again (which finds it gone).
    useEffect(() => {
        setIsFading(false);
        if (!notice) return undefined;
        const left = Math.max(0, notice.remainingMs);
        const fade = setTimeout(() => setIsFading(true), Math.max(0, left - NOTICE_FADE_MS));
        const gone = setTimeout(refresh, left + 20);
        return () => { clearTimeout(fade); clearTimeout(gone); };
    }, [notice, refresh]);

    return { notice, isFading };
}

/** The mark's own words for a notice. */
const noticeAlertData = (notice) => notice ? {
    severity: 'green',
    type: notice.type,
    title: notice.title,
    message: notice.title,
    rulesText: notice.rulesText
} : null;

/**
 * A mark whose life is decided elsewhere (the engine, or a notice's clock).
 * `hovered` opens its bubble from outside — the pointer is on the Token, not
 * necessarily on the mark (B1.1).
 */
function useStaticMark(alertData, { isFading = false, fadeMs, onDismiss, hovered = false } = {}) {
    const [isHovered, setIsHovered] = useState(false);
    const [iconRect, setIconRect] = useState(null);
    const iconRef = useRef(null);
    const shown = !!alertData;
    useLayoutEffect(() => {
        if (hovered && shown && iconRef.current) setIconRect(iconRef.current.getBoundingClientRect());
    }, [hovered, shown]);
    return {
        alertData,
        isHovered: isHovered || (hovered && shown),
        isFading,
        fadeMs,
        isDismissed: false,
        iconRect,
        iconRef,
        dismiss: onDismiss || (() => {}),
        onMouseEnter: () => {
            if (iconRef.current) setIconRect(iconRef.current.getBoundingClientRect());
            setIsHovered(true);
        },
        onMouseLeave: () => setIsHovered(false)
    };
}

/**
 * ⭐ **The one mark at a Token's centre** (FB-8, FB-48, TL-14).
 *
 * Four sources, one place, one mark: a spawner's live problem
 * (`SPAWNER_ALERT_CHANGED`), a worked Token's live problem (`token.alert` or
 * its missing requirements, B1.1), news of a problem (`TILE_EVENT_ALERT`),
 * and a green notice (`TokenNotices`). `pickCentreAlert` decides, so a notice never
 * covers a problem. A green `TILE_EVENT_ALERT` (a restock) is turned into a
 * notice rather than drawn as news, so every green mark fades the same way.
 *
 * A Token is a spawner or worked, not both; should both ever apply, the
 * spawner's problem is the one shown. A worked Token's bubble opens when the
 * pointer is anywhere on the Token (`isHovered`), as the bar's dropdown did.
 *
 * A live problem cannot be clicked away — the problem is still there.
 * Anything happening to the Token — it is replaced, it is picked up —
 * dismisses the news, because the news is about the Token as it was.
 */
export const TokenCentreAlert = ({ instanceId, isSpawner = false, token = null, isHovered = false }) => {
    const event = useEventAlert();
    const { activePayload } = useActiveDrag();
    const { alertData, isDismissed, show, dismiss } = event;

    const onEvent = useCallback((p) => {
        const kind = alertKindOf(p);
        if (kind === ALERT_KIND.SPOKEN) return;   // said by the hero (SB-2)
        if (kind === ALERT_KIND.NOTICE) {
            TokenNotices.raiseNotice(instanceId, {
                type: p.type, title: p.title || p.message, rulesText: p.rulesText || null
            });
            return;
        }
        show(p);
    }, [instanceId, show]);

    useTokenEvent(BOARD_EVENTS.TILE_EVENT_ALERT, instanceId, onEvent);
    useTokenEvent(BOARD_EVENTS.TILE_CHANGED, instanceId, dismiss);

    // Picked up: the news goes with the Token leaving the spot.
    useEffect(() => {
        const dragged = activePayload?.from?.instanceId ?? null;
        if (dragged && dragged === instanceId && alertData && !isDismissed) dismiss();
    }, [activePayload, instanceId, alertData, isDismissed, dismiss]);

    // A spawner's live problem (Token Lifecycle 8.3).
    const [spawnerState, setSpawnerState] = useState(() => isSpawner ? SpawnerSystem.spawnerAlertOf(instanceId) : null);
    useEffect(() => {
        setSpawnerState(isSpawner ? SpawnerSystem.spawnerAlertOf(instanceId) : null);
    }, [instanceId, isSpawner]);
    useTokenEvent(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, instanceId, () => {
        setSpawnerState(isSpawner ? SpawnerSystem.spawnerAlertOf(instanceId) : null);
    });
    const liveData = spawnerAlertData(spawnerState);
    const live = useStaticMark(liveData);

    // A worked Token's live problem (B1.1). The requirements are re-read on
    // hover too, so the list is current when the player looks at it.
    const hasHero = !!token?.heroId;
    // ⚠️ Read the live instance, not `token`: MatToken's `token` is a slim
    // projection without `selectedRecipeId`, so a station's inputs were never
    // found and the list stayed empty (seen live in B1.1; the bar had the same flaw).
    const missing = useMemo(
        () => {
            if (!hasHero) return NO_MISSING;
            const id = token.instanceId ?? instanceId;
            return getMissingRequirements(id, BoardState.getTokenById(id) ?? token);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [instanceId, token, hasHero, isHovered]
    );
    const workedAlert = liveData ? null : workedAlertOf({ hasHero, alert: token?.alert ?? null, missingType: missing.type });
    const workedData = workedAlertData(workedAlert, missing);
    const worked = useStaticMark(workedData, { hovered: isHovered });

    const { notice, isFading: noticeFading } = useNotice(instanceId);
    const noticeMark = useStaticMark(noticeAlertData(notice), {
        isFading: noticeFading,
        fadeMs: NOTICE_FADE_MS,
        onDismiss: () => TokenNotices.clearNotice(instanceId)
    });

    const pick = pickCentreAlert({ live: liveData || workedData, event: alertData, notice });
    if (pick === 'live' && !liveData) {
        return (
            <div data-worked-alert={workedAlert}>
                <EventAlertMark alert={worked} />
            </div>
        );
    }
    if (pick === 'live') {
        return (
            <div data-spawner-alert={spawnerState.alert}>
                <EventAlertMark alert={live} />
            </div>
        );
    }
    if (pick === 'event') return <EventAlertMark alert={event} />;
    if (pick === 'notice') {
        return (
            <div data-token-notice={notice.type}>
                <EventAlertMark alert={noticeMark} />
            </div>
        );
    }
    return null;
};

/** The centre mark for news alone — a Token that is not a spawner. */
export const TokenEventAlert = ({ instanceId }) => <TokenCentreAlert instanceId={instanceId} />;

export default TokenEventAlert;

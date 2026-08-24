import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EventBus } from '../../../systems/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import { GameState } from '../../../state/GameState.js';

export const TUTORIAL_AIDE_EVENTS = {
    HOVER: 'tutorial_aide:hover',
    UNHOVER: 'tutorial_aide:unhover'
};

/** Set the active tutorial quest to highlight */
export function setTutorialAideTarget(questId) {
    if (questId) {
        EventBus.publish(TUTORIAL_AIDE_EVENTS.HOVER, { questId });
    } else {
        EventBus.publish(TUTORIAL_AIDE_EVENTS.UNHOVER, {});
    }
}

/** Resolves the target DOM element for a given tutorial quest */
export function resolveTutorialTargetElement(questId) {
    if (typeof document === 'undefined' || !questId) return null;

    switch (questId) {
        case 'tutorial_1': // Place Guild Hall Token from Tray
            return (
                document.querySelector('[data-tray-container] [data-alpha-test]') ||
                document.querySelector('#tray-bubble-target') ||
                document.querySelector('[data-tray-container]') ||
                document.querySelector('#tray')
            );

        case 'tutorial_2': // Recruit a Hero from Guild Hall
            return (
                document.querySelector('[data-guild-roster-upgrade="true"]') ||
                document.querySelector('#guild-bubble-target') ||
                document.querySelector('button[title*="Guild"]')
            );

        case 'tutorial_3': // Upgrade Guild Hall Production (Wishing Well)
            return (
                document.querySelector('[data-guild-wishing-well-upgrade="true"]') ||
                document.querySelector('#guild-bubble-target') ||
                document.querySelector('button[title*="Guild"]')
            );

        case 'tutorial_4': // Explore one Map (strictly on-board map, no tray fallback)
            return document.querySelector('[data-board-map-id]');

        case 'tutorial_5': // Place a Dropped Token (any floating token sprite on the playmat)
            return (
                document.querySelector('#sprite-layer [data-token-sprite="true"]') ||
                document.querySelector('[data-token-sprite="true"]')
            );

        case 'tutorial_6': // Deploy a Hero from Hero Dock
            return (
                document.querySelector('[data-hero-dock-tab]') ||
                document.querySelector('#rightmost-hero-dock') ||
                document.querySelector('#hero-dock')
            );

        case 'tutorial_7': // Token Cycles (any token with a Hero assigned to it)
            return document.querySelector('[data-tile-staffed="true"]');

        case 'tutorial_8': // Collect Items
            return (
                document.querySelector('[data-item-sprite="true"]') ||
                document.querySelector('#sprite-layer')
            );

        case 'tutorial_9': // Exhaust one Token (tokens on the playmat that are not infinite)
            return (
                document.querySelector('[data-tile-staffed="true"][data-tile-finite-token="true"]') ||
                document.querySelector('[data-tile-finite-token="true"]') ||
                document.querySelector('[data-tile-staffed="true"]') ||
                document.querySelector('[data-tile-has-token="true"]')
            );

        case 'tutorial_10': // Item Bank
            return document.querySelector('#bank-bubble-target');

        case 'tutorial_11': // Equip a Hero
            return (
                document.querySelector('[data-bank-item]') ||
                document.querySelector('[data-hero-dock-tab]') ||
                document.querySelector('#bank-bubble-target')
            );

        case 'tutorial_12': // Token Vault
            return document.querySelector('#vault-bubble-target');

        case 'tutorial_13': // Stage a Token from Vault to Tray
            return (
                document.querySelector('[data-vault-first-token]') ||
                document.querySelector('#vault-bubble-target') ||
                document.querySelector('#tray-bubble-target')
            );

        case 'tutorial_14': // Add a Context Token
            return (
                document.querySelector('[data-tray-container] [data-alpha-test]') ||
                document.querySelector('#tray-bubble-target')
            );

        case 'tutorial_15': // Cartographer's Shop
            return document.querySelector('#cartographer-bubble-target');

        case 'tutorial_16': // Buy a Map
            return (
                document.querySelector('[data-cartographer-map-card]') ||
                document.querySelector('#cartographer-bubble-target')
            );

        default:
            return null;
    }
}

/** Individual pulsating golden beacon attached to a DOM element or query selector */
export const TutorialBeacon = ({ target, keyId }) => {
    const [targetRect, setTargetRect] = useState(null);
    const rafIdRef = useRef(null);

    const updateRect = useCallback(() => {
        if (!target || typeof document === 'undefined') {
            setTargetRect(null);
            return;
        }

        const el = typeof target === 'string'
            ? document.querySelector(target)
            : (typeof target === 'function' ? target() : target);

        if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                setTargetRect({
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2,
                    radius: Math.max(40, Math.max(r.width, r.height) / 2 + 18)
                });
                return;
            }
        }
        setTargetRect(null);
    }, [target]);

    useEffect(() => {
        updateRect();

        // High frequency RAF loop ensures beacon tracks sliding animations (hero dock tabs, inspection panel, playmat pan)
        let running = true;
        const tick = () => {
            if (!running) return;
            updateRect();
            rafIdRef.current = requestAnimationFrame(tick);
        };
        rafIdRef.current = requestAnimationFrame(tick);

        const handleResize = () => updateRect();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize);

        return () => {
            running = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize);
        };
    }, [updateRect]);

    if (!targetRect) return null;

    return (
        <motion.div
            key={keyId}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            style={{
                position: 'fixed',
                left: targetRect.x - targetRect.radius,
                top: targetRect.y - targetRect.radius,
                width: targetRect.radius * 2,
                height: targetRect.radius * 2,
                zIndex: 9999,
                pointerEvents: 'none'
            }}
            className="flex items-center justify-center select-none"
        >
            {/* Outer pulsating beacon ring */}
            <motion.div
                animate={{
                    scale: [1, 1.25, 1],
                    opacity: [0.85, 0.25, 0.85],
                    borderWidth: ['2.5px', '4px', '2.5px']
                }}
                transition={{
                    repeat: Infinity,
                    duration: 1.6,
                    ease: 'easeInOut'
                }}
                className="absolute inset-0 rounded-full border-yellow-400 pointer-events-none shadow-[0_0_25px_rgba(250,204,21,0.9)]"
            />

            {/* Inner secondary glowing accent ring */}
            <motion.div
                animate={{
                    scale: [1.1, 0.95, 1.1],
                    opacity: [0.3, 0.8, 0.3]
                }}
                transition={{
                    repeat: Infinity,
                    duration: 1.6,
                    ease: 'easeInOut',
                    delay: 0.2
                }}
                className="absolute inset-2 rounded-full border border-yellow-200/80 pointer-events-none shadow-[0_0_15px_rgba(253,224,71,0.8)]"
            />
        </motion.div>
    );
};

export const TutorialAideOverlay = () => {
    const [activeQuestId, setActiveQuestId] = useState(null);

    // Track if "Recruit a Hero" is active in Quest Log and incomplete
    const isRecruitHeroQuestActive = useGameState(
        () => {
            const activeQuests = GameState.state?.quests?.active || [];
            const q = activeQuests.find(quest => quest.targetType === 'hero_recruited' || quest.id === 'tutorial_2');
            return !!q && (q.currentCount || 0) < (q.requiredCount || 1);
        },
        ['state_changed', 'quests_updated', 'hero_recruited', 'guild_upgrades_updated']
    );

    // Track if "Upgrade Guild Hall Production" (Wishing Well) is active in Quest Log and incomplete
    const isWishingWellQuestActive = useGameState(
        () => {
            const activeQuests = GameState.state?.quests?.active || [];
            const q = activeQuests.find(quest => quest.targetType === 'guild_upgrade_purchased' || quest.targetType === 'wishing_well_upgraded' || quest.id === 'tutorial_3');
            return !!q && (q.currentCount || 0) < (q.requiredCount || 1);
        },
        ['state_changed', 'quests_updated', 'guild_upgrades_updated']
    );

    useEffect(() => {
        const subHover = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.HOVER, ({ questId }) => {
            setActiveQuestId(questId);
        });
        const subUnhover = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.UNHOVER, () => {
            setActiveQuestId(null);
        });

        return () => {
            subHover?.();
            subUnhover?.();
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden select-none">
            <AnimatePresence>
                {/* 1. Hover-based beacon for active hovered tutorial quest */}
                {activeQuestId && (
                    <TutorialBeacon
                        key={`hover_${activeQuestId}`}
                        keyId={`hover_${activeQuestId}`}
                        target={() => resolveTutorialTargetElement(activeQuestId)}
                    />
                )}

                {/* 2. Standing beacons on Guild Hall Upgrade screen during Recruit a Hero */}
                {isRecruitHeroQuestActive && (
                    <>
                        <TutorialBeacon
                            key="guild_roster_mat"
                            keyId="guild_roster_mat"
                            target="[data-guild-roster-upgrade='true']"
                        />
                        <TutorialBeacon
                            key="guild_roster_upgrade_button"
                            keyId="guild_roster_upgrade_button"
                            target="[data-guild-roster-upgrade-button='true']"
                        />
                    </>
                )}

                {/* 3. Standing beacons on Guild Hall Upgrade screen during Wishing Well Upgrade */}
                {isWishingWellQuestActive && (
                    <>
                        <TutorialBeacon
                            key="guild_wishing_well_mat"
                            keyId="guild_wishing_well_mat"
                            target="[data-guild-wishing-well-upgrade='true']"
                        />
                        <TutorialBeacon
                            key="guild_well_upgrade_button"
                            keyId="guild_well_upgrade_button"
                            target="[data-guild-well-upgrade-button='true']"
                        />
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TutorialAideOverlay;

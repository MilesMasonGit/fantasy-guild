import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { onFrame, onStep } from '../board/frameClock.js';

export const TUTORIAL_AIDE_EVENTS = {
    HOVER: UI_EVENTS.TUTORIAL_AIDE_HOVER,
    UNHOVER: UI_EVENTS.TUTORIAL_AIDE_UNHOVER
};

/** Set the active tutorial quest to highlight */
export function setTutorialAideTarget(questId) {
    if (questId) {
        EventBus.publish(TUTORIAL_AIDE_EVENTS.HOVER, { questId });
    } else {
        EventBus.publish(TUTORIAL_AIDE_EVENTS.UNHOVER, {});
    }
}

/**
 * The tutorial step the player is on: the tutorial quest Token on the mat that is not yet
 * done, as its live quest, or null. The steps are quest Tokens; `state.quests.active` only
 * ever holds an old save's sidebar quests waiting to be converted, so it is always empty in
 * play.
 */
export function activeTutorialQuest() {
    const token = QuestTokens.tutorialTokens().find(t => !t.quest.done);
    return token ? token.quest : null;
}

/** Whether a page element is on show: not inside a hidden tab or a `hidden` element. */
function shown(el) {
    return !!el && !el.closest('.hidden, [hidden]');
}

/** The first element matching `selector` that is on show, or null. */
function firstShown(selector) {
    for (const el of document.querySelectorAll(selector)) if (shown(el)) return el;
    return null;
}

/** The first Token on the mat whose type passes `test`, by its art. */
function tokenWhere(test) {
    for (const el of document.querySelectorAll('[data-token-art="true"][data-token-type]')) {
        const def = getTokenType(el.getAttribute('data-token-type'));
        if (def && test(def)) return el;
    }
    return null;
}

/** Something a hero can gather: a resource with work in it that is not an endgame site. */
const gatherable = (def) => def.tokenType === 'resource' && !def.landmark && !!def.config?.skill;
/** A station that crafts: not a Foundation. */
const craftStation = (def) => def.tokenType === 'station' && !def.foundation;
const enemy = (def) => def.tokenType === 'enemy';
const landmark = (def) => def.landmark === true;

/**
 * Resolves the target DOM element for a given tutorial quest (the chain in `tutorialQuests.js`).
 * Each step prefers the thing itself and falls back to the orb that opens the right screen. The
 * selectors are the live page's (`TutorialAide.test.js` checks them against the components).
 */
export function resolveTutorialTargetElement(questId) {
    if (typeof document === 'undefined' || !questId) return null;

    const q = (selector) => firstShown(selector);
    const token = (typeId) => q(`[data-token-art="true"][data-token-type="${typeId}"]`);
    const shopItem = (typeId) => q(`[data-shop-item="${typeId}"]`) || q('#shop-bubble-target');
    const atlasTab = (tab) => q(`[data-atlas-tab="${tab}"]`) || q('#atlas-bubble-target');

    switch (questId) {
        case 'cart_recruit':
            return q('[data-guild-roster-upgrade="true"]') || q('#guild-bubble-target');

        case 'cart_flag': // Drag a hero from the hero bar onto the mat
            return q('[data-dock-hero][data-dock-deployed="false"]') || q('[data-dock-hero]') || q('#guild-bubble-target');

        case 'cart_gather':
            return tokenWhere(gatherable);

        case 'cart_loot': // Loot on the floor, else where it will fall
            return q('[data-item-sprite="true"]') || tokenWhere(gatherable);

        case 'cart_foundation':
            return shopItem('token_wood_foundation');

        case 'cart_station': // Build on the Wood Foundation
            return token('token_wood_foundation') || shopItem('token_wood_foundation');

        case 'cart_craft': // Craft at the new station
            return tokenWhere(craftStation) || token('token_wood_foundation') || shopItem('token_wood_foundation');

        case 'cart_fight':
            return tokenWhere(enemy);

        case 'cart_inspect': // An endgame site
            return tokenWhere(landmark);

        case 'cart_settle': // Slot a map and Settle, on the Atlas's Cartography table
            return q('[data-cartography-settle]') || atlasTab('cartography');

        case 'cart_travel': // Travel, from the settled message or the Region list
            return q('[data-settled-travel]') || q('[data-region-travel]') || atlasTab('regions');

        default:
            return null;
    }
}

/** Frames a moved target must stay still before the beacon stops reading it every frame. */
const SETTLE_FRAMES = 10;

const sameRect = (a, b) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.radius === b.radius);

/**
 * Individual pulsating golden beacon attached to a DOM element or query selector.
 * ⚠️ It never looks every frame while its target is missing or still: it finds and measures the
 * target once a step (`frameClock.onStep`, ten a second) and on resize or scroll, and follows it
 * every frame only from the step that saw it move until it has stood still for
 * {@link SETTLE_FRAMES} frames (a sliding drawer, a walking hero).
 */
export const TutorialBeacon = ({ target, keyId }) => {
    const [targetRect, setTargetRect] = useState(null);
    // The latest `target`, so a fresh resolver function each parent render does not restart the
    // clocks; a different selector string does.
    const targetRef = useRef(target);
    targetRef.current = target;
    const selector = typeof target === 'string' ? target : null;

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        let el = null;
        let rect = null;
        let stopFrames = null;
        let stillFrames = 0;

        const resolve = () => {
            const t = targetRef.current;
            if (!t) return null;
            if (typeof t === 'string') return document.querySelector(t);
            return typeof t === 'function' ? t() : t;
        };

        // A step looks the target up again (a resolver's better choice may have appeared); a
        // frame keeps the element it has while it is still on the page.
        const measure = (fromFrame) => {
            if (!fromFrame || !el || !el.isConnected) el = resolve();
            if (!el) return null;
            const r = el.getBoundingClientRect();
            if (!(r.width > 0 && r.height > 0)) return null;
            return {
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
                radius: Math.max(40, Math.max(r.width, r.height) / 2 + 18)
            };
        };

        const stopFollowing = () => {
            stopFrames?.();
            stopFrames = null;
        };

        const check = (fromFrame) => {
            const next = measure(fromFrame);
            const moved = !!(rect && next && !sameRect(rect, next));
            if (!sameRect(rect, next)) {
                rect = next;
                setTargetRect(next);
            }
            if (!next) {
                stopFollowing();
            } else if (moved) {
                stillFrames = 0;
                if (!stopFrames) stopFrames = onFrame(() => check(true));
            } else if (fromFrame && ++stillFrames >= SETTLE_FRAMES) {
                stopFollowing();
            }
        };

        check(false);
        const stopSteps = onStep(() => check(false));
        const onWindow = () => check(false);
        window.addEventListener('resize', onWindow);
        window.addEventListener('scroll', onWindow);

        return () => {
            stopSteps();
            stopFollowing();
            window.removeEventListener('resize', onWindow);
            window.removeEventListener('scroll', onWindow);
        };
    }, [selector]);

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

    // Standing beacons while the current tutorial step is 'Recruit a Hero' and not done, read
    // from the tutorial quest Token.
    const isRecruitHeroQuestActive = useGameState(
        () => activeTutorialQuest()?.targetType === 'hero_recruited',
        [ENGINE_EVENTS.STATE_CHANGED, ENGINE_EVENTS.QUESTS_UPDATED, ENGINE_EVENTS.HERO_RECRUITED, ENGINE_EVENTS.GUILD_UPGRADES_UPDATED]
    );

    useEffect(() => {
        const subHover = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.HOVER, ({ questId }) => {
            setActiveQuestId(questId);
        }, UI_LISTENER);
        const subUnhover = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.UNHOVER, () => {
            setActiveQuestId(null);
        }, UI_LISTENER);

        return () => {
            subHover?.();
            subUnhover?.();
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden select-none">
            <AnimatePresence>
                {activeQuestId && (
                    <TutorialBeacon
                        key={`hover_${activeQuestId}`}
                        keyId={`hover_${activeQuestId}`}
                        target={() => resolveTutorialTargetElement(activeQuestId)}
                    />
                )}

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
            </AnimatePresence>
        </div>
    );
};

export default TutorialAideOverlay;

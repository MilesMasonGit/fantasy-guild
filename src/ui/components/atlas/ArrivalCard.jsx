import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { BannerArt } from '../base/BannerArt.jsx';
import { PixelFrame } from '../base/PixelFrame.jsx';
import { bannerForRegion } from './regionBanner.js';
import { prefersReducedMotion } from './AtlasTome.jsx';
import { SettleTitle, SETTLE_TITLE, playFanfare } from './SettleTitle.jsx';

/** How long the card stays, and how long it takes to come and go (in held frames). */
export const ARRIVAL_MS = 1800;
const FADE_S = 0.15;
const FADE_STEPS = 3;
const stepped = (t) => Math.min(1, Math.ceil(t * FADE_STEPS) / FADE_STEPS);

/** What the card shows for Region `id`, or null. */
export function arrivalOf(id) {
    const region = Atlas.getRegion(id);
    if (!region) return null;
    return { id, name: region.flavourName || region.practicalName || '', practical: region.practicalName || '', banner: bannerForRegion(region) };
}

/**
 * The arrival card: on travel, the destination's area banner across the mat for a moment with its
 * name. A click skips it; under reduced motion it comes and goes without fading.
 *
 * On a place just settled (`ATLAS_CHANGED` `'arrived'`, which follows its `'travelled'`) the card
 * gives way to the place's title ({@link SettleTitle}): after the gold banner, with a fanfare, for
 * {@link SETTLE_TITLE}'s `holdMs`; a click or any key skips it. Never on travel to a place settled
 * before.
 */
export const ArrivalCard = ({ durationMs = ARRIVAL_MS, title = SETTLE_TITLE }) => {
    const [card, setCard] = useState(null);
    const timers = useRef([]);
    const shown = useRef(0);
    const clearTimers = useCallback(() => {
        for (const id of timers.current) clearTimeout(id);
        timers.current = [];
    }, []);
    const later = useCallback((fn, ms) => { timers.current.push(setTimeout(fn, ms)); }, []);
    const skip = useCallback(() => {
        clearTimers();
        setCard(null);
    }, [clearTimers]);

    useEffect(() => {
        const off = EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, (payload) => {
            const reason = payload?.reason;
            if (reason !== 'travelled' && reason !== 'arrived') return;
            const next = arrivalOf(payload.regionId);
            if (!next) return;
            clearTimers();
            if (reason === 'travelled') {
                setCard({ ...next, kind: 'travel', key: ++shown.current });
                later(() => setCard(null), durationMs);
                return;
            }
            const key = ++shown.current;
            setCard({ ...next, kind: 'settle', phase: 'waiting', key });
            later(() => {
                setCard(c => (c?.key === key ? { ...c, phase: 'open' } : c));
                playFanfare();
                later(() => setCard(c => (c?.key === key ? { ...c, phase: 'closing' } : c)), Math.max(0, title.holdMs - title.closeMs));
                later(() => setCard(c => (c?.key === key ? null : c)), title.holdMs);
            }, title.delayMs);
        }, UI_LISTENER);
        return () => {
            off?.();
            clearTimers();
        };
    }, [durationMs, title, clearTimers, later]);

    const settling = card?.kind === 'settle';
    useEffect(() => {
        if (!settling || typeof window === 'undefined') return undefined;
        window.addEventListener('keydown', skip, true);
        return () => window.removeEventListener('keydown', skip, true);
    }, [settling, skip]);

    if (!card) return null;
    const still = prefersReducedMotion();
    if (settling) {
        if (card.phase === 'waiting') return null;
        return <SettleTitle key={card.key} title={card} closing={card.phase === 'closing'} still={still} onSkip={skip} />;
    }
    return (
        <div className="absolute inset-0 z-[105] flex items-center pointer-events-none">
            <motion.div
                key={card.key}
                role="status"
                data-arrival-card={card.id}
                onPointerDown={skip}
                className="relative w-full pointer-events-auto cursor-pointer"
                style={{ height: 'min(40%, 288px)' }}
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: FADE_S, ease: stepped }}
            >
                <BannerArt banner={card.banner} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-6 flex justify-center">
                    <PixelFrame kind="studs" frameClassName="px-4 py-1 bg-gi-surface/90 text-center">
                        <div data-arrival-name className="font-pixel ui-text-display font-bold text-white">{card.name}</div>
                        {card.practical && card.practical !== card.name && (
                            <div className="font-pixel ui-text-body text-white/70">{card.practical}</div>
                        )}
                    </PixelFrame>
                </div>
            </motion.div>
        </div>
    );
};

export default ArrivalCard;

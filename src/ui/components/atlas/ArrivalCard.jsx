import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { BannerArt } from '../base/BannerArt.jsx';
import { PixelFrame } from '../base/PixelFrame.jsx';
import { bannerForRegion } from './regionBanner.js';
import { prefersReducedMotion } from './AtlasTome.jsx';

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
 * name. A click skips it; under reduced motion it comes and goes without fading. While `held` (the
 * camera still gliding back from the Atlas) it waits, and its moment starts once it shows.
 */
export const ArrivalCard = ({ durationMs = ARRIVAL_MS, held = false }) => {
    const [card, setCard] = useState(null);
    useEffect(() => {
        const off = EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, (payload) => {
            if (payload?.reason !== 'travelled') return;
            const next = arrivalOf(payload.regionId);
            if (next) setCard({ ...next, key: Date.now() });
        }, UI_LISTENER);
        return () => off?.();
    }, []);
    useEffect(() => {
        if (!card || held) return undefined;
        const timer = setTimeout(() => setCard(null), durationMs);
        return () => clearTimeout(timer);
    }, [card, held, durationMs]);

    if (!card || held) return null;
    const still = prefersReducedMotion();
    const skip = () => setCard(null);
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

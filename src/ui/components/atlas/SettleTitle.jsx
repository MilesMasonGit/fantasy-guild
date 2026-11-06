import { motion } from 'framer-motion';
import { EventBus } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { BannerArt } from '../base/BannerArt.jsx';
import { REGION_BANNER_SCALE } from '../board/MatRegionName.jsx';

/**
 * Settling's timing, in ms: the title waits for the gold banner to drop and the view to glide back
 * from the world map (`WorldCamera`), stays, and opens and closes in held frames. The heroes' walk
 * in is the engine's (`HeroMotion.WALK_IN`), timed to start once the title is up.
 */
export const SETTLE_TITLE = Object.freeze({ delayMs: 600, holdMs: 2600, openMs: 200, closeMs: 150 });

/** The clip the title plays as it opens (`AudioSystem`). */
export const SETTLE_FANFARE = 'settle_fanfare';

/** Where the band lies over the screen: above the Guild Hall, so the heroes walking in to it are seen, and under the banners. */
export const SETTLE_BAND = Object.freeze({ top: '17%', height: 'min(22%, 200px)' });

const STEPS = 4;
const held = (t) => Math.min(1, Math.ceil(t * STEPS) / STEPS);
const SHUT = 'inset(50% 0% 50% 0%)';
const OPEN = 'inset(0% 0% 0% 0%)';
/** The banner fades into the band at both ends. */
const FADE_ENDS = 'linear-gradient(to right, transparent 0%, #000 30%, #000 70%, transparent 100%)';

/** Play the fanfare. ⚠️ No pitch variance: that would draw from the game's random stream. */
export function playFanfare() {
    EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: SETTLE_FANFARE, options: { pitchVariance: 0 } });
}

/**
 * The title on settling a place: a dark band across the mat, opening from its middle line, the
 * place's banner at the top bar's 3× in it fading out at both ends, gold lines at its edges, and
 * over it the place's name in the display size with the hard outline, its land and line under it.
 * A press skips it (`onSkip`); under reduced motion (`still`) it neither opens nor closes. `band`
 * places it (the style sheet page fills its own box).
 *
 * @param {{ title: {id: string, name: string, practical: string, banner: string|null},
 *   closing?: boolean, still?: boolean, onSkip?: () => void, band?: object }} props
 */
export const SettleTitle = ({ title, closing = false, still = false, onSkip, band = SETTLE_BAND }) => (
    <div className="absolute inset-x-0 z-[105] pointer-events-none" style={band}>
        <motion.div
            role="status"
            data-arrival-card={title.id}
            data-settle-title={title.id}
            data-settle-closing={closing ? 'true' : undefined}
            onPointerDown={onSkip}
            className="relative w-full h-full pointer-events-auto cursor-pointer bg-black/80"
            initial={still ? false : { clipPath: SHUT }}
            animate={{ clipPath: closing && !still ? SHUT : OPEN }}
            transition={{ duration: (closing ? SETTLE_TITLE.closeMs : SETTLE_TITLE.openMs) / 1000, ease: held }}
        >
            <BannerArt banner={title.banner} scale={REGION_BANNER_SCALE} focusY={0.6} style={{ maskImage: FADE_ENDS, WebkitMaskImage: FADE_ENDS }} />
            <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--color-ui-gold)] pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--color-ui-gold)] pointer-events-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center pointer-events-none">
                <div data-arrival-name className="font-pixel ui-text-display ui-text-outline-2 font-bold tracking-[0.15em] text-white">{title.name}</div>
                {title.practical && title.practical !== title.name && (
                    <div data-settle-terrain className="font-pixel ui-text-title ui-text-outline-2 tracking-[0.1em] text-white">{title.practical}</div>
                )}
            </div>
        </motion.div>
    </div>
);

export default SettleTitle;

// the ambient life's switches and amounts, as the Ground tuner and the drawing switches set them

import { tuning } from '../../../config/playmatTuning.js';
import { FRAME_MS } from './ambientGround.js';

/** Each effect's Ground tuner toggle, which is also the name of its drawing switch. */
export const AMBIENT_EFFECTS = Object.freeze({
    water: 'ambientWater', gust: 'ambientGust', lava: 'ambientLava',
    particles: 'ambientParticles', birds: 'ambientBirds', clouds: 'ambientClouds'
});

/**
 * Every effect's switch (its toggle on and its drawing switch, `drawn(name)`, on) and the amounts,
 * gaps in frames of the sprite clock. Read live: call it where it is used.
 *
 * @param {(name: string) => boolean} [drawn]
 */
export function ambientSettings(drawn = () => true) {
    const on = (effect) => !!drawn(AMBIENT_EFFECTS[effect]) && tuning(AMBIENT_EFFECTS[effect]) > 0;
    return {
        water: on('water'), gust: on('gust'), lava: on('lava'),
        particles: on('particles'), birds: on('birds'), clouds: on('clouds'),
        sparkles: tuning('ambientSparkles'),
        gustGapFrames: (tuning('ambientGustGap') * 1000) / FRAME_MS,
        birdGapFrames: (tuning('ambientBirdGap') * 1000) / FRAME_MS,
        birdPixel: Math.round(tuning('ambientBirdPixel')),
        cloudCount: Math.round(tuning('ambientCloudCount')),
        cloudSize: tuning('ambientCloudSize'),
        cloudShade: tuning('ambientCloudShade'),
        particleRate: tuning('ambientParticleRate')
    };
}

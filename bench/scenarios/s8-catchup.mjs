// S8 — Catch-up hour: S2 saved, loaded, then one game-hour of the game's own catch-up
// (`CatchUp.run`), as a load after an hour away runs it. See `hour-after-load.mjs`.

import * as CatchUp from '../../src/systems/core/CatchUp.js';
import { build, hourAfterLoad, FINGERPRINT, HOUR_MS } from './hour-after-load.mjs';

export default {
    id: 'S8',
    name: 'Catch-up hour',
    fingerprint: FINGERPRINT,
    build,
    async custom(ctx) {
        return hourAfterLoad(ctx, async (savedAt) => {
            const result = await CatchUp.run({ savedAt, now: savedAt + HOUR_MS, save: false });
            return result.steps;
        });
    }
};

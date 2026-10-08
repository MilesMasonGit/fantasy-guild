// S8F — the same hour as S8, at today's 100 ms ticks: the fidelity reference. S8L's production
// must be within 1 % of it. See `hour-after-load.mjs`.

import { build, hourAfterLoad, plainSteps, FINGERPRINT } from './hour-after-load.mjs';

export default {
    id: 'S8F',
    name: 'Same hour, 100 ms ticks',
    fingerprint: FINGERPRINT,
    build,
    async custom(ctx) {
        return hourAfterLoad(ctx, async () => plainSteps(100));
    }
};

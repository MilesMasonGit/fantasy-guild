// S8L — the same hour as S8, as 3,600 plain `GameLoop.runHandlers(1000)` steps with the virtual
// wall clock moving. S8 must end identical to it. See `hour-after-load.mjs`.

import { build, hourAfterLoad, plainSteps, FINGERPRINT } from './hour-after-load.mjs';

export default {
    id: 'S8L',
    name: 'Same hour, plain 1000 ms steps',
    fingerprint: FINGERPRINT,
    build,
    async custom(ctx) {
        return hourAfterLoad(ctx, async () => plainSteps(1000));
    }
};

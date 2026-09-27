import { describe, it, expect } from 'vitest';
import { TEMPO_NAMES as GAME_TEMPOS, bandFor as gameBandFor } from '../config/registries/tempoBands.js';
import { TEMPO_NAMES, bandFor, isTempo } from '../../cms/src/utils/constants.js';
import { runTempoPass, bandMiddleMs } from '../../cms/src/engine/sim/tempoPass.js';
import { cycleCandidates } from '../../cms/src/engine/sim/tuningPass.js';

/**
 * The CMS offers the game's tempo vocabulary (CMS-5): its Tempo buttons
 * (`SimIntentControls`) and the Progression panel's dropdowns both map over
 * `TEMPO_NAMES` from `cms/src/utils/constants.js`. TL-21 added Quick; these
 * pin that the CMS side offers it and the simulator's passes accept it.
 */
describe('the CMS tempo vocabulary (TL-21)', () => {
    it('is the game\'s list, Quick first', () => {
        expect(TEMPO_NAMES).toBe(GAME_TEMPOS);
        expect(TEMPO_NAMES[0]).toBe('quick');
        expect(isTempo('quick')).toBe(true);
        expect(bandFor('quick', 1)).toEqual(gameBandFor('quick', 1));
    });

    it('the TIME pass places a tagged Quick producer instead of filing an unknown-tempo row', () => {
        expect(bandMiddleMs('quick', 1)).toBe(3000);   // TL-21: the 3s gathering target
        const entity = {
            id: 't', name: 'T', kind: 'token', tempo: 'quick', purpose: 'iph', level: 1,
            outputs: [{ itemId: 'item_x', abundance: 1 }],
        };
        const { cycleTimes, rows } = runTempoPass([entity]);
        expect(rows.find((r) => r.code === 'unknown-tempo')).toBeUndefined();
        expect(cycleTimes.get('t')).toBe(3000);
    });

    it('the TUNE pass keeps a Quick cycle inside 2–4s at level 1', () => {
        const got = cycleCandidates('quick', 1, 3000, 3000);
        expect([...got].sort((a, b) => a - b)).toEqual([2000, 4000]);
    });
});

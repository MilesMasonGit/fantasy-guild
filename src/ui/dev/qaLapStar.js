// The QA fixture's lap star: the Guild Hall star of the drop lap's change pack
// (`2026-11-06-drop-lap`), so a dev build can show the lap at 10 minutes, bought down to 5, before
// the pack is synced. ⚠️ A fixture, gone on reload; never written to `data/`. Mirrors the pack
// (`LapStar.test.js` holds them equal): when the star is synced, the synced one wins.

import { EFFECT_TYPES } from '../../systems/effects/constants.js';

export const LAP_STAR_ID = 'star_well_lap';

const lapRule = (rank, value) => ({
    id: `stm_${LAP_STAR_ID}_${rank}`,
    keyword: 'provides',
    payload: { type: EFFECT_TYPES.PASSIVE_LAP, bucket: 'percentage', value },
    chargeDelta: 0,
    to: { mode: 'all', value: '' },
    reach: 'board',
    target: null,
    when: null,
    upkeep: null
});

/** The pack's star, in the file's shape (`hallStars.js`). */
export function qaLapStar() {
    return {
        constellation: 'well',
        name: 'Swift Laps',
        description: 'The Guild Hall\'s outputs come round sooner: its lap runs 8 minutes, then 6, then 5, from 10.',
        node: { x: 0.45, y: 0.62 },
        links: ['wishing_well'],
        ranks: [
            { tier: 0, price: [{ itemId: 'item_redberry', quantity: 110000 }], rules: [lapRule(1, -0.2)], lines: [] },
            { tier: 1, price: [{ itemId: 'item_cherry', quantity: 140000 }], rules: [lapRule(2, -0.4)], lines: [] },
            { tier: 2, price: [{ itemId: 'item_trout', quantity: 30000 }], rules: [lapRule(3, -0.5)], lines: [] }
        ]
    };
}

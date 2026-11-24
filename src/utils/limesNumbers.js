import { t } from '../i18n/index.js';

const NAMED = [
    [1 / 4, 'quarter'],
    [1 / 3, 'third'],
    [1 / 2, 'half'],
    [2 / 3, 'twoThirds'],
    [3 / 4, 'threeQuarters']
];

/** A fraction in words: a quarter, a third, half, two thirds, three quarters; any other value as a whole percentage. */
export function fractionWords(fraction) {
    const hit = NAMED.find(([value]) => Math.abs(value - fraction) < 1e-9);
    return hit ? t(`limesDefeat.${hit[1]}`) : t('limesDefeat.percent', { percent: Math.round(fraction * 100) });
}

/** A chance as 1 in N when N comes out whole (0.10 is 1 in 10); else a whole percentage. */
export function oneInWords(chance) {
    const n = chance > 0 ? Math.round(1 / chance) : 0;
    if (n >= 2 && Math.abs(1 / n - chance) < 1e-9) return t('limesDefeat.oneIn', { n });
    return t('limesDefeat.percent', { percent: Math.round(chance * 100) });
}

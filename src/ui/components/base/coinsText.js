import { t } from '../../../i18n/index.js';

/** A number of coins in words: `1 coin`, `1,234 coins`. */
export function coinsText(coins) {
    const n = Math.max(0, Math.floor(Number(coins) || 0));
    return t('coins.amount', { count: n, amount: n.toLocaleString('en-US') });
}

// The time away a save slot has built up, in the away summary's own words.

import { formatAway } from '../hud/catchUpSummary.js';
import { CATCH_UP } from '../../../config/loopConstants.js';
import { t } from '../../../i18n/index.js';

/**
 * How long since slot `info` was saved, as the summary says it (`3 h 12 min`), or null for an
 * empty or damaged slot or one with no save time. ⚠️ Only `CATCH_UP.CAP_MS` is ever played, so
 * past it the slot reads the cap with "(max)", which is what loading it gives.
 */
export function slotAwayText(info, now = Date.now()) {
    if (!info || info.damaged) return null;
    const savedAt = Number(info.lastSavedAt);
    if (!(savedAt > 0)) return null;
    const away = Math.max(0, now - savedAt);
    if (away > CATCH_UP.CAP_MS) return t('titleScreen.awayMax', { time: formatAway(CATCH_UP.CAP_MS) });
    return formatAway(away);
}

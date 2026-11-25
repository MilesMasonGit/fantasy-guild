// the Encyclopedia's line on a node kind's Science mastery

import { t } from '../../../i18n/index.js';
import * as Mastery from '../../../systems/progression/Mastery.js';
import { masteryViewOf } from '../board/laboratoryCard.js';
import { KIND } from './encyclopediaModel.js';

/**
 * What a box's card says of the guild's mastery of its kind (brief 810 K6): its rank and the next
 * rank's buff, or that every rank is held. A Token's kind is its type's (an Oak Stump's is Oak's); a
 * crop recipe's is the recipe. None for an entry whose kind has no track.
 *
 * @param {{kind: string, id: string}} entry an Encyclopedia entry
 * @returns {string[]}
 */
export function masteryLinesOf(entry, view = (kind) => masteryViewOf(kind)) {
    if (!entry?.id) return [];
    const kind = entry.kind === KIND.TOKEN ? Mastery.kindOfTypeId(entry.id) : entry.kind === KIND.RECIPE ? entry.id : null;
    const mastery = kind ? view(kind) : null;
    if (!mastery) return [];
    const lines = [t('encyclopedia.mastery', { kind: mastery.name, rank: mastery.rank, ranks: mastery.ranks })];
    lines.push(mastery.next
        ? t('encyclopedia.masteryNext', { rank: mastery.next.roman, buff: mastery.next.buff, toGo: mastery.next.toGo })
        : t('encyclopedia.masteryFull'));
    return lines;
}

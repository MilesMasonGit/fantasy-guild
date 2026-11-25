// a Hideout's card: the camp it robs, what a theft takes, the odds of a catch, and the camps to pick from

import { getTokenType, tokenName, outputRange } from '../../../config/registries/tokenRegistry.js';
import { rareTableOf, rareEntryChances } from '../../../config/registries/rareTables.js';
import { crimeLevelOf, caughtCurveOf } from '../../../config/registries/crime.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { chanceFigure } from '../../../utils/Formatters.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Hideouts from '../../../systems/board/Hideouts.js';
import * as RareTables from '../../../systems/board/RareTables.js';
import * as SkillSystem from '../../../systems/hero/SkillSystem.js';
import { GameState } from '../../../state/GameState.js';
import { lastTheftOf } from './lastTheft.js';

/**
 * What a Hideout's card says, as plain data (`tokenCard.js` calls it for the `theft` block): the
 * camp it is set to rob and its Crime level, a guard standing on it, what a theft there takes (each
 * line at its chance, and the rare finds with Lucky counted), the odds the hero on it is caught,
 * the last theft, and the camps in reach to pick from (the card's list face, `CampList`).
 * Every engine read goes through `src`, so a test can pin it without a mat.
 */

/** The live readers the block takes. */
export function liveTheftSources() {
    return {
        instanceOf: BoardState.getTokenById,
        typeOf: getTokenType,
        tokenName,
        workerOf: BoardState.workerOf,
        heroName: (id) => (GameState.state?.heroes || []).find(h => h?.id === id)?.name || null,
        heroLevel: (heroId, skill) => Number(SkillSystem.getSkillLevel(heroId, skill)) || 0,
        targetOf: Hideouts.targetOf,
        campsInReach: Hideouts.campsInReach,
        guardOf: Hideouts.guardOf,
        robbedEnemyOf: Hideouts.robbedEnemyOfType,
        caughtChanceAt: Hideouts.caughtChanceAt,
        luckyChance: RareTables.luckyChance,
        lastTheft: lastTheftOf
    };
}

/** A steal table's lines, each with its chance, 100 % included: a table reads as odds. */
function stealRows(steal) {
    return (steal?.outputs || []).map(o => {
        const { min, max } = outputRange(o);
        return { itemId: o.itemId, min, max, chance: chanceFigure(o.chance ?? 100) };
    });
}

/** The steal table's rare finds: its chance at the Hideout (Lucky counted), each entry at its share. */
function stealRare(steal, hideoutId, skill, src) {
    const table = steal ? rareTableOf(steal.block) : null;
    if (!table) return null;
    const chance = hideoutId != null && src.luckyChance ? src.luckyChance(hideoutId, table, skill) : table.chance;
    const rows = rareEntryChances(table, chance).map(({ entry, chance: c }) => ({
        itemId: entry.itemId, min: entry.minQty, max: entry.maxQty, chance: chanceFigure(Math.max(0, c))
    }));
    return { chance: chanceFigure(Math.max(0, chance)), rows };
}

/** One camp as the card names it: its name, its enemy's Crime level, and a guard on it. */
function campRow(camp, src) {
    const robbed = src.robbedEnemyOf(camp.typeId);
    const guard = src.guardOf(camp);
    return {
        id: camp.id,
        typeId: camp.typeId,
        name: src.tokenName(camp.typeId),
        enemyTypeId: robbed?.typeId || null,
        crimeLevel: robbed ? crimeLevelOf(robbed.def) : null,
        guarded: !!guard,
        steals: stealRows(robbed?.steal).map(r => r.itemId)
    };
}

/**
 * The `theft` block for a Hideout on the mat (`instance`) or in a catalogue (`instance` null: no
 * camp, no hero; the curve alone).
 */
export function theftBlockOf(instance, def, src = liveTheftSources()) {
    const skill = def?.config?.skill || 'crime';
    const skillName = getSkill(skill)?.name || 'Crime';
    const curve = caughtCurveOf(def);
    if (!instance) return { camp: null, lost: false, guard: null, steals: [], rare: null, caught: null, curve, skillName, last: null, options: [], change: null };

    const camp = src.targetOf(instance);
    const robbed = camp ? src.robbedEnemyOf(camp.typeId) : null;
    const guard = camp ? src.guardOf(camp) : null;
    const heroId = src.workerOf(instance.id) || null;
    const campLevel = robbed ? crimeLevelOf(robbed.def) : null;
    const caught = camp && heroId
        ? {
            chance: chanceFigure(src.caughtChanceAt(instance.id, heroId, camp)),
            heroName: src.heroName(heroId) || 'This hero',
            thiefLevel: src.heroLevel(heroId, skill),
            campLevel
        }
        : null;
    const last = src.lastTheft?.(instance.id) || null;
    return {
        camp: camp ? { ...campRow(camp, src) } : null,
        // A camp was picked but is not one it may rob now (gone, out of reach).
        lost: !camp && typeof instance.stealFrom === 'string',
        guard: guard ? { id: guard.id, typeId: guard.typeId, name: src.tokenName(guard.typeId) } : null,
        steals: stealRows(robbed?.steal),
        rare: stealRare(robbed?.steal, instance.id, skill, src),
        caught,
        curve,
        skillName,
        last: last && last.campId === camp?.id ? last : null,
        options: src.campsInReach(instance).map(c => campRow(c, src)),
        change: { label: camp ? 'Change camp' : 'Choose a camp', chosen: !!camp }
    };
}

/** The words for the last theft: "Stole 2 Wheat, 1 Milk", "Stole nothing", "Caught!". */
export function lastTheftText(last, itemName) {
    if (!last) return '';
    if (last.caught) return 'Caught! A guard stands on the camp';
    const items = (last.items || []).filter(i => i?.itemId && i.quantity > 0);
    if (!items.length) return 'Stole nothing';
    return `Stole ${items.map(i => `${i.quantity} ${itemName(i.itemId)}`).join(', ')}`;
}

// a Laboratory's card and a node's mastery: the node it studies, the kind's ranks, the nodes in reach to pick

import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Laboratories from '../../../systems/board/Laboratories.js';
import * as Mastery from '../../../systems/progression/Mastery.js';
import * as SkillSystem from '../../../systems/hero/SkillSystem.js';
import { GameState } from '../../../state/GameState.js';
import { toRoman } from '../../../utils/Formatters.js';
import { perkTitle, perkLines } from '../dock/heroPerks.js';

/**
 * What a Laboratory's card says (`tokenCard.js` calls it for the `study` block), and the mastery a
 * node's card, a Laboratory's and the Encyclopedia show of a kind, as plain data. The same shape as
 * the Hideout's card (`hideoutCard.js`): the Token it picks, Change, and the list in reach.
 * Every engine read goes through `src`, so a test can pin it without a mat.
 */

/** The live readers. */
export function liveStudySources() {
    return {
        typeOf: getTokenType,
        tokenName,
        workerOf: BoardState.workerOf,
        heroName: (id) => (GameState.state?.heroes || []).find(h => h?.id === id)?.name || null,
        heroLevel: (heroId, skill) => Number(SkillSystem.getSkillLevel(heroId, skill)) || 0,
        targetOf: Laboratories.targetOf,
        candidatesOf: Laboratories.candidatesOf,
        studyOf: Laboratories.studyOf,
        maxLevelOf: Laboratories.maxLevelOf,
        kindOf: Mastery.kindOf,
        standingOf: Mastery.standingOf,
        rankTitle: perkTitle,
        rankLines: perkLines
    };
}

/** One rank of a track, for the card: its number, points, buff title and what its rules do. */
function rankView(row, src) {
    return { rank: row.rank, roman: toRoman(row.rank), points: row.points, buff: src.rankTitle(row), lines: src.rankLines(row) };
}

/**
 * A kind's mastery as the cards show it: `{ kind, name, rank, roman, ranks, points, next, held,
 * mastered, pips }`, `next` the next rank (`{ rank, roman, points, buff, lines, toGo }`, null at full
 * mastery), `held` the ranks held, `pips` one per rank, true where held. Null for a kind with no track.
 */
export function masteryViewOf(kind, src = liveStudySources()) {
    const standing = kind ? src.standingOf(kind) : null;
    if (!standing) return null;
    const next = standing.next ? { ...rankView(standing.next, src), toGo: standing.next.points - standing.points } : null;
    return {
        kind,
        name: standing.name,
        rank: standing.rank,
        roman: standing.rank ? toRoman(standing.rank) : '',
        ranks: standing.ranks,
        points: standing.points,
        next,
        held: standing.held.map(r => rankView(r, src)),
        mastered: standing.mastered,
        pips: standing.track.ranks.map(r => r.rank <= standing.rank)
    };
}

/** One node as the Laboratory names it: its art, its kind's name, level and rank. */
function nodeRow(node, src, { level, refusal = null } = {}) {
    const kind = src.kindOf(node);
    const view = masteryViewOf(kind, src);
    return {
        id: node.id,
        typeId: node.typeId,
        kind,
        name: view?.name || src.tokenName(node.typeId),
        level,
        rank: view?.rank ?? 0,
        ranks: view?.ranks ?? 0,
        refusal
    };
}

/**
 * The `study` block for a Laboratory on the mat (`instance`) or in a catalogue (`instance` null: no
 * node, no hero; its reach alone).
 */
export function studyBlockOf(instance, def, src = liveStudySources()) {
    const skill = def?.config?.skill || 'science';
    const skillName = getSkill(skill)?.name || 'Science';
    const maxLevel = instance ? src.maxLevelOf(instance) : (def?.laboratory?.maxLevel ?? null);
    if (!instance) return { node: null, lost: false, away: false, mastery: null, hero: null, skillName, maxLevel, options: [], change: null };

    const node = src.targetOf(instance);
    const study = node ? src.studyOf(instance) : null;
    const options = src.candidatesOf(instance).map(c => nodeRow(c.node, src, { level: c.level, refusal: c.refusal }));
    const chosen = node ? options.find(o => o.id === node.id) || nodeRow(node, src, {}) : null;
    const heroId = src.workerOf(instance.id) || null;
    return {
        node: chosen,
        // A node was picked but is not one it may study now (gone, out of reach, above its level).
        lost: !node && typeof instance.studies === 'string',
        away: study?.reason === 'node_away',
        mastery: node ? masteryViewOf(chosen.kind, src) : null,
        hero: heroId && chosen
            ? { name: src.heroName(heroId) || 'This hero', level: src.heroLevel(heroId, skill), needs: chosen.level }
            : null,
        skillName,
        maxLevel,
        options,
        change: { label: node ? 'Change node' : 'Choose a node', chosen: !!node }
    };
}

/** The mastery a node's card shows of its kind, or null for a Token of no kind with a track. */
export function nodeMasteryOf(instance, def, src = liveStudySources()) {
    if (!def || Laboratories.isLaboratory(def)) return null;
    const kind = instance ? src.kindOf(instance) : Mastery.kindOfTypeId(def.id);
    return masteryViewOf(kind, src);
}

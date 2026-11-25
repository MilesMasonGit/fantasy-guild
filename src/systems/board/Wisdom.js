// Wisdom, a shrine's blessing: XP earned in its reach is shared with the other heroes working there

import * as BoardState from './BoardState.js';
import * as TileModifiers from './TileModifiers.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { roundByChance } from '../../utils/RNG.js';

/**
 * Wisdom (owner 2026-11-25, the Shrine of Wisdom): when a hero earns XP at a Token a Wisdom rule
 * reaches, every **other** hero working or fighting a Token **the same rule** reaches (the same
 * shrine's reach) gets the rule's share of it, in the skill it was earned in. Two shrines add up:
 * a hero both reach gets both shares, one only one of them reaches gets that one's.
 *
 * * **Earned**: a work cycle's XP (an Echo's again, a catch's), a kill's, and a Grove Felling's
 *   felled trees' (`BoardRunner.giveCycleXp`, `CombatResolutionProcessor.handleVictory`,
 *   `GroveFelling.payOneCycle`). A finished demolition's XP is not: its Token has left the mat.
 * * **Working or fighting**: a hero who has reached the Token their order claims
 *   (`BoardState.workTokenOf`), waiting at it for an input included. Walking, idling on a spot, at
 *   home or healing, none.
 * * **Never shared again**: a share is given straight to the hero (`SkillSystem.addXP`), never back
 *   through here. It takes no XP bonus of its own: the share is of what the earner was given.
 * * **Whole XP**: a share's fraction is paid by chance (`roundByChance`), so 20 % of 3 XP pays 1
 *   three times in five; a whole share draws nothing.
 *
 * Read off the Tokens' own rules (`TileModifiers`' per-Token aggregators: a shrine's reach), never
 * the guild's nor a hero's: those reach no place to share across.
 *
 * ⚠️ The bench's work check pins the `Math.random` stream. With no Wisdom reaching the Token where
 * XP was earned nothing more is read or drawn; a share draws only when it has a fraction.
 */

/**
 * The Wisdom rules reaching Token `instanceId` for `skill`, as `source → percent` (one entry a rule
 * and the Token it comes from), or null for none. Draws nothing.
 */
function rulesAt(instanceId, skill) {
    if (!instanceId || !BoardState.getTokenById(instanceId)) return null;
    const trace = [];
    TileModifiers.getTokenAggregator(instanceId).query(EFFECT_TYPES.WISDOM, skill, trace);
    if (!trace.length) return null;
    const out = new Map();
    for (const { value, modifier } of trace) out.set(modifier.source, (out.get(modifier.source) || 0) + value);
    return out;
}

/**
 * `heroId` just earned `amount` XP of `skill` at Token `instanceId`: share it with every other hero
 * working or fighting a Token the same Wisdom rule reaches, in planting order.
 */
export function shareXp(instanceId, heroId, skill, amount) {
    if (!(amount > 0) || !skill) return;
    const rules = rulesAt(instanceId, skill);
    if (!rules) return;
    for (const [otherId] of BoardState.heroesOnBoard()) {
        if (otherId === heroId) continue;
        const there = rulesAt(BoardState.workTokenOf(otherId), skill);
        if (!there) continue;
        let percent = 0;
        for (const [source, value] of rules) if (there.has(source)) percent += value;
        if (!(percent > 0) || !SkillSystem.heroHasSkill(otherId, skill)) continue;
        const share = roundByChance(amount * percent / 100);
        if (share > 0) SkillSystem.addXP(otherId, skill, share);
    }
}

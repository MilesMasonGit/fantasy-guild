// Grove Felling: a falling tree fells the touching trees of its kind, each paid

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { artRadiusOf } from '../../config/matGeometry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import * as BoardState from './BoardState.js';
import * as Charges from './Charges.js';
import * as CycleSavings from './CycleSavings.js';
import * as Hand from './Hand.js';
import * as OutputRules from './OutputRules.js';
import * as RareDrops from './RareDrops.js';
import * as RareTables from './RareTables.js';
import * as Respawn from './Respawn.js';
import * as TileModifiers from './TileModifiers.js';
import * as Wisdom from './Wisdom.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { neighbourIds, centreOf, distanceSq } from './nearby.js';

/**
 * Grove Feller (Forestry 99): when a tree a hero works falls (a Token that regrows into another
 * when it runs out: an Oak to its Stump), the trees of the same type whose drawn bodies touch it
 * fall too, not the whole reach. Each felled tree pays the hero one cycle's output and XP and rests
 * as the worked tree does, so the next tick turns it into its Stump, a Forest's own tree into that
 * Forest's Stump (the tether rides the change, `EffectActions.transformInstance`).
 *
 * Only the tree the hero works fells its neighbours: a felled tree fells nothing more.
 *
 * A felled tree's cycle is paid by the rules at the worked tree (the hero's perks and tool, the
 * buildings in its reach), as the worked tree's own cycle was: its item lines through Yield, Double
 * Loot and Double Item, and its rare table through Lucky (`OutputRules.landItemLine`,
 * `RareTables.rollRareTable`), landed where the felled tree stands; its XP through the XP rules.
 * Nothing else of a cycle runs for it: no inputs, no failure, no bonus drops, no tool wear, no
 * cycle-complete moment for rules or lessons to count.
 *
 * ⚠️ The bench's work check pins the `Math.random` stream: with no rule offering the chance nothing
 * is drawn, nor with no touching tree of its kind; at 100 the chance itself draws nothing, and only
 * the felled trees' own drops draw.
 */

/** Whether two Tokens' drawn bodies meet: centres no further apart than their two art radii. */
function touching(a, b) {
    const pa = centreOf(a);
    const pb = centreOf(b);
    if (!pa || !pb) return false;
    const reach = artRadiusOf(a.typeId) + artRadiusOf(b.typeId);
    return distanceSq(pa, pb) <= reach * reach;
}

/**
 * The lasting trees of `tree`'s type touching it, in arrival order: on the mat, not in the player's
 * hand, holding the life a roll would end.
 */
export function touchingKin(tree) {
    const out = [];
    for (const id of neighbourIds(tree.id)) {
        const other = BoardState.getTokenById(id);
        if (!other || other.typeId !== tree.typeId) continue;
        if (!(other.usesRemaining > 0) || Hand.isInHand(other.id)) continue;
        if (touching(tree, other)) out.push(other);
    }
    return out;
}

/** One cycle's output and XP for felled tree `felled`, by the rules at worked tree `workedId`. */
function payOneCycle(workedId, felled, def, io, heroId, skill) {
    const times = OutputRules.rollDoubleLoot(workedId, skill) ? 2 : 1;
    for (const output of io?.outputs || []) {
        if (!output?.itemId) continue;
        const chance = output.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;
        OutputRules.landItemLine(workedId, skill, output, times, (sprite) => RareDrops.noteDrop(sprite, chance), felled.id);
    }
    const find = RareTables.rollRareTable(workedId, def, skill);
    if (find) OutputRules.landItemLine(workedId, skill, find.entry, times, (sprite) => RareDrops.noteRareFind(sprite, find.chance), felled.id);

    const baseXp = io?.xp ?? def?.config?.xp ?? 0;
    const xp = SkillSystem.applyXpBonus(baseXp || 0, TileModifiers.resolveAxis(workedId, EFFECT_TYPES.XP_BONUS, baseXp || 0, skill));
    if (xp > 0 && skill) {
        SkillSystem.addXP(heroId, skill, xp);
        Wisdom.shareXp(workedId, heroId, skill, xp);
    }
}

/**
 * Tree `instance` (type `def`, worked with `io`) has just fallen at the end of a cycle hero `heroId`
 * worked (`BoardRunner.completeCycle`), `overMs` before the tick's end: on a Grove Felling hit, the
 * touching trees of its kind fall too, each paid, and rest from that same moment. Rolled once a fall.
 *
 * @returns {string[]} the instance ids felled with it
 */
export function afterFall(instance, def, io, heroId, skill, overMs = 0) {
    if (!heroId || Respawn.respawnOf(def)?.mode !== 'regrow') return [];
    const chance = TileModifiers.resolveAxis(instance.id, EFFECT_TYPES.GROVE_FELLING, 0, skill, heroId);
    if (!(chance > 0)) return [];
    const kin = touchingKin(instance);
    if (!kin.length || !CycleSavings.sureOrRolled(chance)) return [];
    const felled = [];
    for (const tree of kin) {
        payOneCycle(instance.id, tree, getTokenType(tree.typeId) || def, io, heroId, skill);
        if (Charges.spendLife(tree, { heroId })) {
            Respawn.restBeganEarlier(tree, overMs);
            felled.push(tree.id);
        }
    }
    return felled;
}

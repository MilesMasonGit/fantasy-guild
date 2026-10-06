// Fantasy Guild — what a Token *is*, read off what it has

import { KEYWORD, statementsOf } from '../../systems/effects/statements.js';
import { isEnemyDef } from './enemyProfile.js';

/**
 * `tokenType`, derived rather than picked.
 *
 * ## Why the picker went
 * A classification you choose can disagree with the thing it classifies. A classification you
 * *read off* the rules cannot. Managers are retired: a Restocks rule is still read here
 * for the label, but nothing in the engine acts on it.
 *
 * ## But the field still gets written into the file
 * Deleting it would break three real things that are not the engine: the
 * `tokenType` targeting mode, the CMS sidebar's grouping (delete the field and
 * every Token piles into "unclassified"), and `ContentRules.test.js`. So the
 * CMS computes this at sync time and stores the answer. The author never types
 * it; everything downstream keeps working.
 *
 * ## `market` — readable off the Token
 * Gold is retired, so today the label is all a currency output still produces. The Outputs
 * column writes `output.currency` (`OUTPUT_CURRENCIES` in `tokenConstants.js`), so
 * "consumes goods, produces currency" is a real signal and the rung derives like
 * every other one.
 *
 * ⚠️ The currency rung sits **above** Restocks and Acts as. Minting currency is the
 * most distinctive thing a Token can
 * do, and a Market that also handed a capability to its neighbours would
 * otherwise file itself as a `context`.
 *
 * An authored `market` with no currency output is preserved rather than demoted, but the warning names the fix.
 *
 * ## `station` — a statement
 * A Token is a station because it carries a `Works as` statement, and that
 * statement's skill is its recipe pool — so the type and the pool cannot disagree.
 *
 * The rung sits **above** Restocks and Acts as: a Token that both crafts and hands its neighbours a capability is a station first.
 *
 * ## `enemy` — the one rung that is *told*, not read
 * ⚠️ Every other rung above reads a rule the Token already carries. This one
 * reads `def.enemy.level`, a field whose only job is to say "this is an enemy"
 * — the shape of thing the `station` rung was deliberately fixed to stop doing. It is here
 * because the Token editor has a dedicated Enemy section rather than a `Fights as` statement.
 *
 * The disagreement the other rungs prevent is therefore still possible here in
 * principle: a Token could carry `enemy` and behave like something else. In
 * practice it cannot today — `enemy.level` is the sole input to the stat block
 * as well as to this rung, so a Token that claims to be an enemy is one. If
 * enemies ever grow rules of their own, converting this to a statement is the
 * move, and `enemyProfile.js` is the only other file that would change.
 *
 * It sits **first**, above Map. An enemy's drops live in `config.outputs`, so
 * without this rung every enemy would file itself as a `resource`.
 */

/** The ladder, in order. First match wins. */
export function deriveTokenType(def) {
    if (!def) return { type: 'buff', why: 'there is nothing here', warn: true };

    const statements = statementsOf(def);
    const has = keyword => statements.some(s => s?.keyword === keyword);
    const config = def.config;
    const outputs = config?.outputs || [];
    const inputs = config?.inputs || [];
    const hasCycle = !!config && (outputs.length > 0 || inputs.length > 0);

    if (isEnemyDef(def)) return { type: 'enemy', why: 'it is a creature a hero can fight' };
    if (def.mapId) return { type: 'map', why: 'it bursts into a Map' };

    // ⚠️ Above the work-cycle rungs: a promotion Token HAS a cycle — the hero's
    // training — and would otherwise file itself as a station or a passive.
    if (has(KEYWORD.PROMOTES)) return { type: 'promotion', why: 'it promotes the hero standing on it to a job' };

    // A spawner is its own
    // kind: what it does is put other Tokens on the mat, which no rung below
    // describes. Above the currency and work-cycle rungs so a spawner that also
    // has a cycle still files by the thing that makes it distinctive.
    if (def.spawner) return { type: 'spawner', why: 'it spawns other Tokens around it' };

    if (outputs.some(o => o?.currency)) {
        return {
            type: 'market',
            why: inputs.length
                ? 'it turns goods into currency'
                : 'it pays out in currency'
        };
    }

    if (has(KEYWORD.STATION)) return { type: 'station', why: 'it says it works as a station' };
    // A Foundation runs recipes (the ones that build on its kind), so it is a
    // station — its pool comes from `foundation.skill`, not a Works as rule.
    if (def.foundation) return { type: 'station', why: 'it is a Foundation that buildings are built on' };

    if (has(KEYWORD.RESTOCKS)) return { type: 'manager', why: 'it restocks its neighbours' };
    if (has(KEYWORD.ACTS_AS)) return { type: 'context', why: 'it acts as a tool for its neighbours' };

    // An authored Market that does not actually sell anything. Preserved rather
    // than demoted behind the owner's back, but the warning now names the fix.
    if (def.tokenType === 'market') {
        return {
            type: 'market',
            why: 'it was authored as a Market but produces no currency — add a Gold payout to its Outputs',
            warn: true
        };
    }

    if (hasCycle && def.requiresHero === false) return { type: 'passive', why: 'it works with no hero' };
    if (hasCycle && outputs.length) return { type: 'resource', why: `it produces ${outputs.length === 1 ? 'something' : 'things'} from nothing` };

    // A Token that turns (Coast ↔ Shrimp Coast) is a feature of the land that
    // is worth something while turned. With a work cycle of its own it already
    // filed as a resource above; without one it still does something.
    if (def.turns) return { type: 'resource', why: 'it turns into something else for a while' };
    if (def.grows) return { type: 'resource', why: 'it grows into something else after a while' };

    if (has(KEYWORD.PROVIDES) || has(KEYWORD.GRANTS)) {
        return { type: 'buff', why: 'it changes what happens around it' };
    }

    return { type: 'buff', why: 'it has no rules and no work cycle — this Token does nothing', warn: true };
}

/** Just the type, for callers that do not need the reason. */
export function derivedTokenType(def) {
    return deriveTokenType(def).type;
}

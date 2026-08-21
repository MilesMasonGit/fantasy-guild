// Fantasy Guild — what a Token *is*, read off what it has

import { KEYWORD, statementsOf } from '../../systems/effects/statements.js';

/**
 * `tokenType`, derived rather than picked.
 *
 * ## Why the picker went
 * It offered nine values, the engine read three of them, and one — `manager` —
 * was a promise the data could not keep: `Managers.js` decides a Manager by
 * `def.manages`, no CMS field ever wrote that, so a Token typed `manager` and
 * described as restocking its neighbours did nothing at all. A classification
 * you choose can disagree with the thing it classifies. A classification you
 * *read off* the rules cannot.
 *
 * ## But the field still gets written into the file
 * Deleting it would break three real things that are not the engine: the
 * `tokenType` targeting mode, the CMS sidebar's grouping (delete the field and
 * every Token piles into "unclassified"), and `ContentRules.test.js`. So the
 * CMS computes this at sync time and stores the answer. The author never types
 * it; everything downstream keeps working.
 *
 * ## `market` — now readable off the Token, as of Phase 2
 * `BoardRunner` credits gold when an output entry carries `currency` (D-141) —
 * the only thing in the running game that makes a Market a Market. Phase 1 left
 * an authored `market` standing because **no CMS field wrote `output.currency`**;
 * the Outputs column now does (`OUTPUT_CURRENCIES` in `tokenConstants.js`), so
 * "consumes goods, produces currency" is a real signal and the rung derives like
 * every other one.
 *
 * ⚠️ The currency rung sits **above** Restocks and Acts as, unlike the ladder in
 * §1.2 of the design. Minting currency is the most distinctive thing a Token can
 * do, and a Market that also handed a capability to its neighbours would
 * otherwise file itself as a `context`. No authored Token has both today, so
 * nothing re-files because of this.
 *
 * An authored `market` with no currency output is still preserved rather than
 * demoted behind the owner's back — but the warning now names the fix, because
 * there finally is one.
 */

/** The ladder, in order. First match wins. */
export function deriveTokenType(def) {
    if (!def) return { type: 'buff', why: 'there is nothing here', warn: true };

    const statements = statementsOf(def);
    const has = keyword => statements.some(s => s?.keyword === keyword);
    const config = def.config;
    const outputs = config?.outputs || [];
    const inputs = config?.inputs || [];
    const hasCycle = !!config && (outputs.length > 0 || inputs.length > 0 || !!config.recipePool || !!def.recipePool);

    if (def.enemyId) return { type: 'enemy', why: 'it spawns a creature' };
    if (def.mapId) return { type: 'map', why: 'it bursts into a Map' };

    if (outputs.some(o => o?.currency)) {
        return {
            type: 'market',
            why: inputs.length
                ? 'it turns goods into currency'
                : 'it pays out in currency'
        };
    }

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

    if (hasCycle && inputs.length) return { type: 'station', why: 'it turns one thing into another' };
    if (hasCycle && def.requiresHero === false) return { type: 'passive', why: 'it works with no hero' };
    if (hasCycle && outputs.length) return { type: 'resource', why: `it produces ${outputs.length === 1 ? 'something' : 'things'} from nothing` };

    if (has(KEYWORD.PROVIDES) || has(KEYWORD.GRANTS)) {
        return { type: 'buff', why: 'it changes what happens around it' };
    }

    return { type: 'buff', why: 'it has no rules and no work cycle — this Token does nothing', warn: true };
}

/** Just the type, for callers that do not need the reason. */
export function derivedTokenType(def) {
    return deriveTokenType(def).type;
}

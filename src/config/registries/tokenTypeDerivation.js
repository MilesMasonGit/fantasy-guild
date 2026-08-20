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
 * ## ⚠️ `market` is the one rung with no authorable signal yet
 * `BoardRunner` credits gold when an output entry carries `currency` (D-141) —
 * that is the only thing in the running game that makes a Market a Market. **No
 * CMS field writes `output.currency`**, so `token_shrimp_market` consumes Raw
 * Shrimp and produces nothing, and would otherwise derive as an ordinary
 * `station`. Rather than invent a second signal (skill = commerce? inputs and
 * no outputs?) — which is the owner's call, not this code's — an authored
 * `market` is left standing and `ContentAudit` says out loud that it needs a
 * currency output to actually sell anything.
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
    if (has(KEYWORD.RESTOCKS)) return { type: 'manager', why: 'it restocks its neighbours' };
    if (has(KEYWORD.ACTS_AS)) return { type: 'context', why: 'it acts as a tool for its neighbours' };

    if (outputs.some(o => o?.currency)) return { type: 'market', why: 'its output is currency' };

    // See the note above: nothing can author a currency output yet, so an
    // authored Market is preserved rather than demoted behind the owner's back.
    if (def.tokenType === 'market') {
        return {
            type: 'market',
            why: 'it was authored as a Market — nothing about its production says so yet',
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

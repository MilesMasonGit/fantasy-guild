// Fantasy Guild — the statement grammar (effect authoring redesign, Phase 1)

import { MODIFIER_PALETTE, getPaletteEntry } from '../../config/registries/modifierPalette.js';

/**
 * A Token's rules are **statements**, and a statement is one sentence.
 *
 * ```
 * [ When <event>, ]  KEYWORD  <payload>  [ to <filter> ]  [ , costing <upkeep> ]
 *      optional       always    always      some keywords      optional
 * ```
 *
 * ## Why this replaced `effectBlocks`
 * A block was one flexible container holding five unrelated mechanics — target,
 * capability provision, trigger, upkeep and a *list* of modifiers. Five
 * mechanics in one box means the editor shows all five whether or not they
 * apply, and a block carrying three modifiers is three sentences pretending to
 * be one, which is why no honest description of it could ever be generated.
 *
 * A statement carries **exactly one** thing it does. The rules text is then the
 * statements rendered in words, and a wrong statement makes a wrong sentence —
 * the validation loop the old pipeline never had.
 *
 * ## ⚠️ Two things this shape fixes that the old one could not
 *
 * 1. **A stable `id` on every statement.** `BlockUpkeep` and `TriggerSystem`
 *    keyed their save-resident per-copy state by **position in the array**, so
 *    reordering a Token's rules in the CMS silently remapped a live save's
 *    upkeep and cooldown state onto the wrong rule. Statements are sentences;
 *    reordering them is the normal thing to want. Keying by id makes reordering
 *    free.
 * 2. **Legality is declared, not hoped for.** A number effect inside a
 *    triggered block was read by *neither* system — `TileModifiers` skipped
 *    triggered blocks and `TriggerSystem` only handled item grants and
 *    conversions. `KEYWORDS` below says which keywords accept a trigger and
 *    which accept upkeep, so the editor cannot offer the combination at all.
 *
 * ## What is deliberately NOT here (Phase 2)
 * `Cannot` — restrictions and adjacency limits. The keyword is designed for
 * (the grammar has room for it) but nothing enforces one yet, so offering it
 * would be another promise the data does not keep.
 */

/** The keywords a statement may start with. */
export const KEYWORD = Object.freeze({
    PROVIDES: 'provides',
    GRANTS: 'grants',
    ACTS_AS: 'acts_as',
    REQUIRES: 'requires',
    RESTOCKS: 'restocks',
    CONVERTS: 'converts'
});

/** Whether a keyword may carry a `When …` clause. */
export const WHEN = Object.freeze({
    NEVER: 'never',
    OPTIONAL: 'optional',
    REQUIRED: 'required'
});

/**
 * Every keyword, with what it accepts.
 *
 * `filter` says whether the statement may name *which* neighbours it reaches.
 * `Acts as`, `Requires`, `Restocks` and `Converts` have none: a capability is
 * handed to every neighbour without discrimination, a requirement is about this
 * Token, a restock list *is* its own filter, and a conversion touches the Bank
 * rather than any neighbour at all.
 */
export const KEYWORDS = Object.freeze([
    {
        id: KEYWORD.PROVIDES,
        label: 'Provides',
        blurb: 'Changes a number on nearby Tokens — yield, work time, XP and the rest.',
        filter: true,
        when: WHEN.NEVER,
        upkeep: true
    },
    {
        id: KEYWORD.GRANTS,
        label: 'Grants',
        blurb: 'Hands a nearby Token an extra item when it finishes work.',
        filter: true,
        when: WHEN.OPTIONAL,
        upkeep: true
    },
    {
        id: KEYWORD.ACTS_AS,
        label: 'Acts as',
        blurb: 'Hands a capability — a pickaxe, an anvil — to every adjacent station.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: true
    },
    {
        id: KEYWORD.REQUIRES,
        label: 'Requires',
        blurb: 'This Token does not work unless something beside it supplies a capability.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: false
    },
    {
        id: KEYWORD.RESTOCKS,
        label: 'Restocks',
        blurb: 'Keeps named neighbours supplied from the Guild Bank when they run dry.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: true
    },
    {
        id: KEYWORD.CONVERTS,
        label: 'Converts',
        blurb: 'Spends items from the Bank and produces others. Needs a firing moment.',
        filter: false,
        when: WHEN.REQUIRED,
        upkeep: true
    }
]);

/** One keyword's rules, or null. */
export function getKeyword(id) {
    return KEYWORDS.find(k => k.id === id) || null;
}

/**
 * Which number effects may sit inside a statement with a `When` clause.
 *
 * This is the mirror image the old `triggeredOnly` flag never had. `Convert` was
 * hidden until a block had a trigger; nothing hid Yield from a block that *did*,
 * so six of the eight palette entries could be authored into a statement where
 * neither system would ever read them.
 */
export function paletteForKeyword(keywordId, hasTrigger) {
    if (keywordId === KEYWORD.PROVIDES) {
        // Provides changes a **number**. The item-carrying shapes have their own
        // keywords — Grants and Converts — so offering them here too would be
        // two ways to author one thing, which is how the old editor's five
        // sections started.
        return MODIFIER_PALETTE.filter(e => e.shape === 'deterministic' || e.shape === 'proc');
    }
    if (keywordId === KEYWORD.GRANTS) {
        return MODIFIER_PALETTE.filter(e => e.type === 'BONUS_DROP');
    }
    if (keywordId === KEYWORD.CONVERTS) {
        return MODIFIER_PALETTE.filter(e => e.type === 'CONVERT');
    }
    void hasTrigger;
    return [];
}

/** A short, sortable, collision-proof statement id. */
export function newStatementId() {
    return `stm_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** The blank payload each keyword starts with. */
export function blankPayload(keywordId) {
    switch (keywordId) {
        case KEYWORD.PROVIDES:
            return { type: 'YIELD', bucket: 'percentage', value: 0 };
        case KEYWORD.GRANTS:
            return { type: 'BONUS_DROP', itemId: '', quantity: 1, chance: 100 };
        case KEYWORD.ACTS_AS:
            return { tag: '', tier: 1 };
        case KEYWORD.REQUIRES:
            return { tag: '', minTier: 1 };
        case KEYWORD.RESTOCKS:
            return { tokenIds: [] };
        case KEYWORD.CONVERTS:
            return { type: 'CONVERT', consumes: [], produces: [], chance: 100 };
        default:
            return {};
    }
}

/**
 * A new statement, legal by construction.
 *
 * A `Converts` statement is born with its trigger because the keyword requires
 * one — an unfireable conversion should not be a state the editor can be in,
 * even for a moment.
 */
export function makeStatement(keywordId, data = {}) {
    const keyword = getKeyword(keywordId);
    const statement = {
        id: newStatementId(),
        keyword: keywordId,
        payload: blankPayload(keywordId),
        to: keyword?.filter ? { mode: 'all', value: '' } : null,
        when: keyword?.when === WHEN.REQUIRED
            ? { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: '', threshold: 1, cooldownMs: 5000 }
            : null,
        upkeep: null,
        ...data
    };
    return statement;
}

/**
 * A Token's statements.
 *
 * ⚠️ **`effectBlocks` is not read here, deliberately.** Content authored in the
 * old shape is not migrated and not silently reinterpreted — it simply has no
 * statements, and `ContentAudit` says so by name at boot. A quiet
 * half-translation is the failure mode this redesign exists to remove.
 */
export function statementsOf(def) {
    return Array.isArray(def?.statements) ? def.statements : [];
}

/** Statements of one keyword. */
export function statementsWith(def, keywordId) {
    return statementsOf(def).filter(s => s?.keyword === keywordId);
}

/**
 * Whether a Token still carries the retired shape and therefore does nothing.
 *
 * Both the old container names count: `effectBlocks` was the array, and `buff`
 * was the single-block form that preceded it.
 */
export function hasRetiredEffectData(def) {
    if (Array.isArray(def?.effectBlocks) && def.effectBlocks.length) return true;
    return !!def?.buff;
}

/**
 * The palette entry a `Provides` statement is scaling, or null.
 * Convenience for the renderer and the editor, which both need it.
 */
export function effectEntryOf(statement) {
    return getPaletteEntry(statement?.payload?.type);
}

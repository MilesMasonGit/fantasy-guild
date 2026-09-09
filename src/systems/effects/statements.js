// Fantasy Guild — the statement grammar (effect authoring redesign, Phase 1)

import { MODIFIER_PALETTE, getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { blankRestriction } from '../../config/registries/restrictionPalette.js';
import { DEFAULT_REACH } from '../../config/registries/reachRegistry.js';
import { ROLE } from '../../config/registries/roleRegistry.js';

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
 * ## Phase 2 added three keywords
 * `Cannot` (a placement restriction, enforced in `Placement.js`) and `Applies`
 * (a status effect landing on the heroes working the Tokens the filter names).
 * Both fit the same four slots; neither needed a new concept bolted on beside
 * the grammar.
 */

/** The keywords a statement may start with. */
export const KEYWORD = Object.freeze({
    PROVIDES: 'provides',
    GRANTS: 'grants',
    ACTS_AS: 'acts_as',
    REQUIRES: 'requires',
    RESTOCKS: 'restocks',
    CONVERTS: 'converts',
    CANNOT: 'cannot',
    APPLIES: 'applies',
    DEALS: 'deals',
    STATION: 'station'
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
 * `Acts as`, `Requires` and `Restocks` have none: a capability is handed to
 * every neighbour without discrimination, a requirement is about this Token, and
 * a restock list *is* its own filter.
 *
 * ⚠️ `Converts` gained one in ER-14, and it is the one filter that names a
 * **single** destination rather than a set — see the note on its row.
 *
 * ## `reach` — how far the statement carries (Effects Robustness P2)
 *
 * A second, independent axis: `filter` says *which* Tokens, `reach` says *how
 * far*. `reachRegistry.js` holds the vocabulary. Three keywords declare it, and
 * the omissions are all deliberate (ER-6):
 *
 * * **`Requires` and `Works as`** are statements *about this Token*. There is
 *   nothing for a reach to vary.
 * * **`Acts as` and `Restocks`** hand things to neighbours with no filter at
 *   all; giving them a reach without a filter would be half a targeting
 *   vocabulary, and `Acts as` reaching further is a real balance change that the
 *   concept declined for items on exactly those grounds.
 * * **`Converts`** already names a *single destination* through its filter.
 *   "How far" adds nothing coherent on top of "which one".
 * * **`Cannot`** is a placement restriction read once by `Placement.js`, not an
 *   effect that carries. A board-wide restriction — *"no more than three of
 *   these anywhere"* — is a genuinely useful idea and a genuinely different
 *   feature, so it waits for its own slice rather than arriving as fallout.
 */
export const KEYWORDS = Object.freeze([
    {
        id: KEYWORD.PROVIDES,
        label: 'Provides',
        blurb: 'Changes a number on nearby Tokens — yield, work time, XP and the rest.',
        filter: true,
        reach: true,
        when: WHEN.NEVER,
        upkeep: true
    },
    {
        id: KEYWORD.GRANTS,
        label: 'Grants',
        blurb: 'Hands a nearby Token an extra item when it finishes work.',
        filter: true,
        reach: true,
        when: WHEN.OPTIONAL,
        upkeep: true
    },
    {
        /**
         * ⚠️ **Deliberately does not scale** (UE-7).
         *
         * `tier` looks like a magnitude and is not one: it is which capability
         * this is, and `RecipeResolver` gates on it with `>= minTier`. A Tier 3
         * pickaxe is a *different tool*, not a stronger one, which is why the
         * shipped content models Iron/Mythril/Adamantium as their own library
         * entries rather than one entry at three scales.
         */
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
        /**
         * ⚠️ **The filter picks ONE destination, not a set** (ER-14).
         *
         * Every other filtered keyword broadcasts: `Provides` reaches each
         * neighbour it names, `Grants` gives each of them an item, `Applies`
         * puts a status on each of their heroes. A conversion cannot, because it
         * is an **exchange** with a fixed input — producing onto four Kilns
         * would quadruple the output while the Bank paid once.
         *
         * So `TriggerSystem` takes the lowest-indexed match and the sentence
         * says *"onto the nearest"* in as many words. The owner's own example is
         * singular: a Sigil turning Stone into Bricks and putting them on the
         * adjacent Kiln.
         *
         * An absent filter still means the firing tile (D-40), so nothing
         * authored before this changed behaviour.
         */
        id: KEYWORD.CONVERTS,
        label: 'Converts',
        blurb: 'Spends items from the Bank and produces others. Needs a firing moment.',
        filter: true,
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * ⚠️ **No trigger and no upkeep, both deliberately** (design §3.7).
         *
         * A restriction is not a thing that *happens*, so it has no firing
         * moment; and a rule that lapses when you run out of coal is a trap
         * rather than a rule, so it cannot be bought off with upkeep either.
         */
        id: KEYWORD.CANNOT,
        label: 'Cannot',
        blurb: 'A restriction on where this Token may sit. Refused at the moment you put it down.',
        filter: true,
        when: WHEN.NEVER,
        upkeep: false
    },
    {
        /**
         * ⚠️ **The filter names Tokens; the status lands on people.**
         *
         * The owner ruled that `Applies` uses the same filter as every other
         * keyword, so there is one targeting concept in the grammar rather than
         * two. A filter selecting Tokens therefore resolves to **the heroes
         * working those Tokens** — and `statementText.js` says so in the
         * sentence, in those words, so the reading is never ambiguous.
         */
        id: KEYWORD.APPLIES,
        label: 'Applies',
        reach: true,
        /**
         * A scale multiplies the **stacks** applied (UE-7). `Applies` is the
         * one scalable keyword whose payload has no palette row behind it —
         * a status is not an axis — so it declares its own field here.
         */
        scales: 'stacks',
        blurb: 'Puts a status on the heroes working nearby Tokens — Well Fed, Poison, and the rest.',
        filter: true,
        when: WHEN.OPTIONAL,
        upkeep: true
    },
    {
        /**
         * ⭐ **The first keyword that DOES something to a person**
         * (Effects Grammar v2, V2).
         *
         * Nine keywords and not one of them acted: `Provides` scales a number,
         * `Grants` drops an item, `Applies` attaches a status. Nothing dealt
         * damage, which is why Thorns was unauthorable.
         *
         * ⚠️ **A moment is REQUIRED.** Damage happens at an instant; a
         * continuously-dealt 1 damage has no meaning and no reader. The default
         * moment is `SELF_CYCLE_COMPLETE` because that is the Thorns case and
         * the one this verb was built for — *"a cycle completed targeting this
         * entity"* — which covers a hero harvesting a bush and a hero killing a
         * monster alike, since one kill is one cycle (D-129).
         *
         * ⚠️ **It targets a ROLE, not a tile.** `to` filters Tokens by tag or
         * id; damage is dealt to a *participant* — the actor, or the bearer.
         * The two are different questions and this keyword asks the second, so
         * it declares no `filter` and no `reach`.
         */
        id: KEYWORD.DEALS,
        label: 'Deals',
        scales: 'amount',
        blurb: 'Deals damage to somebody involved in the moment — the hero who just harvested or fought this.',
        filter: false,
        targetsRole: true,
        when: WHEN.REQUIRED,
        upkeep: true
    },
    {
        /**
         * ⚠️ **This statement is the only thing that makes a Token a Station**
         * (rework P2.5, R-15), and its skill is the Token's whole recipe pool
         * (R-14). `deriveTokenType` reads the keyword; `recipesForToken` reads
         * the payload. There is no second field either of them consults.
         *
         * No filter (the statement is about this Token), no trigger (being a
         * station is not a thing that happens) and no upkeep (a Token that
         * stopped being a station when it ran out of coal would be a trap).
         */
        id: KEYWORD.STATION,
        label: 'Works as',
        blurb: 'Makes this a station. It can run any recipe of the skill you pick.',
        filter: false,
        when: WHEN.NEVER,
        upkeep: false
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

/**
 * What a triggered statement spends when it does not author a `chargeDelta`.
 *
 * -1. `Charges.statementChargeDelta` applies this when the field is absent, and
 * `Charges` imports the constant from here rather than declaring its own: the
 * CMS authoring control needs the same number, and the CMS reads the statement
 * grammar (this file) without pulling in the board runtime.
 *
 * ⚠️ The absence of the field is **not** `chargeDelta: 0`. An author who wants a
 * free effect writes a zero; that is why `makeStatement` stamps an explicit
 * value on the keywords that can carry a trigger.
 */
export const DEFAULT_STATEMENT_CHARGE_DELTA = -1;

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
        case KEYWORD.CANNOT:
            return blankRestriction();
        case KEYWORD.DEALS:
            // `ignoresArmor` is written out rather than left absent so the
            // editor shows a real state and G-23's default — damage RESPECTS
            // armour — is visible rather than implied.
            return { amount: 1, ignoresArmor: false };
        case KEYWORD.APPLIES:
            // `target` is read only when an ITEM carries this rule (UE-24): a
            // Token's `Applies` uses its filter and ignores the field. Defaulted
            // to the hero because that is the reading a Token already has, so an
            // effect moved from a Token to an item keeps meaning the same thing.
            return { statusId: '', stacks: 1, chance: 100, target: 'hero' };
        case KEYWORD.STATION:
            return { skill: '' };
        default:
            return {};
    }
}

/**
 * The moment a keyword that REQUIRES one is born with.
 *
 * ⚠️ This used to be a single hardcoded `ITEM_THRESHOLD`, which was the right
 * default for the only keyword that then required a moment (`Converts` watches
 * the Bank). `Deals` requires one too and wants a completely different answer,
 * so the default became a per-keyword question rather than a constant.
 *
 * A born-with-a-moment statement is never an unfireable rule the editor can sit
 * in, even for an instant — the reason `Converts` got a default in the first
 * place.
 */
function defaultMoment(keywordId) {
    if (keywordId === KEYWORD.DEALS) {
        // ⭐ The Thorns case: "a cycle completed targeting this entity", which
        // is a hero harvesting a bush and a hero killing a monster alike
        // (D-129). The moment this verb exists for, so it is the moment it
        // starts on.
        return { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 };
    }
    return { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: '', threshold: 1, cooldownMs: 5000 };
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
        /**
         * Written out, not left absent, on the keywords that can fire.
         *
         * `TriggerSystem.fireStatement` is the only caller that reads a charge
         * delta, and it only ever sees statements carrying a `when` clause, so
         * a keyword that can never carry one gets no field. On the ones that
         * can, the value is stamped so the editor shows a real number and an
         * author's `0` is distinguishable from a blank.
         */
        /**
         * ⚠️ Stamped on **every** keyword since P2, and the number differs.
         *
         * A rule that can fire is born costing 1 per firing, which is what such
         * rules have always cost. A rule that cannot fire is born costing
         * **nothing**, because "every cycle of this Token" is a new moment and
         * an aura that suddenly started wearing its Token down would re-cost
         * content the owner authored on the opposite understanding (UE-20).
         *
         * Written out rather than left absent so the editor shows a real number
         * and an author's explicit `0` stays distinguishable from a blank.
         */
        chargeDelta: keyword?.when !== WHEN.NEVER ? DEFAULT_STATEMENT_CHARGE_DELTA : 0,
        to: keyword?.filter ? { mode: 'all', value: '' } : null,
        /**
         * Written out on the keywords that can carry one, the same way `to` is,
         * so the editor shows a real value rather than a blank.
         *
         * ⚠️ Its **absence** still means `adjacent` (ER-5) — that is what makes
         * every statement authored before P2 keep its behaviour without a
         * migration touching a single file. `reachOf` owns that default; this
         * only decides what a *new* statement starts as.
         */
        reach: keyword?.reach ? DEFAULT_REACH : null,
        /**
         * Who the statement acts on, as a **role** rather than a tile filter
         * (Effects Grammar v2). Only the keywords that act on a participant
         * carry one; everything else aims with `to` and `reach`.
         *
         * ⚠️ V4 folds `to`, `reach` and this into one selector shape. It is
         * introduced separately here so the new verb is not blocked on
         * migrating four old ones, and so the migration happens once, later,
         * with filters arriving at the same time.
         */
        target: keyword?.targetsRole ? { role: ROLE.ACTOR } : null,
        when: keyword?.when === WHEN.REQUIRED ? defaultMoment(keywordId) : null,
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
 * The skill a Token's `Works as` statement names, or null if it has none.
 *
 * Both halves of station-ness resolve through this: `deriveTokenType` calls a
 * Token with one of these a `station`, and `recipesForToken` returns that
 * skill's pool. A Token with several takes the first — the shape allows more
 * than one, nothing reads past the first, and no authored Token has two.
 */
export function stationSkillOf(def) {
    for (const statement of statementsWith(def, KEYWORD.STATION)) {
        if (statement?.payload?.skill) return statement.payload.skill;
    }
    return null;
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

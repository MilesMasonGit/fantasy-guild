// Fantasy Guild — the filters a selector may stack (Effects Grammar v2, V4)

/**
 * **Which** of the things in range a rule actually picks.
 *
 * ## Filter, not guard (G-8)
 * A filter narrows **who** a rule hits: *"every adjacent Token with fewer than
 * three charges"*. A **guard** would decide **whether** the rule fires at all:
 * *"only if the hero is below half health"*. The first renders as one honest
 * sentence and is what this file is; the second wants AND/OR/NOT trees and has
 * no sentence anyone would trust, and it is refused.
 *
 * That distinction is the whole line between a vocabulary and a rules engine,
 * and it is the line the owner drew.
 *
 * ## Composable, AND-only (G-9)
 * A selector stacks any number of these and every one must pass. There is no OR
 * and no nesting — those are the shapes with no sentence. *"Not tagged Coast,
 * and being worked"* is two rows that read as one clause.
 *
 * ## ⚠️ Every filter declares what it needs to look at
 * A filter about a **definition** (a tag, a station) can be answered anywhere. A
 * filter about **state** (charges left, currently being worked) needs the live
 * instance or the tile, and not every caller has one — `Restrictions` asks about
 * arrangement at the moment a Token is put down, and there is no instance to
 * inspect. So a filter says what it needs, and a caller that cannot supply it
 * refuses the match rather than guessing. `ContentAudit` names the combination
 * so an author is told, rather than watching a rule quietly never fire.
 *
 * ## ⚠️ A row ships with its reader or not at all
 * Same discipline as `TRIGGER_EVENTS`, `REACHES` and `CHARGE_MOMENTS`. Every row
 * below is evaluated by `matchesTokenTarget`.
 */

/** What a filter has to look at to answer. */
export const FILTER_NEEDS = Object.freeze({
    /** The Token definition — always available. */
    DEF: 'def',
    /** The live instance on the board: charges, wear. */
    INSTANCE: 'instance',
    /** The tile, so the board can be asked who is standing there. */
    TILE: 'tile'
});

/**
 * @type {ReadonlyArray<{
 *   id: string, label: string, hint: string, needs: string,
 *   value?: 'text'|'number', placeholder?: string,
 *   match: (ctx: object, value: any) => boolean,
 *   phrase: (value: any, names: object) => string
 * }>}
 */
export const FILTER_KINDS = Object.freeze([
    {
        id: 'tagged',
        label: 'tagged …',
        hint: 'Carries this tag. Tags match exactly, including case.',
        needs: FILTER_NEEDS.DEF,
        value: 'text',
        placeholder: 'e.g. Coast',
        match: ({ def }, value) => !!value && (def?.tags || []).includes(value),
        phrase: (value) => value ? `tagged ${value}` : 'tagged …',
        negative: (value) => value ? `not tagged ${value}` : 'not tagged …'
    },
    {
        id: 'is_station',
        label: 'a station',
        hint: 'Any Token that works as a station — it has a Works as rule.',
        needs: FILTER_NEEDS.DEF,
        match: ({ def }) => (def?.statements || []).some(s => s?.keyword === 'station'),
        phrase: () => 'working as a station',
        negative: () => 'not working as a station'
    },
    {
        id: 'charges_below',
        label: 'with fewer than … charges',
        hint: 'How worn down it is. A Token with unlimited charges never matches — it is never running out.',
        needs: FILTER_NEEDS.INSTANCE,
        value: 'number',
        match: ({ instance }, value) => {
            const left = instance?.usesRemaining;
            // ⚠️ `null` is UNLIMITED (R-4), not zero. A Token that can never run
            // down is never "running low", and reading its null as 0 would make
            // every unlimited Token match a rule aimed at exhausted ones.
            if (left == null) return false;
            return left < (Number(value) || 0);
        },
        phrase: (value) => `with fewer than ${Number(value) || 0} charges`,
        // ⚠️ Said as its positive opposite rather than as "not with fewer
        // than", which is not English. Every filter owns both readings, because
        // negating a phrase mechanically is what produces sentences nobody
        // would write.
        negative: (value) => `with ${Number(value) || 0} or more charges`
    },
    {
        id: 'worked',
        label: 'being worked',
        hint: 'A hero is standing on it right now.',
        needs: FILTER_NEEDS.TILE,
        match: ({ heroOnTile }) => !!heroOnTile,
        phrase: () => 'being worked',
        negative: () => 'not being worked'
    }
]);

/** One filter kind, or null. */
export function getFilterKind(id) {
    return FILTER_KINDS.find(f => f.id === id) || null;
}

/** A statement's stacked filters, normalised. Tolerates absence and rubbish. */
export function filtersOf(spec) {
    const raw = Array.isArray(spec?.filters) ? spec.filters : [];
    return raw.filter(f => f && getFilterKind(f.kind));
}

/**
 * Whether every stacked filter passes (G-9: AND, always).
 *
 * @param {object} spec     the `to` selector
 * @param {object} ctx      `{ def, instance, tile, heroOnTile }` — whatever the
 *                          caller can supply
 * @param {Set<string>} available  which of `FILTER_NEEDS` the caller supplied
 */
export function matchesFilters(spec, ctx, available) {
    for (const entry of filtersOf(spec)) {
        const kind = getFilterKind(entry.kind);

        /**
         * ⚠️ A filter the caller cannot evaluate **fails**, and never passes.
         *
         * `Restrictions` asks about a Token being put down and has no live
         * instance to inspect, so "with fewer than 3 charges" has no answer
         * there. Failing is the safe direction: a rule that reaches nothing is
         * visible and reportable, where a rule that silently reaches EVERYTHING
         * because a filter could not be checked is a narrow effect turned
         * board-wide — the exact failure `matchesTokenTarget` refuses for
         * unknown modes.
         */
        if (!available.has(kind.needs)) return false;

        const passed = kind.match(ctx, entry.value);
        if (entry.not ? passed : !passed) return false;
    }
    return true;
}

/**
 * "not tagged Coast" — one filter in words.
 *
 * ⚠️ Each kind owns **both** readings. Negating mechanically — sticking "not" in
 * front of whatever the positive said — produces "not with fewer than 3
 * charges", which is not a sentence anybody would write. The opposite of
 * "fewer than 3" is "3 or more", and only the filter knows that.
 */
export function filterPhrase(entry, names = {}) {
    const kind = getFilterKind(entry?.kind);
    if (!kind) return '…';
    return entry.not
        ? (kind.negative?.(entry.value, names) ?? `not ${kind.phrase(entry.value, names)}`)
        : kind.phrase(entry.value, names);
}

/**
 * "tagged Coast and being worked" — the stacked clause, attached directly.
 *
 * ## ⚠️ Why these are modifiers and not a relative clause
 * The first version wrote "that is …", which forced a number agreement the
 * renderer cannot win: the frame in front may be singular (*"every adjacent
 * Token"*, *"this Token"*) or plural (*"adjacent Coast Tokens"*), so it produced
 * "Tokens that is being worked". Phrases that attach directly — *"adjacent Coast
 * Tokens tagged Wet"*, *"every adjacent Token being worked"* — read correctly
 * after either, and need no agreement at all.
 *
 * Returns an empty string when there is nothing to say, so a caller concatenates
 * without checking, and every sentence authored before V4 is unchanged.
 */
export function filtersPhrase(spec, names = {}) {
    const entries = filtersOf(spec);
    if (!entries.length) return '';
    return ` ${entries.map(e => filterPhrase(e, names)).join(' and ')}`;
}

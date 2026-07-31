// Fantasy Guild — Card Effect Registry (Area Deck Rework, C-3)
//
// A card carries a LIST of effects, and any card may carry any combination
// (concept doc D-60). "Task" and "Boost" are labels for pack pools and display
// only — the engine must never branch on card type to decide what a card can
// DO. That rule is why this registry exists: adding a new kind of card
// behaviour should be authoring plus one resolver, never an engine rewrite.
//
// This formalises a pattern the codebase already proved works. Mutator cards
// are ordinary cards that take normal Work Time and stamp a token as an extra
// payoff, dispatched by looking for a trait rather than by checking a type.
// Effects generalise that: every behaviour is a listed effect, and a card with
// no effect of a given kind simply does nothing for it.

/**
 * When an effect fires. A fixed, ordered set (owner decision, C-3 review):
 * predictable to author, easy to show on a card face, and it matches the
 * shape the loop already runs in.
 *
 * A genuinely new timing need means adding a phase here — deliberately a
 * visible change rather than something an author can invent ad hoc.
 */
export const EFFECT_PHASES = {
    /** The card is drawn, before the hero begins it. */
    ON_DRAW: 'on_draw',
    /** The hero arrives and starts work. Hazards bite here (D-11). */
    ON_ACTIVATE: 'on_activate',
    /** Work finished. Outputs, restores and token stamps land here. */
    ON_COMPLETE: 'on_complete'
};

/** Phases in the order the engine runs them. */
export const PHASE_ORDER = [
    EFFECT_PHASES.ON_DRAW,
    EFFECT_PHASES.ON_ACTIVATE,
    EFFECT_PHASES.ON_COMPLETE
];

/**
 * How far a buff reaches (D-10). Reach is kept separate from phase because
 * they are orthogonal: a buff *fires* at a moment and *lasts* for a span.
 */
export const EFFECT_REACH = {
    /** Applies only to the card carrying it. */
    SELF: 'self',
    /** Buffs only the card immediately after this one. */
    NEXT_CARD: 'next_card',
    /** Applies from this card to the end of the loop — the Aura archetype. */
    LOOP: 'loop'
};

/** Registered effect kinds, keyed by kind id. */
const EFFECT_KINDS = new Map();

/**
 * Register an effect kind.
 *
 * @param {object} def
 * @param {string} def.kind      Unique id, e.g. 'work_output'.
 * @param {string} def.phase     One of EFFECT_PHASES.
 * @param {string} [def.summary] One-line human description of the kind.
 * @param {(payload: object) => string[]} [def.validate]
 *        Returns a list of problems with an authored payload; empty means valid.
 */
export function defineEffect({ kind, phase, summary = '', validate = () => [] }) {
    if (!kind) throw new Error('defineEffect: `kind` is required');
    if (!PHASE_ORDER.includes(phase)) {
        throw new Error(`defineEffect("${kind}"): unknown phase "${phase}"`);
    }
    if (EFFECT_KINDS.has(kind)) {
        throw new Error(`defineEffect: "${kind}" is already registered`);
    }
    EFFECT_KINDS.set(kind, { kind, phase, summary, validate });
    return EFFECT_KINDS.get(kind);
}

/** The definition for an effect kind, or null if it isn't registered. */
export function getEffectKind(kind) {
    return EFFECT_KINDS.get(kind) || null;
}

/** Every registered effect kind id. */
export function listEffectKinds() {
    return [...EFFECT_KINDS.keys()];
}

/** True when `kind` has been registered. */
export function isEffectKind(kind) {
    return EFFECT_KINDS.has(kind);
}

/**
 * The effects from `effects` that fire in `phase`, in authored order.
 * Authored order is preserved so a card can, say, damage before it yields.
 *
 * @param {object[]} effects
 * @param {string} phase
 * @returns {object[]}
 */
export function effectsForPhase(effects, phase) {
    if (!Array.isArray(effects)) return [];
    return effects.filter(e => getEffectKind(e?.kind)?.phase === phase);
}

/** The first effect of `kind` on a card, or null. */
export function findEffect(effects, kind) {
    if (!Array.isArray(effects)) return null;
    return effects.find(e => e?.kind === kind) || null;
}

/** True when the card carries at least one effect of `kind`. */
export function hasEffect(effects, kind) {
    return findEffect(effects, kind) !== null;
}

/**
 * Validate an authored effect list.
 *
 * @param {object[]} effects
 * @returns {string[]} Problems found; empty means the list is valid.
 */
export function validateEffects(effects) {
    const problems = [];
    if (effects === undefined || effects === null) return problems;
    if (!Array.isArray(effects)) return ['`effects` must be an array'];

    effects.forEach((effect, index) => {
        const where = `effects[${index}]`;
        if (!effect || typeof effect !== 'object') {
            problems.push(`${where}: must be an object`);
            return;
        }
        const def = getEffectKind(effect.kind);
        if (!def) {
            problems.push(`${where}: unknown effect kind "${effect.kind}"`);
            return;
        }
        for (const problem of def.validate(effect)) {
            problems.push(`${where} (${effect.kind}): ${problem}`);
        }
    });

    return problems;
}

// ---------------------------------------------------------------------------
// Built-in effect kinds
//
// These cover the behaviours the game already has plus the ones the rework
// designs. Each is small on purpose — the point is that the NEXT one is an
// authoring change plus a resolver, not an engine change.
// ---------------------------------------------------------------------------

/** Yields items and/or XP when the card completes. The classic Task payoff. */
export const EFFECT_WORK_OUTPUT = defineEffect({
    kind: 'work_output',
    phase: EFFECT_PHASES.ON_COMPLETE,
    summary: 'Yields items and XP on completion.',
    validate(payload) {
        const problems = [];
        const outputs = payload.outputs;
        if (outputs !== undefined && !Array.isArray(outputs)) {
            problems.push('`outputs` must be an array when present');
        }
        if (payload.xp !== undefined && typeof payload.xp !== 'number') {
            problems.push('`xp` must be a number when present');
        }
        if (!outputs?.length && !payload.xp) {
            problems.push('needs at least one output or some xp');
        }
        return problems;
    }
});

/**
 * Damages the hero when they arrive at the card (D-8, D-11). Once per
 * execution, so four hazard cards in a loop is four hits.
 */
export const EFFECT_HAZARD = defineEffect({
    kind: 'hazard',
    phase: EFFECT_PHASES.ON_ACTIVATE,
    summary: 'Damages the hero on arrival, once per execution.',
    validate(payload) {
        const problems = [];
        if (typeof payload.damage !== 'number' || payload.damage <= 0) {
            problems.push('`damage` must be a positive number');
        }
        return problems;
    }
});

/** Restores HP or Energy on completion — what a Rest card does. */
export const EFFECT_RESTORE = defineEffect({
    kind: 'restore',
    phase: EFFECT_PHASES.ON_COMPLETE,
    summary: 'Restores hero HP or Energy on completion.',
    validate(payload) {
        const problems = [];
        if (payload.resource !== 'hp' && payload.resource !== 'energy') {
            problems.push("`resource` must be 'hp' or 'energy'");
        }
        if (typeof payload.amount !== 'number' || payload.amount <= 0) {
            problems.push('`amount` must be a positive number');
        }
        return problems;
    }
});

/**
 * Buffs other cards on the banner (D-10). `reach` decides the archetype:
 * LOOP is the Aura (best in slot 1, covering the whole deck), NEXT_CARD is
 * the sequencing play. Any card may carry one — including a card that also
 * yields output, which is the hybrid D-60 exists to allow.
 */
export const EFFECT_BUFF = defineEffect({
    kind: 'buff',
    phase: EFFECT_PHASES.ON_ACTIVATE,
    summary: 'Buffs later cards in the loop.',
    validate(payload) {
        const problems = [];
        const reaches = Object.values(EFFECT_REACH);
        if (!reaches.includes(payload.reach)) {
            problems.push(`\`reach\` must be one of ${reaches.join(', ')}`);
        }
        if (!Array.isArray(payload.modifiers) || payload.modifiers.length === 0) {
            problems.push('`modifiers` must be a non-empty array');
        }
        return problems;
    }
});

/** Stamps a token onto other slots — what Mutator cards do today. */
export const EFFECT_TOKEN_STAMP = defineEffect({
    kind: 'token_stamp',
    phase: EFFECT_PHASES.ON_COMPLETE,
    summary: 'Stamps a token onto slots in the deck.',
    validate(payload) {
        return payload.tokenId ? [] : ['`tokenId` is required'];
    }
});

/** The card is a fight: the hero engages an enemy on arrival. */
export const EFFECT_COMBAT = defineEffect({
    kind: 'combat',
    phase: EFFECT_PHASES.ON_ACTIVATE,
    summary: 'Starts combat against an enemy.',
    validate(payload) {
        return payload.enemyId ? [] : ['`enemyId` is required'];
    }
});

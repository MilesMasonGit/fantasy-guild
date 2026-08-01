// Fantasy Guild — Card Effects: authoring bridge and derived type (C-3)
//
// Two jobs, both in service of concept doc D-60 ("cards are composable, not
// typed") and D-61 ("copy limits are authored per card"):
//
//   1. `getCardEffects` gives the engine an effect list for ANY card — one
//      authored with `effects`, or a legacy card whose behaviour still lives
//      in `config.outputs` / `config.enemyId` / `config.tokenId`. Existing
//      content keeps working untouched while new content is authored directly
//      as effects.
//
//   2. `deriveCardType` computes a card's type from what it DOES. Type is a
//      label for pack pools and display only; nothing branches on it to decide
//      capability. This mirrors the CMS's `inferCardType` (rework L13: type is
//      derived from content, never picked from a dropdown), one layer down —
//      the CMS reads authored fields, the game reads effects.

import { CARD_TYPES } from '../registries/cardConstants.js';
import { hasEffect, findEffect, validateEffects } from './effectRegistry.js';

/**
 * The default copy cap for a card (D-13): four is exactly a full banner.
 * Uniques declare 1. See `getMaxCopies`.
 */
export const DEFAULT_MAX_COPIES = 4;

/**
 * Read a value from either the flat template or its nested `config`, matching
 * how the rest of the card code tolerates both shapes.
 */
function read(template, key) {
    return template?.[key] ?? template?.config?.[key] ?? null;
}

/**
 * Item outputs, excluding combat triggers — an ambush trigger is not a yield.
 * Same exclusion the CMS's inferCardType makes, so both sides agree.
 */
function itemOutputs(template) {
    const outputs = read(template, 'outputs') || template?.drops || [];
    if (!Array.isArray(outputs)) return [];
    return outputs.filter(o => o && o.type !== 'combat_trigger' && (o.itemId || o.id));
}

/**
 * Build an effect list for a legacy card whose behaviour is still described by
 * `config` fields rather than an authored `effects` array.
 *
 * Deliberately conservative: it only emits effects for signals that already
 * drive behaviour today, so translating a card cannot change what it does.
 *
 * @param {object} template
 * @returns {object[]}
 */
export function deriveEffectsFromLegacy(template) {
    if (!template) return [];
    const effects = [];

    const enemyId = read(template, 'enemyId');
    if (enemyId) {
        effects.push({ kind: 'combat', enemyId });
    }

    const tokenId = read(template, 'tokenId');
    if (tokenId) {
        effects.push({ kind: 'token_stamp', tokenId });
    }

    const outputs = itemOutputs(template);
    const xp = read(template, 'xp') || 0;
    if (outputs.length || xp) {
        effects.push({ kind: 'work_output', outputs, xp });
    }

    // Consumable cards carry their restore on the linked ITEM, not the card,
    // so this emits the item-backed form of `restore` — the resolver reads
    // `restoreAmount` and the `drink` tag off the item. That keeps the legacy
    // consumable path expressible as an effect rather than a card-type branch.
    if (template.cardType === 'consumable') {
        const itemId = read(template, 'itemId');
        if (itemId) effects.push({ kind: 'restore', itemId });
    }

    return effects;
}

/**
 * The complete effect list for a card.
 *
 * Authored `effects` come first and always win. Legacy `config` signals are
 * then translated and appended **only for kinds the card didn't author** — so
 * a card can declare a hazard as an effect while still describing its yield
 * the old way, and the list stays a complete picture of what the card does.
 *
 * That completeness matters because D-60 makes the effect list the card's
 * description: `deriveCardType` and every future consumer read it. A card that
 * authored only a hazard would otherwise look like it produces nothing.
 *
 * @param {object} template
 * @returns {object[]}
 */
export function getCardEffects(template) {
    const authored = Array.isArray(template?.effects) ? template.effects : [];
    if (authored.length === 0) return deriveEffectsFromLegacy(template);

    const authoredKinds = new Set(authored.map(e => e?.kind));
    const inherited = deriveEffectsFromLegacy(template)
        .filter(e => !authoredKinds.has(e.kind));

    return inherited.length ? [...authored, ...inherited] : authored;
}

/**
 * Derive a card's type from its effects. First match wins; the order matters
 * and mirrors the CMS ruleset so both sides label a card the same way.
 *
 *   1. stamps a token                     → action (a Mutator)
 *   2. fights, and yields no items        → combat
 *   3. yields output                      → task   (a hybrid that also buffs
 *                                                   still reads as a Task —
 *                                                   work output wins the label)
 *   4. only buffs                         → boost
 *   5. only restores                      → task   (Rest is a Task, D-3)
 *   6. nothing recognisable               → task   (the safe default)
 *
 * @param {object[]} effects
 * @returns {string} a CARD_TYPES value
 */
export function deriveCardType(effects) {
    if (hasEffect(effects, 'token_stamp')) return CARD_TYPES.ACTION;

    const fights = hasEffect(effects, 'combat');
    const works = hasEffect(effects, 'work_output');

    if (fights && !works) return CARD_TYPES.COMBAT;
    if (works) return CARD_TYPES.TASK;
    if (hasEffect(effects, 'buff')) return CARD_TYPES.BOOST;
    if (hasEffect(effects, 'restore')) return CARD_TYPES.TASK;

    return CARD_TYPES.TASK;
}

/** Convenience: derive a card's type straight from its template. */
export function getCardType(template) {
    return deriveCardType(getCardEffects(template));
}

/**
 * How many copies of this card the player may own (D-61). Authored per card,
 * independent of what effects it carries — a powerful hybrid can be made
 * unique while a simple buff card allows four. Drives the binder's pip count
 * (D-49), which is why uniques must report 1 rather than 4.
 *
 * Falls back to the legacy `isUnique` boolean so existing content is correct
 * without being re-authored.
 *
 * @param {object} template
 * @returns {number}
 */
export function getMaxCopies(template) {
    const authored = template?.maxCopies;
    if (typeof authored === 'number' && authored > 0) return authored;
    if (template?.isUnique) return 1;
    return DEFAULT_MAX_COPIES;
}

/**
 * Validate a card's authoring: its effect list, and its copy cap.
 *
 * @param {object} template
 * @returns {string[]} Problems found; empty means valid.
 */
export function validateCardEffects(template) {
    const problems = validateEffects(template?.effects);

    const max = template?.maxCopies;
    if (max !== undefined && (typeof max !== 'number' || max < 1 || max > DEFAULT_MAX_COPIES)) {
        problems.push(`maxCopies must be a number between 1 and ${DEFAULT_MAX_COPIES}`);
    }

    // A buff with LOOP reach in the last slot does nothing, and a NEXT_CARD
    // buff in the last slot does nothing either — but that's a placement
    // choice the player makes, not an authoring error. Nothing to check here.
    const buff = findEffect(template?.effects, 'buff');
    if (buff && buff.reach === 'self') {
        problems.push("a 'buff' with reach 'self' has no one to buff — use a stat effect on the card instead");
    }

    return problems;
}

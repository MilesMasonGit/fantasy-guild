// Fantasy Guild - Status Effect Registry
// Status Effects first pass (status_effects_concept.md).
// Every status is data: the engine (StatusEffectSystem) reads this registry;
// no status has one-off code scattered elsewhere. SCB-discoverable.

/**
 * === Status Schema ===
 * {
 *   id: string,
 *   name: string,
 *   icon: string,             // emoji placard icon
 *   category: 'buff'|'debuff',
 *   combatOnly: boolean,      // cleared when the fight resolves (§3A)
 *   stackModel: 'decrement'   // one instance; re-application adds stacks;
 *                             //   magnitude = valuePerStack × current stacks (§4A)
 *             | 'layered',    // each application is its own layer with an
 *                             //   independent lifetime; magnitudes sum (§4B)
 *   maxStacks?: number,       // decrement model cap
 *   duration?: number,        // layered model: decay events until the layer expires
 *   effect: {
 *     type: 'dot'             // damage per tick (true damage — bypasses Armor/Block, can kill)
 *         | 'attack_fail'     // % chance the attack attempt fails
 *         | 'flat_armor'      // flat Armor added in the damage step
 *         | 'damage_pct'      // % outgoing damage bonus
 *         | 'yield_pct',      // % task output yield bonus
 *     valuePerStack: number,
 *     cap?: number            // ceiling on the summed value (e.g. attack_fail chance)
 *   },
 *   decay: 'tick'             // −1 stack per global 5s tick
 *        | 'hit_taken'        // −1 stack per successful hit received (not on miss/block)
 *        | 'attack_attempt'   // −1 stack per attack attempt
 *        | 'combat_resolved'  // layered: −1 duration per combat encounter resolved
 *        | 'slot_resolved'    // layered: −1 duration per loop slot resolved
 * }
 */

export const STATUS_EFFECTS = {
    // === Damage over Time (persist from combat into the loop, §3A) ===
    poison: {
        id: 'poison',
        name: 'Poison',
        icon: '☠️',
        category: 'debuff',
        combatOnly: false,
        stackModel: 'decrement',
        maxStacks: 99,
        effect: { type: 'dot', valuePerStack: 2 },
        decay: 'tick',
        description: 'Takes 2 damage per stack every 5s. Long and grinding.'
    },
    burning: {
        id: 'burning',
        name: 'Burning',
        icon: '🔥',
        category: 'debuff',
        combatOnly: false,
        stackModel: 'decrement',
        maxStacks: 3,
        effect: { type: 'dot', valuePerStack: 4 },
        decay: 'tick',
        description: 'Takes 4 damage per stack every 5s. Hot but short (max 3 stacks).'
    },
    bleed: {
        id: 'bleed',
        name: 'Bleed',
        icon: '🩸',
        category: 'debuff',
        combatOnly: false,
        stackModel: 'decrement',
        maxStacks: 99,
        effect: { type: 'dot', valuePerStack: 3 },
        decay: 'tick',
        description: 'Takes 3 damage per stack every 5s.'
    },

    // === Combat-only tactical statuses (clear on combat resolution, §3A) ===
    stun: {
        id: 'stun',
        name: 'Stun',
        icon: '💫',
        category: 'debuff',
        combatOnly: true,
        stackModel: 'decrement',
        maxStacks: 10,
        effect: { type: 'attack_fail', valuePerStack: 0.25, cap: 0.8 },
        decay: 'attack_attempt',
        description: '25% chance per stack to fail an attack. Decays per attempt.'
    },
    armor_shield: {
        id: 'armor_shield',
        name: 'Armor Shield',
        icon: '🛡️',
        category: 'buff',
        combatOnly: true,
        stackModel: 'decrement',
        maxStacks: 99,
        effect: { type: 'flat_armor', valuePerStack: 1 },
        decay: 'hit_taken',
        description: '+1 flat Armor per stack. Loses a stack when a hit lands (not on miss/block).'
    },

    // === Layered buffs (independent lifetimes, summed magnitude, §4B) ===
    well_fed: {
        id: 'well_fed',
        name: 'Well Fed',
        icon: '🍖',
        category: 'buff',
        combatOnly: false,
        stackModel: 'layered',
        duration: 3, // combat encounters
        effect: { type: 'damage_pct', valuePerStack: 0.10 },
        decay: 'combat_resolved',
        description: '+10% damage per layer for the next 3 combat encounters.'
    },
    cookout: {
        id: 'cookout',
        name: 'Cookout',
        icon: '🍳',
        category: 'buff',
        combatOnly: false,
        stackModel: 'layered',
        duration: 3, // loop slots
        effect: { type: 'yield_pct', valuePerStack: 0.10 },
        decay: 'slot_resolved',
        description: '+10% gathering yield per layer for the next 3 loop slots.'
    }
};

export function getStatusEffect(statusId) {
    return STATUS_EFFECTS[statusId] || null;
}

export function getAllStatusEffects() {
    return STATUS_EFFECTS;
}

// ---------------------------------------------------------------------------
// Pure helpers over a status-instance array.
// An instance is { id, stacks, remaining? } — 'remaining' only on layered
// statuses. These are side-effect free so leaf modules (CombatFormulas) can
// use them without importing the engine.
// ---------------------------------------------------------------------------

/**
 * Sum the total magnitude of one effect type across a status list.
 * @param {Array} statuses - entity status instances
 * @param {string} effectType - e.g. 'flat_armor', 'damage_pct'
 * @returns {number}
 */
export function sumStatusEffect(statuses, effectType) {
    if (!statuses || statuses.length === 0) return 0;
    let total = 0;
    let cap = null;
    for (const instance of statuses) {
        const def = STATUS_EFFECTS[instance.id];
        if (!def || def.effect.type !== effectType) continue;
        total += def.effect.valuePerStack * (instance.stacks || 0);
        if (def.effect.cap != null) cap = def.effect.cap;
    }
    return cap != null ? Math.min(total, cap) : total;
}

/**
 * Total stacks of a specific status (layered instances summed).
 */
export function getStatusStacks(statuses, statusId) {
    if (!statuses) return 0;
    return statuses
        .filter(s => s.id === statusId)
        .reduce((sum, s) => sum + (s.stacks || 0), 0);
}

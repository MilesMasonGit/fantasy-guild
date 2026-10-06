// Fantasy Guild - Job Registry
// The 19-entry job tree (skill_class_rework_roadmap_v1.md §2).

import {
    SKILLS,
    SKILL_LAYERS,
    FOUNDATION_SKILL_IDS,
    HERO_SKILL_SLOTS
} from './skillRegistry.js';

/**
 * JobRegistry — **the class tree is the skill unlock tree.**
 *
 * ## ⭐ Promotion keeps every foundation skill
 * A hero on any job holds **all nine foundation skills plus the job's own
 * non-foundation skills** (`getJobSheet`). Promotion only ever adds (and,
 * when re-training across branches, swaps) non-foundation skills:
 *
 * ```
 * RECRUIT            9 foundation · no combat skill · cannot fight      (9)
 *    │  promote        +1 combat  +1 shared
 *    ▼
 * BASE CLASS         9 foundation · 1 combat · 1 shared                (11)
 *    │  promote        +1 shared  +1 signature
 *    ▼
 * ADVANCED JOB       9 foundation · 1 combat · 2 shared · 1 signature  (13)
 * ```
 *
 * ## ⚠️ The `skills` arrays below are still six wide
 * They are the job's authored LIST, kept because the promotion gate reads its
 * foundation picks (a Knight gates on the Mining and Smithing it lists) and
 * `JobTree.test.js` checks its layer shape. A listed foundation skill is no
 * longer the only one a hero holds: every foundation skill is.
 *
 * ⚠️ The **Warlord** still lists `construction`, which is a foundation skill,
 * so it has no signature skill.
 *
 * ## Each job declares its LIST, not its deltas
 * What a promotion *grants* and *removes* is derived by diffing the held sheets
 * against the parent's (`grantsOf`, `removesOf`).
 *
 * This is deliberately the opposite of storing the deltas. Deltas are what the
 * player experiences, but sheets are what everything else needs to know, and a
 * sheet cannot silently drift out of agreement with its own parent. **Re-parent
 * a job and its deltas recompute themselves**.
 *
 * ## ⚠️ Everything else is derived
 * Which skill is the combat one, which is the signature, which are foundation —
 * none of that is declared. It is read from each skill's `layer` in
 * `skillRegistry.js`. **Nothing here may hardcode a skill id outside a `skills`
 * array**, so moving a skill between layers needs no edit in this file at all.
 *
 * ## ⚠️ This list is a first draft
 * Which jobs exist, what each holds, and the shape of
 * the tree are all expected to change. `JobTree.test.js` asserts the structural
 * rules — every promoted list exactly 6, foundation pairs subset of the parent's,
 * signatures unique, coverage even — so the tree can be rearranged freely and
 * the tests will say if a rearrangement broke something.
 */

/** Tier 0 is the waiting room; 1 is a base class; 2 is a specialised job. */
export const JOB_TIERS = { RECRUIT: 0, BASE: 1, ADVANCED: 2 };

/**
 * Promotion cost, per tier.
 *
 * ⚠️ **Every number here is a placeholder for the balance pass.**
 * `skillLevel` is the threshold each *carried-forward* skill must reach
 * to become a Knight you need the Mining and Smithing a Knight keeps,
 * not an arbitrary hero level. That shape is settled; the values are not.
 *
 * ⚠️ **Re-training uses the same cost as entering the job.** It is
 * the only respec the player has, so its price is the single most
 * important balance dial in the rework — and the roadmap's advice is to ship it
 * cheap and raise it, because a forgiving system is far easier to tighten than
 * a punishing one is to recover from.
 */
export const PROMOTION_COSTS = {
    // ⚠️ Gold and materials are retired: a promotion is
    // paid for with a charge of the Token whose Promotes rule names the job.
    // The skill threshold — the qualification — is all this table holds now.
    [JOB_TIERS.BASE]: { skillLevel: 10 },
    [JOB_TIERS.ADVANCED]: { skillLevel: 25 }
};

export const JOBS = {
    // === Tier 0 ==========================================================
    recruit: {
        id: 'recruit', name: 'Recruit', tier: JOB_TIERS.RECRUIT, parent: null,
        description: 'Wide and shallow — a little of everything, badly. Cannot fight.',
        icon: '🧑',
        skills: [...FOUNDATION_SKILL_IDS]
    },

    // === Tier 1 — the six base classes ===================================
    // 4 foundation · 1 combat · 1 shared. The shared skill a base class grants
    // is its identity, and every advanced job under it inherits that skill.
    fighter: {
        id: 'fighter', name: 'Fighter', tier: JOB_TIERS.BASE, parent: 'recruit',
        description: 'A frontline soldier who leads from the front.',
        icon: '⚔️',
        skills: ['mining', 'logging', 'smithing', 'crafting', 'melee', 'leadership']
    },
    cleric: {
        id: 'cleric', name: 'Cleric', tier: JOB_TIERS.BASE, parent: 'recruit',
        description: 'A devoted servant who fights and mends in equal measure.',
        icon: '✝️',
        skills: ['mining', 'smithing', 'crafting', 'cooking', 'melee', 'faith']
    },
    ranger: {
        id: 'ranger', name: 'Ranger', tier: JOB_TIERS.BASE, parent: 'recruit',
        description: 'A hunter at home in the wild, and deadly at distance.',
        icon: '🏹',
        skills: ['logging', 'fishing', 'crafting', 'cooking', 'ranged', 'nature']
    },
    rogue: {
        id: 'rogue', name: 'Rogue', tier: JOB_TIERS.BASE, parent: 'recruit',
        description: 'An opportunist who takes what is not offered.',
        icon: '🗝️',
        skills: ['mining', 'logging', 'fishing', 'crafting', 'ranged', 'crime']
    },
    wizard: {
        id: 'wizard', name: 'Wizard', tier: JOB_TIERS.BASE, parent: 'recruit',
        description: 'A scholar who binds power into things.',
        icon: '🔮',
        skills: ['smithing', 'fishing', 'crafting', 'cooking', 'magic', 'enchanting']
    },
    alchemist: {
        id: 'alchemist', name: 'Alchemist', tier: JOB_TIERS.BASE, parent: 'recruit',
        description: 'A compounder of reagents, and of trouble.',
        icon: '🧪',
        skills: ['logging', 'fishing', 'crafting', 'cooking', 'magic', 'alchemy']
    },

    // === Tier 2 — the twelve advanced jobs ===============================
    // 2 foundation · 1 combat · 2 shared · 1 signature. The signature is
    // exclusive: one job, one signature, no exceptions.
    knight: {
        id: 'knight', name: 'Knight', tier: JOB_TIERS.ADVANCED, parent: 'fighter',
        description: 'Masterwork plate, and outgrown gear tempered into something better.',
        icon: '🛡️',
        skills: ['mining', 'smithing', 'melee', 'leadership', 'faith', 'armory']
    },
    warlord: {
        id: 'warlord', name: 'Warlord', tier: JOB_TIERS.ADVANCED, parent: 'fighter',
        description: 'Permanent stone — vaults, paving and a hall that grows.',
        icon: '🧱',
        skills: ['mining', 'logging', 'melee', 'leadership', 'crime', 'construction']
    },
    zealot: {
        id: 'zealot', name: 'Zealot', tier: JOB_TIERS.ADVANCED, parent: 'cleric',
        description: 'Pyres, sacrifices and hexes that strip an enemy bare.',
        icon: '💀',
        skills: ['mining', 'smithing', 'melee', 'faith', 'leadership', 'occult']
    },
    paladin: {
        id: 'paladin', name: 'Paladin', tier: JOB_TIERS.ADVANCED, parent: 'cleric',
        description: 'Scribed scrolls, consecrated gear, and scripture that holds.',
        icon: '📜',
        skills: ['smithing', 'cooking', 'melee', 'faith', 'enchanting', 'inscription']
    },
    druid: {
        id: 'druid', name: 'Druid', tier: JOB_TIERS.ADVANCED, parent: 'ranger',
        description: 'Living companions that haul, hunt and fight beside you.',
        icon: '🐺',
        skills: ['fishing', 'cooking', 'ranged', 'nature', 'alchemy', 'beastmaster']
    },
    scout: {
        id: 'scout', name: 'Scout', tier: JOB_TIERS.ADVANCED, parent: 'ranger',
        description: 'Forward camps and towers that supercharge whatever they sit beside.',
        icon: '⛺',
        skills: ['logging', 'crafting', 'ranged', 'nature', 'crime', 'survival']
    },
    merchant: {
        id: 'merchant', name: 'Merchant', tier: JOB_TIERS.ADVANCED, parent: 'rogue',
        // ⚠️ The only job that can run a Market, which makes this
        // promotion an economic turning point rather than a stat change.
        description: 'Markets and charters that turn surplus goods into gold.',
        icon: '💰',
        skills: ['mining', 'logging', 'ranged', 'crime', 'leadership', 'commerce']
    },
    assassin: {
        id: 'assassin', name: 'Assassin', tier: JOB_TIERS.ADVANCED, parent: 'rogue',
        description: 'Toxins, weapon oils and acids — potions aimed the other way.',
        icon: '☠️',
        skills: ['fishing', 'crafting', 'ranged', 'crime', 'alchemy', 'brewing']
    },
    conjurer: {
        id: 'conjurer', name: 'Conjurer', tier: JOB_TIERS.ADVANCED, parent: 'wizard',
        description: 'Disposable minions that fight so a hero does not have to.',
        icon: '👻',
        skills: ['smithing', 'fishing', 'magic', 'enchanting', 'faith', 'summoning']
    },
    astromancer: {
        id: 'astromancer', name: 'Astromancer', tier: JOB_TIERS.ADVANCED, parent: 'wizard',
        description: 'Lenses, star-charts and beacons that bend what the world drops.',
        icon: '🔭',
        skills: ['crafting', 'cooking', 'magic', 'enchanting', 'nature', 'astrology']
    },
    scientist: {
        id: 'scientist', name: 'Scientist', tier: JOB_TIERS.ADVANCED, parent: 'alchemist',
        description: 'Research that permanently sharpens recipes across the guild.',
        icon: '⚗️',
        skills: ['fishing', 'cooking', 'magic', 'alchemy', 'enchanting', 'science']
    },
    engineer: {
        id: 'engineer', name: 'Engineer', tier: JOB_TIERS.ADVANCED, parent: 'alchemist',
        description: 'Managers, drones and clockwork — the board working unattended.',
        icon: '⚙️',
        skills: ['logging', 'crafting', 'magic', 'alchemy', 'nature', 'engineering']
    }
};

/** The id every new hero starts on. */
export const STARTING_JOB_ID = 'recruit';

export function getAllJobIds() {
    return Object.keys(JOBS);
}

/** A job definition, or null. */
export function getJob(jobId) {
    return JOBS[jobId] || null;
}

/** Every job at a tier. */
export function getJobsByTier(tier) {
    return getAllJobIds().filter(id => JOBS[id].tier === tier);
}

/** The jobs a hero can promote into from `jobId`. */
export function getPromotionsFrom(jobId) {
    return getAllJobIds().filter(id => JOBS[id].parent === jobId);
}

/**
 * The job's **listed** skills — its `skills` array as authored (nine for a
 * Recruit, six for a promoted job).
 *
 * ⚠️ This is NOT everything a hero on the job holds; that is
 * `getJobSheet`. The list still matters: its layer shape is what the tree's
 * design rules check, and its foundation picks are what the promotion gate
 * asks for (`getPromotionGateSkills`).
 */
export function getJobSkills(jobId) {
    return JOBS[jobId]?.skills ? [...JOBS[jobId].skills] : [];
}

/**
 * Every skill a hero on this job **holds**: all the foundation skills, plus the
 * job's own non-foundation skills.
 *
 * Promotion never removes a foundation skill, so a promoted hero can still
 * build, farm and explore. The sheet widens with each tier — 9 for a Recruit,
 * 11 for a base class, 13 for an advanced job (12 for the Warlord). Derived, so a job's list needs
 * no edit when the foundation layer grows; a foundation skill a job lists is
 * simply already held.
 */
export function getJobSheet(jobId) {
    if (!JOBS[jobId]) return [];
    const own = getJobSkills(jobId).filter(id => !FOUNDATION_SKILL_IDS.includes(id));
    return [...FOUNDATION_SKILL_IDS, ...own];
}

/** Skills in one layer of a job's LISTED skills — derived, never declared. */
export function getJobSkillsByLayer(jobId, layer) {
    return getJobSkills(jobId).filter(id => SKILLS[id]?.layer === layer);
}

/** The one combat skill this job grants, or null for a Recruit. */
export function getJobCombatSkill(jobId) {
    return getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT)[0] || null;
}

/** The exclusive signature skill, or null below tier 2. */
export function getJobSignatureSkill(jobId) {
    return getJobSkillsByLayer(jobId, SKILL_LAYERS.SIGNATURE)[0] || null;
}

/** Whether a hero on this job can fight at all. */
export function jobCanFight(jobId) {
    return getJobCombatSkill(jobId) !== null;
}

/**
 * What promoting from a job's parent into it **adds** — derived by diffing the
 * two held sheets (`getJobSheet`), so it can never disagree with them.
 */
export function grantsOf(jobId) {
    const job = JOBS[jobId];
    if (!job?.parent) return getJobSheet(jobId);
    const parent = new Set(getJobSheet(job.parent));
    return getJobSheet(jobId).filter(id => !parent.has(id));
}

/**
 * What that promotion **removes**, diffing the held sheets. This is
 * empty for every promotion down the tree: no foundation skill is ever
 * removed, and every advanced job keeps its parent's combat and shared skills.
 * Re-training ACROSS branches (a Knight becoming a Druid) still removes
 * non-foundation skills; `PromotionSystem.promote` banks those at their level
 * level.
 */
export function removesOf(jobId) {
    const job = JOBS[jobId];
    if (!job?.parent) return [];
    const own = new Set(getJobSheet(jobId));
    return getJobSheet(job.parent).filter(id => !own.has(id));
}

/** What entering (or re-training into) this job costs. */
export function getPromotionCost(jobId) {
    return PROMOTION_COSTS[JOBS[jobId]?.tier] || null;
}

/**
 * The skills a promotion gates on: those carried forward from the parent
 * To become a Knight you need the Mining and Smithing a Knight keeps.
 *
 * ⚠️ Deliberately diffs the LISTED skills, not the held sheets. Every
 * sheet now holds all nine foundation skills, so diffing sheets would gate
 * every promotion on all nine; the listed foundation picks keep the gate
 * asking for the job's own trades.
 */
export function getPromotionGateSkills(jobId) {
    const job = JOBS[jobId];
    if (!job?.parent) return [];
    const parent = new Set(getJobSkills(job.parent));
    return getJobSkills(jobId).filter(id => parent.has(id));
}

/** The chain from Recruit down to this job, inclusive. */
export function getJobLineage(jobId) {
    const chain = [];
    let cursor = jobId;
    while (cursor && JOBS[cursor]) {
        chain.unshift(cursor);
        cursor = JOBS[cursor].parent;
    }
    return chain;
}

/** How many skills a promoted job LISTS (not how many it holds). Re-exported so consumers need one import. */
export { HERO_SKILL_SLOTS };

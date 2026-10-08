// Fantasy Guild - Job Registry
// The 13-entry class tree: the Recruit, four basic classes, eight master classes.

import {
    SKILLS,
    SKILL_LAYERS,
    STARTING_SKILL_IDS
} from './skillRegistry.js';

/**
 * JobRegistry — **the class tree is the skill unlock tree.**
 *
 * ## ⭐ Promotion keeps every Starting skill
 * A hero on any job holds **all nine Starting skills plus the job's own
 * class skills** (`getJobSheet`). Promotion only ever adds (and, when
 * re-training across branches, swaps) class skills:
 *
 * ```
 * RECRUIT        9 Starting · no combat skill · cannot fight            (9)
 *    │  promote    +1 combat  +1 advanced
 *    ▼
 * BASIC CLASS    9 Starting · 1 combat · 1 advanced                    (11)
 *    │  promote    +1 advanced  +1 master
 *    ▼
 * MASTER CLASS   9 Starting · 1 combat · 2 advanced · 1 master         (13)
 * ```
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
 * ## ⚠️ The promotion gate reads the LISTS
 * `getPromotionGateSkills` asks for the listed skills a job shares with its
 * parent's list. A basic class lists only its combat and advanced skill, which
 * the Recruit does not list, so a basic class has no skill gate; a master class
 * gates on its parent's combat and advanced skill.
 *
 * ## ⚠️ Everything else is derived
 * Which skill is the combat one, which is the master skill, which are Starting —
 * none of that is declared. It is read from each skill's `layer` in
 * `skillRegistry.js`. **Nothing here may hardcode a skill id outside a `skills`
 * array**, so moving a skill between layers needs no edit in this file at all.
 * `JobTree.test.js` asserts the structural rules, so the tree can be
 * rearranged freely and the tests will say if a rearrangement broke something.
 */

/** Tier 0 is the waiting room; 1 is a basic class; 2 is a master class. */
export const JOB_TIERS = { RECRUIT: 0, BASIC: 1, MASTER: 2 };

/**
 * Promotion cost, per tier.
 *
 * ⚠️ **Every number here is a placeholder for the balance pass.**
 * `skillLevel` is the threshold each skill in the promotion gate
 * (`getPromotionGateSkills`) must reach.
 *
 * ⚠️ **Re-training uses the same cost as entering the job.** It is the only
 * respec the player has, so its price is the single most important balance
 * dial in the rework.
 */
export const PROMOTION_COSTS = {
    // ⚠️ Gold and materials are retired: a promotion is
    // paid for with a charge of the Token whose Promotes rule names the job.
    // The skill threshold — the qualification — is all this table holds now.
    [JOB_TIERS.BASIC]: { skillLevel: 10 },
    [JOB_TIERS.MASTER]: { skillLevel: 25 }
};

export const JOBS = {
    // === Tier 0 ==========================================================
    recruit: {
        id: 'recruit', name: 'Recruit', tier: JOB_TIERS.RECRUIT, parent: null,
        description: 'Wide and shallow — a little of everything, badly. Cannot fight.',
        icon: '🧑',
        skills: [...STARTING_SKILL_IDS]
    },

    // === Tier 1 — the four basic classes =================================
    // 1 combat · 1 advanced. The advanced skill is the class's identity, and
    // both master classes under it keep it.
    fighter: {
        id: 'fighter', name: 'Fighter', tier: JOB_TIERS.BASIC, parent: 'recruit',
        description: 'A frontline soldier who leads from the front.',
        icon: '⚔️',
        skills: ['melee', 'leadership']
    },
    ranger: {
        id: 'ranger', name: 'Ranger', tier: JOB_TIERS.BASIC, parent: 'recruit',
        description: 'A wilderness scout, deadly at distance, who makes their own arrows.',
        icon: '🏹',
        skills: ['ranged', 'fletching']
    },
    wizard: {
        id: 'wizard', name: 'Wizard', tier: JOB_TIERS.BASIC, parent: 'recruit',
        description: 'An arcane researcher who binds power into things.',
        icon: '🔮',
        skills: ['magic', 'enchanting']
    },
    rogue: {
        id: 'rogue', name: 'Rogue', tier: JOB_TIERS.BASIC, parent: 'recruit',
        description: 'An infiltrator who moves through shadows and picks locks.',
        icon: '🗝️',
        skills: ['stealth', 'crime']
    },

    // === Tier 2 — the eight master classes ===============================
    // The parent's two skills · 1 more advanced · 1 master. The master skill
    // is exclusive: one class, one master skill, no exceptions.
    paladin: {
        id: 'paladin', name: 'Paladin', tier: JOB_TIERS.MASTER, parent: 'fighter',
        description: 'A holy protector who blesses monuments and wards armor.',
        icon: '✝️',
        skills: ['melee', 'leadership', 'enchanting', 'faith']
    },
    knight: {
        id: 'knight', name: 'Knight', tier: JOB_TIERS.MASTER, parent: 'fighter',
        description: 'A master of arms who reforges masterwork plate.',
        icon: '🛡️',
        skills: ['melee', 'leadership', 'fletching', 'armory']
    },
    beastmaster: {
        id: 'beastmaster', name: 'Beastmaster', tier: JOB_TIERS.MASTER, parent: 'ranger',
        description: 'A forest warden whose companion beasts work beside them.',
        icon: '🐺',
        skills: ['ranged', 'fletching', 'enchanting', 'taming']
    },
    hunter: {
        id: 'hunter', name: 'Hunter', tier: JOB_TIERS.MASTER, parent: 'ranger',
        description: 'A cunning stalker of snares, traps and blinds.',
        icon: '🪤',
        skills: ['ranged', 'fletching', 'crime', 'trapping']
    },
    necromancer: {
        id: 'necromancer', name: 'Necromancer', tier: JOB_TIERS.MASTER, parent: 'wizard',
        description: 'A dark arcanist who raises thralls to fight unattended.',
        icon: '💀',
        skills: ['magic', 'enchanting', 'crime', 'summoning']
    },
    scholar: {
        id: 'scholar', name: 'Scholar', tier: JOB_TIERS.MASTER, parent: 'wizard',
        description: 'A visionary who builds laboratories and bulk converters.',
        icon: '⚗️',
        skills: ['magic', 'enchanting', 'leadership', 'science']
    },
    merchant: {
        id: 'merchant', name: 'Merchant', tier: JOB_TIERS.MASTER, parent: 'rogue',
        // ⚠️ The only job that can run a Market, which makes this
        // promotion an economic turning point rather than a stat change.
        description: 'A trade baron of market stalls, banks and charters.',
        icon: '💰',
        skills: ['stealth', 'crime', 'leadership', 'commerce']
    },
    assassin: {
        id: 'assassin', name: 'Assassin', tier: JOB_TIERS.MASTER, parent: 'rogue',
        description: 'A shadow craftsman of cloaks, daggers and poisoned blades.',
        icon: '☠️',
        skills: ['stealth', 'crime', 'fletching', 'shadowcraft']
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
 * The job's **listed** skills — its `skills` array as authored (the nine
 * Starting skills for a Recruit, its class skills for a promoted job).
 *
 * ⚠️ This is NOT everything a hero on the job holds; that is
 * `getJobSheet`. The list still matters: it is what the promotion gate
 * reads (`getPromotionGateSkills`).
 */
export function getJobSkills(jobId) {
    return JOBS[jobId]?.skills ? [...JOBS[jobId].skills] : [];
}

/**
 * Every skill a hero on this job **holds**: all the Starting skills, plus the
 * job's own class skills.
 *
 * Promotion never removes a Starting skill, so a promoted hero can still
 * build, farm and fell trees. The sheet widens with each tier — 9 for a
 * Recruit, 11 for a basic class, 13 for a master class. A Starting skill a
 * job lists is simply already held.
 */
export function getJobSheet(jobId) {
    if (!JOBS[jobId]) return [];
    const own = getJobSkills(jobId).filter(id => !STARTING_SKILL_IDS.includes(id));
    return [...STARTING_SKILL_IDS, ...own];
}

/** Skills in one layer of a job's LISTED skills — derived, never declared. */
export function getJobSkillsByLayer(jobId, layer) {
    return getJobSkills(jobId).filter(id => SKILLS[id]?.layer === layer);
}

/** The one combat skill this job grants, or null for a Recruit. */
export function getJobCombatSkill(jobId) {
    return getJobSkillsByLayer(jobId, SKILL_LAYERS.COMBAT)[0] || null;
}

/** The exclusive master skill, or null below tier 2. */
export function getJobMasterSkill(jobId) {
    return getJobSkillsByLayer(jobId, SKILL_LAYERS.MASTER)[0] || null;
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
 * empty for every promotion down the tree: no Starting skill is ever
 * removed, and every master class keeps its parent's combat and advanced
 * skills. Re-training ACROSS branches (a Knight becoming a Wizard) still
 * removes class skills; `PromotionSystem.promote` banks those at their level.
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
 * The skills a promotion gates on: those the job's list shares with its
 * parent's list. To become a Paladin you need the Melee and Leadership a
 * Paladin keeps.
 *
 * ⚠️ Deliberately diffs the LISTED skills, not the held sheets. Every
 * sheet holds all nine Starting skills, so diffing sheets would gate every
 * promotion on all nine.
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

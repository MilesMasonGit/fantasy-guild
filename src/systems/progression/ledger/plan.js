// the progression ledger's plan block: an entry's status, its owner-set tier and its note

/**
 * Every item, Token (enemies included) and recipe can carry a plan block, the owner's plan for it:
 *
 *     plan: { status: 'planned' | 'draft' | 'live' | 'parked', tier: 0..n, note: '...', ...later fields }
 *
 * - **Planned**: a stub (a name, a tier, a note) for content not made yet. It never reaches `data/`:
 *   the CMS's Sync leaves it out of the game's files and keeps it in `cms/plan/plan.json`.
 * - **Draft**: authored, not finished. Synced like Live.
 * - **Live**: in the game. A record with no plan block, or no status, is Live: everything the game
 *   has today was authored before the ledger existed.
 * - **Parked**: kept on purpose though unused or unreachable; the ledger's checks leave it alone.
 *
 * `tier` is the stage the owner says the entry belongs to: 0 is the Starter Camp, 1 plane 1, 2
 * plane 2, and so on. It is always hand-set; the reach engine computes when the entry is actually
 * first reachable and the checks compare the two. It is not an item's weapon `tier` or a Token's
 * `tier`, which the game reads: that is why it lives inside the block. Later phases add fields of
 * their own to the block (targets, wedge and ring, waivers); everything here keeps them.
 *
 * ⚠️ The CMS, its server and its Node tools import this file, so it stays free of game state and imports nothing.
 */

export const PLAN_STATUS = Object.freeze({
    PLANNED: 'planned',
    DRAFT: 'draft',
    LIVE: 'live',
    PARKED: 'parked'
});

/** The statuses, in the order the CMS offers them. */
export const PLAN_STATUSES = Object.freeze([PLAN_STATUS.PLANNED, PLAN_STATUS.DRAFT, PLAN_STATUS.LIVE, PLAN_STATUS.PARKED]);

/** What a record with no plan status is. */
export const DEFAULT_PLAN_STATUS = PLAN_STATUS.LIVE;

/** The stage time budgets the owner set (about 30 minutes, 1.5 hours, a day); later tiers have none yet. */
const TIER_BUDGET_MS = Object.freeze({ 0: 30 * 60 * 1000, 1: 90 * 60 * 1000, 2: 24 * 60 * 60 * 1000 });

/** The tiers the CMS offers. A record may hold a later one; {@link tierLabel} names any. */
export const PLAN_TIERS = Object.freeze([0, 1, 2, 3, 4, 5]);

/** Author-facing words, kept together for translation. */
export const PLAN_TEXT = Object.freeze({
    status: Object.freeze({ planned: 'Planned', draft: 'Draft', live: 'Live', parked: 'Parked' }),
    statusHelp: Object.freeze({
        planned: 'A stub for content not made yet: never synced to the game.',
        draft: 'Authored but not finished. Synced to the game like Live.',
        live: 'In the game.',
        parked: 'Kept on purpose; the ledger checks leave it alone. Synced to the game.'
    }),
    starterCamp: 'Starter Camp',
    plane: (tier) => `Plane ${tier}`,
    noTier: 'No tier set'
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A tier: a whole number from 0, else null. */
export function tierOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

/** A tier in words: "Starter Camp", "Plane 2", or "No tier set". */
export function tierLabel(tier) {
    const t = tierOrNull(tier);
    if (t === null) return PLAN_TEXT.noTier;
    return t === 0 ? PLAN_TEXT.starterCamp : PLAN_TEXT.plane(t);
}

/** A stage's time budget in milliseconds, or null where the owner has set none. */
export function tierBudgetMs(tier) {
    const t = tierOrNull(tier);
    return t === null ? null : (TIER_BUDGET_MS[t] ?? null);
}

/** A status the ledger knows, case and spaces forgiven ("Planned" is planned), else null. */
export function statusOrNull(value) {
    if (typeof value !== 'string') return null;
    const s = value.trim().toLowerCase();
    return PLAN_STATUSES.includes(s) ? s : null;
}

/**
 * A record's plan as `{ status, tier, note }`, defaults filled in: Live, no tier, no note.
 * ⚠️ A status the ledger does not know reads as Live rather than Planned, so a typo can never take
 * authored content out of the game; the change-pack check refuses one before it gets here.
 */
export function planOf(def) {
    const block = isObject(def?.plan) ? def.plan : {};
    return {
        status: statusOrNull(block.status) ?? DEFAULT_PLAN_STATUS,
        tier: tierOrNull(block.tier),
        note: typeof block.note === 'string' ? block.note : ''
    };
}

export function statusOf(def) {
    return planOf(def).status;
}

/** Whether a record is a Planned stub, which never reaches the game. */
export function isPlanned(def) {
    return statusOf(def) === PLAN_STATUS.PLANNED;
}

/** The owner's tier for a record, or null when none is set. */
export function planTierOf(def) {
    return planOf(def).tier;
}

/**
 * A plan block with its status, tier and note tidied (a known status in lower case, a whole tier,
 * a note with text) and blanks dropped; any other field is kept as it is. Undefined when nothing is
 * left, so a record that was never planned and one cleared again are the same.
 */
export function cleanPlan(block) {
    if (!isObject(block)) return undefined;
    const out = {};
    for (const [key, value] of Object.entries(block)) {
        if (value !== undefined && value !== null && !['status', 'tier', 'note'].includes(key)) out[key] = value;
    }
    const status = statusOrNull(block.status);
    const tier = tierOrNull(block.tier);
    if (status) out.status = status;
    if (tier !== null) out.tier = tier;
    if (typeof block.note === 'string' && block.note.trim()) out.note = block.note;
    return Object.keys(out).length ? out : undefined;
}

/** A copy of a record with its plan block patched (`{ status?, tier?, note? }`); the block is removed when it ends up empty. */
export function withPlan(def, patch = {}) {
    const block = cleanPlan({ ...(isObject(def?.plan) ? def.plan : {}), ...patch });
    const next = { ...def };
    if (block) next.plan = block;
    else delete next.plan;
    return next;
}

// Fantasy Guild - Skill Registry
// The 27-skill, four-layer system (skill_class_rework_roadmap_v1.md §1).

/**
 * SkillRegistry — the world's skills, in four layers.
 *
 * ## The one rule that matters
 * **A hero holds SOME skills, not all of them.** A skill a hero does not hold
 * is work they cannot do at any level — this is *possession*, and it is the
 * gate the previous 15-skill system did not have (every hero held all 15, so
 * only level ever mattered).
 *
 * ## The four layers
 *
 * | Layer | Count | Who holds it | Granted by |
 * | :-- | :-- | :-- | :-- |
 * | `foundation` | 9 | Every Recruit | The starting state |
 * | `combat`     | 3 | Exactly one per promoted hero | First promotion |
 * | `shared`     | 6 | One per base class, plus T2 grants | Promotion |
 * | `signature`  | 11 | Exactly one job each, exclusively | Second promotion |
 *
 * A Recruit holds **every foundation skill** (`RECRUIT_SKILL_SLOTS`, nine). A
 * promoted job holds **exactly 6** (`HERO_SKILL_SLOTS`).
 *
 * ⚠️ *Token Lifecycle slice 1.1 (2026-09-25).* The foundation layer grew from six
 * to nine: `farming` (SP-60) and `explore` (SP-74) are new, and `construction`
 * moved here from the signature layer (SP-59). The promoted jobs' sheets were
 * deliberately left as they were (TL-6), so the first promotion now drops
 * **five** foundation skills instead of two (they are banked at their level,
 * not lost), and the Warlord, whose signature was Construction, has no
 * signature skill until the promotion overhaul (SP-58).
 *
 * ## ⚠️ This list is a first draft and is expected to change
 * *(Owner, 2026-08-12.)* Which skills exist, and which layer each sits in, will
 * move during development. **Nothing outside this file may hardcode a skill id
 * or a count.** Adding, renaming or re-layering a skill must be an edit to this
 * file and nothing else — derive from `SKILLS`, `SKILL_LAYERS` and the helpers
 * below rather than writing a literal.
 *
 * ## What happened to the old 15
 * Six ids are **deleted**: `labor` → `mining`, `aquatic` → `fishing`,
 * `forge` → `smithing`, `explore` → `survival`, `social` → `commerce`, and
 * `defense` folds into the hero's single combat skill. Nine survive, of which
 * `occult` and `science` **keep their id but change meaning** — both are now
 * job-exclusive signatures. That is safe only because saves are wiped.
 *
 * **`explore` is back, as a different skill** (SP-74): the new foundation
 * Explore works Maps. Nothing remaps the old id to `survival` (there was never
 * an alias or a save migration for it), so reusing it collides with nothing.
 *
 * **`SUB_SKILL_TO_PARENT` is gone.** Sub-skills were tags whose XP funnelled
 * into a parent; the split they simulated (mining vs quarrying) is now either a
 * real skill or nothing at all.
 */

/** The four layers, in the order a hero acquires them. */
export const SKILL_LAYERS = {
    FOUNDATION: 'foundation',
    COMBAT: 'combat',
    SHARED: 'shared',
    SIGNATURE: 'signature'
};

export const SKILLS = {
    // === Foundation (9) — every Recruit holds all of these ================
    mining: {
        id: 'mining', name: 'Mining', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Extracting ore, stone and gems from veins and quarries.',
        icon: '⛏️',
        sprite: 'assets/skills/skill_mining.png'
    },
    logging: {
        id: 'logging', name: 'Logging', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Felling trees for timber, sap and bark.',
        icon: '🪓',
        sprite: 'assets/skills/skill_logging.png'
    },
    fishing: {
        id: 'fishing', name: 'Fishing', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Working ponds, rivers and deep water for fish and salvage.',
        icon: '🎣',
        sprite: 'assets/skills/skill_fishing.png'
    },
    smithing: {
        id: 'smithing', name: 'Smithing', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Smelting ore into bars, and forging tools and weapons.',
        icon: '🔨',
        sprite: 'assets/skills/skill_smithing.png'
    },
    crafting: {
        id: 'crafting', name: 'Crafting', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Assembling wood, leather and fibre into gear and containers.',
        icon: '🪡',
        sprite: 'assets/skills/skill_crafting.png'
    },
    cooking: {
        id: 'cooking', name: 'Cooking', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Preparing meals and curative broths that keep heroes working.',
        icon: '🍳',
        sprite: 'assets/skills/skill_cooking.png'
    },
    construction: {
        id: 'construction', name: 'Construction', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Building stations on Foundations.',
        icon: '🧱'
    },
    farming: {
        id: 'farming', name: 'Farming', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Planting and harvesting crops and fruit.',
        icon: '🌾'
    },
    explore: {
        id: 'explore', name: 'Explore', layer: SKILL_LAYERS.FOUNDATION,
        description: 'Working Maps, spending supplies for themed finds.',
        icon: '🧭'
    },

    // === Combat (3) — exactly one per promoted hero =======================
    // There is no Defence skill: a hero's combat skill supplies both halves.
    // A Melee 30 hero attacks at 30 and defends at 30.
    melee: {
        id: 'melee', name: 'Melee', layer: SKILL_LAYERS.COMBAT,
        description: 'Frontline fighting with blades, axes and hammers.',
        icon: '⚔️',
        sprite: 'assets/skills/skill_melee.png'
    },
    ranged: {
        id: 'ranged', name: 'Ranged', layer: SKILL_LAYERS.COMBAT,
        description: 'Fighting at distance with bows, crossbows and thrown weapons.',
        icon: '🏹',
        sprite: 'assets/skills/skill_ranged.png'
    },
    magic: {
        id: 'magic', name: 'Magic', layer: SKILL_LAYERS.COMBAT,
        description: 'Elemental spellcraft with staves, wands and tomes.',
        icon: '✨',
        sprite: 'assets/skills/skill_magic.png'
    },

    // === Shared Specialist (6) — one per base class =======================
    leadership: {
        id: 'leadership', name: 'Leadership', layer: SKILL_LAYERS.SHARED,
        description: 'Banners, standards and drills that steady those nearby.',
        icon: '🚩'
    },
    faith: {
        id: 'faith', name: 'Faith', layer: SKILL_LAYERS.SHARED,
        description: 'Shrines, blessings and holy water that mend and ward.',
        icon: '✝️'
    },
    nature: {
        id: 'nature', name: 'Nature', layer: SKILL_LAYERS.SHARED,
        description: 'Herbs, hides, crops and livestock from the wild and the field.',
        icon: '🌿',
        sprite: 'assets/skills/skill_nature.png'
    },
    crime: {
        id: 'crime', name: 'Crime', layer: SKILL_LAYERS.SHARED,
        description: 'Locks, contraband and the things other people would rather keep.',
        icon: '🗝️',
        sprite: 'assets/skills/skill_crime.png'
    },
    enchanting: {
        id: 'enchanting', name: 'Enchanting', layer: SKILL_LAYERS.SHARED,
        description: 'Binding gems and dust into gear to make it more than it was.',
        icon: '🔮'
    },
    alchemy: {
        id: 'alchemy', name: 'Alchemy', layer: SKILL_LAYERS.SHARED,
        description: 'Compounding reagents into potions and elixirs.',
        icon: '🧪'
    },

    // === Signature (11) — exclusive to one advanced job each ==============
    armory: {
        id: 'armory', name: 'Armory', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Masterwork plate, and tempering outgrown gear into something better.',
        icon: '🛡️'
    },
    occult: {
        id: 'occult', name: 'Occult', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Pyres, sacrifices and hexes that strip an enemy bare.',
        icon: '💀',
        sprite: 'assets/skills/skill_occult.png'
    },
    inscription: {
        id: 'inscription', name: 'Inscription', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Scribing one-use combat scrolls and station manuscripts.',
        icon: '📜'
    },
    beastmaster: {
        id: 'beastmaster', name: 'Beastmaster', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Taming living companions that haul, hunt and fight.',
        icon: '🐺'
    },
    survival: {
        id: 'survival', name: 'Survival', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Forward camps, towers and outposts that supercharge a neighbour.',
        icon: '⛺'
    },
    commerce: {
        id: 'commerce', name: 'Commerce', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Markets and charters that turn surplus goods into gold.',
        icon: '💰'
    },
    brewing: {
        id: 'brewing', name: 'Brewing', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Toxins, weapon oils and acids — potions aimed the other way.',
        icon: '☠️'
    },
    summoning: {
        id: 'summoning', name: 'Summoning', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Binding disposable minions that fight in a hero\'s place.',
        icon: '👻'
    },
    astrology: {
        id: 'astrology', name: 'Astrology', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Lenses, star-charts and beacons that bend what the world drops.',
        icon: '🔭'
    },
    science: {
        id: 'science', name: 'Science', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Research that permanently sharpens recipes across the guild.',
        icon: '⚗️'
    },
    engineering: {
        id: 'engineering', name: 'Engineering', layer: SKILL_LAYERS.SIGNATURE,
        description: 'Managers, drones and clockwork — the board working unattended.',
        icon: '⚙️'
    }
};

/** Every skill id, in registry order. */
export function getAllSkillIds() {
    return Object.keys(SKILLS);
}

/** All ids in one layer. Derived, so re-layering a skill needs no other edit. */
export function getSkillIdsByLayer(layer) {
    return getAllSkillIds().filter(id => SKILLS[id].layer === layer);
}

export const FOUNDATION_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.FOUNDATION);
export const COMBAT_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.COMBAT);
export const SHARED_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.SHARED);
export const SIGNATURE_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.SIGNATURE);

/**
 * Layer groupings for UI. Shaped like the old `SKILL_CATEGORIES` so consumers
 * that only wanted "give me the groups" keep working, but **derived** — adding
 * a skill to `SKILLS` puts it in the right group with no edit here.
 */
export const SKILL_CATEGORIES = {
    [SKILL_LAYERS.FOUNDATION]: {
        id: SKILL_LAYERS.FOUNDATION, name: 'Foundation', skills: FOUNDATION_SKILL_IDS
    },
    [SKILL_LAYERS.COMBAT]: {
        id: SKILL_LAYERS.COMBAT, name: 'Combat', skills: COMBAT_SKILL_IDS
    },
    [SKILL_LAYERS.SHARED]: {
        id: SKILL_LAYERS.SHARED, name: 'Specialist', skills: SHARED_SKILL_IDS
    },
    [SKILL_LAYERS.SIGNATURE]: {
        id: SKILL_LAYERS.SIGNATURE, name: 'Signature', skills: SIGNATURE_SKILL_IDS
    }
};

/** How many skills exist in the world. */
export const SKILL_COUNT = Object.keys(SKILLS).length;

/**
 * How many skills a **promoted** hero holds (base class and advanced job).
 * Promotion between those tiers swaps contents, never width.
 */
export const HERO_SKILL_SLOTS = 6;

/**
 * How many skills a **Recruit** holds: the whole foundation layer (SP-59,
 * SP-60, SP-74). Wider than `HERO_SKILL_SLOTS` until the skills overhaul
 * (SP-58) decides the final shape, so the first promotion narrows the sheet.
 */
export const RECRUIT_SKILL_SLOTS = FOUNDATION_SKILL_IDS.length;

/** Whether `skillId` names a real skill. */
export function isSkillId(skillId) {
    return Object.prototype.hasOwnProperty.call(SKILLS, skillId);
}

/** Whether `skillId` is one of the combat styles. */
export function isCombatSkill(skillId) {
    return SKILLS[skillId]?.layer === SKILL_LAYERS.COMBAT;
}

/**
 * Look up a skill definition.
 *
 * Unlike the old registry this does **not** resolve sub-skill tags — an
 * unknown id is unknown, and callers must handle `null`. Content still naming
 * a deleted id is a content bug, and returning null is how it gets found.
 */
export function getSkill(skillId) {
    return SKILLS[skillId] || null;
}

export function getAllSkills() {
    return SKILLS;
}

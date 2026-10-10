// Fantasy Guild - Skill Registry

/**
 * SkillRegistry — the world's skills, in four layers.
 *
 * ## The one rule that matters
 * **A hero holds SOME skills, not all of them.** A skill a hero does not hold
 * is work they cannot do at any level — this is *possession*, as distinct from level.
 *
 * ## The four layers
 *
 * | Layer | Count | Who holds it | Granted by |
 * | :-- | :-- | :-- | :-- |
 * | `starting` | 9 | Every hero, on every job | The starting state |
 * | `combat`   | 4 | Exactly one per promoted hero | Basic promotion |
 * | `advanced` | 4 | One on a basic class, two on a master class | Promotion |
 * | `master`   | 8 | Exactly one master class each | Master promotion |
 *
 * A Recruit holds **every Starting skill** (`RECRUIT_SKILL_SLOTS`, nine), and
 * **promotion never takes one away**: a basic class holds 11, a master class
 * 13 (`jobRegistry.getJobSheet`).
 *
 * ## ⚠️ The Advanced and Master skills are placeholders
 * They are names, descriptions and placeholder icons that work like any other
 * skill (Tokens and recipes that name them; XP; levels), with no mechanics of
 * their own yet. **Nothing outside this file may hardcode a skill id or a
 * count.** Adding, renaming or re-layering a skill must be an edit to this
 * file and nothing else — derive from `SKILLS`, `SKILL_LAYERS` and the helpers
 * below rather than writing a literal.
 *
 * ⚠️ Renaming an id strands every piece of content naming the old one. A
 * rename also needs an entry in `skillIdMigration.js`, which rewrites the old
 * id in `data/` and in the CMS workspace as they load.
 */

/** The four layers, in the order a hero acquires them. */
export const SKILL_LAYERS = {
    STARTING: 'starting',
    COMBAT: 'combat',
    ADVANCED: 'advanced',
    MASTER: 'master'
};

export const SKILLS = {
    // === Starting (9) — every hero holds all of these, always =============
    mining: {
        id: 'mining', name: 'Mining', layer: SKILL_LAYERS.STARTING,
        description: 'Extracting ore, stone and gems from veins and quarries.',
        icon: '⛏️',
        sprite: 'assets/skills/skill_mining.png'
    },
    forestry: {
        id: 'forestry', name: 'Forestry', layer: SKILL_LAYERS.STARTING,
        description: 'Felling trees for timber, sap and bark.',
        icon: '🪓',
        // ⚠️ The art kept its Logging file name when the skill was renamed.
        sprite: 'assets/skills/skill_logging.png'
    },
    fishing: {
        id: 'fishing', name: 'Fishing', layer: SKILL_LAYERS.STARTING,
        description: 'Working ponds, rivers and deep water for fish and salvage.',
        icon: '🎣',
        sprite: 'assets/skills/skill_fishing.png'
    },
    smithing: {
        id: 'smithing', name: 'Smithing', layer: SKILL_LAYERS.STARTING,
        description: 'Smelting ore into bars, and forging tools and weapons.',
        icon: '🔨',
        sprite: 'assets/skills/skill_smithing.png'
    },
    crafting: {
        id: 'crafting', name: 'Crafting', layer: SKILL_LAYERS.STARTING,
        description: 'Assembling wood, leather and fibre into gear and containers.',
        icon: '🪡',
        sprite: 'assets/skills/skill_crafting.png'
    },
    cooking: {
        id: 'cooking', name: 'Cooking', layer: SKILL_LAYERS.STARTING,
        description: 'Preparing meals and curative broths that keep heroes working.',
        icon: '🍳',
        sprite: 'assets/skills/skill_cooking.png'
    },
    farming: {
        id: 'farming', name: 'Farming', layer: SKILL_LAYERS.STARTING,
        description: 'Planting and harvesting crops and fruit.',
        icon: '🌾'
    },
    alchemy: {
        id: 'alchemy', name: 'Alchemy', layer: SKILL_LAYERS.STARTING,
        description: 'Compounding reagents into potions, salves and flasks.',
        icon: '🧪'
    },
    construction: {
        id: 'construction', name: 'Construction', layer: SKILL_LAYERS.STARTING,
        description: 'Building stations on Foundations.',
        icon: '🧱'
    },

    // === Combat (4) — exactly one per promoted hero =======================
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
    stealth: {
        id: 'stealth', name: 'Stealth', layer: SKILL_LAYERS.COMBAT,
        description: 'Fighting from the shadows with daggers, cloaks and poisons.',
        icon: '🗡️'
    },

    // === Advanced (4) — one per basic class; a master class holds two =====
    leadership: {
        id: 'leadership', name: 'Leadership', layer: SKILL_LAYERS.ADVANCED,
        description: 'Banners, standards and drills that steady those nearby.',
        icon: '🚩'
    },
    fletching: {
        id: 'fletching', name: 'Fletching', layer: SKILL_LAYERS.ADVANCED,
        description: 'Arrows, bows and hunting gear, made and tuned by hand.',
        icon: '🪶'
    },
    enchanting: {
        id: 'enchanting', name: 'Enchanting', layer: SKILL_LAYERS.ADVANCED,
        description: 'Binding gems and dust into gear to make it more than it was.',
        icon: '🔮'
    },
    crime: {
        id: 'crime', name: 'Crime', layer: SKILL_LAYERS.ADVANCED,
        description: 'Locks, contraband and the things other people would rather keep.',
        icon: '🗝️',
        sprite: 'assets/skills/skill_crime.png'
    },

    // === Master (8) — exclusive to one master class each ==================
    faith: {
        id: 'faith', name: 'Faith', layer: SKILL_LAYERS.MASTER,
        description: 'Shrines, altars and wards that bless the heroes and Tokens around them.',
        icon: '✝️'
    },
    trapping: {
        id: 'trapping', name: 'Trapping', layer: SKILL_LAYERS.MASTER,
        description: 'Snares, pits and caltrops that weaken foes and strip their charges.',
        icon: '🪤'
    },
    summoning: {
        id: 'summoning', name: 'Summoning', layer: SKILL_LAYERS.MASTER,
        description: 'Raising thralls and spirits that fight in a hero\'s place.',
        icon: '👻'
    },
    taming: {
        id: 'taming', name: 'Taming', layer: SKILL_LAYERS.MASTER,
        description: 'Beasts of burden that harvest, haul and graze unattended.',
        icon: '🐾'
    },
    commerce: {
        id: 'commerce', name: 'Commerce', layer: SKILL_LAYERS.MASTER,
        description: 'Markets and charters that turn surplus goods into gold.',
        icon: '💰'
    },
    science: {
        id: 'science', name: 'Science', layer: SKILL_LAYERS.MASTER,
        description: 'Laboratories that convert goods in bulk into other materials.',
        icon: '⚗️'
    },
    armory: {
        id: 'armory', name: 'Armory', layer: SKILL_LAYERS.MASTER,
        description: 'Anvils and racks that reforge plate, shields and smithed weapons.',
        icon: '🛡️'
    },
    shadowcraft: {
        id: 'shadowcraft', name: 'Shadowcraft', layer: SKILL_LAYERS.MASTER,
        description: 'Workbenches and cauldrons that rework cloaks, daggers and poisoned blades.',
        icon: '🌑'
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

export const STARTING_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.STARTING);
export const COMBAT_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.COMBAT);
export const ADVANCED_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.ADVANCED);
export const MASTER_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.MASTER);

/**
 * Layer groupings for UI, **derived**: adding a skill to `SKILLS` puts it in
 * the right group with no edit here. `hint` says who holds the layer; the CMS
 * skill pickers show it beside the name.
 */
export const SKILL_CATEGORIES = {
    [SKILL_LAYERS.STARTING]: {
        id: SKILL_LAYERS.STARTING, name: 'Starting', hint: 'every hero has these',
        skills: STARTING_SKILL_IDS
    },
    [SKILL_LAYERS.COMBAT]: {
        id: SKILL_LAYERS.COMBAT, name: 'Combat', hint: 'one per class',
        skills: COMBAT_SKILL_IDS
    },
    [SKILL_LAYERS.ADVANCED]: {
        id: SKILL_LAYERS.ADVANCED, name: 'Advanced', hint: 'one per basic class, two per master class',
        skills: ADVANCED_SKILL_IDS
    },
    [SKILL_LAYERS.MASTER]: {
        id: SKILL_LAYERS.MASTER, name: 'Master', hint: 'one master class each',
        skills: MASTER_SKILL_IDS
    }
};

/** How many skills exist in the world. */
export const SKILL_COUNT = Object.keys(SKILLS).length;

/**
 * How many skills a **Recruit** holds: the whole Starting layer.
 * Every promoted hero holds these too.
 */
export const RECRUIT_SKILL_SLOTS = STARTING_SKILL_IDS.length;

/**
 * The skill a hero demolishes a marked Token with (`board/Demolition.js`). ⚠️ It must stay a
 * Starting skill: every hero holds it, so any hero can clear a Token away.
 */
export const DEMOLITION_SKILL_ID = SKILLS.construction.id;

/** Whether `skillId` names a real skill. */
export function isSkillId(skillId) {
    return Object.prototype.hasOwnProperty.call(SKILLS, skillId);
}

/** Whether `skillId` is one of the combat styles. */
export function isCombatSkill(skillId) {
    return SKILLS[skillId]?.layer === SKILL_LAYERS.COMBAT;
}

/**
 * Look up a skill definition, or null. A deleted id is a content bug, and
 * returning null is how it gets found.
 */
export function getSkill(skillId) {
    return SKILLS[skillId] || null;
}

export function getAllSkills() {
    return SKILLS;
}

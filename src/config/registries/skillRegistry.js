// Fantasy Guild - Skill Registry

/**
 * SkillRegistry: the world's skills, in three layers.
 *
 * ## Every hero holds every skill
 * A hero holds every skill here from level 1: the gate on any work, Token or piece of gear is a
 * skill level, a tool or an item, never what the hero is. `hero.skills[id]` absent means only that
 * the id is not a skill (a cut one, or content's typo).
 *
 * | Layer | Count | What it is |
 * | :-- | :-- | :-- |
 * | `starting`   | 9 | The work every guild does from the first day |
 * | `combat`     | 4 | The four styles: a hero fights in the style of the weapon in their hands |
 * | `specialist` | 7 | Placeholders until the specialist-skill rework gives each its mechanics |
 *
 * ## ⚠️ The specialist skills are placeholders
 * They are names, descriptions and placeholder icons that work like any other skill (Tokens and
 * recipes that name them; XP; levels), with no mechanics of their own yet. **Nothing outside this
 * file may hardcode a skill id or a count.** Adding, renaming or re-layering a skill must be an
 * edit to this file and nothing else: derive from `SKILLS`, `SKILL_LAYERS` and the helpers below
 * rather than writing a literal.
 *
 * ⚠️ Renaming an id strands every piece of content naming the old one. A rename also needs an
 * entry in `skillIdMigration.js`, which rewrites the old id in `data/` and in the CMS workspace as
 * they load. A dropped id is listed by the boot audit and the CMS Economy Audit
 * (`unknownRefRule.js`), and an older save's levels in it are dropped on load.
 */

export const SKILL_LAYERS = {
    STARTING: 'starting',
    COMBAT: 'combat',
    SPECIALIST: 'specialist'
};

export const SKILLS = {
    // === Starting (9) =====================================================
    mining: {
        id: 'mining', name: 'Mining', layer: SKILL_LAYERS.STARTING,
        description: 'Extracting ore, stone and gems from veins and quarries.',
        purpose: 'Mines ore, stone and gems from veins, for Smithing, Crafting and Construction.',
        icon: '⛏️',
        sprite: 'assets/skills/s_mining.png'
    },
    forestry: {
        id: 'forestry', name: 'Forestry', layer: SKILL_LAYERS.STARTING,
        description: 'Felling trees for timber, sap and bark.',
        purpose: 'Fells trees for logs, sap and bark, for Construction, Crafting and fuel.',
        icon: '🪓',
        // ⚠️ The art kept its Logging file name when the skill was renamed.
        sprite: 'assets/skills/s_logging.png'
    },
    fishing: {
        id: 'fishing', name: 'Fishing', layer: SKILL_LAYERS.STARTING,
        description: 'Working ponds, rivers and deep water for fish and salvage.',
        purpose: 'Catches fish and finds from the water, for Cooking and Crafting.',
        icon: '🎣',
        sprite: 'assets/skills/s_fishing.png'
    },
    smithing: {
        id: 'smithing', name: 'Smithing', layer: SKILL_LAYERS.STARTING,
        description: 'Smelting ore into bars, and forging tools and weapons.',
        purpose: 'Smelts ingots and forges tools, weapons and metal armour for heroes.',
        icon: '🔨',
        sprite: 'assets/skills/s_smithing.png'
    },
    crafting: {
        id: 'crafting', name: 'Crafting', layer: SKILL_LAYERS.STARTING,
        description: 'Assembling wood, leather and fibre into gear and containers.',
        purpose: 'Makes rope, cloth, glass, leather gear and the everyday parts other skills need.',
        icon: '🪡',
        sprite: 'assets/skills/s_crafting.png'
    },
    cooking: {
        id: 'cooking', name: 'Cooking', layer: SKILL_LAYERS.STARTING,
        description: 'Preparing meals and curative broths that keep heroes working.',
        purpose: 'Cooks food that heals heroes in fights, and drinks that help them work.',
        icon: '🍳',
        sprite: 'assets/skills/s_cooking.png'
    },
    farming: {
        id: 'farming', name: 'Farming', layer: SKILL_LAYERS.STARTING,
        description: 'Planting and harvesting crops and fruit.',
        purpose: 'Plants and harvests crops, fruit, herbs and saplings, for Cooking, Alchemy and Forestry.',
        icon: '🌾'
    },
    alchemy: {
        id: 'alchemy', name: 'Alchemy', layer: SKILL_LAYERS.STARTING,
        description: 'Compounding reagents into potions, salves and flasks.',
        purpose: 'Brews potions heroes use in fights and at work.',
        icon: '🧪'
    },
    construction: {
        id: 'construction', name: 'Construction', layer: SKILL_LAYERS.STARTING,
        description: 'Building stations on Foundations.',
        purpose: 'Builds stations and buildings on Foundations, and takes down marked Tokens.',
        icon: '🧱'
    },

    // === Combat (4): the style is the weapon's =============================
    // There is no Defence skill: the style a hero fights in supplies both halves. A hero with a
    // sword at Melee 30 attacks at 30 and defends at 30.
    melee: {
        id: 'melee', name: 'Melee', layer: SKILL_LAYERS.COMBAT,
        description: 'Frontline fighting with blades, axes and hammers.',
        icon: '⚔️',
        sprite: 'assets/skills/s_melee.png'
    },
    ranged: {
        id: 'ranged', name: 'Ranged', layer: SKILL_LAYERS.COMBAT,
        description: 'Fighting at distance with bows, crossbows and thrown weapons.',
        icon: '🏹',
        sprite: 'assets/skills/s_ranged.png'
    },
    magic: {
        id: 'magic', name: 'Magic', layer: SKILL_LAYERS.COMBAT,
        description: 'Elemental spellcraft with staves, wands and tomes.',
        icon: '✨',
        sprite: 'assets/skills/s_magic.png'
    },
    stealth: {
        id: 'stealth', name: 'Stealth', layer: SKILL_LAYERS.COMBAT,
        description: 'Fighting from the shadows with daggers, cloaks and poisons.',
        icon: '🗡️'
    },

    // === Specialist (7): placeholders until the specialist-skill rework =====
    fletching: {
        id: 'fletching', name: 'Fletching', layer: SKILL_LAYERS.SPECIALIST,
        description: 'Arrows, bows and hunting gear, made and tuned by hand.',
        icon: '🪶'
    },
    faith: {
        id: 'faith', name: 'Faith', layer: SKILL_LAYERS.SPECIALIST,
        description: 'Shrines, altars and wards that bless the heroes and Tokens around them.',
        icon: '✝️'
    },
    summoning: {
        id: 'summoning', name: 'Summoning', layer: SKILL_LAYERS.SPECIALIST,
        description: 'Raising thralls and spirits that fight in a hero’s place.',
        icon: '👻'
    },
    enchanting: {
        id: 'enchanting', name: 'Enchanting', layer: SKILL_LAYERS.SPECIALIST,
        description: 'Binding gems and dust into gear to make it more than it was.',
        icon: '🔮'
    },
    crime: {
        id: 'crime', name: 'Crime', layer: SKILL_LAYERS.SPECIALIST,
        description: 'Locks, contraband and the things other people would rather keep.',
        icon: '🗝️',
        sprite: 'assets/skills/s_crime.png'
    },
    taming: {
        id: 'taming', name: 'Taming', layer: SKILL_LAYERS.SPECIALIST,
        description: 'Beasts of burden that harvest, haul and graze unattended.',
        icon: '🐾'
    },
    science: {
        id: 'science', name: 'Science', layer: SKILL_LAYERS.SPECIALIST,
        description: 'Laboratories that convert goods in bulk into other materials.',
        icon: '⚗️'
    }
};

/**
 * What fighting is for, the one line every combat skill's row shows on the hero sheet: a hero
 * fights in the style of the weapon in their hands, barehanded as Melee.
 */
export const COMBAT_PURPOSE = 'Fights with a weapon of this style (barehanded is Melee), for loot, Maps and its XP. The best of the four sets the hero’s health.';

/**
 * A skill's one line for the hero sheet's skill list: its `purpose` (what it does and what it
 * feeds), else its `description` for the placeholder skills that have no purpose yet. A combat
 * skill reads {@link COMBAT_PURPOSE}.
 */
export function skillPurpose(skillId) {
    const skill = SKILLS[skillId];
    if (skill?.layer === SKILL_LAYERS.COMBAT) return COMBAT_PURPOSE;
    return skill ? (skill.purpose || skill.description || null) : null;
}

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
export const SPECIALIST_SKILL_IDS = getSkillIdsByLayer(SKILL_LAYERS.SPECIALIST);

/** Every skill a hero holds: all of them, in registry order. */
export const HERO_SKILL_IDS = getAllSkillIds();

/**
 * Layer groupings for UI, **derived**: adding a skill to `SKILLS` puts it in
 * the right group with no edit here. `hint` says what the layer is; the CMS
 * skill pickers show it beside the name.
 */
export const SKILL_CATEGORIES = {
    [SKILL_LAYERS.STARTING]: {
        id: SKILL_LAYERS.STARTING, name: 'Starting', hint: 'the everyday work',
        skills: STARTING_SKILL_IDS
    },
    [SKILL_LAYERS.COMBAT]: {
        id: SKILL_LAYERS.COMBAT, name: 'Combat', hint: 'the weapon decides the style',
        skills: COMBAT_SKILL_IDS
    },
    [SKILL_LAYERS.SPECIALIST]: {
        id: SKILL_LAYERS.SPECIALIST, name: 'Specialist', hint: 'placeholders, no mechanics yet',
        skills: SPECIALIST_SKILL_IDS
    }
};

/** How many skills exist in the world. */
export const SKILL_COUNT = Object.keys(SKILLS).length;

/**
 * The skill a hero demolishes a marked Token with (`board/Demolition.js`): any hero can clear a
 * Token away.
 */
export const DEMOLITION_SKILL_ID = SKILLS.construction.id;

/**
 * The style a hero fights in with no weapon in their hands (a punch), and the one a weapon naming
 * no style fights in.
 */
export const BAREHANDED_STYLE_ID = SKILLS.melee.id;

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

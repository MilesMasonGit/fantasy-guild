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

/**
 * What a Starting skill does, for the hero sheet's order: gathering from the land, or making from
 * what was gathered.
 */
export const SKILL_TRADES = {
    GATHERING: 'gathering',
    CRAFTING: 'crafting'
};

export const SKILLS = {
    // === Starting (9) =====================================================
    mining: {
        id: 'mining', trade: SKILL_TRADES.GATHERING, name: 'Mining', layer: SKILL_LAYERS.STARTING,
        description: 'Extracting ore, stone and gems from veins and quarries.',
        icon: '⛏️',
        sprite: 'assets/skills/s_mining.png'
    },
    forestry: {
        id: 'forestry', trade: SKILL_TRADES.GATHERING, name: 'Forestry', layer: SKILL_LAYERS.STARTING,
        description: 'Felling trees for timber, sap and bark.',
        icon: '🪓',
        // ⚠️ The art kept its Logging file name when the skill was renamed.
        sprite: 'assets/skills/s_logging.png'
    },
    fishing: {
        id: 'fishing', trade: SKILL_TRADES.GATHERING, name: 'Fishing', layer: SKILL_LAYERS.STARTING,
        description: 'Working ponds, rivers and deep water for fish and salvage.',
        icon: '🎣',
        sprite: 'assets/skills/s_fishing.png'
    },
    smithing: {
        id: 'smithing', trade: SKILL_TRADES.CRAFTING, name: 'Smithing', layer: SKILL_LAYERS.STARTING,
        description: 'Smelting ore into bars, and forging tools and weapons.',
        icon: '🔨',
        sprite: 'assets/skills/s_smithing.png'
    },
    crafting: {
        id: 'crafting', trade: SKILL_TRADES.CRAFTING, name: 'Crafting', layer: SKILL_LAYERS.STARTING,
        description: 'Assembling wood, leather and fibre into gear and containers.',
        icon: '🪡',
        sprite: 'assets/skills/s_crafting.png'
    },
    cooking: {
        id: 'cooking', trade: SKILL_TRADES.CRAFTING, name: 'Cooking', layer: SKILL_LAYERS.STARTING,
        description: 'Preparing meals and curative broths that keep heroes working.',
        icon: '🍳',
        sprite: 'assets/skills/s_cooking.png'
    },
    farming: {
        id: 'farming', trade: SKILL_TRADES.GATHERING, name: 'Farming', layer: SKILL_LAYERS.STARTING,
        description: 'Planting and harvesting crops and fruit.',
        icon: '🌾'
    },
    alchemy: {
        id: 'alchemy', trade: SKILL_TRADES.CRAFTING, name: 'Alchemy', layer: SKILL_LAYERS.STARTING,
        description: 'Compounding reagents into potions, salves and flasks.',
        icon: '🧪'
    },
    construction: {
        id: 'construction', trade: SKILL_TRADES.CRAFTING, name: 'Construction', layer: SKILL_LAYERS.STARTING,
        description: 'Building stations on Foundations.',
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
 * Every skill in the hero sheet's order: combat, then the gathering skills, then the crafting ones,
 * then the specialist ones, each in registry order. Derived, so a new skill finds its place by its
 * layer and trade.
 */
export function heroSheetSkillIds() {
    const starting = (trade) => STARTING_SKILL_IDS.filter(id => SKILLS[id].trade === trade);
    const rest = STARTING_SKILL_IDS.filter(id => !Object.values(SKILL_TRADES).includes(SKILLS[id].trade));
    return [
        ...COMBAT_SKILL_IDS,
        ...starting(SKILL_TRADES.GATHERING),
        ...starting(SKILL_TRADES.CRAFTING),
        ...rest,
        ...SPECIALIST_SKILL_IDS
    ];
}

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

/**
 * Skills cut when heroes became classless. ⚠️ Not skills any more: an older save's levels in them
 * are dropped on load (`HeroRehydration.settleSkillSheet`), and content still naming one is listed
 * by the boot audit and the CMS Economy Audit as a skill that does not exist.
 */
export const RETIRED_SKILL_IDS = Object.freeze(['leadership', 'commerce', 'trapping', 'armory', 'shadowcraft']);

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

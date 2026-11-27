// Skill Registry

/**
 * SkillRegistry: the world's skills, in two layers.
 *
 * ## Every hero holds every skill
 * A hero holds every skill here from level 1: the gate on any work, Token or piece of gear is a
 * skill level, a tool or an item, never what the hero is. `hero.skills[id]` absent means only that
 * the id is not a skill (a cut one, or content's typo). A skill no content uses yet is still listed
 * and still held.
 *
 * | Layer | What it is |
 * | :-- | :-- |
 * | `starting` | Every skill that is not a combat style: gathering, making, and the ones whose identity is not placed yet (no `trade`) |
 * | `combat`   | The four styles: a hero fights in the style of the weapon in their hands |
 *
 * **Nothing outside this file may hardcode a skill id or a count.** Adding, renaming or re-layering
 * a skill must be an edit to this file and nothing else: derive from `SKILLS`, `SKILL_LAYERS` and
 * the helpers below rather than writing a literal.
 *
 * ⚠️ The one exception is words: a new skill also needs its hero-sheet line under `skillPurpose`
 * in `src/i18n/en.json` (a test fails until it has one).
 *
 * ⚠️ Renaming an id strands every piece of content naming the old one. A dropped id is listed by the boot audit and the CMS Economy Audit
 * (`unknownRefRule.js`), and an older save's levels in it are dropped on load.
 */

export const SKILL_LAYERS = {
    STARTING: 'starting',
    COMBAT: 'combat'
};

/**
 * What a non-combat skill does, for the hero sheet's order: gathering from the land, or making from
 * what was gathered. A skill with neither stands last.
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
    // A combat style's one text is its hero-sheet line (`skillPurpose` in `en.json`): no second here.
    melee: {
        id: 'melee', name: 'Melee', layer: SKILL_LAYERS.COMBAT,
        icon: '⚔️',
        sprite: 'assets/skills/s_melee.png'
    },
    ranged: {
        id: 'ranged', name: 'Ranged', layer: SKILL_LAYERS.COMBAT,
        icon: '🏹',
        sprite: 'assets/skills/s_ranged.png'
    },
    magic: {
        id: 'magic', name: 'Magic', layer: SKILL_LAYERS.COMBAT,
        icon: '✨',
        sprite: 'assets/skills/s_magic.png'
    },
    stealth: {
        id: 'stealth', name: 'Stealth', layer: SKILL_LAYERS.COMBAT,
        icon: '🗡️'
    },

    // === Skills whose identity is not placed yet: no mechanics of their own, listed last ===
    fletching: {
        id: 'fletching', trade: SKILL_TRADES.CRAFTING, name: 'Fletching', layer: SKILL_LAYERS.STARTING,
        description: 'Arrows, bows and hunting gear, made and tuned by hand.',
        icon: '🪶'
    },
    faith: {
        id: 'faith', name: 'Faith', layer: SKILL_LAYERS.STARTING,
        description: "A shrine's strong blessing holds only while a Faith hero keeps it supplied with offerings, made at an altar from other skills' goods.",
        icon: '✝️'
    },
    summoning: {
        id: 'summoning', name: 'Summoning', layer: SKILL_LAYERS.STARTING,
        description: 'Calls Summoned workers that work but never fight, until their charges run out. A higher level calls more kinds and adds more charges.',
        icon: '👻'
    },
    enchanting: {
        id: 'enchanting', trade: SKILL_TRADES.CRAFTING, name: 'Enchanting', layer: SKILL_LAYERS.STARTING,
        description: 'Binding gems and dust into gear to make it more than it was.',
        icon: '🔮'
    },
    tailor: {
        id: 'tailor', trade: SKILL_TRADES.CRAFTING, name: 'Tailor', layer: SKILL_LAYERS.STARTING,
        description: 'Weaving cloth and stitching leather into robes, hoods, cloaks and string.',
        icon: '🧵'
    },
    crime: {
        id: 'crime', name: 'Crime', layer: SKILL_LAYERS.STARTING,
        description: 'Steals from enemy camps instead of fighting them, for a different set of goods. A theft that goes wrong puts a guard on the camp.',
        icon: '🗝️',
        sprite: 'assets/skills/s_crime.png'
    },
    science: {
        id: 'science', name: 'Science', layer: SKILL_LAYERS.STARTING,
        description: 'Studies nearby nodes in a Laboratory for lasting mastery of each kind of node, instead of goods.',
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

/** Every skill a hero holds: all of them, in registry order. */
export const HERO_SKILL_IDS = getAllSkillIds();

/**
 * Every skill in the hero sheet's order: combat, then the gathering skills, then the crafting ones,
 * then the ones with neither trade, each in registry order. Derived, so a new skill finds its place
 * by its layer and trade.
 */
export function heroSheetSkillIds() {
    const starting = (trade) => STARTING_SKILL_IDS.filter(id => SKILLS[id].trade === trade);
    const rest = STARTING_SKILL_IDS.filter(id => !Object.values(SKILL_TRADES).includes(SKILLS[id].trade));
    return [
        ...COMBAT_SKILL_IDS,
        ...starting(SKILL_TRADES.GATHERING),
        ...starting(SKILL_TRADES.CRAFTING),
        ...rest
    ];
}

/**
 * Layer groupings for UI, **derived**: adding a skill to `SKILLS` puts it in
 * the right group with no edit here. `hint` says what the layer is; the CMS
 * skill pickers show it beside the name.
 */
export const SKILL_CATEGORIES = {
    [SKILL_LAYERS.STARTING]: {
        id: SKILL_LAYERS.STARTING, name: 'Skills', hint: 'gathering and making',
        skills: STARTING_SKILL_IDS
    },
    [SKILL_LAYERS.COMBAT]: {
        id: SKILL_LAYERS.COMBAT, name: 'Combat', hint: 'the weapon decides the style',
        skills: COMBAT_SKILL_IDS
    }
};

/**
 * Skills cut from the game (heroes became classless; Taming left). ⚠️ Not skills any more: an older save's levels in them
 * are dropped on load (`HeroRehydration.settleSkillSheet`), and content still naming one is listed
 * by the boot audit and the CMS Economy Audit as a skill that does not exist.
 */
export const RETIRED_SKILL_IDS = Object.freeze(['leadership', 'commerce', 'trapping', 'armory', 'shadowcraft', 'taming']);

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

/** Whether `skillId` is a gathering skill: work that takes from the land (`SKILL_TRADES.GATHERING`). */
export function isGatheringSkill(skillId) {
    return typeof skillId === 'string' && isSkillId(skillId) && SKILLS[skillId].trade === SKILL_TRADES.GATHERING;
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

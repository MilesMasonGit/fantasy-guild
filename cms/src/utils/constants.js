// === Shared vocabulary — DERIVED from the game's registries, never copied ===
//
// CMS rework Phase 1 (L7 / L24, cms_rework_roadmap_v1.md §5). The CMS used to
// keep its own hand-maintained lists of skills, card types, presets, tags and
// equip slots, and they rotted out of sync with the game (findings F5–F7, F10).
// Now they are imported live from `src/config/registries/`, so definitions flow
// game → CMS and the drift cannot recur. The cross-project import path is the
// same one proven at Sidebar.jsx (finding F1).
import {
  SKILLS as GAME_SKILLS,
  SUB_SKILL_TO_PARENT,
} from '../../../src/config/registries/skillRegistry.js';
import { CARD_TYPES as GAME_CARD_TYPES } from '../../../src/config/registries/cardConstants.js';
import { CARD_PRESETS as GAME_CARD_PRESETS } from '../../../src/config/cards/card-presets.js';
import {
  FLAVOUR_TAGS as GAME_FLAVOUR_TAGS,
  CARD_TAG_OVERRIDES as GAME_CARD_TAG_OVERRIDES,
} from '../../../src/config/registries/tagRegistry.js';
import {
  SLOT_ORDER as GAME_SLOT_ORDER,
  SLOT_INFO as GAME_SLOT_INFO,
} from '../../../src/config/registries/equipmentConstants.js';

// The game defines SKILLS as an object keyed by id; every CMS consumer expects
// an array of { id, name }. Transform here so downstream code is untouched.
// `combat` is deliberately absent: it is a game CATEGORY, not one of the 15
// skills, so it can never be picked in a skill dropdown. (Combat-card ROUTING
// keys off the `skill` field on task DATA in engine/fileUtils.js and is a
// separate concern — unaffected by this list.)
export const SKILLS = Object.values(GAME_SKILLS).map(({ id, name }) => ({ id, name }));

// The game exports CARD_TYPES as { KEY: 'value' }; expose the values (16 types).
export const CARD_TYPES = Object.values(GAME_CARD_TYPES);

// Preset NAMES the game knows (BASIC_TASK, CRAFTING_TASK, MUTATOR, …).
export const CARD_PRESETS = Object.keys(GAME_CARD_PRESETS);

// Card flavour tags Tokens target by (Aquatic / Gathering / Social / Hazard).
export const FLAVOUR_TAGS = [...GAME_FLAVOUR_TAGS];
export const CARD_TAG_OVERRIDES = GAME_CARD_TAG_OVERRIDES;

// The six Hero Dock equipment slots, in display order — the real, current slots
// (finding F7). Replaces the old fictional 8-slot list.
export const SLOT_ORDER = [...GAME_SLOT_ORDER];
export const SLOT_INFO = GAME_SLOT_INFO;
export const EQUIP_SLOTS = [...GAME_SLOT_ORDER];

// === Fictional-skill remap (F5, L23) ===
// `industry`, `culinary` and `nautical` were CMS-only skills that never existed
// in the game. The game already declares the canonical best-fit replacement for
// each in SUB_SKILL_TO_PARENT (skillRegistry.js), so we read the targets from
// there rather than encode our own — same principle as everything above.
// Current resolution: industry → labor, culinary → cooking, nautical → aquatic.
export const FICTIONAL_SKILLS = ['industry', 'culinary', 'nautical'];
export const FICTIONAL_SKILL_REMAP = Object.fromEntries(
  FICTIONAL_SKILLS.map((id) => [id, SUB_SKILL_TO_PARENT[id] || id])
);

/** Rewrite a fictional skill id to its real target; passes everything else through. */
export function remapSkillId(id) {
  return (typeof id === 'string' && FICTIONAL_SKILL_REMAP[id]) || id;
}

// Every skill id the game's CardValidator will ACCEPT on a card: the 15 parent
// skills plus every subskill/legacy alias (`SUB_SKILL_TO_PARENT` — which also
// contains the fictional ids industry/culinary/nautical as legacy aliases).
// Mirrors `SKILLS[id] || SUB_SKILL_TO_PARENT[id]` so tooling doesn't false-flag
// valid subskill-based content (e.g. `foraging`) as an unknown skill.
export const VALID_SKILL_IDS = new Set([
  ...SKILLS.map((s) => s.id),
  ...Object.keys(SUB_SKILL_TO_PARENT),
]);

export const ITEM_TYPES = [
  'Material', 'Ingredient', 'Tool', 'Weapon', 'Armor',
  'Food', 'Drink', 'Consumable', 'Treasure', 'Quest Item',
];

export const COMBAT_TYPES = ['Melee', 'Ranged', 'Magic'];

export const ENEMY_TIERS = [1, 2, 3, 4, 5, 6];

export const RESTORE_TYPES = ['HP', 'Energy'];

export const PERSONALITY_TAGS = [
  'Food', 'Drink', 'Tool', 'Weapon', 'Armor', 'Consumable', 'Ingredient', 
  'Material', 'Treasure', 'Quest', 'Legendary', 'Intermediate', 'Root', 
  'Heavy', 'Volatile', 'Liquid', 'Resource Sink', 'Gathering', 'Passive', 'Fast', 'Slow'
];

export const EV_CURVE = {
  1: 1.05,
  11: 1.15,
  41: 1.40,
  71: 1.70,
  99: 2.00
};

export const EV_VARIANCE = {
  1: 0.02,
  11: 0.05,
  41: 0.10,
  71: 0.20
};

// Default global constants
export const DEFAULT_GLOBALS = {
  gpt: 3.0,
  energyGpValue: 0.25,
  healthGpValue: 0.50,
  xpToGoldRatio: 0.1,
  combatXpMultiplier: 1.0,
  skillMultiplierRate: 0.035,
  levelReqBaseValue: 100,
  defaultItemDurability: 100,
  laborScalingType: 'exponential',
  defaultTargetEV: 1.05,
  energyPerSwing: 1,
  profitMarkupPerUniqueInput: 0.02, // 2% markup per unique ingredient input
  rawCommodityBaseValue: 1.0,      // Base GP value for level 1 raw materials
  rawCommodityScalingRate: 0.05,    // Exponential scaling rate per level for raw materials

  sellModifiers: {
    Material: -0.30,
    Ingredient: -0.30,
    Tool: -0.50,
    Weapon: -0.40,
    Armor: -0.40,
    Food: 0,
    Drink: 0,
    Consumable: 0.10,
    Treasure: 0.20,
    'Quest Item': 0,
  },

  heroProfiles: {
    1: { combatStat: 5, derivedHp: 5 },
    2: { combatStat: 15, derivedHp: 15 },
    3: { combatStat: 30, derivedHp: 30 },
    4: { combatStat: 50, derivedHp: 50 },
    5: { combatStat: 80, derivedHp: 80 },
    6: { combatStat: 120, derivedHp: 120 },
  },

  // Progression Targets (Time to Level in minutes)
  ttlTargets: {
    1: 2,    // levels 1-10
    11: 15,  // levels 11-30
    31: 60,  // levels 31-60
    61: 240, // levels 61-90
    91: 720, // levels 91-99
  },
  xpThresholdBase: 100,
  xpThresholdMultiplier: 1.15,

  // Wealth & XP Velocity Targets
  gphTargets: {
    1: 1200,
    11: 1400,
    41: 10000,
    71: 176000,
  },
  xphTargets: {
    1: 3000,
    11: 3500,
    41: 25000,
    71: 440000,
  },

  // Balancing Logic Defaults
  profitSplitRatio: 0.5,
  xpTaxBracketSize: 10,
  xpTaxDecayRate: 0.1,
  restorationMarkup: 0.2, // 20% of sell price is converted to restoration amount
  guildProgressionSpeedFactor: 1.0,
  laborRatePerLevel: 0.002, // 0.2% per skill level
};

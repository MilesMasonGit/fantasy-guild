// Fixed list of 8 skills — not managed in the CMS
export const SKILLS = [
  { id: 'nature', name: 'Nature' },
  { id: 'industry', name: 'Industry' },
  { id: 'culinary', name: 'Culinary' },
  { id: 'occult', name: 'Occult' },
  { id: 'crime', name: 'Crime' },
  { id: 'social', name: 'Social' },
  { id: 'nautical', name: 'Nautical' },
  { id: 'science', name: 'Science' },
  { id: 'combat', name: 'Combat' },
];

export const ITEM_TYPES = [
  'Material', 'Ingredient', 'Tool', 'Weapon', 'Armor',
  'Food', 'Drink', 'Consumable', 'Treasure', 'Quest Item',
];

export const CARD_TYPES = ['Task', 'Crafting', 'Combat'];

export const COMBAT_TYPES = ['Melee', 'Ranged', 'Magic'];

export const EQUIP_SLOTS = [
  'Head', 'Body', 'Legs', 'Feet', 'MainHand', 'OffHand', 'Ring', 'Amulet',
];

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
  gpt: 10,
  energyGpValue: 0.25,
  healthGpValue: 0.50,
  xpToGoldRatio: 0.1,
  combatXpMultiplier: 1.0,
  skillMultiplierRate: 0.002,
  defaultTargetEV: 1.05,
  energyPerSwing: 1,

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
    1: 500,
    11: 2500,
    41: 10000,
    71: 50000,
  },
  xphTargets: {
    1: 100,
    11: 500,
    41: 2000,
    71: 10000,
  },

  // Balancing Logic Defaults
  profitSplitRatio: 0.5,
  xpTaxBracketSize: 10,
  xpTaxDecayRate: 0.1,
  restorationMarkup: 0.2, // 20% of sell price is converted to restoration amount
};

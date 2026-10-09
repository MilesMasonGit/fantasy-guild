// Shared vocabulary, derived from the game's registries and never copied: the CMS asks the game what words exist, so definitions flow game → CMS in one direction and drift cannot recur.
// ⚠️ The cost: removing an export from a game registry breaks the CMS silently and immediately; a game-side deletion is a CMS-side break.

import { SKILLS as GAME_SKILLS, SKILL_CATEGORIES as GAME_SKILL_CATEGORIES } from '../../../src/config/registries/skillRegistry.js';
import { EQUIPMENT_CATEGORY_DEFS } from '../../../src/config/registries/equipmentCategories.js';
import { ITEM_TYPES as GAME_ITEM_TYPES } from '../../../src/config/registries/itemRegistry.js';
import {
  TOKEN_TYPES as GAME_TOKEN_TYPES,
  TOKEN_RARITIES as GAME_TOKEN_RARITIES,
} from '../../../src/config/registries/tokenConstants.js';

// The authorable modifier palette and target modes, read from the game so the CMS only offers axes something actually reads; `EFFECT_TYPES` itself holds several with no consumer.
export {
  MODIFIER_PALETTE,
  MODIFIER_BUCKETS,
  bucketsFor,
  MODIFIER_SHAPES,
  TARGET_MODES,
  getPaletteEntry,
  isAuthorableModifier,
  modifierValueRange,
  clampModifierValue,
  describeModifierDirection,
} from '../../../src/config/registries/modifierPalette.js';

// The statement grammar: the keywords, what each accepts, and the one renderer that turns a statement into a sentence, used by the editor row, the rules panel and the in-game tooltip alike.
export {
  KEYWORD,
  KEYWORDS,
  WHEN,
  DEFAULT_STATEMENT_CHARGE_DELTA,
  getKeyword,
  paletteForKeyword,
  makeStatement,
  newStatementId,
  blankPayload,
  statementsOf,
  statementsWith,
  stationSkillOf,
  hasRetiredEffectData,
  effectEntryOf,
} from '../../../src/systems/effects/statements.js';

export {
  renderStatement,
  renderSegments,
  upkeepLine,
  rulesLinesOf,
  rulesTextOf,
} from '../../../src/systems/effects/statementText.js';

// A statement as the ordered slots an author fills in: the model behind the sentence editor. It reads the same declarations the game reads, so a new keyword, moment, reach or role reaches the editor with no editor change.
export {
  SLOT_KIND,
  slotsOf,
  costSlots,
  FINE_PRINT_SLOTS,
  nearestOptions,
  slotsWithoutWords,
  slotDisplay,
  slotIsOrphaned,
  filterOptions,
} from '../../../src/systems/effects/statementSlots.js';

// The named effect library. A statement lives in a named entry and bearers reference that entry by id; the shape is declared in the game.
export {
  EFFECT_ID_PREFIX,
  MAX_SCALE,
  normaliseScale,
  effectTitle,
  scaleStatement,
  effectRefsOf,
  hasWorkingStatements,
  statementsFromEntry,
  expandBearer,
  expandAll,
  duplicateRefsOf,
  usedBy,
} from '../../../src/systems/effects/effectLibrary.js';

// ⚠️ The migration is imported, never reimplemented: it runs over `data/` and over the workspace in the browser (`useEntityStore`), and a second implementation would let the two produce different libraries.
export {
  migrateBearers,
  migratePromotionFields,
  migrateAppliesTargetsIn,
  provisionalName,
} from '../../../src/systems/effects/effectMigration.js';
export { migrateSkillIdsIn, migrateRecipePools } from '../../../src/systems/effects/skillIdMigration.js';

// When a rule spends its Token's charges. Same extensibility rule as TRIGGER_EVENTS: adding a moment in the game puts it in the editor's picker with no CMS change.
export {
  CHARGE_MOMENT,
  CHARGE_MOMENTS,
  DEFAULT_CHARGE_DELTA_BY_MOMENT,
  getChargeMoment,
  chargeMomentsFor,
  chargeMomentOf,
} from '../../../src/config/registries/chargeMomentRegistry.js';

// Token Lifecycle: the kinds of Foundation. Game-defined, so the dropdown, the engine and the content audit cannot disagree about what a kind is.
export { FOUNDATION_KINDS, foundationTierOf, foundationMinTierOf } from '../../../src/config/registries/tokenConstants.js';

// A turning Token rolls a chance once per cycle, both ways. The defaults a new Turns block starts with are the game's.
export { TURN_DEFAULTS } from '../../../src/config/registries/tokenConstants.js';

// A Token that comes back after it runs out: refill in place or regrow from another Token. The modes, the default rest and its floor are the game's.
export { RESPAWN_MODES, RESPAWN_DEFAULTS, RESPAWN_MIN_MS } from '../../../src/config/registries/tokenConstants.js';

// An enemy is a Token: it carries `enemy: { level, style }`. `ENEMY_STYLES` fills the Style dropdown and `enemyCombatBudget` powers the editor's read-only stat preview, imported from the game so the numbers shown are the numbers the fight uses.
export { ENEMY_STYLES } from '../../../src/config/registries/enemyProfile.js';
export { enemyCombatBudget } from '../../../src/config/FormulaRegistry.js';

// A hero-worked Token must name a skill. The game's own rule and wording, so the CMS and the boot audit name the same Tokens.
export { isWorkedWithoutSkill, WORK_SKILL_WHY } from '../../../src/systems/core/workSkillRule.js';

// The content checks for the six lifecycle blocks: the game's own rules and wording, so the Economy Audit and the boot audit report the same problems.
export { auditLifecycleBlocks } from '../../../src/systems/core/lifecycleAudit.js';

// Content naming a skill or job the game does not have (a renamed or dropped one). The game's own rule and wording.
export { findUnknownRefs } from '../../../src/systems/core/unknownRefRule.js';

// `tokenType` is derived from what a Token has rather than picked. The CMS computes it and writes it into the file.
export {
  deriveTokenType,
  derivedTokenType,
} from '../../../src/config/registries/tokenTypeDerivation.js';

// Triggered Token vocabulary: adding a row to TRIGGER_EVENTS makes it available in the trigger picker with no CMS change.
export {
  TRIGGER_EVENTS,
  TRIGGER_SCOPES,
  getTriggerEvent,
} from '../../../src/config/registries/triggerRegistry.js';

// How far a rule carries: the same game-defines / CMS-renders split as the trigger vocabulary.
export {
  REACH,
  REACHES,
  DEFAULT_REACH,
  reachOf,
} from '../../../src/config/registries/reachRegistry.js';

// Who a moment puts in the room. The CMS offers a role only where the chosen moment supplies it, which is why `rolesOf` crosses the boundary too.
export {
  ROLE,
  ROLES,
  getRole,
} from '../../../src/config/registries/roleRegistry.js';
export { rolesOf } from '../../../src/config/registries/triggerRegistry.js';

// The filters a selector may stack: AND-composed, negatable, and each declares what it needs to look at, so a filter the caller cannot evaluate refuses rather than guessing.
export {
  FILTER_KINDS,
  FILTER_NEEDS,
  getFilterKind,
  filtersOf,
  filterPhrase,
} from '../../../src/config/registries/filterRegistry.js';

// Where a number comes from: typed, a percentage of a named stat, or a count of a second selector's matches. A closed list, never arithmetic.
export {
  MAGNITUDE_KIND,
  MAGNITUDE_STATS,
  getMagnitudeStat,
  statsForRoles,
  magnitudePhrase,
} from '../../../src/config/registries/magnitudeRegistry.js';

// Where a spawned Token lands: an authored choice from a short list, never a hidden fallback.
export {
  PLACEMENT,
  PLACEMENTS,
  getPlacement,
  placementOf,
} from '../../../src/config/registries/placementRegistry.js';

// What a `Cannot` may forbid. One row today, shaped like the modifier palette so a second restriction is a row in the game, not a rewrite of the editor.
export {
  RESTRICTION_KINDS,
  getRestrictionKind,
  blankRestriction,
} from '../../../src/config/registries/restrictionPalette.js';

// What an `Applies` may put on someone. Read from the status engine's own
// registry, so the CMS can never offer a status the engine has not got.
import { authorableStatuses } from '../../../src/config/registries/statusRegistry.js';
// The simulator's dial defaults. They live beside the passes that read them, so
// there is one definition of "the §14 dials" rather than a copy here.
import { DEFAULT_DIALS } from '../engine/sim/dials.js';

export const AUTHORABLE_STATUSES = authorableStatuses();

// The game defines SKILLS as an object keyed by id; every CMS consumer expects an array of `{ id, name }`, so it is transformed here. `combat` is deliberately absent: it is a game category, not a skill, so it can never be picked in a skill dropdown.
export const SKILLS = Object.values(GAME_SKILLS).map(({ id, name, layer }) => ({ id, name, layer }));

/**
 * The skill layers, in the order the game declares them, with the words a designer sees. `SKILLS` is already in this order, so nothing is re-sorted; these are the group headings that make the order visible.
 * ⚠️ Derived from the game's layer list: `skillsByLayer` drops any layer without a heading, so a hand-typed list emptied every picker the moment the game renamed its layers.
 */
export const SKILL_LAYER_LABELS = Object.freeze(
  Object.values(GAME_SKILL_CATEGORIES).map(({ id, name, hint }) => [id, hint ? `${name} — ${hint}` : name]),
);

/** `SKILLS` grouped into `[label, skills[]]`, empty layers dropped. */
export function skillsByLayer() {
  return SKILL_LAYER_LABELS
    .map(([layer, label]) => [label, SKILLS.filter((s) => s.layer === layer)])
    .filter(([, group]) => group.length > 0);
}

/**
 * What an item's `equipSlot` may be.
 * ⚠️ Not `SLOT_ORDER`, which is the hero dock's grid indices `[0..8]`: an item names a category, which `EquipmentValidator` checks with `isEquipCategory`. Categories carry a display label and a cap, so surface both.
 */
export const EQUIP_CATEGORIES = EQUIPMENT_CATEGORY_DEFS.map(({ id, label, icon, cap }) => ({
  id,
  label,
  icon,
  cap,
}));

export const EQUIP_SLOTS = EQUIP_CATEGORIES.map((c) => c.id);

// Token classification vocabulary. Adding a value in the game makes it available here with no CMS change; `ContentRules.test.js` asserts that shipped content only uses values these lists declare.
export const TOKEN_TYPES = [...GAME_TOKEN_TYPES];
export const TOKEN_RARITIES = [...GAME_TOKEN_RARITIES];
// The five tempos and their cycle-time bands: the game declares the vocabulary, the CMS offers it.
// ⚠️ Keep this re-export after an `export const`: its position is the regression guard for `CMSBoundary.test.js`'s scanner, which once mis-read a `from` clause appearing after one.
export {
  TEMPO_NAMES,
  TEMPO_BANDS,
  isTempo,
  bandFor,
  isInBand,
} from '../../../src/config/registries/tempoBands.js';

export const ITEM_TYPES = Object.values(GAME_ITEM_TYPES);

export const RESTORE_TYPES = ['HP', 'Energy'];

export const PERSONALITY_TAGS = [
  'Food', 'Drink', 'Tool', 'Weapon', 'Armor', 'Consumable', 'Ingredient',
  'Material', 'Treasure', 'Quest', 'Legendary', 'Intermediate', 'Root',
  'Heavy', 'Volatile', 'Liquid', 'Resource Sink', 'Gathering', 'Passive', 'Fast', 'Slow',
];

export const ENEMY_TIERS = [1, 2, 3, 4, 5, 6];

// Balance defaults, consumed by `useGlobalStore`. These are the old card-economy's dials, kept only so the dial UI has something to render against.

export const EV_CURVE = {
  1: 1.05,
  11: 1.15,
  41: 1.40,
  71: 1.70,
  99: 2.00,
};

export const EV_VARIANCE = {
  1: 0.02,
  11: 0.05,
  41: 0.10,
  71: 0.20,
};

export const DEFAULT_GLOBALS = {
  /** The economic simulator's dials, in one key: nested rather than spread across the globals above so they are one thing to reset, migrate and hand to `runSim`. The flat dials around it belong to the retired balance engine. See `sim/dials.js` for which dials a pass reads. */
  simDials: DEFAULT_DIALS,

  gpt: 3.0,
  energyGpValue: 0.25,
  healthGpValue: 0.50,
  xpToGoldRatio: 0.1,
  skillMultiplierRate: 0.035,
  levelReqBaseValue: 100,
  defaultItemDurability: 100,
  laborScalingType: 'exponential',
  defaultTargetEV: 1.05,
  profitMarkupPerUniqueInput: 0.02,
  rawCommodityBaseValue: 1.0,
  rawCommodityScalingRate: 0.05,

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

  profitSplitRatio: 0.5,
  restorationMarkup: 0.2,
  laborRatePerLevel: 0.002,

  mapTargetROI: 20.0,
  passiveVelocityRatio: 0.25,
  craftMarkupBase: 0.05,
  craftMarkupTierRate: 0.01,
  velocityTolerance: 0.05,
  unlimitedLifetimeHours: 16.0,
  mapBurstSellRatio: 0.50,
  combatRewardMultiplier: 1.05,

  // ⚠️ Combat- and progression-era dials, kept only so the existing Settings screen renders controlled inputs rather than throwing React warnings.
  combatXpMultiplier: 1.0,
  energyPerSwing: 1,
  xpThresholdBase: 100,
  xpThresholdMultiplier: 1.15,
  xpTaxBracketSize: 10,
  xpTaxDecayRate: 0.1,
  guildProgressionSpeedFactor: 1.0,
  ttlTargets: { 1: 2, 11: 15, 31: 60, 61: 240, 91: 720 },
  heroProfiles: {
    1: { combatStat: 5, derivedHp: 5 },
    2: { combatStat: 15, derivedHp: 15 },
    3: { combatStat: 30, derivedHp: 30 },
    4: { combatStat: 50, derivedHp: 50 },
    5: { combatStat: 80, derivedHp: 80 },
    6: { combatStat: 120, derivedHp: 120 },
  },
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
};

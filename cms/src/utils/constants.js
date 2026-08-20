// === Shared vocabulary — DERIVED from the game's registries, never copied ===
//
// CMS-5's founding principle: the CMS asks the game what words exist. The old
// CMS kept its own hand-maintained lists and they rotted out of sync, which is
// how it ended up offering skills (`industry`, `culinary`, `nautical`) the game
// had never heard of. Definitions flow game → CMS, in one direction, so that
// drift cannot recur.
//
// ⚠️ **The cost of this principle, seen once already:** removing an export from
// a game registry breaks the CMS silently and immediately — the skill/class
// rework's removal of `SUB_SKILL_TO_PARENT` left the CMS unable to build, and
// nothing caught it. The trade is still judged worth it (see the CMS-5 note in
// `cms_rework_v2_decisions.md`), but a game-side deletion is a CMS-side break.

import { SKILLS as GAME_SKILLS } from '../../../src/config/registries/skillRegistry.js';
import { EQUIPMENT_CATEGORY_DEFS } from '../../../src/config/registries/equipmentCategories.js';
import { ITEM_TYPES as GAME_ITEM_TYPES } from '../../../src/config/registries/itemRegistry.js';
import {
  TOKEN_TYPES as GAME_TOKEN_TYPES,
  TOKEN_RARITIES as GAME_TOKEN_RARITIES,
  TOKEN_THEMES as GAME_TOKEN_THEMES,
} from '../../../src/config/registries/tokenConstants.js';

// The authorable modifier palette (CMS-20/25) and target modes (CMS-18). Read
// from the game so the CMS can only ever offer axes something actually reads —
// `EFFECT_TYPES` itself holds several with no consumer at all.
export {
  MODIFIER_PALETTE,
  MODIFIER_BUCKETS,
  MODIFIER_SHAPES,
  TARGET_MODES,
  getPaletteEntry,
  isAuthorableModifier,
  modifierValueRange,
  clampModifierValue,
  describeModifierDirection,
} from '../../../src/config/registries/modifierPalette.js';

// The statement grammar (effect authoring redesign). The keywords, what each
// one accepts, and the one renderer that turns a statement into a sentence —
// used by the editor row, the rules panel and the in-game tooltip alike, so
// there is nothing left for them to disagree about.
export {
  KEYWORD,
  KEYWORDS,
  WHEN,
  getKeyword,
  paletteForKeyword,
  makeStatement,
  newStatementId,
  blankPayload,
  statementsOf,
  statementsWith,
  hasRetiredEffectData,
  effectEntryOf,
} from '../../../src/systems/effects/statements.js';

export {
  renderStatement,
  rulesLinesOf,
  rulesTextOf,
} from '../../../src/systems/effects/statementText.js';

// `tokenType` is derived from what a Token has rather than picked (§1.2). The
// CMS computes it and writes it into the file; the author never types it.
export {
  deriveTokenType,
  derivedTokenType,
} from '../../../src/config/registries/tokenTypeDerivation.js';

// Triggered Token vocabulary (CMS-32). Extensible from the game: adding a row
// to TRIGGER_EVENTS makes it available in the trigger picker with no CMS change.
export {
  TRIGGER_EVENTS,
  TRIGGER_SCOPES,
  getTriggerEvent,
} from '../../../src/config/registries/triggerRegistry.js';

// The game defines SKILLS as an object keyed by id; every CMS consumer expects
// an array of { id, name }. Transform here so downstream code is untouched.
// `combat` is deliberately absent: it is a game CATEGORY, not one of the 15
// skills, so it can never be picked in a skill dropdown.
export const SKILLS = Object.values(GAME_SKILLS).map(({ id, name }) => ({ id, name }));

/**
 * What an item's `equipSlot` may be.
 *
 * ⚠️ **Not `SLOT_ORDER`**, which the CMS used to import for this. That is
 * `[0..8]` — the hero dock's grid *indices* since the dock rework replaced
 * named slots with a 9-cell grid. An item does not name a cell; it names a
 * **category**, and `EquipmentValidator` checks it with `isEquipCategory`.
 * Importing the wrong symbol produced an equip-slot dropdown offering the
 * numbers 0 to 8.
 *
 * Categories carry a display label and a cap, so surface both — `hand` allows
 * two, `consumable` is uncapped, most gear caps at one (D-55/D-56).
 */
export const EQUIP_CATEGORIES = EQUIPMENT_CATEGORY_DEFS.map(({ id, label, icon, cap }) => ({
  id,
  label,
  icon,
  cap,
}));

export const EQUIP_SLOTS = EQUIP_CATEGORIES.map((c) => c.id);

// Token classification vocabulary (CMS-89). Adding a value in the game makes it
// available here with no CMS change; `ContentRules.test.js` asserts that shipped
// content only uses values these lists declare.
export const TOKEN_TYPES = [...GAME_TOKEN_TYPES];
export const TOKEN_RARITIES = [...GAME_TOKEN_RARITIES];
export const TOKEN_THEMES = [...GAME_TOKEN_THEMES];

/**
 * ⚠️ **Known wrong — resolve before building the Item editor (Phase 1).**
 *
 * There is a live three-way disagreement about what an item's `type` may be:
 *
 * * the game declares `material, tool, weapon, armor, food, potion, currency,
 *   drop` (here);
 * * `data/items.json` actually uses `material, ingredient, weapon, food, drink`
 *   — two of which the game does not declare;
 * * the old CMS offered a third, capitalised list (`Material`, `Ingredient`,
 *   `Quest Item`, …) matching neither.
 *
 * Type is not cosmetic — CMS-13 has it keying recipe and context gating — so an
 * item authored as `Material` and synced would write a value the game does not
 * recognise. This import at least makes the game the single source, per CMS-5,
 * rather than adding a fourth list. **Which values the merged vocabulary should
 * contain is an open content question for the owner**, tracked in the decisions
 * log's Open list; the Item editor must not ship until it is answered.
 */
export const ITEM_TYPES = Object.values(GAME_ITEM_TYPES);

export const RESTORE_TYPES = ['HP', 'Energy'];

/**
 * ⚠️ **Also known wrong, and for the same reason as `ITEM_TYPES` above.**
 *
 * A hardcoded tag vocabulary maintained in the CMS — precisely what CMS-5
 * forbids. CMS-13 has item `tags` keying recipe and context gating rather than
 * being cosmetic, so these are mechanically meaningful strings that the game
 * has no matching list for: `tagRegistry.js` exports `FLAVOUR_TAGS`, but those
 * are card-era Token-targeting tags, not item tags.
 *
 * Kept unchanged for now only so the Phase 1 Item editor keeps building.
 * Resolving it belongs with the `ITEM_TYPES` question — same decision, same
 * phase, and both are in the decisions log's Open list.
 */
export const PERSONALITY_TAGS = [
  'Food', 'Drink', 'Tool', 'Weapon', 'Armor', 'Consumable', 'Ingredient',
  'Material', 'Treasure', 'Quest', 'Legendary', 'Intermediate', 'Root',
  'Heavy', 'Volatile', 'Liquid', 'Resource Sink', 'Gathering', 'Passive', 'Fast', 'Slow',
];

/** Combat tiers, used only by the Settings screen's hero profiles (Phase 8 culls this). */
export const ENEMY_TIERS = [1, 2, 3, 4, 5, 6];

// === Balance defaults ========================================================
// Consumed by `useGlobalStore` and, for now, by the balance engines kept as
// Phase 8 reference. CMS-15's Global Value dials (production markup, Map ROI
// ratio, velocity bands) replace most of this when the solver is rewritten —
// these are the old card-economy's dials, kept only so the dial UI has
// something to render against until then.

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

  // Wealth & XP velocity targets — CMS-10's velocity check, CMS-15's third dial.
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

  // CMS-116 Global Dials for balancing and economy feel
  mapTargetROI: 20.0,
  passiveVelocityRatio: 0.25,
  craftMarkupBase: 0.05,
  craftMarkupTierRate: 0.01,
  velocityTolerance: 0.05,
  unlimitedLifetimeHours: 16.0,
  mapBurstSellRatio: 0.50,
  combatRewardMultiplier: 1.05,

  // ⚠️ Combat- and progression-era dials, kept ONLY so the existing Settings
  // screen renders controlled inputs rather than throwing React warnings.
  // CMS-2 defers combat balancing and CMS-15 replaces most of these with the
  // real Global Value dials — Phase 8 culls this block wholesale.
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

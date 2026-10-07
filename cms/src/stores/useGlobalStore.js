import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_GLOBALS } from '../utils/constants';

/** Global simulation constants store: the tuning knobs for the economic engine. */
export const useGlobalStore = create(
  persist(
    (set) => ({
      ...DEFAULT_GLOBALS,

      // Gemini API key (stored locally).
      geminiApiKey: '',

      generatorStyleGuide: `## TAGS & CLASSIFICATION
- DO NOT invent your own tags. You MUST only use tags from the approved list: [Food, Drink, Tool, Weapon, Armor, Consumable, Ingredient, Material, Treasure, Quest, Legendary, Intermediate, Root, Heavy, Volatile, Liquid, Resource Sink, Gathering, Passive, Fast, Slow].
- Use "Food" for items that restore HP and "Drink" for items that restore Energy.
- Use "Material" for raw resources and "Ingredient" for processed food components.
- Use "Root" for base items that have no inputs (e.g. raw ore, water).

## NAMING CONVENTIONS
- Almost always AVOID adjectives in item names, except for rare/legendary magic items.
- Keep names simple, clean, and noun-focused.
- For example: Use "Apple" instead of "Sweet Apple", "Wheat" instead of "Golden Wheat", "Butter" instead of "Creamy Butter", "Bread" instead of "Crusty Bread".
- Any descriptive, balancing, or flavoring qualities should be represented purely via the item's combat/stat modifier (e.g. an "Apple" gets assigned a "Sweet" effect, "Butter" gets assigned a "Creamy" effect, and "Bread" gets assigned a "Toasty" effect).
- Recipes MUST always have the exact same name as their primary output item. Instead of "Bake Bread", "Cook Apple Pie", or "Mill Flour", the recipes must simply be named "Bread", "Apple Pie", and "Flour".
- Tasks and Stations MUST be named after a physical building, location, or tool.
- The title should NOT describe the actual action being done (the action should be inferred). Adjectives and slightly vague titles are perfectly fine and encouraged.
  - For example: Use "Dairy Cow Pasture" instead of "Milk Dairy Cows", "Golden Wheat Field" instead of "Harvest Golden Wheat", "Infested Cellar" instead of "Rat Fight", and "Kitchen Hearth" instead of "Bake Bread Kitchen".

## DESIGN PHILOSOPHY
- This is a fantasy idle game. Items flow between areas, so keep them universal.
- Tasks represent physical card locations on a game board. They should feel like places you send a hero TO.

## QUESTS & ZONE UNLOCKS
- Areas link together in an interconnected web of exploration unlocks. An Area can contain multiple quests, each serving to unlock different downstream Areas by targeting them in the "mapFragmentTarget" field.
- Gateway Quests: Quests provided by an Area MUST only consume items/resources or target enemies that are locally produced, gathered, or defeated within THAT specific Area.
- Quest Rewards: Quests MUST always include a "rewards" array containing Gold (CURRENCY type, id: "gold") or Items. The total value of the rewards must be proportional to and at least 1.5x to 2x greater than the combined GP value of the items or actions required to complete the quest.
- Schema matching for Quests:
  - id: "quest_[area_id]_[target_item_or_enemy_name]"
  - name: Location or objective theme (noun-based, adjectives allowed)
  - targetEvent: "ON_ITEM_GAINED" or "ON_ENEMY_KILLED"
  - targetId: Name of the local item or enemy
  - maxProgress: Quantity required (e.g. 5 to 50 based on level)
  - mapFragmentTarget: The downstream area name/ID being unlocked (e.g., "Farmland" or "Mountain")
  - fragmentIcon: Emoji matching the destination theme`,

      setGlobal: (key, value) => set({ [key]: value }),

      setSellModifier: (type, value) =>
        set((s) => ({
          sellModifiers: { ...s.sellModifiers, [type]: value },
        })),

      setHeroProfile: (tier, patch) =>
        set((s) => ({
          heroProfiles: {
            ...s.heroProfiles,
            [tier]: { ...s.heroProfiles[tier], ...patch },
          },
        })),

      resetGlobals: () => set(DEFAULT_GLOBALS),
    }),
    {
      name: 'fantasy-guild-cms-globals',
      /**
       * Version 2 adds `simDials`.
       * ⚠️ `migrate` is not enough on its own: zustand runs it only when the stored `version` is a number that differs from this one, so a workspace written before any version key existed is used as-is, and a store that installed `simDials` only in `migrate` would hand `runSim` an undefined dial set. The defaults are therefore filled in `merge`, which runs on every rehydration; `migrate` is kept for a numbered mismatch, which would otherwise throw the dials away.
       */
      version: 2,
      /** The default merge plus the dial defaults. The spread order is zustand's own default (persisted wins over the fresh store); `simDials` is then layered so a stored dial set keeps every value the developer turned and gains any dial added since. */
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState || {}),
        simDials: { ...DEFAULT_GLOBALS.simDials, ...(persistedState?.simDials || {}) },
      }),
      migrate: (persistedState, version) => {
        // ⚠️ zustand does not call `migrate` for a versionless blob, so the versionless path is `merge`'s.
        if (version < 1) {
          return {
            ...DEFAULT_GLOBALS,
            ...persistedState,
            gphTargets: DEFAULT_GLOBALS.gphTargets,
            xphTargets: DEFAULT_GLOBALS.xphTargets,
          };
        }
        return persistedState;
      },
    }
  )
);

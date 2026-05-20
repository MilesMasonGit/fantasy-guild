import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/idGenerator';

const DEFAULT_EFFECTS = {
  // --- Combat Effects (Weapons) ---
  damage: {
    id: "damage",
    name: "Damage",
    targetEntityTypes: ["Weapon"],
    drainTrigger: "NONE",
    description: "+3 Base Damage per level."
  },
  finesse: {
    id: "finesse",
    name: "Finesse",
    targetEntityTypes: ["Weapon"],
    drainTrigger: "NONE",
    description: "+5% Hit Chance per level."
  },
  stun: {
    id: "stun",
    name: "Stun",
    targetEntityTypes: ["Weapon"],
    drainTrigger: "NONE",
    description: "+100ms Target Attack Speed Delay per level."
  },
  sunder: {
    id: "sunder",
    name: "Sunder",
    targetEntityTypes: ["Weapon"],
    drainTrigger: "NONE",
    description: "Ignores 10% Defender Defense per level."
  },
  // --- Combat Effects (Armor) ---
  resistance: {
    id: "resistance",
    name: "Resistance",
    targetEntityTypes: ["Armor"],
    drainTrigger: "NONE",
    description: "-2 Flat Damage Taken per level."
  },
  deflection: {
    id: "deflection",
    name: "Deflection",
    targetEntityTypes: ["Armor"],
    drainTrigger: "NONE",
    description: "-5% Enemy Hit Chance per level."
  },
  light: {
    id: "light",
    name: "Light",
    targetEntityTypes: ["Armor"],
    drainTrigger: "NONE",
    description: "-10% Energy Cost per swing per level."
  },
  mobile: {
    id: "mobile",
    name: "Mobile",
    targetEntityTypes: ["Armor"],
    drainTrigger: "NONE",
    description: "-100ms Attack Interval per level."
  },
  // --- Non-Combat Drink Effects ---
  herbal: {
    id: "herbal",
    name: "Herbal",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Nature XP per level."
  },
  bitter: {
    id: "bitter",
    name: "Bitter",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Industry XP per level."
  },
  tannin: {
    id: "tannin",
    name: "Tannin",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Culinary XP per level."
  },
  sour: {
    id: "sour",
    name: "Sour",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Occult XP per level."
  },
  creamy: {
    id: "creamy",
    name: "Creamy",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Crime XP per level."
  },
  bubbly: {
    id: "bubbly",
    name: "Bubbly",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Social XP per level."
  },
  frosty: {
    id: "frosty",
    name: "Frosty",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Nautical XP per level."
  },
  refreshing: {
    id: "refreshing",
    name: "Refreshing",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+1% Science XP per level."
  },
  // --- Rare Loot Table Drink Effects ---
  farmers_ale: {
    id: "farmers_ale",
    name: "Farmer's Ale",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% Sylvan Cache drop chance on Nature actions."
  },
  miners_brew: {
    id: "miners_brew",
    name: "Miner's Brew",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% Deepstone Trove drop chance on Industry actions."
  },
  brewers_stout: {
    id: "brewers_stout",
    name: "Brewer's Stout",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% Ambrosial Stash drop chance on Culinary actions."
  },
  alchemists_elixir: {
    id: "alchemists_elixir",
    name: "Alchemist's Elixir",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% Eldritch Essence Vault drop chance on Occult actions."
  },
  smugglers_cider: {
    id: "smugglers_cider",
    name: "Smuggler's Cider",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% Shadow Guild Cache drop chance on Crime actions."
  },
  diplomats_mead: {
    id: "diplomats_mead",
    name: "Diplomat's Mead",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% High Court Coffers drop chance on Social actions."
  },
  sailors_grog: {
    id: "sailors_grog",
    name: "Sailor's Grog",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% Sunken Galleon Cargo drop chance on Nautical actions."
  },
  tinkerers_toddy: {
    id: "tinkerers_toddy",
    name: "Tinkerer's Toddy",
    targetEntityTypes: ["Drink"],
    drainTrigger: "NONE",
    description: "+0.05% Lost Laboratory Drafts drop chance on Science actions."
  },
  // --- Subtle Combat Food Effects ---
  hearty: {
    id: "hearty",
    name: "Hearty",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+2% Max HP per level."
  },
  savory: {
    id: "savory",
    name: "Savory",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+3% chance to halve incoming damage per level."
  },
  crunchy: {
    id: "crunchy",
    name: "Crunchy",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+1% chance to block and ignore a hit entirely per level."
  },
  rich: {
    id: "rich",
    name: "Rich",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+2% Auto-Eat Threshold per level."
  },
  spicy: {
    id: "spicy",
    name: "Spicy",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+1 Flat Damage per level."
  },
  zesty: {
    id: "zesty",
    name: "Zesty",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "-10ms Attack Interval per level."
  },
  sweet: {
    id: "sweet",
    name: "Sweet",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+3% chance to not consume energy per swing per level."
  },
  salty: {
    id: "salty",
    name: "Salty",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+3% chance to not consume Drink charges per level."
  },
  glazed: {
    id: "glazed",
    name: "Glazed",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+3% chance to not consume Weapon durability per level."
  },
  chewy: {
    id: "chewy",
    name: "Chewy",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+3% chance to not consume Armor durability per level."
  },
  tart: {
    id: "tart",
    name: "Tart",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+3% chance to not consume Special Item durability per level."
  },
  umami: {
    id: "umami",
    name: "Umami",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+1% chance to roll combat loot twice per level."
  },
  golden: {
    id: "golden",
    name: "Golden",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+2% Gold Gained from combat per level."
  },
  minty: {
    id: "minty",
    name: "Minty",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+2% Combat XP Gained per level."
  },
  peppery: {
    id: "peppery",
    name: "Peppery",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+1% Hit Chance per level."
  },
  toasty: {
    id: "toasty",
    name: "Toasty",
    targetEntityTypes: ["Food"],
    drainTrigger: "NONE",
    description: "+3% health restored from auto-eat per level."
  },
  // --- Enemy & Combat Trigger Effects ---
  lifesteal: {
    id: "lifesteal",
    name: "Lifesteal",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_DAMAGE_DEALT",
    description: "Restores 1 point of HP each time damage is dealt."
  },
  thorns: {
    id: "thorns",
    name: "Thorns",
    targetEntityTypes: ["Enemy", "Armor"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "Deals 1 damage to the attacker when hit."
  },
  rage: {
    id: "rage",
    name: "Rage",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "-100ms Attack Interval when below 40% HP."
  },
  hard_shell: {
    id: "hard_shell",
    name: "Hard Shell",
    targetEntityTypes: ["Enemy", "Armor"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "Ignores damage first X times each combat."
  },
  speedy: {
    id: "speedy",
    name: "Speedy",
    targetEntityTypes: ["Enemy", "Armor", "Weapon"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "-2% Opponent accuracy."
  },
  disgusting: {
    id: "disgusting",
    name: "Disgusting",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "Reduces hero's auto-eat healing value by 5%."
  },
  corrosive_blood: {
    id: "corrosive_blood",
    name: "Corrosive Blood",
    targetEntityTypes: ["Enemy", "Armor"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "5% chance to remove 1 durability from hero's Weapon when damaged."
  },
  acid_spit: {
    id: "acid_spit",
    name: "Acid Spit",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_DAMAGE_DEALT",
    description: "5% chance to remove 1 durability from hero's Armor when causing damage."
  },
  sticky_web: {
    id: "sticky_web",
    name: "Sticky Web",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "10% chance to add +100ms delay to hero's next attack interval when hit."
  },
  noxious: {
    id: "noxious",
    name: "Noxious",
    targetEntityTypes: ["Enemy", "Armor", "Consumable"],
    drainTrigger: "ON_TICK_COMPLETE",
    description: "Deals 1 damage to the opponent every 3 seconds."
  },
  regenerate: {
    id: "regenerate",
    name: "Regenerate",
    targetEntityTypes: ["Enemy", "Armor", "Consumable"],
    drainTrigger: "ON_TICK_COMPLETE",
    description: "Restores 1 point of HP every 3 seconds."
  },
  dodge: {
    id: "dodge",
    name: "Dodge",
    targetEntityTypes: ["Enemy", "Armor"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "5% chance to ignore an incoming attack entirely when hit."
  },
  drain_touch: {
    id: "drain_touch",
    name: "Drain Touch",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_DAMAGE_DEALT",
    description: "5% chance to steal 1 point of hero's Energy when damage is dealt."
  },
  crushing: {
    id: "crushing",
    name: "Crushing",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_DAMAGE_DEALT",
    description: "5% chance to add +200ms delay to hero's next attack when causing damage."
  },
  second_wind: {
    id: "second_wind",
    name: "Second Wind",
    targetEntityTypes: ["Enemy", "Armor", "Consumable"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "Restores 10 points of HP when falling below 20% HP."
  },
  hypnotic: {
    id: "hypnotic",
    name: "Hypnotic",
    targetEntityTypes: ["Enemy", "Weapon"],
    drainTrigger: "ON_HIT_TAKEN",
    description: "Reduces hero's auto-drink energy value by 5%."
  }
};

const DEFAULT_LOOT_TABLES = {
  sylvan_cache: {
    id: "sylvan_cache",
    name: "Sylvan Cache",
    description: "Rare Nature harvest rewards (botanicals, heartwood, wild gems).",
    rolls: 1,
    entries: []
  },
  deepstone_trove: {
    id: "deepstone_trove",
    name: "Deepstone Trove",
    description: "Rare Industry mining/crafting rewards (geodes, primal minerals, scrap).",
    rolls: 1,
    entries: []
  },
  ambrosial_stash: {
    id: "ambrosial_stash",
    name: "Ambrosial Stash",
    description: "Rare Culinary cooking/brewing rewards (royal spices, rare ingredients).",
    rolls: 1,
    entries: []
  },
  eldritch_essence_vault: {
    id: "eldritch_essence_vault",
    name: "Eldritch Essence Vault",
    description: "Rare Occult magical rewards (runic papers, soul shards, stardust).",
    rolls: 1,
    entries: []
  },
  shadow_guild_cache: {
    id: "shadow_guild_cache",
    name: "Shadow Guild Cache",
    description: "Rare Crime thievery rewards (contraband, shadow keys, stolen goods).",
    rolls: 1,
    entries: []
  },
  high_court_coffers: {
    id: "high_court_coffers",
    name: "High Court Coffers",
    description: "Rare Social interaction rewards (royal favors, treaties, grand badges).",
    rolls: 1,
    entries: []
  },
  sunken_galleon_cargo: {
    id: "sunken_galleon_cargo",
    name: "Sunken Galleon Cargo",
    description: "Rare Nautical fishing/sailing rewards (doubloons, ancient relics, ocean pearls).",
    rolls: 1,
    entries: []
  },
  lost_laboratory_drafts: {
    id: "lost_laboratory_drafts",
    name: "Lost Laboratory Drafts",
    description: "Rare Science engineering rewards (clockwork cores, active schematics).",
    rolls: 1,
    entries: []
  }
};

/**
 * Central entity store for all CMS entities.
 * Persisted to localStorage via Zustand middleware (Draft Autosave).
 */
export const useEntityStore = create(
  persist(
    (set, get) => ({
      // ===== Entity Collections (keyed by id) =====
      items: {},
      recipes: {},
      tasks: {},
      workstations: {},
      enemies: {},
      areas: {},
      quests: {},
      subskills: {},
      effects: { ...DEFAULT_EFFECTS },
      lootTables: { ...DEFAULT_LOOT_TABLES },
      // ===== Active Selection =====
      activeEntityId: null,
      activeEntityType: null,

      setActiveEntity: (id, type) => set({ activeEntityId: id, activeEntityType: type }),
      clearActiveEntity: () => set({ activeEntityId: null, activeEntityType: null }),

      // ===== ITEMS =====
      addItem: (data = {}) => {
        const id = generateId('item');
        const item = {
          name: data.name || 'New Item',
          icon: data.icon || '📦',
          type: data.type || 'Material',
          tags: data.tags || [],
          stackable: data.stackable ?? true,
          maxStack: data.maxStack || 99,
          restoreAmount: data.restoreAmount || 0,
          restoreType: data.restoreType || '',
          regen: data.regen || 0,
          equipSlot: data.equipSlot || '',
          durability: data.durability || 0,
          // Economic values (set by simulation)
          trueCost: data.trueCost || 0,
          sellPrice: data.sellPrice || 0,
          valueProfile: data.valueProfile || { hp: 0.0, energy: 0.0, sellValue: 1.0 },
          assignedEffect: data.assignedEffect || null, // { effectId: string, scale: number }
          ...data,
          id, // ensure id is always the generated one
        };
        set((s) => ({ items: { ...s.items, [id]: item } }));
        return id;
      },
      updateItem: (id, patch) =>
        set((s) => ({
          items: { ...s.items, [id]: { ...s.items[id], ...patch } },
        })),
      deleteItem: (id) =>
        set((s) => {
          const { [id]: _discard, ...rest } = s.items;
          return { items: rest };
        }),

      // ===== RECIPES =====
      addRecipe: (data = {}) => {
        const id = generateId('recipe');
        const recipe = {
          name: data.name || 'New Recipe',
          subskillId: data.subskillId || '',
          levelRequirement: data.levelRequirement || 1,
          baseTickTime: data.baseTickTime || 10000,
          energyCost: data.energyCost || 1,
          inputs: data.inputs || [],
          outputs: (data.outputs || []).map(o => ({ 
            id: o.id || o.itemId, 
            type: o.type || 'item', 
            dropChance: o.dropChance ?? 100, 
            minQty: o.minQty ?? o.quantity ?? 1, 
            maxQty: o.maxQty ?? o.quantity ?? 1, 
            isLocked: o.isLocked ?? false 
          })),
          encounterChance: data.encounterChance || 0,
          encounterTableId: data.encounterTableId || null,
          xpAwarded: data.xpAwarded || 0,
          targetEV: data.targetEV || 1.05,
          tags: data.tags || [],
          autoBalance: data.autoBalance ?? true,
          isLocked: data.isLocked ?? false,
          fieldLocks: data.fieldLocks || { quantity: false, xpAwarded: false },
          profitSplit: data.profitSplit || { item: 0.8, xp: 0.2 },
          // Diagnostics
          calculatedEV: null,
          goldPerMinute: null,
          xpPerMinute: null,
          ...data,
          id,
        };
        set((s) => ({ recipes: { ...s.recipes, [id]: recipe } }));
        return id;
      },
      updateRecipe: (id, patch) =>
        set((s) => ({
          recipes: { ...s.recipes, [id]: { ...s.recipes[id], ...patch } },
        })),
      deleteRecipe: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.recipes;
          return { recipes: rest };
        }),

      // ===== TASKS =====
      addTask: (data = {}) => {
        const id = generateId('task');
        const task = {
          name: data.name || 'New Task',
          areaId: data.areaId || '',
          baseTickTime: data.baseTickTime || 10000,
          skillRequirement: data.skillRequirement || 1,
          skill: data.skill || 'nature',
          subskill: data.subskill || '',
          energyCost: data.energyCost || 1,
          targetEV: data.targetEV || 1.05,
          inputs: data.inputs || [],
          outputs: (data.outputs || []).map(o => ({ 
            id: o.id || o.itemId, 
            type: o.type || 'item', 
            dropChance: o.dropChance ?? 100, 
            minQty: o.minQty ?? o.quantity ?? 1, 
            maxQty: o.maxQty ?? o.quantity ?? 1, 
            isLocked: o.isLocked ?? false 
          })),
          encounterChance: data.encounterChance || 0,
          encounterTableId: data.encounterTableId || null,
          xpAwarded: data.xpAwarded || 0,
          tags: data.tags || [],
          autoBalance: data.autoBalance ?? true,
          isLocked: data.isLocked ?? false,
          fieldLocks: data.fieldLocks || { quantity: false, xpAwarded: false },
          profitSplit: data.profitSplit || { item: 0.8, xp: 0.2 },
          minToolTier: data.minToolTier || 0,
          acceptedToolType: data.acceptedToolType || '',
          // Diagnostics
          calculatedEV: null,
          goldPerMinute: null,
          xpPerMinute: null,
          prescribedXP: null,
          ...data,
          id,
        };
        set((s) => ({ tasks: { ...s.tasks, [id]: task } }));
        return id;
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...patch } },
        })),
      deleteTask: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.tasks;
          return { tasks: rest };
        }),

      // ===== WORKSTATIONS =====
      addWorkstation: (data = {}) => {
        const id = generateId('workstation');
        const workstation = {
          name: data.name || 'New Workstation',
          areaId: data.areaId || '',
          subskillId: data.subskillId || '',
          skillCap: data.skillCap || 10,
          ...data,
          id,
        };
        set((s) => ({ workstations: { ...s.workstations, [id]: workstation } }));
        return id;
      },
      updateWorkstation: (id, patch) =>
        set((s) => ({
          workstations: { ...s.workstations, [id]: { ...s.workstations[id], ...patch } },
        })),
      deleteWorkstation: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.workstations;
          return { workstations: rest };
        }),

      // ===== ENEMIES =====
      addEnemy: (data = {}) => {
        const id = generateId('enemy');
        const enemy = {
          name: data.name || 'New Enemy',
          areaId: data.areaId || '',
          biomeId: data.biomeId || '',
          tier: data.tier || 1,
          combatStat: data.combatStat || 5,
          hp: data.hp || 30,
          attackSpeed: data.attackSpeed || 3000,
          combatType: data.combatType || 'Melee',
          skillId: data.skillId || 'combat',
          skillRequirement: data.skillRequirement || 1,
          drops: (data.drops || []).map(o => ({ 
            id: o.id || o.itemId, 
            type: o.type || 'item', 
            dropChance: o.dropChance ?? 100, 
            minQty: o.minQty ?? o.quantity ?? 1, 
            maxQty: o.maxQty ?? o.quantity ?? 1, 
            isLocked: o.isLocked ?? false 
          })),
          encounterChance: data.encounterChance || 0,
          encounterTableId: data.encounterTableId || null,
          xpAwarded: data.xpAwarded || 0,
          tags: data.tags || [],
          autoBalance: data.autoBalance ?? true,
          isLocked: data.isLocked ?? false,
          fieldLocks: data.fieldLocks || { quantity: false, xpAwarded: false },
          profitSplit: data.profitSplit || { item: 0.8, xp: 0.2 },
          energyCost: data.energyCost || 2,
          assignedEffects: (data.assignedEffects || []).map(e => typeof e === 'string' ? { effectId: e, scale: 1 } : e),
          modifiers: data.modifiers || [],
          // Diagnostics
          calculatedEV: null,
          expectedDamageTaken: null,
          timeToKill: null,
          ...data,
          id,
        };
        set((s) => ({ enemies: { ...s.enemies, [id]: enemy } }));
        return id;
      },
      updateEnemy: (id, patch) =>
        set((s) => ({
          enemies: { ...s.enemies, [id]: { ...s.enemies[id], ...patch } },
        })),
      deleteEnemy: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.enemies;
          return { enemies: rest };
        }),

      // ===== AREAS =====
      addArea: (data = {}) => {
        const id = generateId('area');
        const area = {
          name: data.name || 'New Area',
          icon: data.icon || '🗺️',
          totalFragments: data.totalFragments || 3,
          packBaseGoldCost: data.packBaseGoldCost || 100,
          packCostScaling: data.packCostScaling || 1.05,
          cardPool: data.cardPool || [],
          // Diagnostics
          expectedPackValue: null,
          estimatedTimeToPurchase: null,
          ...data,
          id,
        };
        set((s) => ({ areas: { ...s.areas, [id]: area } }));
        return id;
      },
      updateArea: (id, patch) =>
        set((s) => ({
          areas: { ...s.areas, [id]: { ...s.areas[id], ...patch } },
        })),
      deleteArea: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.areas;
          return { areas: rest };
        }),

      // ===== QUESTS =====
      addQuest: (data = {}) => {
        const id = generateId('quest');
        const quest = {
          name: data.name || 'New Quest',
          description: data.description || '',
          targetEvent: data.targetEvent || 'Gain Item',
          targetId: data.targetId || '',
          maxProgress: data.maxProgress || 1,
          mapFragmentTarget: data.mapFragmentTarget || '',
          rewards: data.rewards || [],
          ...data,
          id,
        };
        set((s) => ({ quests: { ...s.quests, [id]: quest } }));
        return id;
      },
      updateQuest: (id, patch) =>
        set((s) => ({
          quests: { ...s.quests, [id]: { ...s.quests[id], ...patch } },
        })),
      deleteQuest: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.quests;
          return { quests: rest };
        }),

      // ===== SUBSKILLS =====
      addSubskill: (data = {}) => {
        const id = generateId('subskill');
        const subskill = {
          name: data.name || 'New Subskill',
          parentSkill: data.parentSkill || 'nature',
          isRecipeSkill: data.isRecipeSkill || false,
          ...data,
          id,
        };
        set((s) => ({ subskills: { ...s.subskills, [id]: subskill } }));
        return id;
      },
      updateSubskill: (id, patch) =>
        set((s) => ({
          subskills: { ...s.subskills, [id]: { ...s.subskills[id], ...patch } },
        })),
      deleteSubskill: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.subskills;
          return { subskills: rest };
        }),

      // ===== EFFECTS =====
      addEffect: (data = {}) => {
        const id = generateId('effect');
        const effect = {
          name: data.name || 'New Effect',
          targetEntityTypes: data.targetEntityTypes || [],
          drainTrigger: data.drainTrigger || 'NONE',
          description: data.description || '',
          ...data,
          id,
        };
        set((s) => ({ effects: { ...s.effects, [id]: effect } }));
        return id;
      },
      updateEffect: (id, patch) =>
        set((s) => ({
          effects: { ...s.effects, [id]: { ...s.effects[id], ...patch } },
        })),
      deleteEffect: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.effects;
          return { effects: rest };
        }),

      // ===== LOOT TABLES =====
      addLootTable: (data = {}) => {
        const id = generateId('lootTable');
        const lootTable = {
          name: data.name || 'New Loot Table',
          description: data.description || '',
          entries: data.entries || [], // { itemId, dropWeight }
          ...data,
          id,
        };
        set((s) => ({ lootTables: { ...s.lootTables, [id]: lootTable } }));
        return id;
      },
      updateLootTable: (id, patch) =>
        set((s) => ({
          lootTables: { ...s.lootTables, [id]: { ...s.lootTables[id], ...patch } },
        })),
      deleteLootTable: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.lootTables;
          return { lootTables: rest };
        }),

      // ===== HYDRATION & MIGRATION =====
      hydrate: (data) => {
        const normalizeOutputs = (entity) => {
          if (!entity) return entity;
          const outArr = entity.outputs || entity.drops || [];
          const normalized = outArr.map(o => ({
            id: o.id || o.itemId,
            type: o.type || 'item',
            dropChance: o.dropChance ?? 100,
            minQty: o.minQty ?? o.quantity ?? 1,
            maxQty: o.maxQty ?? o.quantity ?? 1,
            isLocked: o.isLocked ?? false,
          }));
          if (entity.encounterTableId && entity.encounterChance > 0) {
            normalized.push({
              id: entity.encounterTableId,
              type: 'encounterTable',
              dropChance: entity.encounterChance,
              minQty: 1,
              maxQty: 1,
              isLocked: true, // The user requested to maintain manual control over encounter chances
            });
          }
          
          // Omit legacy encounterProps entirely
          const { encounterChance, encounterTableId, ...rest } = entity;
          
          if (rest.drops) return { ...rest, drops: normalized };
          return { ...rest, outputs: normalized };
        };

        const migrateMap = (recordMap) => Object.fromEntries(
          Object.entries(recordMap || {}).map(([id, entity]) => [id, normalizeOutputs(entity)])
        );

        set(() => ({
          items: data.items || {},
          tasks: migrateMap(data.tasks),
          recipes: migrateMap(data.recipes),
          workstations: data.workstations || {},
          enemies: migrateMap(data.enemies),
          areas: data.areas || {},
          quests: data.quests || {},
          subskills: data.subskills || {},
          effects: (data.effects && Object.keys(data.effects).length > 0) ? data.effects : { ...DEFAULT_EFFECTS },
          lootTables: (data.lootTables && Object.keys(data.lootTables).length > 0) ? data.lootTables : { ...DEFAULT_LOOT_TABLES },
          activeEntityId: null,
        }));
      },

      // ===== Utility Getters =====
      getEntity: (id, type) => {
        const state = get();
        const collection = state[type + 's'] || state[type];
        return collection?.[id] || null;
      },

      getAllEntitiesFlat: () => {
        const s = get();
        return [
          ...Object.values(s.items || {}).map((e) => ({ ...e, _type: 'item' })),
          ...Object.values(s.recipes || {}).map((e) => ({ ...e, _type: 'recipe' })),
          ...Object.values(s.tasks || {}).map((e) => ({ ...e, _type: 'task' })),
          ...Object.values(s.encounters || {}).map((e) => ({ ...e, _type: 'encounter' })),
          ...Object.values(s.workstations || {}).map((e) => ({ ...e, _type: 'workstation' })),
          ...Object.values(s.enemies || {}).map((e) => ({ ...e, _type: 'enemy' })),
          ...Object.values(s.areas || {}).map((e) => ({ ...e, _type: 'area' })),
          ...Object.values(s.quests || {}).map((e) => ({ ...e, _type: 'quest' })),
          ...Object.values(s.subskills || {}).map((e) => ({ ...e, _type: 'subskill' })),
          ...Object.values(s.effects || {}).map((e) => ({ ...e, _type: 'effect' })),
          ...Object.values(s.lootTables || {}).map((e) => ({ ...e, _type: 'lootTable' })),
          ...Object.values(s.encounterTables || {}).map((e) => ({ ...e, _type: 'encounterTable' })),
        ];
      },
    }),
    {
      name: 'fantasy-guild-cms-entities',
    }
  )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId, slugify } from '../utils/idGenerator';

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

const DEFAULT_TAGS = {
  food: { id: 'food', name: 'Food', icon: '🍎', description: 'Enables health restoration value calculations.', autoSyncId: true },
  drink: { id: 'drink', name: 'Drink', icon: '🍺', description: 'Enables energy restoration value calculations.', autoSyncId: true },
  tool: { id: 'tool', name: 'Tool', icon: '🔨', description: 'Designates item as a tool used in tasks.', autoSyncId: true },
  weapon: { id: 'weapon', name: 'Weapon', icon: '⚔️', description: 'Designates item as a weapon with combat stats.', autoSyncId: true },
  armor: { id: 'armor', name: 'Armor', icon: '🛡️', description: 'Designates item as armor with combat stats.', autoSyncId: true },
  treasure: { id: 'treasure', name: 'Treasure', icon: '💎', description: 'Valuable item with resale bonuses.', autoSyncId: true },
  quest: { id: 'quest', name: 'Quest', icon: '📜', description: 'Special item required for quests.', autoSyncId: true }
};

/**
 * Helper function to safely rename an entity ID and propagate it throughout the store
 * to preserve data integrity and prevent broken links.
 */
function performRename(state, oldId, newId, entityType) {
  if (!oldId || !newId || oldId === newId) return {};
  
  const typeToCollection = {
    item: 'items',
    recipe: 'recipes',
    task: 'tasks',
    station: 'stations',
    enemy: 'enemies',
    area: 'areas',
    quest: 'quests',
    subskill: 'subskills',
    effect: 'effects',
    lootTable: 'lootTables',
    encounter: 'encounters',
    encounterTable: 'encounterTables',
    tag: 'tags'
  };
  const collectionName = typeToCollection[entityType];
  if (!collectionName || !state[collectionName]) return {};
  
  if (state[collectionName][newId]) {
    console.warn(`ID collision: ${newId} already exists in ${collectionName}`);
    return {};
  }

  if (!state[collectionName][oldId]) return {};
  
  const collection = {};
  for (const [k, v] of Object.entries(state[collectionName])) {
    if (k === oldId) {
      collection[newId] = { ...v, id: newId };
    } else {
      collection[k] = v;
    }
  }
  
  const updates = { [collectionName]: collection };

  if (state.activeEntityId === oldId && 
      (state.activeEntityType === entityType || 
       state.activeEntityType === collectionName || 
       typeToCollection[state.activeEntityType] === collectionName)) {
    updates.activeEntityId = newId;
  }

  // --- ITEMS (References Tags) ---
  if (entityType === 'tag' && state.items) {
    const newItems = {};
    let itemsChanged = false;
    for (const [itemId, item] of Object.entries(state.items)) {
      if (item.tags && item.tags.includes(oldId)) {
        newItems[itemId] = {
          ...item,
          tags: item.tags.map(t => t === oldId ? newId : t)
        };
        itemsChanged = true;
      }
    }
    if (itemsChanged) {
      updates.items = { ...state.items, ...newItems };
    }
  }

  // --- RECIPES ---
  if (state.recipes) {
    const newRecipes = {};
    let recipesChanged = false;
    for (const [rid, recipe] of Object.entries(state.recipes)) {
      let recipeChanged = false;
      let nextRecipe = { ...recipe };
      
      if (entityType === 'recipe' && rid === oldId) {
        continue;
      }

      if (entityType === 'item' && recipe.inputs) {
        const newInputs = recipe.inputs.map(inp => {
          if ((inp.id || inp.itemId) === oldId) {
            recipeChanged = true;
            return { ...inp, id: newId, itemId: newId };
          }
          return inp;
        });
        if (recipeChanged) nextRecipe.inputs = newInputs;
      }

      if (entityType === 'item' && recipe.outputs) {
        const newOutputs = recipe.outputs.map(out => {
          if ((out.id || out.itemId) === oldId) {
            recipeChanged = true;
            return { ...out, id: newId, itemId: newId };
          }
          return out;
        });
        if (recipeChanged) nextRecipe.outputs = newOutputs;
      }

      if (entityType === 'subskill' && recipe.subskillId === oldId) {
        nextRecipe.subskillId = newId;
        recipeChanged = true;
      }

      newRecipes[rid] = nextRecipe;
      if (recipeChanged) recipesChanged = true;
    }
    if (recipesChanged) {
      updates.recipes = { ...state.recipes, ...newRecipes };
      if (entityType === 'recipe') {
        delete updates.recipes[oldId];
      }
    }
  }

  // --- TASKS ---
  if (state.tasks) {
    const newTasks = {};
    let tasksChanged = false;
    for (const [tid, task] of Object.entries(state.tasks)) {
      let taskChanged = false;
      let nextTask = { ...task };
      
      if (entityType === 'task' && tid === oldId) {
        continue;
      }

      if (entityType === 'item' && task.inputs) {
        const newInputs = task.inputs.map(inp => {
          if ((inp.id || inp.itemId) === oldId) {
            taskChanged = true;
            return { ...inp, id: newId, itemId: newId };
          }
          return inp;
        });
        if (taskChanged) nextTask.inputs = newInputs;
      }

      if (entityType === 'item' && task.outputs) {
        const newOutputs = task.outputs.map(out => {
          if ((out.id || out.itemId) === oldId) {
            taskChanged = true;
            return { ...out, id: newId, itemId: newId };
          }
          return out;
        });
        if (taskChanged) nextTask.outputs = newOutputs;
      }

      if (entityType === 'area' && task.areaId === oldId) {
        nextTask.areaId = newId;
        taskChanged = true;
      }

      if (entityType === 'subskill' && task.subskillId === oldId) {
        nextTask.subskillId = newId;
        taskChanged = true;
      }

      if (entityType === 'enemy' && task.enemyId === oldId) {
        nextTask.enemyId = newId;
        taskChanged = true;
      }

      newTasks[tid] = nextTask;
      if (taskChanged) tasksChanged = true;
    }
    if (tasksChanged) {
      updates.tasks = { ...state.tasks, ...newTasks };
      if (entityType === 'task') {
        delete updates.tasks[oldId];
      }
    }
  }

  // --- STATIONS ---
  if (state.stations) {
    const newStations = {};
    let stationsChanged = false;
    for (const [wid, station] of Object.entries(state.stations)) {
      let stChanged = false;
      let nextSt = { ...station };

      if (entityType === 'station' && wid === oldId) {
        continue;
      }

      if (entityType === 'area' && station.areaId === oldId) {
        nextSt.areaId = newId;
        stChanged = true;
      }

      if (entityType === 'subskill' && station.subskillId === oldId) {
        nextSt.subskillId = newId;
        stChanged = true;
      }

      newStations[wid] = nextSt;
      if (stChanged) stationsChanged = true;
    }
    if (stationsChanged) {
      updates.stations = { ...state.stations, ...newStations };
      if (entityType === 'station') {
        delete updates.stations[oldId];
      }
    }
  }

  // --- ENEMIES ---
  if (state.enemies) {
    const newEnemies = {};
    let enemiesChanged = false;
    for (const [eid, enemy] of Object.entries(state.enemies)) {
      let enemyChanged = false;
      let nextEnemy = { ...enemy };

      if (entityType === 'enemy' && eid === oldId) {
        continue;
      }

      if (entityType === 'area' && enemy.areaId === oldId) {
        nextEnemy.areaId = newId;
        enemyChanged = true;
      }

      newEnemies[eid] = nextEnemy;
      if (enemyChanged) enemiesChanged = true;
    }
    if (enemiesChanged) {
      updates.enemies = { ...state.enemies, ...newEnemies };
      if (entityType === 'enemy') {
        delete updates.enemies[oldId];
      }
    }
  }

  // --- QUESTS ---
  if (state.quests) {
    const newQuests = {};
    let questsChanged = false;
    for (const [qid, quest] of Object.entries(state.quests)) {
      let questChanged = false;
      let nextQuest = { ...quest };

      if (entityType === 'quest' && qid === oldId) {
        continue;
      }

      if ((entityType === 'item' || entityType === 'enemy') && quest.targetId === oldId) {
        nextQuest.targetId = newId;
        questChanged = true;
      }

      if (entityType === 'area' && quest.mapFragmentTarget === oldId) {
        nextQuest.mapFragmentTarget = newId;
        questChanged = true;
      }

      if (entityType === 'item' && quest.rewards) {
        const newRewards = quest.rewards.map(rew => {
          if (rew.type === 'item' && rew.itemId === oldId) {
            questChanged = true;
            return { ...rew, itemId: newId };
          }
          return rew;
            });
            if (questChanged) nextQuest.rewards = newRewards;
          }

          newQuests[qid] = nextQuest;
          if (questChanged) questsChanged = true;
        }
        if (questsChanged) {
          updates.quests = { ...state.quests, ...newQuests };
          if (entityType === 'quest') {
            delete updates.quests[oldId];
          }
        }
      }

  // --- AREAS (References parentAreaId) ---
  if (entityType === 'area' && state.areas) {
    const newAreas = {};
    let areasChanged = false;
    for (const [areaId, area] of Object.entries(state.areas)) {
      if (area.parentAreaId === oldId) {
        newAreas[areaId] = {
          ...area,
          parentAreaId: newId
        };
        areasChanged = true;
      }
    }
    if (areasChanged) {
      updates.areas = { ...state.areas, ...newAreas };
    }
  }

  return updates;
}

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
      stations: {},
      enemies: {},
      areas: {},
      quests: {},
      subskills: {},
      tags: { ...DEFAULT_TAGS },
      effects: { ...DEFAULT_EFFECTS },
      lootTables: { ...DEFAULT_LOOT_TABLES },
      encounters: {},
      encounterTables: {},
      // ===== Active Selection =====
      activeEntityId: null,
      activeEntityType: null,

      setActiveEntity: (id, type) => set({ activeEntityId: id, activeEntityType: type }),
      clearActiveEntity: () => set({ activeEntityId: null, activeEntityType: null }),

      renameEntityId: (oldId, newId, entityType) => {
        if (!oldId || !newId || oldId === newId) return false;
        const state = get();
        const updates = performRename(state, oldId, newId, entityType);
        if (Object.keys(updates).length === 0) return false;
        set(updates);
        return true;
      },

      migrateAllEntityIds: () => {
        try {
          const state = get();
          let updatedState = { ...state };
          
          const collectionsToMigrate = [
            { name: 'items', prefix: 'item' },
            { name: 'recipes', prefix: 'recipe' },
            { name: 'tasks', prefix: 'task' },
            { name: 'stations', prefix: 'station' },
            { name: 'enemies', prefix: 'enemy' },
            { name: 'areas', prefix: 'area' },
            { name: 'quests', prefix: 'quest' },
            { name: 'subskills', prefix: 'subskill' }
          ];

          for (const colInfo of collectionsToMigrate) {
            const collection = state[colInfo.name];
            if (!collection) continue;

            for (const [oldId, entity] of Object.entries(collection)) {
              if (!entity) continue;
              const desiredId = slugify(entity.name || '', colInfo.prefix);
              if (desiredId && oldId !== desiredId) {
                let finalId = desiredId;
                let counter = 1;
                while (updatedState[colInfo.name] && Object.prototype.hasOwnProperty.call(updatedState[colInfo.name], finalId)) {
                  counter++;
                  finalId = `${desiredId}_${counter}`;
                }
                
                if (updatedState[colInfo.name] && updatedState[colInfo.name][oldId]) {
                  updatedState[colInfo.name][oldId] = {
                    ...updatedState[colInfo.name][oldId],
                    autoSyncId: true
                  };
                }
                const renameUpdates = performRename(updatedState, oldId, finalId, colInfo.prefix);
                updatedState = { ...updatedState, ...renameUpdates };
              } else {
                if (updatedState[colInfo.name] && updatedState[colInfo.name][oldId]) {
                  updatedState[colInfo.name][oldId] = {
                    ...updatedState[colInfo.name][oldId],
                    autoSyncId: true
                  };
                }
              }
            }
          }

          set(updatedState);
        } catch (err) {
          console.error("Critical error in migrateAllEntityIds:", err);
          alert("Error during ID migration: " + err.message);
        }
      },

      // ===== TAGS =====
      addTag: (data = {}) => {
        const baseName = data.name || 'New Tag';
        const initialSlug = slugify(baseName, 'tag');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.tags && state.tags[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const tag = {
          name: baseName,
          icon: data.icon || '🏷️',
          description: data.description || '',
          autoSyncId: data.autoSyncId ?? true,
          ...data,
          id: finalId,
        };
        set((s) => ({ tags: { ...s.tags, [finalId]: tag } }));
        return finalId;
      },
      updateTag: (id, patch) =>
        set((s) => {
          const current = s.tags[id] || {};
          const next = { ...current, ...patch };

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'tag');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.tags[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename(s, id, finalId, 'tag');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.tags && stateUpdates.tags[finalId]) {
                stateUpdates.tags[finalId] = { ...stateUpdates.tags[finalId], name: patch.name };
              }
              stateUpdates.activeEntityId = finalId;
            }
          }
          
          const baseTagUpdate = stateUpdates.tags 
            ? { ...stateUpdates.tags } 
            : { ...s.tags, [id]: next };

          return {
            ...stateUpdates,
            tags: baseTagUpdate
          };
        }),
      deleteTag: (id) =>
        set((s) => {
          const { [id]: _discard, ...rest } = s.tags;
          const cleanedItems = {};
          let itemsChanged = false;
          for (const [itemId, item] of Object.entries(s.items)) {
            if (item.tags && item.tags.includes(id)) {
              cleanedItems[itemId] = {
                ...item,
                tags: item.tags.filter(t => t !== id)
              };
              itemsChanged = true;
            }
          }
          const updates = { tags: rest };
          if (itemsChanged) {
            updates.items = { ...s.items, ...cleanedItems };
          }
          return updates;
        }),

      // ===== ITEMS =====
      addItem: (data = {}) => {
        const baseName = data.name || 'New Item';
        const initialSlug = slugify(baseName, 'item');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.items[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const price = data.trueCost !== undefined ? data.trueCost : (data.sellPrice !== undefined ? data.sellPrice : 0);
        const item = {
          name: baseName,
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
          isRoot: data.isRoot ?? false,
          valueScale: data.valueScale ?? 1.0,
          autoSyncId: data.autoSyncId ?? true,
          trueCost: price,
          sellPrice: price,
          valueProfile: data.valueProfile || { hp: 0.0, energy: 0.0, sellValue: 1.0 },
          assignedEffect: data.assignedEffect || null,
          sprite: data.sprite || '',
          ...data,
          id: finalId,
        };
        item.trueCost = price;
        item.sellPrice = price;
        set((s) => ({ items: { ...s.items, [finalId]: item } }));
        return finalId;
      },
      updateItem: (id, patch) =>
        set((s) => {
          const current = s.items[id] || {};
          const next = { ...current, ...patch };
          
          if ('trueCost' in patch || 'sellPrice' in patch) {
            const price = patch.trueCost !== undefined ? patch.trueCost : patch.sellPrice;
            next.trueCost = price;
            next.sellPrice = price;
          }

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'item');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.items[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename(s, id, finalId, 'item');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.items && stateUpdates.items[finalId]) {
                stateUpdates.items[finalId] = { ...stateUpdates.items[finalId], name: patch.name };
              }
              stateUpdates.activeEntityId = finalId;
            }
          }
          
          const baseItemUpdate = stateUpdates.items 
            ? { ...stateUpdates.items } 
            : { ...s.items, [id]: next };

          return {
            ...stateUpdates,
            items: baseItemUpdate
          };
        }),
      deleteItem: (id) =>
        set((s) => {
          const { [id]: _discard, ...rest } = s.items;
          return { items: rest };
        }),

      // ===== RECIPES =====
      addRecipe: (data = {}) => {
        const baseName = data.name || 'New Recipe';
        const initialSlug = slugify(baseName, 'recipe');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.recipes && state.recipes[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const recipe = {
          name: baseName,
          skill: data.skill || 'industry',
          subskillId: data.subskillId || '',
          skillRequirement: data.skillRequirement || data.levelRequirement || 1,
          baseTickTime: data.baseTickTime || 10000,
          energyCost: data.energyCost || 1,
          inputs: data.inputs || [],
          outputs: (data.outputs || []).map(o => ({ 
            id: o.id || o.itemId, 
            type: o.type || 'item', 
            dropChance: o.dropChance ?? 100, 
            minQty: o.minQty ?? o.quantity ?? 1, 
            maxQty: o.maxQty ?? o.quantity ?? 1, 
            isLocked: o.isLocked ?? false,
            isPrimarySource: o.isPrimarySource ?? o.isPrimaryOutput ?? false
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
          autoSyncId: data.autoSyncId ?? true,
          // Diagnostics
          calculatedEV: null,
          goldPerMinute: null,
          xpPerMinute: null,
          ...data,
          id: finalId,
        };
        recipe.levelRequirement = recipe.skillRequirement;
        set((s) => ({ recipes: { ...s.recipes, [finalId]: recipe } }));
        return finalId;
      },
      updateRecipe: (id, patch) =>
        set((s) => {
          const current = s.recipes[id] || {};
          const next = { ...current, ...patch };
          if ('skillRequirement' in patch) {
            next.levelRequirement = patch.skillRequirement;
          } else if ('levelRequirement' in patch) {
            next.skillRequirement = patch.levelRequirement;
          }

          let extraSet = {};
          if (patch.outputs) {
            next.outputs = patch.outputs.map(o => ({
              ...o,
              isPrimarySource: o.isPrimarySource ?? o.isPrimaryOutput ?? false
            }));

            const newPrimaryItems = next.outputs
              .filter(o => o.isPrimarySource)
              .map(o => o.id || o.itemId);

            if (newPrimaryItems.length > 0) {
              const updatedRecipes = { ...s.recipes };
              const updatedTasks = { ...s.tasks };
              let changed = false;

              for (const targetItemId of newPrimaryItems) {
                for (const [rid, rec] of Object.entries(updatedRecipes)) {
                  if (rid === id) continue;
                  if (rec.outputs && rec.outputs.some(o => (o.id || o.itemId) === targetItemId && o.isPrimarySource)) {
                    updatedRecipes[rid] = {
                      ...rec,
                      outputs: rec.outputs.map(o => (o.id || o.itemId) === targetItemId ? { ...o, isPrimarySource: false } : o)
                    };
                    changed = true;
                  }
                }
                for (const [tid, tsk] of Object.entries(updatedTasks)) {
                  if (tsk.outputs && tsk.outputs.some(o => (o.id || o.itemId) === targetItemId && o.isPrimarySource)) {
                    updatedTasks[tid] = {
                      ...tsk,
                      outputs: tsk.outputs.map(o => (o.id || o.itemId) === targetItemId ? { ...o, isPrimarySource: false } : o)
                    };
                    changed = true;
                  }
                }
              }

              if (changed) {
                extraSet = { recipes: updatedRecipes, tasks: updatedTasks };
              }
            }
          }

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'recipe');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.recipes[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename({ ...s, ...extraSet }, id, finalId, 'recipe');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.recipes && stateUpdates.recipes[finalId]) {
                stateUpdates.recipes[finalId] = { ...stateUpdates.recipes[finalId], name: patch.name };
              }
              stateUpdates.activeEntityId = finalId;
            }
          }

          const baseRecipeUpdate = stateUpdates.recipes 
            ? { ...stateUpdates.recipes } 
            : { ...s.recipes, ...extraSet.recipes, [id]: next };

          return {
            ...extraSet,
            ...stateUpdates,
            recipes: baseRecipeUpdate
          };
        }),
      deleteRecipe: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.recipes;
          return { recipes: rest };
        }),

      // ===== TASKS =====
      addTask: (data = {}) => {
        const baseName = data.name || 'New Task';
        const initialSlug = slugify(baseName, 'task');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.tasks && state.tasks[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const task = {
          name: baseName,
          areaId: data.areaId || '',
          baseTickTime: data.baseTickTime || 10000,
          skillRequirement: data.skillRequirement || 1,
          skill: data.skill || 'nature',
          subskillId: data.subskillId || data.subskill || '',
          energyCost: data.energyCost || 1,
          targetEV: data.targetEV || 1.05,
          inputs: data.inputs || [],
          outputs: (data.outputs || []).map(o => ({ 
            id: o.id || o.itemId, 
            type: o.type || 'item', 
            dropChance: o.dropChance ?? 100, 
            minQty: o.minQty ?? o.quantity ?? 1, 
            maxQty: o.maxQty ?? o.quantity ?? 1, 
            isLocked: o.isLocked ?? false,
            isPrimarySource: o.isPrimarySource ?? o.isPrimaryOutput ?? false
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
          autoSyncId: data.autoSyncId ?? true,
          // Diagnostics
          calculatedEV: null,
          goldPerMinute: null,
          xpPerMinute: null,
          prescribedXP: null,
          ...data,
          id: finalId,
        };
        task.subskill = task.subskillId;
        set((s) => ({ tasks: { ...s.tasks, [finalId]: task } }));
        return finalId;
      },
      updateTask: (id, patch) =>
        set((s) => {
          const current = s.tasks[id] || {};
          const next = { ...current, ...patch };
          if ('subskillId' in patch) {
            next.subskill = patch.subskillId;
          } else if ('subskill' in patch) {
            next.subskillId = patch.subskill;
          }

          let extraSet = {};
          if (patch.outputs) {
            next.outputs = patch.outputs.map(o => ({
              ...o,
              isPrimarySource: o.isPrimarySource ?? o.isPrimaryOutput ?? false
            }));

            const newPrimaryItems = next.outputs
              .filter(o => o.isPrimarySource)
              .map(o => o.id || o.itemId);

            if (newPrimaryItems.length > 0) {
              const updatedRecipes = { ...s.recipes };
              const updatedTasks = { ...s.tasks };
              let changed = false;

              for (const targetItemId of newPrimaryItems) {
                for (const [rid, rec] of Object.entries(updatedRecipes)) {
                  if (rec.outputs && rec.outputs.some(o => (o.id || o.itemId) === targetItemId && o.isPrimarySource)) {
                    updatedRecipes[rid] = {
                      ...rec,
                      outputs: rec.outputs.map(o => (o.id || o.itemId) === targetItemId ? { ...o, isPrimarySource: false } : o)
                    };
                    changed = true;
                  }
                }
                for (const [tid, tsk] of Object.entries(updatedTasks)) {
                  if (tid === id) continue;
                  if (tsk.outputs && tsk.outputs.some(o => (o.id || o.itemId) === targetItemId && o.isPrimarySource)) {
                    updatedTasks[tid] = {
                      ...tsk,
                      outputs: tsk.outputs.map(o => (o.id || o.itemId) === targetItemId ? { ...o, isPrimarySource: false } : o)
                    };
                    changed = true;
                  }
                }
              }

              if (changed) {
                extraSet = { recipes: updatedRecipes, tasks: updatedTasks };
              }
            }
          }

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'task');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.tasks[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename({ ...s, ...extraSet }, id, finalId, 'task');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.tasks && stateUpdates.tasks[finalId]) {
                stateUpdates.tasks[finalId] = { ...stateUpdates.tasks[finalId], name: patch.name };
              }
              stateUpdates.activeEntityId = finalId;
            }
          }

          const baseTaskUpdate = stateUpdates.tasks 
            ? { ...stateUpdates.tasks } 
            : { ...s.tasks, ...extraSet.tasks, [id]: next };

          return {
            ...extraSet,
            ...stateUpdates,
            tasks: baseTaskUpdate
          };
        }),
      deleteTask: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.tasks;
          return { tasks: rest };
        }),

      // ===== STATIONS =====
      addStation: (data = {}) => {
        const id = generateId('station');
        const station = {
          name: data.name || 'New Station',
          areaId: data.areaId || '',
          subskillId: data.subskillId || '',
          skillCap: data.skillCap || 10,
          hasCraftingQueue: data.hasCraftingQueue ?? true,
          passiveBuff: data.passiveBuff || null,
          ...data,
          id,
        };
        set((s) => ({ stations: { ...s.stations, [id]: station } }));
        return id;
      },
      updateStation: (id, patch) =>
        set((s) => ({
          stations: { ...s.stations, [id]: { ...s.stations[id], ...patch } },
        })),
      deleteStation: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.stations;
          return { stations: rest };
        }),

      // ===== ENEMIES =====
      addEnemy: (data = {}) => {
        const baseName = data.name || 'New Enemy';
        const initialSlug = slugify(baseName, 'enemy');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.enemies && state.enemies[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const enemy = {
          name: baseName,
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
          sprite: data.sprite || '',
          autoSyncId: data.autoSyncId ?? true,
          // Diagnostics
          calculatedEV: null,
          expectedDamageTaken: null,
          timeToKill: null,
          ...data,
          id: finalId,
        };
        set((s) => ({ enemies: { ...s.enemies, [finalId]: enemy } }));
        return finalId;
      },
      updateEnemy: (id, patch) =>
        set((s) => {
          const current = s.enemies[id] || {};
          const next = { ...current, ...patch };

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'enemy');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.enemies[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename(s, id, finalId, 'enemy');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.enemies && stateUpdates.enemies[finalId]) {
                stateUpdates.enemies[finalId] = { ...stateUpdates.enemies[finalId], name: patch.name };
              }
              stateUpdates.activeEntityId = finalId;
            }
          }
          
          const baseEnemyUpdate = stateUpdates.enemies 
            ? { ...stateUpdates.enemies } 
            : { ...s.enemies, [id]: next };

          return {
            ...stateUpdates,
            enemies: baseEnemyUpdate
          };
        }),
      deleteEnemy: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.enemies;
          return { enemies: rest };
        }),

      // ===== AREAS =====
      addArea: (data = {}) => {
        const baseName = data.name || 'New Area';
        const initialSlug = slugify(baseName, 'area');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.areas && state.areas[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const area = {
          name: baseName,
          icon: data.icon || '🗺️',
          totalFragments: data.totalFragments || 3,
          packBaseGoldCost: data.packBaseGoldCost || 100,
          packCostScaling: data.packCostScaling || 1.05,
          cardPool: data.cardPool || [],
          sprite: data.sprite || '',
          questBackground: data.questBackground || '',
          invasionBackground: data.invasionBackground || '',
          autoSyncId: data.autoSyncId ?? true,
          parentAreaId: data.parentAreaId || '',
          // Diagnostics
          expectedPackValue: null,
          estimatedTimeToPurchase: null,
          ...data,
          id: finalId,
        };
        set((s) => ({ areas: { ...s.areas, [finalId]: area } }));
        return finalId;
      },
      updateArea: (id, patch) =>
        set((s) => {
          const current = s.areas[id] || {};
          const next = { ...current, ...patch };

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'area');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.areas[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename(s, id, finalId, 'area');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.areas && stateUpdates.areas[finalId]) {
                stateUpdates.areas[finalId] = { ...stateUpdates.areas[finalId], name: patch.name };
              }
              stateUpdates.activeEntityId = finalId;
            }
          }
          
          const baseAreaUpdate = stateUpdates.areas 
            ? { ...stateUpdates.areas } 
            : { ...s.areas, [id]: next };

          return {
            ...stateUpdates,
            areas: baseAreaUpdate
          };
        }),
      deleteArea: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.areas;
          return { areas: rest };
        }),

      // ===== QUESTS =====
      addQuest: (data = {}) => {
        const baseName = data.name || 'New Quest';
        const initialSlug = slugify(baseName, 'quest');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.quests && state.quests[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const quest = {
          name: baseName,
          description: data.description || '',
          targetEvent: data.targetEvent || 'Gain Item',
          targetId: data.targetId || '',
          maxProgress: data.maxProgress || 1,
          mapFragmentTarget: data.mapFragmentTarget || '',
          rewards: data.rewards || [],
          autoSyncId: data.autoSyncId ?? true,
          createdAt: data.createdAt || (Date.now() + Math.random()),
          ...data,
          id: finalId,
        };
        set((s) => ({ quests: { ...s.quests, [finalId]: quest } }));
        return finalId;
      },
      updateQuest: (id, patch) =>
        set((s) => {
          const current = s.quests[id] || {};
          const next = { ...current, ...patch };

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'quest');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.quests[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename(s, id, finalId, 'quest');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.quests && stateUpdates.quests[finalId]) {
                stateUpdates.quests[finalId] = { ...stateUpdates.quests[finalId], name: patch.name };
              }
              if (s.activeEntityType === 'quest') {
                stateUpdates.activeEntityId = finalId;
              }
            }
          }
          
          const baseQuestUpdate = stateUpdates.quests 
            ? { ...stateUpdates.quests } 
            : { ...s.quests, [id]: next };

          return {
            ...stateUpdates,
            quests: baseQuestUpdate
          };
        }),
      deleteQuest: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.quests;
          return { quests: rest };
        }),

      // ===== SUBSKILLS =====
      addSubskill: (data = {}) => {
        const baseName = data.name || 'New Subskill';
        const initialSlug = slugify(baseName, 'subskill');
        const state = get();
        
        let finalId = initialSlug;
        let counter = 1;
        while (state.subskills && state.subskills[finalId]) {
          counter++;
          finalId = `${initialSlug}_${counter}`;
        }

        const subskill = {
          name: baseName,
          parentSkill: data.parentSkill || 'nature',
          isRecipeSkill: data.isRecipeSkill || false,
          autoSyncId: data.autoSyncId ?? true,
          ...data,
          id: finalId,
        };
        set((s) => ({ subskills: { ...s.subskills, [finalId]: subskill } }));
        return finalId;
      },
      updateSubskill: (id, patch) =>
        set((s) => {
          const current = s.subskills[id] || {};
          const next = { ...current, ...patch };

          let stateUpdates = {};
          if ('name' in patch && next.autoSyncId) {
            const desiredId = slugify(patch.name, 'subskill');
            if (desiredId && desiredId !== id) {
              let finalId = desiredId;
              let counter = 1;
              while (s.subskills[finalId] && finalId !== id) {
                counter++;
                finalId = `${desiredId}_${counter}`;
              }
              const propagateUpdates = performRename(s, id, finalId, 'subskill');
              stateUpdates = propagateUpdates;
              
              if (stateUpdates.subskills && stateUpdates.subskills[finalId]) {
                stateUpdates.subskills[finalId] = { ...stateUpdates.subskills[finalId], name: patch.name };
              }
              stateUpdates.activeEntityId = finalId;
            }
          }
          
          const baseSubskillUpdate = stateUpdates.subskills 
            ? { ...stateUpdates.subskills } 
            : { ...s.subskills, [id]: next };

          return {
            ...stateUpdates,
            subskills: baseSubskillUpdate
          };
        }),
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

      // ===== ENCOUNTERS =====
      addEncounter: (data = {}) => {
        const id = generateId('encounter');
        const encounter = {
          name: data.name || 'New Encounter',
          areaId: data.areaId || '',
          assignedEnemies: data.assignedEnemies || [], // { enemyId, spawnChance }
          // Diagnostics
          calculatedEV: null,
          goldPerMinute: null,
          xpPerMinute: null,
          ...data,
          id,
        };
        set((s) => ({ encounters: { ...(s.encounters || {}), [id]: encounter } }));
        return id;
      },
      updateEncounter: (id, patch) =>
        set((s) => ({
          encounters: { ...(s.encounters || {}), [id]: { ...(s.encounters?.[id] || {}), ...patch } },
        })),
      deleteEncounter: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.encounters || {};
          return { encounters: rest };
        }),

      // ===== ENCOUNTER TABLES =====
      addEncounterTable: (data = {}) => {
        const id = generateId('encounterTable');
        const encounterTable = {
          name: data.name || 'New Encounter Table',
          description: data.description || '',
          entries: data.entries || [], // { encounterId, dropWeight }
          ...data,
          id,
        };
        set((s) => ({ encounterTables: { ...(s.encounterTables || {}), [id]: encounterTable } }));
        return id;
      },
      updateEncounterTable: (id, patch) =>
        set((s) => ({
          encounterTables: { ...(s.encounterTables || {}), [id]: { ...(s.encounterTables?.[id] || {}), ...patch } },
        })),
      deleteEncounterTable: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.encounterTables || {};
          return { encounterTables: rest };
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
            isPrimarySource: o.isPrimarySource ?? o.isPrimaryOutput ?? false,
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

        // Migrate recipes & tasks schema structures (option 1: Dual Schema Unification)
        const migratedRecipes = Object.fromEntries(
          Object.entries(data.recipes || {}).map(([id, rec]) => {
            const normalized = normalizeOutputs(rec);
            const skillRequirement = normalized.skillRequirement || normalized.levelRequirement || 1;
            const subskillId = normalized.subskillId || '';
            // Auto-resolve parent skill from subskills catalog if not set
            let parentSkill = normalized.skill || 'industry';
            if (data.subskills && subskillId && data.subskills[subskillId]) {
              parentSkill = data.subskills[subskillId].parentSkill || parentSkill;
            }
            return [id, {
              ...normalized,
              skillRequirement,
              levelRequirement: skillRequirement,
              subskillId,
              skill: parentSkill,
            }];
          })
        );

        const migratedTasks = Object.fromEntries(
          Object.entries(data.tasks || {}).map(([id, tsk]) => {
            const normalized = normalizeOutputs(tsk);
            const subskillId = normalized.subskillId || normalized.subskill || '';
            return [id, {
              ...normalized,
              subskillId,
              subskill: subskillId,
            }];
          })
        );

        const normalizedItems = Object.fromEntries(
          Object.entries(data.items || {}).map(([id, item]) => {
            const price = item.trueCost !== undefined ? item.trueCost : (item.sellPrice !== undefined ? item.sellPrice : 0);
            return [id, { ...item, trueCost: price, sellPrice: price, valueScale: item.valueScale ?? 1.0 }];
          })
        );

        set(() => ({
          items: normalizedItems,
          tasks: migratedTasks,
          recipes: migratedRecipes,
          // Accept both keys so pre-rename workspace backups still load
          stations: data.stations || data.workstations || {},
          enemies: migrateMap(data.enemies),
          areas: data.areas || {},
          quests: data.quests || {},
          subskills: data.subskills || {},
          effects: (data.effects && Object.keys(data.effects).length > 0) ? data.effects : { ...DEFAULT_EFFECTS },
          lootTables: (data.lootTables && Object.keys(data.lootTables).length > 0) ? data.lootTables : { ...DEFAULT_LOOT_TABLES },
          encounters: data.encounters || {},
          encounterTables: data.encounterTables || {},
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
          ...Object.values(s.stations || {}).map((e) => ({ ...e, _type: 'station' })),
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
      // v2 (Phase 4 rename): the 'workstations' collection became 'stations'.
      // Migrate persisted localStorage drafts so no authored data is lost.
      version: 2,
      migrate: (persistedState) => {
        if (persistedState && persistedState.workstations && !persistedState.stations) {
          persistedState.stations = persistedState.workstations;
          delete persistedState.workstations;
        }
        if (persistedState && persistedState.activeEntityType === 'workstation') {
          persistedState.activeEntityType = 'station';
        }
        return persistedState;
      },
    }
  )
);
